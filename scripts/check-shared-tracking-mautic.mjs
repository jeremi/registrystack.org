// Optional native acceptance against fresh official Mautic 7.2.1 and MySQL 8.4.13 containers.
// The PHP fixture rejects non-loopback origins and any enabled mail transport.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brokerPath = join(root, 'src/lib/tracking-broker.mjs');
const clientPath = join(root, 'src/lib/shared-tracking-client.mjs');
const protocolPath = join(root, 'src/lib/tracking-protocol.mjs');
await Promise.all([access(brokerPath), access(clientPath), access(protocolPath)]);

const mauticContainer = process.env.MAUTIC_TEST_CONTAINER;
const mysqlContainer = process.env.MAUTIC_TEST_MYSQL_CONTAINER;
const mauticUrl = new URL(process.env.MAUTIC_TEST_URL ?? 'http://invalid');
for (const [name, value] of [['MAUTIC_TEST_CONTAINER', mauticContainer], ['MAUTIC_TEST_MYSQL_CONTAINER', mysqlContainer]]) {
  assert.match(value ?? '', /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/, `Set ${name} to a fresh disposable container.`);
}
assert.equal(mauticUrl.hostname, '127.0.0.1', 'MAUTIC_TEST_URL must use loopback.');
assert.equal(mauticUrl.protocol, 'http:', 'The isolated upstream Mautic container must use loopback HTTP.');
assert.equal(mauticUrl.pathname, '/', 'MAUTIC_TEST_URL must be an origin.');

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8', timeout: 45_000, maxBuffer: 8 * 1024 * 1024, ...options,
  });
  assert.equal(result.status, 0, `Disposable Docker fixture command failed: docker ${args.slice(0, 2).join(' ')}`);
  return result.stdout;
}

const mauticImage = docker(['inspect', '--format', '{{.Config.Image}}', mauticContainer]).trim();
const mysqlImage = docker(['inspect', '--format', '{{.Config.Image}}', mysqlContainer]).trim();
assert.match(mauticImage, /^mautic\/mautic:7\.2\.1-apache(?:@sha256:[0-9a-f]{64})?$/);
assert.match(mysqlImage, /^mysql:8\.4\.13(?:@sha256:[0-9a-f]{64})?$/);

const fixture = await readFile(join(root, 'tests/fixtures/mautic-shared-tracking.php'), 'utf8');
function runFixture({ includeStats = false, mauticSiteUrl, websiteOrigins } = {}) {
  const args = ['exec', '-i', '--user', 'www-data', '--workdir', '/var/www/html'];
  if (includeStats) args.push('-e', 'SHARED_FIXTURE_STATS=1');
  if (mauticSiteUrl) args.push('-e', `SHARED_FIXTURE_MAUTIC_URL=${mauticSiteUrl}`);
  if (websiteOrigins) args.push('-e', `SHARED_FIXTURE_WEBSITE_ORIGINS=${JSON.stringify(websiteOrigins)}`);
  args.push(mauticContainer, 'php');
  const result = spawnSync('docker', args, { input: fixture, encoding: 'utf8', timeout: 45_000 });
  assert.equal(result.status, 0, 'Local Mautic shared-tracking fixture failed.');
  return JSON.parse(result.stdout);
}
const stats = () => runFixture({ includeStats: true });
async function waitForStats(predicate, message) {
  let snapshot;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    snapshot = stats();
    if (predicate(snapshot)) return snapshot;
    await delay(250);
  }
  assert.fail(message);
}
function clearMauticCache() {
  docker(['exec', '--user', 'www-data', '--workdir', '/var/www/html', mauticContainer,
    'php', 'bin/console', 'cache:clear', '--env=prod', '--no-interaction']);
}
function queueCount(queue) {
  const output = docker(['exec', '--user', 'www-data', '--workdir', '/var/www/html', mauticContainer,
    'php', 'bin/console', 'messenger:stats', '--format=json', '--env=prod', '--no-interaction']);
  const start = output.indexOf('{');
  assert.ok(start >= 0, 'Local Mautic queue statistics were malformed.');
  return Number(JSON.parse(output.slice(start)).transports?.[queue]?.count ?? 0);
}
async function waitForQueue(queue, expected) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (queueCount(queue) === expected) return;
    await delay(250);
  }
  assert.fail(`The isolated Mautic ${queue} queue did not reach ${expected} message(s).`);
}
function consumeHits() {
  docker(['exec', '--user', 'www-data', '--workdir', '/var/www/html', mauticContainer,
    'php', 'bin/console', 'messenger:consume', 'hit', '--time-limit=3', '--memory-limit=256M',
    '--no-interaction', '-vv'], { timeout: 35_000 });
  assert.equal(queueCount('hit'), 0, 'The isolated hit worker did not empty the queue.');
}
async function requestBody(request, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    assert.ok(size <= limit, 'Tracking proxy request exceeded its local limit.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

const scratchBase = process.env.SHARED_TRACKING_TEST_SCRATCH ?? tmpdir();
await mkdir(scratchBase, { recursive: true });
const scratch = await mkdtemp(join(scratchBase, 'registrystack-shared-tracking-mautic-'));
const openssl = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(scratch, 'test.key'),
  '-out', join(scratch, 'test.crt'), '-days', '1', '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
], { encoding: 'utf8' });
assert.equal(openssl.status, 0, 'Could not create a disposable local TLS certificate.');
const tls = {
  key: await readFile(join(scratch, 'test.key')),
  cert: await readFile(join(scratch, 'test.crt')),
};

