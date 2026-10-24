// Browser contract checks with a deterministic tracking server. The optional
// check-starter-request-mautic.mjs exercises the real Mautic implementation.
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
const scratch = await mkdtemp(join(cache, 'marketing-tracking-'));
const dist = join(scratch, 'dist');
const tracker = 'https://mautic.example.test';
const endpoint = 'https://forms.example.test/form/submit?formId=1&privacy=kiosk';
const trackedEndpoint = 'https://forms.example.test/form/submit?formId=2&privacy=consented';
const networkEndpoint = `${endpoint}&ajax=1`;
const trackedNetworkEndpoint = `${trackedEndpoint}&ajax=1`;
const resultAliases = ['email', 'organization', 'role', 'message', 'starter_id', 'source_page', 'request_token'];
function successfulMauticResponse(data) {
  return {
    success: 1,
    results: Object.fromEntries(resultAliases.map(alias => [alias, data[`mauticform[${alias}]`]])),
  };
}
const build = spawnSync('npm', ['run', 'build', '--', '--outDir', dist], {
  cwd: root, encoding: 'utf8',
  env: { ...process.env, PUBLIC_STARTER_REQUEST_ENDPOINT: endpoint, PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: trackedEndpoint, PUBLIC_MAUTIC_URL: tracker, PUBLIC_UMAMI_WEBSITE_ID: '' },
});
assert.equal(build.status, 0, build.stderr || build.stdout);
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
const browser = await chromium.launch();
const consentKey = 'registrystack.marketing-tracking';
const identityKeys = ['mtc_id', 'mautic_device_id'];
const requests = [];
const pageviews = [];
const submissions = [];
const errors = [];
let nextIdentity = 0;

// Implements only the documented queue and identity response contract. The
// production integration is also tested against an installed Mautic instance.
const trackerScript = `(() => {
  const queued = window.mt.q || [];
  window.mt = (command, event, data, callbacks = {}) => {
    if (command !== 'send' || event !== 'pageview') return;
    const body = new URLSearchParams(data);
    const device = localStorage.getItem('mautic_device_id');
    if (device) body.set('mautic_device_id', device);
    fetch(${JSON.stringify(`${tracker}/mtc/event`)}, { method: 'POST', body, credentials: 'include' })
      .then(response => response.json()).then(result => {
        for (const key of ['mtc_id', 'mautic_device_id']) {
          localStorage.setItem(key, result[key]);
          document.cookie = key + '=' + result[key] + '; Path=/; SameSite=Lax';
        }
        callbacks.onload?.();
      }).catch(() => callbacks.onerror?.());
  };
  for (const args of queued) window.mt(...args);
})();`;

async function configure(context) {
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route(`${tracker}/**`, async route => {
    requests.push(route.request().url());
    const path = new URL(route.request().url()).pathname;
    if (path === '/mtc.js') return route.fulfill({ contentType: 'text/javascript', body: trackerScript });
    assert.equal(path, '/mtc/event');
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    pageviews.push(data);
    const device = data.mautic_device_id || `a${String(++nextIdentity).padStart(22, '0')}`;
    return route.fulfill({
      json: { mtc_id: String(nextIdentity), mautic_device_id: device },
      headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
    });
  });
  for (const submissionEndpoint of [networkEndpoint, trackedNetworkEndpoint]) {
    await context.route(submissionEndpoint, route => {
      const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
      submissions.push({ endpoint: route.request().url(), ...data });
      return route.fulfill({ json: successfulMauticResponse(data), headers: { 'access-control-allow-origin': origin } });
    });
  }
}

async function submit(page, email) {
  const form = page.locator('[data-starter-request-form]');
  await form.getByRole('textbox', { name: 'Email address' }).fill(email);
  await form.getByRole('button', { name: 'Send request' }).click();
  await form.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
}

