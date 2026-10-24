import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'starter-request-'));
const dist = join(scratch, 'dist');
const endpoint = 'https://starter-requests.example.test/form/submit?formId=1&privacy=kiosk';
const networkEndpoint = `${endpoint}&ajax=1`;
const resultAliases = ['email', 'organization', 'role', 'message', 'starter_id', 'source_page', 'request_token'];
function successfulMauticResponse(data) {
  return {
    success: 1,
    results: Object.fromEntries(resultAliases.map(alias => [alias, data[`mauticform[${alias}]`]])),
  };
}
const build = spawnSync('npm', ['run', 'build', '--', '--outDir', dist], {
  cwd: root, encoding: 'utf8',
  env: { ...process.env, PUBLIC_STARTER_REQUEST_ENDPOINT: endpoint, PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: '', PUBLIC_UMAMI_WEBSITE_ID: '', PUBLIC_MAUTIC_URL: '' },
});
assert.equal(build.status, 0, build.stderr || build.stdout);
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(dist, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(`${dist}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const path = '/starters/professional-licensing/';
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const browserErrors = [];
  const outbound = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith(origin)) outbound.push(request);
  });
  let submissions = [];
  await page.route(networkEndpoint, async route => {
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    submissions.push(data);
    await route.fulfill({ json: successfulMauticResponse(data), headers: { 'access-control-allow-origin': origin } });
  });
  await page.goto(`${origin}${path}?utm_source=example&email=never-forward@example.invalid`);
  await page.locator('.hero-actions [data-journey="starter-request"]').click();
  const form = page.locator('[data-starter-request-form]');
  await form.getByRole('textbox', { name: 'Email address' }).fill('visitor@example.invalid');
  await form.getByRole('textbox', { name: 'Organization' }).fill('Licensing office');
  await form.getByRole('textbox', { name: 'Your role' }).fill('Service owner');
  await form.getByRole('textbox', { name: 'What are you trying to do?' }).fill('Record professional licences.');
  await form.getByRole('button', { name: 'Send request' }).click();
  await form.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  assert.equal(submissions.length, 1);
  assert.match(submissions[0]['mauticform[request_token]'], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual({ ...submissions[0], 'mauticform[request_token]': '<uuid>' }, {
    'mauticform[email]': 'visitor@example.invalid',
    'mauticform[organization]': 'Licensing office',
    'mauticform[role]': 'Service owner',
    'mauticform[message]': 'Record professional licences.',
    'mauticform[starter_id]': 'professional-licensing',
    'mauticform[source_page]': '/starters/professional-licensing/',
    'mauticform[request_token]': '<uuid>',
    'mauticform[website]': '',
    'mauticform[formId]': '1',
  });
  assert.equal(outbound.length, 1, 'only the submission endpoint is contacted');
  assert.equal(outbound[0].headers()['referer'], undefined);
  assert.equal(outbound[0].headers()['cookie'], undefined);
  assert.deepEqual(await context.cookies(), []);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal(await form.getByRole('checkbox').count(), 0, 'no tracking consent required');
  assert.equal(await form.getByRole('button', { name: 'Send request' }).isDisabled(), true);
  assert.deepEqual(browserErrors, []);
  const accessibility = await new AxeBuilder({ page }).include('#starter-request-form').analyze();
  assert.deepEqual(accessibility.violations, []);

  // Failures retain the visitor's details and never pretend a request was saved.
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, route => route.fulfill({ json: { success: 0 }, headers: { 'access-control-allow-origin': origin } }));
  await page.reload();
  await form.getByRole('textbox', { name: 'Email address' }).fill('retry@example.invalid');
  await form.getByRole('textbox', { name: 'What are you trying to do?' }).fill('Keep this text.');
  await form.getByRole('button', { name: 'Send request' }).click();
  await form.locator('[data-starter-request-error]').waitFor({ state: 'visible' });
  assert.equal(await form.getByRole('textbox', { name: 'Email address' }).inputValue(), 'retry@example.invalid');
  assert.equal(await form.getByRole('textbox', { name: 'What are you trying to do?' }).inputValue(), 'Keep this text.');
  assert.equal(await form.getByRole('button', { name: 'Send request' }).isEnabled(), true);

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.goto(`${origin}/starters/health-facilities/`);
  assert.equal(await page.locator('[data-starter-request-form]').count(), 0);
  assert.match(await page.locator('.hero-actions [data-journey="starter-request"]').getAttribute('href'), /^mailto:/);
  await context.close();

  // Disabling the integration must ignore identifiers left by an earlier visit.
  const disabledTracking = await browser.newContext();
  await disabledTracking.addInitScript(() => {
    localStorage.setItem('registrystack.marketing-tracking', JSON.stringify({ version: 1, choice: 'accepted', expiresAt: Date.now() + 86400000 }));
    localStorage.setItem('mautic_device_id', 'a'.repeat(23));
  });
  let disabledSubmission;
  await disabledTracking.route(networkEndpoint, route => {
    disabledSubmission = Object.fromEntries(new URLSearchParams(route.request().postData()));
    return route.fulfill({ json: successfulMauticResponse(disabledSubmission), headers: { 'access-control-allow-origin': origin } });
  });
  const disabledPage = await disabledTracking.newPage();
  await disabledPage.goto(`${origin}${path}`);
  await disabledPage.getByRole('textbox', { name: 'Email address' }).fill('disabled@example.invalid');
  await disabledPage.getByRole('button', { name: 'Send request' }).click();
  await disabledPage.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  assert.equal(disabledSubmission.mautic_device_id, undefined);
  assert.equal(disabledSubmission.tracking_consent, undefined);
  assert.equal(disabledSubmission['mauticform[formId]'], '1');
  assert.equal(await disabledPage.locator('[data-tracking-preferences]').count(), 0);
  await disabledTracking.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noJs.newPage();
  await fallback.goto(`${origin}${path}`);
  assert.equal(await fallback.getByRole('button', { name: 'Send request' }).isDisabled(), true);
  assert.match(await fallback.locator('.starter-request-fallback a').getAttribute('href'), /^mailto:/);
  await noJs.close();
  console.log('Starter request browser checks passed: saved details, no consent/cookies/tracking, failure recovery, accessibility, mobile, no-JS fallback and other starters.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