let mainOrigin;
let docsOrigin;
let publicMauticOrigin;
const modules = new Map([
  ['/modules/tracking-broker.mjs', brokerPath],
  ['/modules/shared-tracking-client.mjs', clientPath],
  ['/modules/tracking-protocol.mjs', protocolPath],
]);
function parentHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Shared tracking acceptance parent</title></head>
<body><main>Shared tracking acceptance parent</main>
<script type="module">
import { buildMauticPageview, createSharedTrackingClient } from '/modules/shared-tracking-client.mjs';
const client = createSharedTrackingClient({ bridgeUrl: ${JSON.stringify(`${mainOrigin}/tracking-bridge/`)}, timeoutMs: 8000 });
globalThis.acceptance = {
  read: () => client.read(),
  choose: choice => client.choose(choice),
  pageview: input => client.pageview(buildMauticPageview(input)),
  associate: generation => client.associate(generation, { timeoutMs: 8000 }),
  state: () => client.state,
  close: () => client.close(),
};
</script></body></html>`;
}
function bridgeHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Tracking bridge</title></head>
<body><script type="module">
import { createTrackingBroker } from '/modules/tracking-broker.mjs';
globalThis.acceptanceBroker = createTrackingBroker({
  mauticUrl: ${JSON.stringify(publicMauticOrigin)},
  allowedOrigins: ${JSON.stringify([mainOrigin, docsOrigin])},
  associationOrigin: ${JSON.stringify(mainOrigin)},
  bootstrapTimeoutMs: 6000,
});
</script></body></html>`;
}
function createParentServer({ bridge = false } = {}) {
  return createHttpsServer(tls, async (request, response) => {
    try {
      const path = new URL(request.url, 'https://127.0.0.1').pathname;
      if (path === '/' || path === '/parent/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(parentHtml());
        return;
      }
      if (bridge && path === '/tracking-bridge/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(bridgeHtml());
        return;
      }
      const modulePath = modules.get(path);
      if (modulePath) {
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(await readFile(modulePath));
        return;
      }
      response.writeHead(404).end();
    } catch {
      response.writeHead(500, { 'content-type': 'text/plain' }).end('Local fixture failed.');
    }
  });
}
const mainServer = createParentServer({ bridge: true });
const docsServer = createParentServer();
await Promise.all([
  new Promise(resolveListen => mainServer.listen(0, '127.0.0.1', resolveListen)),
  new Promise(resolveListen => docsServer.listen(0, '127.0.0.1', resolveListen)),
]);
mainOrigin = `https://127.0.0.1:${mainServer.address().port}`;
docsOrigin = `https://localhost:${docsServer.address().port}`;