async function deviceId(page) {
  await page.waitForFunction(() => /^[a-z0-9]{23}$/.test(localStorage.getItem('mautic_device_id') || ''));
  return page.evaluate(() => localStorage.getItem('mautic_device_id'));
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await configure(context);
  const page = await context.newPage();
  await page.goto(`${origin}/starters/professional-licensing/?email=private@example.invalid#private`);
  const panel = page.locator('[data-tracking-preferences]');
  await panel.waitFor({ state: 'visible' });
  assert.equal(requests.length, 0, 'no tracker request before a choice');
  assert.deepEqual(await context.cookies(), []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.deepEqual((await new AxeBuilder({ page }).include('[data-tracking-preferences]').analyze()).violations, []);
  await page.screenshot({ path: join(scratch, 'tracking-desktop.png') });
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(scratch, 'tracking-mobile.png') });
  await panel.getByRole('button', { name: 'Reject optional cookies' }).click();
  await submit(page, 'untracked@example.invalid');
  assert.equal(submissions.at(-1).endpoint, networkEndpoint);
  assert.equal(submissions.at(-1)['mauticform[formId]'], '1');
  assert.equal(submissions.at(-1).tracking_consent, undefined);
  assert.equal(submissions.at(-1).mautic_device_id, undefined);
  assert.equal(requests.length, 0);

  await page.goto(`${origin}/solutions/licensing/?utm_source=conference&utm_campaign=licensing&email=private@example.invalid&utm_content=private%40example.invalid#secret`);
  assert.equal(await panel.isVisible(), false, 'rejection is remembered');
  await page.locator('[data-tracking-preferences-open]').click();
  await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
  const firstDevice = await deviceId(page);
  assert.equal(pageviews.length, 1);
  assert.equal(pageviews[0].page_url, 'https://registrystack.org/solutions/licensing/');
  assert.equal(pageviews[0].utm_source, 'conference');
  assert.equal(pageviews[0].utm_campaign, 'licensing');
  assert.equal(pageviews[0].utm_content ?? '', '');
  assert.equal(pageviews[0].page_referrer, '');
  assert.equal(pageviews[0].referrer, undefined);
  assert.ok(!JSON.stringify(pageviews).includes('private'));
  await page.goto(`${origin}/pricing/`);
  assert.equal(await deviceId(page), firstDevice);
  await page.goto(`${origin}/starters/professional-licensing/`);
  assert.equal(await deviceId(page), firstDevice);
  await submit(page, 'consented@example.invalid');
  assert.equal(submissions.at(-1).endpoint, trackedNetworkEndpoint);
  assert.equal(submissions.at(-1)['mauticform[formId]'], '2');
  assert.equal(submissions.at(-1).tracking_consent, undefined);
  assert.equal(submissions.at(-1).mautic_device_id, firstDevice);
  assert.equal(pageviews.length, 3, 'one pageview per page');
  assert.ok(!JSON.stringify(pageviews).includes('@'), 'no lead email enters tracking data');

  const secondTab = await context.newPage();
  await secondTab.goto(`${origin}/pricing/`);
  await deviceId(secondTab);
  const beforeWithdraw = requests.length;
  await page.locator('[data-tracking-preferences-open]').click();
  await Promise.all([page.waitForEvent('load'), panel.getByRole('button', { name: 'Reject optional cookies' }).click()]);
  assert.equal(requests.length, beforeWithdraw, 'withdrawal does not send another tracking request');
  assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), identityKeys), [null, null]);
  assert.ok((await context.cookies()).every(cookie => !identityKeys.includes(cookie.name)));
  await secondTab.waitForFunction(() => !document.querySelector('script[data-registry-mautic]'));
  await submit(page, 'withdrawn@example.invalid');
  assert.equal(submissions.at(-1).endpoint, networkEndpoint);
  assert.equal(submissions.at(-1)['mauticform[formId]'], '1');
  assert.equal(submissions.at(-1).mautic_device_id, undefined);
  await page.locator('[data-tracking-preferences-open]').click();
  await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
  assert.notEqual(await deviceId(page), firstDevice, 're-consent starts a fresh profile');

  await page.evaluate(key => {
    const preference = JSON.parse(localStorage.getItem(key));
    preference.expiresAt = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(preference));
  }, consentKey);
  const beforeExpiry = requests.length;
  await page.reload();
  await panel.waitFor({ state: 'visible' });
  assert.equal(requests.length, beforeExpiry);
  assert.equal(await page.evaluate(() => localStorage.getItem('mautic_device_id')), null);
  await context.close();

  for (const signal of ['doNotTrack', 'globalPrivacyControl']) {
    const denied = await browser.newContext();
    await denied.addInitScript(signal => {
      Object.defineProperty(navigator, signal, { value: signal === 'doNotTrack' ? '1' : true });
    }, signal);
    await configure(denied);
    const deniedPage = await denied.newPage();
    const before = requests.length;
    await deniedPage.goto(`${origin}/starters/professional-licensing/`);
    await deniedPage.locator('[data-tracking-preferences-open]').click();
    assert.equal(await deniedPage.getByRole('button', { name: 'Accept optional cookies' }).isDisabled(), true);
    await deniedPage.getByRole('button', { name: 'Reject optional cookies' }).click();
    await submit(deniedPage, 'signal@example.invalid');
    assert.equal(submissions.at(-1).endpoint, networkEndpoint);
    assert.equal(submissions.at(-1)['mauticform[formId]'], '1');
    assert.equal(submissions.at(-1).mautic_device_id, undefined);
    assert.equal(requests.length, before);
    await denied.close();
  }

  const sameDocument = await browser.newContext();
  await configure(sameDocument);
  const sameDocumentPage = await sameDocument.newPage();
  const pageviewsBeforeSameDocumentChoice = pageviews.length;
  await sameDocumentPage.goto(`${origin}/starters/professional-licensing/`);
  const sameDocumentPanel = sameDocumentPage.locator('[data-tracking-preferences]');
  await sameDocumentPanel.getByRole('button', { name: 'Reject optional cookies' }).click();
  await sameDocumentPage.locator('[data-tracking-preferences-open]').click();
  await sameDocumentPanel.getByRole('button', { name: 'Accept optional cookies' }).click();
  const sameDocumentDevice = await deviceId(sameDocumentPage);
  assert.equal(
    pageviews.length,
    pageviewsBeforeSameDocumentChoice + 1,
    'accepting after initial rejection in the same document sends one pageview',
  );
  await submit(sameDocumentPage, 'same-document@example.invalid');
  assert.equal(submissions.at(-1).endpoint, trackedNetworkEndpoint);
  assert.equal(submissions.at(-1)['mauticform[formId]'], '2');
  assert.equal(submissions.at(-1).mautic_device_id, sameDocumentDevice);
  await sameDocument.close();

  assert.deepEqual(errors, []);
  console.log('Marketing browser checks passed: default/reject/DNT/GPC, same-document accept after reject, sanitized page attribution, opted-in request, withdrawal across tabs, re-consent, expiry, accessibility and mobile.');
  console.log(`Screenshots: ${scratch}`);
} finally {
  await browser.close();
  website.closeAllConnections();
  await new Promise(resolve => website.close(resolve));
}
