// Optional acceptance check against a disposable, installed Mautic 7.2.1.
// The PHP fixture refuses a non-loopback site URL or an enabled mail transport.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const container = process.env.MAUTIC_TEST_CONTAINER;
const mauticUrl = new URL(process.env.MAUTIC_TEST_URL ?? 'http://invalid');
assert.match(container ?? '', /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/, 'Set MAUTIC_TEST_CONTAINER to a disposable web container.');
assert.equal(mauticUrl.hostname, '127.0.0.1', 'MAUTIC_TEST_URL must use loopback.');
const fixture = await readFile(join(root, 'tests/fixtures/mautic-starter-form.php'), 'utf8');
const browserUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
function runFixture({ includeStats = false, mauticSiteUrl, websiteOrigin } = {}) {
  const args = ['exec', '-i', '--user', 'www-data', '--workdir', '/var/www/html'];
  if (includeStats) args.push('-e', 'STARTER_FIXTURE_STATS=1');
  if (mauticSiteUrl) args.push('-e', `STARTER_FIXTURE_MAUTIC_URL=${mauticSiteUrl}`);
  if (websiteOrigin) args.push('-e', `STARTER_FIXTURE_WEBSITE_ORIGIN=${websiteOrigin}`);
  args.push(container, 'php');
  const result = spawnSync('docker', args, { input: fixture, encoding: 'utf8' });
  assert.equal(result.status, 0, 'Local Mautic fixture failed.');
  return JSON.parse(result.stdout);
}
function stats() {
  return runFixture({ includeStats: true });
}
async function waitForStats(predicate, message) {
  let snapshot;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    snapshot = stats();
    if (predicate(snapshot)) return snapshot;
    await delay(250);
  }
  assert.fail(message);
}
function clearMauticCache() {
  const result = spawnSync('docker', [
    'exec', '--user', 'www-data', '--workdir', '/var/www/html', container,
    'php', 'bin/console', 'cache:clear', '--env=prod', '--no-interaction',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Local Mautic cache clear failed.');
}
function hitQueueCount() {
  const result = spawnSync('docker', [
    'exec', '--user', 'www-data', '--workdir', '/var/www/html', container,
    'php', 'bin/console', 'messenger:stats', '--format=json', '--env=prod', '--no-interaction',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Could not inspect the local Mautic hit queue.');
  const output = String(result.stdout);
  const jsonStart = output.indexOf('{');
  assert.ok(jsonStart >= 0, 'Local Mautic hit queue stats were malformed.');
  return Number(JSON.parse(output.slice(jsonStart)).transports?.hit?.count ?? 0);
}
function consumeHitQueue({ limit } = {}) {
  const args = [
    'exec', '--user', 'www-data', '--workdir', '/var/www/html', container,
    'php', 'bin/console', 'messenger:consume', 'hit',
    '--time-limit', limit ? '30' : '3', '--memory-limit=256M', '--no-interaction', '-vv',
  ];
  if (limit) args.push(`--limit=${limit}`);
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 35_000 });
  assert.equal(result.status, 0, 'Local Mautic hit worker failed.');
  if (limit) assert.equal(hitQueueCount(), 0, 'The bounded hit worker did not consume the isolated page-hit message.');
}
async function waitForHitQueueCount(expected) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (hitQueueCount() === expected) return;
    await delay(250);
  }
  assert.fail(`The isolated Mautic hit queue did not reach ${expected} message(s).`);
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
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'starter-mautic-'));
const dist = join(scratch, 'dist');
const openssl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(scratch, 'test.key'), '-out', join(scratch, 'test.crt'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1']);
assert.equal(openssl.status, 0, 'Could not create a disposable local TLS certificate.');
const tls = { key: await readFile(join(scratch, 'test.key')), cert: await readFile(join(scratch, 'test.crt')) };
const website = createHttpsServer(tls, async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(dist, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => website.listen(0, '127.0.0.1', resolve));
const origin = `https://127.0.0.1:${website.address().port}`;
const trackingRequests = [];
const trackingProxy = createHttpsServer(tls, async (request, response) => {
  try {
    const incomingUrl = new URL(request.url, 'https://127.0.0.1');
    const privacyMode = incomingUrl.searchParams.get('privacy');
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await requestBody(request);
    const recordedRequest = {
      method: request.method,
      path: `${incomingUrl.pathname}${incomingUrl.search}`,
      body: body?.toString('utf8') ?? '',
      hadCookie: Boolean(request.headers.cookie),
      privacyMode,
      dnt: request.headers.dnt ?? null,
      status: null,
    };
    trackingRequests.push(recordedRequest);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined || ['cookie', 'content-length'].includes(name)) continue;
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
    }
    headers.set('x-forwarded-proto', 'https');
    if (incomingUrl.pathname === '/form/submit' && privacyMode === 'kiosk') headers.set('dnt', '1');
    recordedRequest.forwardedDnt = headers.get('dnt');
    const upstream = await fetch(new URL(request.url, mauticUrl), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });
    recordedRequest.status = upstream.status;
    const responseHeaders = {};
    upstream.headers.forEach((value, name) => {
      if (!['set-cookie', 'content-length', 'content-encoding'].includes(name.toLowerCase())) {
        responseHeaders[name] = value;
      }
    });
    if (request.headers.origin === origin) {
      responseHeaders['access-control-allow-origin'] = origin;
      responseHeaders.vary = responseHeaders.vary ? `${responseHeaders.vary}, Origin` : 'Origin';
    }
    let responseBody = Buffer.from(await upstream.arrayBuffer());
    recordedRequest.responseContentType = upstream.headers.get('content-type');
    if (incomingUrl.pathname === '/form/submit' && responseHeaders['content-type']?.includes('application/json')) {
      try {
        const payload = JSON.parse(responseBody.toString('utf8'));
        recordedRequest.responseShape = {
          success: payload?.success,
          resultKeys: payload?.results && typeof payload.results === 'object' ? Object.keys(payload.results).sort() : [],
          hasValidationErrors: payload?.validationErrors !== undefined,
          hasErrorMessage: payload?.errorMessage !== undefined,
        };
      } catch {
        recordedRequest.responseShape = { malformedJson: true };
      }
    }
    if (incomingUrl.pathname === '/mtc.js') {
      // Mautic builds tracking URLs without a port. Production uses standard HTTPS/443;
      // retain this fixture's ephemeral loopback port without changing its event data.
      responseBody = Buffer.from(
        responseBody.toString('utf8').replaceAll('//127.0.0.1/', `//127.0.0.1:${trackingProxy.address().port}/`),
      );
    }
    response.writeHead(upstream.status, { ...responseHeaders, 'content-length': responseBody.length });
    response.end(responseBody);
  } catch {
    response.writeHead(502, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    response.end('Local tracking proxy failed.');
  }
});
await new Promise(resolve => trackingProxy.listen(0, '127.0.0.1', resolve));
const publicMauticOrigin = `https://127.0.0.1:${trackingProxy.address().port}`;
const configured = runFixture({ mauticSiteUrl: publicMauticOrigin, websiteOrigin: origin });
clearMauticCache();
if (hitQueueCount() > 0) consumeHitQueue();
assert.equal(hitQueueCount(), 0, 'The isolated Mautic hit queue must be empty before acceptance.');
const before = stats();
assert.equal(before.formId, configured.formId);
assert.equal(before.trackedFormId, configured.trackedFormId);
const kioskEndpoint = `${publicMauticOrigin}/form/submit?formId=${before.formId}&privacy=kiosk`;
const trackedEndpoint = `${publicMauticOrigin}/form/submit?formId=${before.trackedFormId}&privacy=consented`;
let browser;
try {
  const build = spawnSync('npm', ['run', 'build', '--', '--outDir', dist], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PUBLIC_STARTER_REQUEST_ENDPOINT: kioskEndpoint,
      PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: trackedEndpoint,
      PUBLIC_MAUTIC_URL: publicMauticOrigin,
      PUBLIC_UMAMI_WEBSITE_ID: '',
    },
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  browser = await chromium.launch();
  const contexts = [];
  const errors = [];
  const externalUrls = [];
  async function newBrowserPage({ dnt = false, gpc = false } = {}) {
    const extraHTTPHeaders = {};
    if (dnt) extraHTTPHeaders.DNT = '1';
    if (gpc) extraHTTPHeaders['Sec-GPC'] = '1';
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 1000 },
      extraHTTPHeaders,
      userAgent: browserUserAgent,
    });
    contexts.push(context);
    if (dnt || gpc) {
      await context.addInitScript(({ dnt, gpc }) => {
        if (dnt) Object.defineProperty(navigator, 'doNotTrack', { configurable: true, get: () => '1' });
        if (gpc) Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, get: () => true });
      }, { dnt, gpc });
    }
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(origin)) externalUrls.push(request.url());
    });
    return { context, page };
  }
  async function submitRequest(page, email, message) {
    const form = page.locator('[data-starter-request-form]');
    await form.getByRole('textbox', { name: 'Email address' }).fill(email);
    await form.getByRole('textbox', { name: 'Organization' }).fill('Example licensing office');
    await form.getByRole('textbox', { name: 'Your role' }).fill('Service owner');
    await form.getByRole('textbox', { name: 'What are you trying to do?' }).fill(message);
    await form.getByRole('button', { name: 'Send request' }).click();
    await Promise.race([
      form.locator('[data-starter-request-success]').waitFor({ state: 'visible' }),
      form.locator('[data-starter-request-error]').waitFor({ state: 'visible' }),
    ]);
    if (await form.locator('[data-starter-request-success]').isHidden()) {
      const request = trackingRequests.findLast(item => new URL(item.path, publicMauticOrigin).pathname === '/form/submit');
      assert.fail(`Native form was not confirmed: ${JSON.stringify({ status: request?.status, privacyMode: request?.privacyMode, responseContentType: request?.responseContentType, responseShape: request?.responseShape, pageErrors: errors.length })}`);
    }
  }
  async function assertNoBrowserIdentity(context, page) {
    assert.deepEqual(await page.evaluate(() => [
      localStorage.getItem('mtc_id'),
      localStorage.getItem('mautic_device_id'),
    ]), [null, null]);
    assert.ok((await context.cookies()).every(cookie => !['mtc_id', 'mautic_device_id'].includes(cookie.name)));
  }

  const unique = randomUUID().slice(0, 8);
  const trackedEmail = `starter-tracked-${unique}@example.invalid`;
  const previouslyUntracked = await newBrowserPage();
  await previouslyUntracked.page.goto(`${origin}/starters/professional-licensing/`);
  await submitRequest(previouslyUntracked.page, trackedEmail, 'Untracked request before consent');
  await assertNoBrowserIdentity(previouslyUntracked.context, previouslyUntracked.page);
  const afterPreviouslyUntracked = await waitForStats(
    snapshot => snapshot.submissions.some(row => row.email === trackedEmail),
    'The initial untracked request was not saved.',
  );
  assert.equal(afterPreviouslyUntracked.pageHits, before.pageHits);

  const main = await newBrowserPage();
  const testUrl = `${origin}/starters/professional-licensing/?utm_source=acceptance&utm_medium=web&utm_campaign=starter_test&utm_term=not%20valid%21&email=not-forwarded%40example.invalid`;
  await main.page.goto(testUrl, { referer: `${origin}/private-path/?email=not-forwarded%40example.invalid` });
  assert.equal(trackingRequests.filter(
    request => new URL(request.path, publicMauticOrigin).pathname !== '/form/submit',
  ).length, 0, 'tracking must not load before consent');
  await main.context.addCookies([
    { name: 'mtc_id', value: 'preexisting-cookie', domain: '127.0.0.1', path: '/' },
    { name: 'mautic_device_id', value: 'preexisting-device', domain: '127.0.0.1', path: '/' },
  ]);
  await main.page.getByRole('button', { name: 'Accept optional cookies' }).click();
  try {
    await main.page.waitForFunction(() => /^[a-z0-9]{23}$/.test(localStorage.getItem('mautic_device_id') ?? ''));
  } catch {
    const redactedExternalRequests = externalUrls.map(value => {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    });
    assert.fail(`Mautic did not return a browser device ID; tracking requests: ${JSON.stringify(trackingRequests.map(({ method, path, status }) => ({ method, path: new URL(path, publicMauticOrigin).pathname, status })))}; external requests: ${JSON.stringify(redactedExternalRequests)}; page errors: ${errors.length}.`);
  }
  const firstDeviceId = await main.page.evaluate(() => localStorage.getItem('mautic_device_id'));
  const afterFirstHit = await waitForStats(
    snapshot => snapshot.pageHits >= before.pageHits + 1,
    'Consented page view did not reach Mautic.',
  );
  await waitForHitQueueCount(1);
  assert.equal(afterFirstHit.pageHits, before.pageHits + 1);
  const beforeHitIds = new Set(before.hitRows.map(row => String(row.id)));
  const firstHit = afterFirstHit.hitRows.find(row => !beforeHitIds.has(String(row.id)));
  assert.ok(firstHit, 'Consented page view was not recorded.');
  const firstEvent = trackingRequests.find(request => request.method === 'POST' && new URL(request.path, publicMauticOrigin).pathname === '/mtc/event');
  assert.ok(firstEvent, 'Consented page view did not use the Mautic event endpoint.');
  const firstEventParams = new URLSearchParams(firstEvent.body);
  assert.equal(firstEventParams.get('page_url'), 'https://registrystack.org/starters/professional-licensing/');
  assert.equal(firstEventParams.get('page_referrer'), origin);
  assert.equal(firstEventParams.get('utm_source'), 'acceptance');
  assert.equal(firstEventParams.get('utm_medium'), 'web');
  assert.equal(firstEventParams.get('utm_campaign'), 'starter_test');
  assert.equal(firstEventParams.get('utm_term'), null);
  const trackingText = decodeURIComponent(trackingRequests.map(request => `${request.path}&${request.body}`).join('&').replaceAll('+', ' '));
  assert.match(trackingText, /utm_source[^a-z0-9]+acceptance/i);
  assert.match(trackingText, /utm_campaign[^a-z0-9]+starter_test/i);
  assert.doesNotMatch(trackingText, /not-forwarded|not valid|%40/i);
  assert.ok(trackingRequests.some(request => request.hadCookie), 'proxy path did not receive the synthetic pre-existing cookie');

  const cookiesBeforeForm = await main.context.cookies();
  await submitRequest(main.page, trackedEmail, 'Tracked starter request');
  assert.deepEqual(await main.context.cookies(), cookiesBeforeForm, 'native form submission must not change browser cookies');
  const afterTrackedForm = await waitForStats(
    snapshot => snapshot.submissions.some(row => row.email === trackedEmail),
    'Tracked starter request was not saved.',
  );
  assert.equal(afterTrackedForm.pageHits, afterFirstHit.pageHits, 'form submit must not add a page hit');
  assert.equal(afterTrackedForm.devices, afterFirstHit.devices, 'form submit must not add a device');
  const trackedRequest = afterTrackedForm.submissions.find(
    row => row.email === trackedEmail && Number(row.form_id) === before.trackedFormId,
  );
  const sameEmailRequests = afterTrackedForm.submissions.filter(row => row.email === trackedEmail);
  assert.equal(sameEmailRequests.length, 2);
  assert.equal(new Set(sameEmailRequests.map(row => String(row.submission_id))).size, 2);
  assert.equal(new Set(sameEmailRequests.map(row => String(row.lead_id))).size, 1);
  assert.equal(Number(trackedRequest.form_id), before.trackedFormId);
  consumeHitQueue({ limit: 1 });
  const afterTrackedProcessed = stats();
  const linkedFirstHit = afterTrackedProcessed.hitRows.find(row => String(row.id) === String(firstHit.id));
  assert.equal(String(linkedFirstHit.lead_id), String(trackedRequest.lead_id));
  assert.equal(new URL(linkedFirstHit.url).pathname, '/starters/professional-licensing/');
  const storedPageview = linkedFirstHit.query_fields;
  assert.equal(storedPageview.page_url, 'https://registrystack.org/starters/professional-licensing/');
  assert.equal(storedPageview.page_referrer, origin);
  assert.equal(storedPageview.utm_source, 'acceptance');
  assert.equal(storedPageview.utm_medium, 'web');
  assert.equal(storedPageview.utm_campaign, 'starter_test');
  assert.equal(storedPageview.utm_term, undefined);
  assert.equal(trackedRequest.tracking_id, firstDeviceId, 'tracked form result must retain the browser device correlation');

  const secondTrackedEmail = `starter-second-${unique}@example.invalid`;
  const second = await newBrowserPage();
  await second.page.goto(`${origin}/starters/professional-licensing/`);
  await second.page.getByRole('button', { name: 'Accept optional cookies' }).click();
  await second.page.waitForFunction(() => /^[a-z0-9]{23}$/.test(localStorage.getItem('mautic_device_id') ?? ''));
  const secondVisitorDeviceId = await second.page.evaluate(() => localStorage.getItem('mautic_device_id'));
  assert.notEqual(secondVisitorDeviceId, firstDeviceId);
  await waitForStats(
    snapshot => snapshot.pageHits >= afterTrackedForm.pageHits + 1,
    'The second consented visitor page view did not reach Mautic.',
  );
  await waitForHitQueueCount(1);
  consumeHitQueue({ limit: 1 });
  const afterSecondHit = stats();
  const afterTrackedHitIds = new Set(afterTrackedForm.hitRows.map(row => String(row.id)));
  const secondHit = afterSecondHit.hitRows.find(row => !afterTrackedHitIds.has(String(row.id)));
  assert.ok(secondHit, 'The second consented visitor page view was not recorded.');
  await submitRequest(second.page, secondTrackedEmail, 'Second tracked starter request');
  const afterSecondForm = await waitForStats(
    snapshot => snapshot.submissions.some(row => row.email === secondTrackedEmail),
    'The second tracked starter request was not saved.',
  );
  const secondTrackedRequest = afterSecondForm.submissions.find(row => row.email === secondTrackedEmail);
  const linkedSecondHit = afterSecondForm.hitRows.find(row => String(row.id) === String(secondHit.id));
  const stableFirstHit = afterSecondForm.hitRows.find(row => String(row.id) === String(firstHit.id));
  assert.equal(String(linkedSecondHit.lead_id), String(secondTrackedRequest.lead_id));
  assert.equal(secondTrackedRequest.tracking_id, secondVisitorDeviceId);
  assert.notEqual(String(secondTrackedRequest.lead_id), String(trackedRequest.lead_id));
  assert.equal(String(stableFirstHit.lead_id), String(trackedRequest.lead_id));
  assert.equal(afterSecondForm.devices, afterTrackedForm.devices + 1);

  await main.page.locator('[data-tracking-preferences-open]').click();
  await Promise.all([
    main.page.waitForNavigation(),
    main.page.getByRole('button', { name: 'Reject optional cookies' }).click(),
  ]);
  await assertNoBrowserIdentity(main.context, main.page);
  const afterWithdrawal = stats();
  assert.equal(afterWithdrawal.pageHits, afterSecondForm.pageHits, 'withdrawal reload must not track');
  await main.page.locator('[data-tracking-preferences-open]').click();
  await main.page.getByRole('button', { name: 'Accept optional cookies' }).click();
  await main.page.waitForFunction(previous => {
    const current = localStorage.getItem('mautic_device_id');
    return /^[a-z0-9]{23}$/.test(current ?? '') && current !== previous;
  }, firstDeviceId);
  const secondDeviceId = await main.page.evaluate(() => localStorage.getItem('mautic_device_id'));
  assert.notEqual(secondDeviceId, firstDeviceId);
  await waitForStats(
    snapshot => snapshot.pageHits >= afterSecondForm.pageHits + 1,
    'Reaccepted tracking did not start a fresh page view.',
  );
  await waitForHitQueueCount(1);
  consumeHitQueue({ limit: 1 });
  const afterReaccept = stats();
  assert.equal(afterReaccept.pageHits, afterSecondForm.pageHits + 1);
  const trackingRequestCountBeforePrivacyScenarios = trackingRequests.filter(
    request => new URL(request.path, publicMauticOrigin).pathname !== '/form/submit',
  ).length;

  const scenarios = [
    ['rejected', {}, 'reject'],
    ['unset', {}, 'unset'],
    ['dnt', { dnt: true }, 'signal'],
    ['gpc', { gpc: true }, 'signal'],
  ];
  for (const [name, browserOptions, choice] of scenarios) {
    const email = `starter-${name}-${unique}@example.invalid`;
    const current = await newBrowserPage(browserOptions);
    await current.page.goto(`${origin}/starters/professional-licensing/`);
    if (choice === 'reject') await current.page.getByRole('button', { name: 'Reject optional cookies' }).click();
    if (choice === 'signal') {
      const observedSignals = await current.page.evaluate(() => ({
        dnt: navigator.doNotTrack,
        gpc: navigator.globalPrivacyControl,
      }));
      if (name === 'dnt') assert.equal(observedSignals.dnt, '1');
      if (name === 'gpc') assert.equal(observedSignals.gpc, true);
    }
    await submitRequest(current.page, email, `${name} request`);
    await assertNoBrowserIdentity(current.context, current.page);
  }

  const after = await waitForStats(
    snapshot => scenarios.every(([name]) => snapshot.submissions.some(row => row.email === `starter-${name}-${unique}@example.invalid`)),
    'One or more privacy-preserving starter requests were not saved.',
  );
  assert.equal(after.pageHits, before.pageHits + 3, 'only the three consented page views may be tracked');
  assert.equal(trackingRequests.filter(
    request => new URL(request.path, publicMauticOrigin).pathname !== '/form/submit',
  ).length, trackingRequestCountBeforePrivacyScenarios, 'reject, unset, DNT and GPC scenarios must not contact Mautic tracking');
  assert.equal(after.emailStats, before.emailStats, 'acceptance must not send email');
  assert.equal(after.contacts, before.contacts + 6);
  const requests = after.submissions.filter(row => row.email?.endsWith(`-${unique}@example.invalid`));
  assert.equal(requests.length, 7);
  assert.equal(new Set(requests.map(row => row.request_token)).size, 7);
  assert.ok(requests.every(row => row.starter_id === 'professional-licensing' && row.source_page === '/starters/professional-licensing/'));
  const kioskRequests = requests.filter(row => Number(row.form_id) === before.formId);
  assert.equal(kioskRequests.length, 5);
  assert.ok(kioskRequests.every(row => !row.tracking_id));
  const nativeSubmissions = trackingRequests.filter(
    request => request.method === 'POST' && new URL(request.path, publicMauticOrigin).pathname === '/form/submit',
  );
  assert.equal(nativeSubmissions.length, 7);
  assert.equal(nativeSubmissions.filter(request => new URLSearchParams(request.body).has('mautic_device_id')).length, 2);
  assert.ok(nativeSubmissions.every(request => !request.hadCookie));
  assert.ok(nativeSubmissions.filter(request => request.privacyMode === 'kiosk').every(request => request.forwardedDnt === '1'));
  assert.ok(nativeSubmissions.filter(request => request.privacyMode === 'consented').every(request => request.forwardedDnt === null));
  assert.ok(externalUrls.every(url => !url.includes('@') && !url.includes('not-forwarded')));
  assert.deepEqual(errors, []);

  console.log(configured.emailWasPubliclyUpdatable
    ? 'Fixture disabled public updates on Mautic Contact email before acceptance.'
    : 'Mautic Contact email was already not publicly updatable.');
  console.log('Real Mautic acceptance passed: consented page history linked once; reject, unset, DNT and GPC requests stayed untracked; withdrawal and reacceptance started a different device.');
  await Promise.all(contexts.map(context => context.close()));
} finally {
  await browser?.close();
  trackingProxy.closeAllConnections();
  website.closeAllConnections();
  await Promise.all([
    new Promise(resolve => trackingProxy.close(resolve)),
    new Promise(resolve => website.close(resolve)),
  ]);
}