const trackingRequests = [];
const trackingProxy = createHttpsServer(tls, async (request, response) => {
  try {
    const incoming = new URL(request.url, 'https://127.0.0.1');
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await requestBody(request);
    const recorded = {
      method: request.method,
      pathname: incoming.pathname,
      search: incoming.search,
      body: body?.toString('utf8') ?? '',
      browserSentCookie: Boolean(request.headers.cookie),
      status: null,
    };
    trackingRequests.push(recorded);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined || ['cookie', 'content-length'].includes(name)) continue;
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
    }
    recorded.forwardedCookie = headers.has('cookie');
    headers.set('x-forwarded-proto', 'https');
    if (incoming.pathname === '/form/submit' && incoming.searchParams.get('privacy') === 'kiosk') {
      headers.set('dnt', '1');
    }
    const upstream = await fetch(new URL(request.url, mauticUrl), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
    recorded.status = upstream.status;
    const responseHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (!['set-cookie', 'content-length', 'content-encoding', 'transfer-encoding', 'access-control-allow-origin'].includes(name.toLowerCase())) {
        responseHeaders[name] = value;
      }
    });
    const requestOrigin = request.headers.origin;
    if ([mainOrigin, docsOrigin].includes(requestOrigin)) {
      responseHeaders['access-control-allow-origin'] = requestOrigin;
      responseHeaders.vary = responseHeaders.vary ? `${responseHeaders.vary}, Origin` : 'Origin';
    }
    let responseBody = Buffer.from(await upstream.arrayBuffer());
    if (incoming.pathname === '/mtc.js') {
      const publicHostname = new URL(publicMauticOrigin).hostname;
      responseBody = Buffer.from(responseBody.toString('utf8').replaceAll(
        `//${publicHostname}/`, `//${publicHostname}:${trackingProxy.address().port}/`,
      ));
    }
    response.writeHead(upstream.status, { ...responseHeaders, 'content-length': responseBody.length });
    response.end(responseBody);
  } catch {
    response.writeHead(502, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('Local tracking proxy failed.');
  }
});
await new Promise(resolveListen => trackingProxy.listen(0, '127.0.0.1', resolveListen));
publicMauticOrigin = `https://127.0.0.1:${trackingProxy.address().port}`;

const configured = runFixture({ mauticSiteUrl: publicMauticOrigin, websiteOrigins: [mainOrigin, docsOrigin] });
clearMauticCache();
if (queueCount('hit') > 0) consumeHits();
assert.equal(queueCount('hit'), 0, 'Hit queue must be empty before acceptance.');
assert.equal(queueCount('email'), 0, 'Email queue must be empty before acceptance.');
assert.equal(configured.actions, 0);
const before = stats();
assert.equal(before.campaigns, 0, 'Fresh fixture must not contain campaigns.');
assert.equal(before.emailStats, 0, 'Fresh fixture must not contain email statistics.');
const kioskEndpoint = `${publicMauticOrigin}/form/submit?formId=${configured.kioskFormId}&privacy=kiosk&ajax=1`;
const trackedEndpoint = `${publicMauticOrigin}/form/submit?formId=${configured.trackedFormId}&privacy=consented&ajax=1`;

