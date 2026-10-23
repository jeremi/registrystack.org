// Optional acceptance check against a disposable, installed Mautic 7.2.1.
// The PHP fixture refuses a non-loopback site URL or an enabled mail transport.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStarterRequestServer } from '../server/starter-request.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const container = process.env.MAUTIC_TEST_CONTAINER;
const mauticUrl = new URL(process.env.MAUTIC_TEST_URL ?? 'http://invalid');
assert.match(container ?? '', /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/, 'Set MAUTIC_TEST_CONTAINER to a disposable web container.');
assert.equal(mauticUrl.hostname, '127.0.0.1', 'MAUTIC_TEST_URL must use loopback.');
const fixture = await readFile(join(root, 'tests/fixtures/mautic-starter-form.php'), 'utf8');
function stats() {
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', '--workdir', '/var/www/html', '-e', 'STARTER_FIXTURE_STATS=1', container, 'php'], { input: fixture, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || 'Local Mautic fixture failed.');
  return JSON.parse(result.stdout);
}
const before = stats();
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'starter-mautic-'));
const dist = join(scratch, 'dist');
const openssl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(scratch, 'test.key'), '-out', join(scratch, 'test.crt'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1']);
assert.equal(openssl.status, 0, 'Could not create a disposable local TLS certificate.');
const website = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(dist, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => website.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${website.address().port}`;
const upstreamCookies = [];
const relay = createStarterRequestServer({
  mauticBaseUrl: mauticUrl.origin, mauticFormId: before.formId,
  websiteOrigin: origin, allowLoopbackWebsiteOrigin: true,
  fetch: async (url, options) => {
    assert.equal(options.headers.DNT, '1');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Content-Type', 'DNT', 'User-Agent']);
    const result = await fetch(url, options);
    upstreamCookies.push(...result.headers.getSetCookie());
    return result;
  },
});
const secureRelay = createHttpsServer({ key: await readFile(join(scratch, 'test.key')), cert: await readFile(join(scratch, 'test.crt')) }, relay.listeners('request')[0]);
await new Promise(resolve => secureRelay.listen(0, '127.0.0.1', resolve));
const endpoint = `https://127.0.0.1:${secureRelay.address().port}/starter-request`;
let browser;
try {
  const build = spawnSync('npm', ['run', 'build', '--', '--outDir', dist], { cwd: root, encoding: 'utf8', env: { ...process.env, PUBLIC_STARTER_REQUEST_ENDPOINT: endpoint, PUBLIC_UMAMI_WEBSITE_ID: '' } });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 1000 } });
  await context.addCookies([{ name: 'mtc_id', value: 'unrelated-identity', domain: '127.0.0.1', path: '/' }, { name: 'mautic_device_id', value: 'unrelated-device', domain: '127.0.0.1', path: '/' }]);
  const cookiesBefore = await context.cookies();
  const page = await context.newPage();
  const errors = [];
  const outbound = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin)) outbound.push(request); });
  const unique = randomUUID().slice(0, 8);
  const emailA = `starter-a-${unique}@example.invalid`;
  const emailB = `starter-b-${unique}@example.invalid`;
  for (const [email, message] of [[emailA, 'First request'], [emailA, 'Second request'], [emailB, 'Separate requester'], [emailB, '']]) {
    await page.goto(`${origin}/starters/professional-licensing/?utm_source=test&email=not-forwarded@example.invalid`);
    const form = page.locator('[data-starter-request-form]');
    await form.getByRole('textbox', { name: 'Email address' }).fill(email);
    await form.getByRole('textbox', { name: 'Organization' }).fill(message ? 'Example licensing office' : '');
    await form.getByRole('textbox', { name: 'Your role' }).fill(message ? 'Service owner' : '');
    await form.getByRole('textbox', { name: 'What are you trying to do?' }).fill(message);
    await form.getByRole('button', { name: 'Send request' }).click();
    await form.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  }
  assert.deepEqual(await context.cookies(), cookiesBefore, 'no tracking cookies are created or changed');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  assert.equal(outbound.length, 4);
  assert.ok(outbound.every(request => request.url() === endpoint));
  assert.ok(outbound.every(request => !request.headers().cookie && !request.headers().referer));
  assert.deepEqual(upstreamCookies, [], 'DNT plus kiosk must suppress Mautic tracking cookies');

  const after = stats();
  assert.equal(after.contacts - before.contacts, 2);
  for (const key of ['anonymous', 'devices', 'pageHits', 'emailStats']) assert.equal(after[key], before[key], `no new ${key}`);
  const requests = after.submissions.filter(row => row.email === emailA || row.email === emailB);
  assert.equal(requests.length, 4);
  assert.equal(new Set(requests.map(row => row.request_token)).size, 4);
  assert.equal(requests[0].lead_id, requests[1].lead_id);
  assert.notEqual(requests[0].lead_id, requests[2].lead_id);
  assert.equal(requests[2].lead_id, requests[3].lead_id);
  assert.ok(requests.every(row => !row.tracking_id && row.starter_id === 'professional-licensing' && row.source_page === '/starters/professional-licensing/'));
  assert.deepEqual(requests.map(row => row.message), ['First request', 'Second request', 'Separate requester', '']);
  assert.ok(requests.slice(0, 3).every(row => row.organization === 'Example licensing office' && row.role === 'Service owner'));
  assert.equal(requests[3].organization, '');
  assert.equal(requests[3].role, '');

  await page.goto(`${origin}/starters/professional-licensing/#starter-request-form`);
  await page.locator('#starter-request-form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(scratch, 'starter-request-desktop.png') });
  await page.setViewportSize({ width: 390, height: 950 });
  await page.locator('#starter-request-form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(scratch, 'starter-request-mobile.png') });
  console.log('Real Mautic acceptance passed: 4 browser submissions including email-only, 2 isolated contacts, 4 saved request records; no new anonymous contacts, devices, page hits, cookies or email stats.');
  console.log(`Screenshots: ${scratch}`);
  await context.close();
} finally {
  await browser?.close();
  secureRelay.closeAllConnections();
  website.closeAllConnections();
  await Promise.all([new Promise(resolve => secureRelay.close(resolve)), new Promise(resolve => website.close(resolve))]);
}