const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
let browser;
const contexts = [];
try {
  browser = await chromium.launch();
  async function newParent(origin, context) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/parent/`);
    await page.waitForFunction(() => typeof globalThis.acceptance?.read === 'function');
    return { page, errors };
  }
  async function call(page, method, ...args) {
    const result = await page.evaluate(async ({ method, args }) => {
      try {
        return { ok: true, value: await globalThis.acceptance[method](...args) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }, { method, args });
    return result;
  }
  function formBody({ formId, email, sourcePage, requestType, message, deviceId }) {
    return new URLSearchParams({
      'mauticform[email]': email,
      'mauticform[organization]': 'Shared tracking acceptance office',
      'mauticform[role]': 'Service owner',
      'mauticform[message]': message,
      'mauticform[starter_id]': requestType === 'starter' ? 'professional-licensing' : '',
      'mauticform[source_page]': sourcePage,
      'mauticform[request_token]': randomUUID(),
      'mauticform[request_type]': requestType,
      'mauticform[request_context]': requestType === 'privacy' ? 'website privacy question' : 'Professional licensing starter',
      'mauticform[website]': '',
      'mauticform[formId]': String(formId),
      ...(deviceId ? { mautic_device_id: deviceId } : {}),
    }).toString();
  }
  async function submit(page, endpoint, body) {
    const result = await page.evaluate(async ({ endpoint, body }) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      return { status: response.status, payload: await response.json() };
    }, { endpoint, body });
    assert.equal(result.status, 200);
    assert.equal(result.payload.success, 1);
  }

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: browserUserAgent,
    viewport: { width: 1280, height: 900 },
  });
  contexts.push(context);
  await context.addCookies([{
    name: 'synthetic_mautic_cookie',
    value: 'must-not-reach-upstream',
    url: publicMauticOrigin,
    sameSite: 'None',
    secure: true,
  }]);
  const main = await newParent(mainOrigin, context);
  const docs = await newParent(docsOrigin, context);
  const initialStates = await Promise.all([call(main.page, 'read'), call(docs.page, 'read')]);
  assert.ok(initialStates.every(result => result.ok && result.value.choice === null));
  assert.equal(trackingRequests.length, 0, 'Neither origin may contact Mautic before consent.');

  const accepted = await call(main.page, 'choose', 'accepted');
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.value.choice, 'accepted');
  assert.match(accepted.value.generation, /^[0-9a-f-]{36}$/);
  const docsAccepted = await call(docs.page, 'read');
  assert.equal(docsAccepted.value.generation, accepted.value.generation);

  const mainPageview = {
    canonicalUrl: `${mainOrigin}/pricing/`,
    currentUrl: `${mainOrigin}/pricing/?utm_source=acceptance-main&utm_medium=referral&utm_campaign=shared-native&email=not-forwarded%40example.invalid`,
    pageTitle: 'Registry Stack pricing',
    referrer: 'https://partner.example/private?email=hidden',
  };
  const docsPageview = {
    canonicalUrl: `${docsOrigin}/start/`,
    currentUrl: `${docsOrigin}/start/?utm_source=acceptance-docs&utm_medium=referral&utm_campaign=shared-native&secret=hidden`,
    pageTitle: 'Registry Stack documentation',
    referrer: 'https://partner.example/another-private-path',
  };
  const concurrent = await Promise.all([
    call(main.page, 'pageview', mainPageview),
    call(docs.page, 'pageview', docsPageview),
  ]);
  assert.ok(concurrent.every(result => result.ok), `Concurrent bootstrap failed: ${JSON.stringify({
    results: concurrent,
    requests: trackingRequests.map(({ method, pathname, status }) => ({ method, pathname, status })),
    pageErrors: [...main.errors, ...docs.errors],
  })}`);
  await waitForQueue('hit', 2);
  const anonymous = await waitForStats(
    snapshot => snapshot.pageHits === before.pageHits + 2 && snapshot.devices === before.devices + 1,
    'Two cross-origin page hits did not share one native Mautic device.',
  );
  const hitIds = new Set(before.hitRows.map(row => String(row.id)));
  const initialHits = anonymous.hitRows.filter(row => !hitIds.has(String(row.id)));
  assert.equal(initialHits.length, 2);
  assert.equal(new Set(initialHits.map(row => String(row.lead_id))).size, 1, 'Both page hits must initially belong to one anonymous contact.');
  assert.equal(anonymous.contacts, before.contacts);
  assert.equal(anonymous.anonymous, before.anonymous + 1);
  assert.equal(new Set(initialHits.map(row => row.tracking_id)).size, 1);

  const docsAssociation = await call(docs.page, 'associate', accepted.value.generation);
  assert.equal(docsAssociation.ok, false, 'Docs must not receive the raw Mautic identifier.');
  const association = await call(main.page, 'associate', accepted.value.generation);
  assert.equal(association.ok, true);
  assert.equal(association.value.state.generation, accepted.value.generation);
  assert.match(association.value.deviceId, /^[a-z0-9]{23}$/);

  const unique = randomUUID().slice(0, 8);
  const trackedEmail = `shared-tracked-${unique}@example.invalid`;
  await submit(main.page, trackedEndpoint, formBody({
    formId: configured.trackedFormId,
    email: trackedEmail,
    sourcePage: '/starters/professional-licensing/',
    requestType: 'starter',
    message: 'Associate the two consented visits.',
    deviceId: association.value.deviceId,
  }));
  const associated = await waitForStats(
    snapshot => snapshot.submissions.some(row => row.email === trackedEmail),
    'The consented starter request was not saved.',
  );
  const trackedSubmission = associated.submissions.find(row => row.email === trackedEmail);
  assert.equal(Number(trackedSubmission.form_id), configured.trackedFormId);
  assert.equal(trackedSubmission.tracking_id, association.value.deviceId);
  consumeHits();
  const identified = stats();
  const identifiedHits = identified.hitRows.filter(row => !hitIds.has(String(row.id)));
  assert.equal(new Set(identifiedHits.map(row => String(row.lead_id))).size, 1);
  assert.ok(identifiedHits.every(row => String(row.lead_id) === String(trackedSubmission.lead_id)));
  assert.equal(identified.contacts, before.contacts + 1);
  assert.equal(identified.anonymous, before.anonymous);
  const savedByPath = new Map(identifiedHits.map(row => [new URL(row.url).pathname, row.query_fields]));
  assert.deepEqual(savedByPath.get('/pricing/'), {
    page_url: `${mainOrigin}/pricing/`,
    page_referrer: 'https://partner.example',
    page_title: 'Registry Stack pricing',
    utm_source: 'acceptance-main',
    utm_medium: 'referral',
    utm_campaign: 'shared-native',
  });
  assert.deepEqual(savedByPath.get('/start/'), {
    page_url: `${docsOrigin}/start/`,
    page_referrer: 'https://partner.example',
    page_title: 'Registry Stack documentation',
    utm_source: 'acceptance-docs',
    utm_medium: 'referral',
    utm_campaign: 'shared-native',
  });

  const privacyBody = formBody({
    formId: configured.kioskFormId,
    email: trackedEmail,
    sourcePage: '/privacy/',
    requestType: 'privacy',
    message: 'Please review my stored visit history.',
  });
  await submit(main.page, kioskEndpoint, privacyBody);
  const afterPrivacy = await waitForStats(
    snapshot => snapshot.submissions.filter(row => row.email === trackedEmail).length === 2,
    'The kiosk privacy request was not saved.',
  );
  const privacy = afterPrivacy.submissions.find(row => row.email === trackedEmail && row.request_type === 'privacy');
  assert.ok(privacy);
  assert.equal(Number(privacy.form_id), configured.kioskFormId);
  assert.equal(privacy.tracking_id, null);
  assert.equal(String(privacy.lead_id), String(trackedSubmission.lead_id));

  const rejected = await call(docs.page, 'choose', 'rejected');
  assert.equal(rejected.ok, true);
  assert.equal(rejected.value.choice, 'rejected');
  const rejectedEmail = `shared-rejected-${unique}@example.invalid`;
  await submit(docs.page, kioskEndpoint, formBody({
    formId: configured.kioskFormId,
    email: rejectedEmail,
    sourcePage: '/contact/',
    requestType: 'question',
    message: 'A request after rejecting optional tracking.',
  }));
  const afterRejected = await waitForStats(
    snapshot => snapshot.submissions.some(row => row.email === rejectedEmail),
    'The rejected visitor request was not saved.',
  );
  const rejectedSubmission = afterRejected.submissions.find(row => row.email === rejectedEmail);
  assert.equal(Number(rejectedSubmission.form_id), configured.kioskFormId);
  assert.equal(rejectedSubmission.tracking_id, null);
  assert.equal(afterRejected.pageHits, identified.pageHits);

  const reaccepted = await call(main.page, 'choose', 'accepted');
  assert.equal(reaccepted.ok, true);
  assert.notEqual(reaccepted.value.generation, accepted.value.generation);
  const reacceptedHit = await call(main.page, 'pageview', {
    canonicalUrl: `${mainOrigin}/about/`,
    currentUrl: `${mainOrigin}/about/?utm_source=reaccept&utm_campaign=shared-native`,
    pageTitle: 'About Registry Stack',
    referrer: '',
  });
  assert.equal(reacceptedHit.ok, true);
  await waitForQueue('hit', 1);
  const secondAssociation = await call(main.page, 'associate', reaccepted.value.generation);
  assert.equal(secondAssociation.ok, true);
  assert.notEqual(secondAssociation.value.deviceId, association.value.deviceId, 'Re-consent must create a new Mautic device.');
  consumeHits();

  const blockedContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: browserUserAgent,
  });
  contexts.push(blockedContext);
  await blockedContext.route(`${publicMauticOrigin}/mtc.js`, route => route.abort('blockedbyclient'));
  const blocked = await newParent(mainOrigin, blockedContext);
  const blockedAccepted = await call(blocked.page, 'choose', 'accepted');
  assert.equal(blockedAccepted.ok, true);
  const beforeBlocked = stats();
  const blockedPageview = await call(blocked.page, 'pageview', {
    canonicalUrl: `${mainOrigin}/blocked/`,
    currentUrl: `${mainOrigin}/blocked/?utm_source=blocked`,
    pageTitle: 'Blocked tracker',
    referrer: '',
  });
  assert.equal(blockedPageview.ok, false, 'A blocked native tracker must fail closed.');
  await delay(300);
  const afterBlocked = stats();
  assert.equal(afterBlocked.pageHits, beforeBlocked.pageHits);
  assert.equal(afterBlocked.devices, beforeBlocked.devices);
  assert.equal((await call(blocked.page, 'associate', blockedAccepted.value.generation)).ok, false);

  const final = stats();
  assert.equal(final.pageHits, before.pageHits + 3, 'Acceptance must save exactly three page hits.');
  assert.equal(final.devices, before.devices + 2, 'Withdrawal and re-consent must add exactly two devices.');
  assert.equal(final.contacts, before.contacts + 2, 'Tracked and rejected forms must add exactly two identified contacts.');
  assert.equal(final.anonymous, before.anonymous + 1, 'Only the re-consented, unassociated device may remain anonymous.');
  assert.equal(final.submissions.length, before.submissions.length + 3, 'Acceptance must save exactly three form submissions.');
  assert.equal(final.emailStats, before.emailStats, 'Acceptance must not send automated mail.');
  assert.equal(final.campaigns, 0, 'Acceptance fixture must not create campaigns.');
  assert.equal(configured.actions, 0, 'Acceptance forms must not have actions.');
  assert.equal(queueCount('hit'), 0, 'Acceptance must leave no page hits queued.');
  assert.equal(queueCount('email'), 0, 'Acceptance must not enqueue email.');
  assert.ok(trackingRequests.some(request => request.browserSentCookie), 'The fixture did not exercise cookie stripping.');
  assert.ok(trackingRequests.every(request => !request.forwardedCookie), 'The proxy must not forward browser cookies to Mautic.');
  const trackedText = decodeURIComponent(trackingRequests.map(request => `${request.search}&${request.body}`).join('&').replaceAll('+', ' '));
  assert.doesNotMatch(trackedText, /not-forwarded|hidden|private%40|email=.+@/i);
  assert.deepEqual([...main.errors, ...docs.errors], []);

  await Promise.all([call(main.page, 'close'), call(docs.page, 'close'), call(blocked.page, 'close')]);
  console.log('Real shared Mautic acceptance passed: two HTTPS origins shared one anonymous device, both attributed hits joined the consented contact, docs could not disclose the identifier, kiosk requests stayed unassociated, withdrawal and re-consent rotated identity, tracker blocking failed closed, and no campaign or email activity occurred.');
  console.log(`Disposable browser artifacts: ${scratch}`);
} finally {
  await Promise.all(contexts.map(context => context.close().catch(() => undefined)));
  await browser?.close();
  for (const server of [trackingProxy, mainServer, docsServer]) server.closeAllConnections();
  await Promise.all([trackingProxy, mainServer, docsServer].map(server => new Promise(resolveClose => server.close(resolveClose))));
}
