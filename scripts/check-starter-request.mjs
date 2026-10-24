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
const unconfiguredDist = join(scratch, 'unconfigured-dist');
const endpoint = 'https://starter-requests.example.test/form/submit?formId=1&privacy=kiosk';
const networkEndpoint = `${endpoint}&ajax=1`;
const resultAliases = [
  'email',
  'organization',
  'role',
  'message',
  'starter_id',
  'source_page',
  'request_token',
  'request_type',
  'request_context',
];
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
const unconfiguredBuild = spawnSync('npm', ['run', 'build', '--', '--outDir', unconfiguredDist], {
  cwd: root, encoding: 'utf8',
  env: { ...process.env, PUBLIC_STARTER_REQUEST_ENDPOINT: '', PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: '', PUBLIC_UMAMI_WEBSITE_ID: '', PUBLIC_MAUTIC_URL: '' },
});
assert.equal(unconfiguredBuild.status, 0, unconfiguredBuild.stderr || unconfiguredBuild.stdout);
const createStaticServer = serveDir => createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(serveDir, `.${path.endsWith('/') ? `${path}index.html` : path}`);
  if (!file.startsWith(`${serveDir}${sep}`)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
const server = createStaticServer(dist);
const unconfiguredServer = createStaticServer(unconfiguredDist);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await new Promise(resolve => unconfiguredServer.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const unconfiguredOrigin = `http://127.0.0.1:${unconfiguredServer.address().port}`;
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
  await form.getByRole('button', { name: 'Request access' }).click();
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
    'mauticform[request_type]': 'starter',
    'mauticform[request_context]': 'Professional licensing',
    'mauticform[website]': '',
    'mauticform[formId]': '1',
  });
  assert.equal(outbound.length, 1, 'only the submission endpoint is contacted');
  assert.equal(outbound[0].headers()['referer'], undefined);
  assert.equal(outbound[0].headers()['cookie'], undefined);
  assert.deepEqual(await context.cookies(), []);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal(await form.getByRole('checkbox').count(), 0, 'no tracking consent required');
  assert.equal(await form.getByRole('button', { name: 'Request access' }).isDisabled(), true);
  assert.deepEqual(browserErrors, []);
  const accessibility = await new AxeBuilder({ page }).include('#starter-request-form').analyze();
  assert.deepEqual(accessibility.violations, []);

  // Failures retain the visitor's details and never pretend a request was saved.
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, route => route.fulfill({ json: { success: 0 }, headers: { 'access-control-allow-origin': origin } }));
  await page.reload();
  await form.getByRole('textbox', { name: 'Email address' }).fill('retry@example.invalid');
  await form.getByRole('textbox', { name: 'What are you trying to do?' }).fill('Keep this text.');
  await form.getByRole('button', { name: 'Request access' }).click();
  await form.locator('[data-starter-request-error]').waitFor({ state: 'visible' });
  assert.equal(await form.getByRole('textbox', { name: 'Email address' }).inputValue(), 'retry@example.invalid');
  assert.equal(await form.getByRole('textbox', { name: 'What are you trying to do?' }).inputValue(), 'Keep this text.');
  assert.equal(await form.getByRole('button', { name: 'Request access' }).isEnabled(), true);
  assert.equal(await page.locator('.starter-request-fallback').isVisible(), true);

  // A confirmed retry clears the recovery prompt along with the error.
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, async route => {
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    await route.fulfill({ json: successfulMauticResponse(data), headers: { 'access-control-allow-origin': origin } });
  });
  await form.getByRole('button', { name: 'Request access' }).click();
  await form.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  assert.equal(await form.locator('[data-starter-request-error]').isVisible(), false);
  assert.equal(await page.locator('.starter-request-fallback').isVisible(), false);

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.goto(`${origin}/starters/health-facilities/`);
  assert.equal(await page.locator('[data-starter-request-form]').count(), 1);
  assert.equal(await page.locator('.hero-actions [data-journey="starter-request"]').getAttribute('href'), '#starter-request-form');

  // A same-origin contact link records its path explicitly because the site's
  // strict referrer policy intentionally omits it.
  await page.unroute(networkEndpoint);
  await page.route(networkEndpoint, async route => {
    const data = Object.fromEntries(new URLSearchParams(route.request().postData()));
    submissions.push(data);
    await route.fulfill({ json: successfulMauticResponse(data), headers: { 'access-control-allow-origin': origin } });
  });
  submissions = [];
  await page.goto(`${origin}/pricing/`);
  await page.getByRole('link', { name: 'Request a proposal' }).click();
  assert.equal(new URL(page.url()).searchParams.get('source'), '/pricing/');
  const proposalForm = page.locator('[data-starter-request-form]');
  await proposalForm.getByRole('textbox', { name: 'Email address' }).fill('programme-owner@example.invalid');
  await proposalForm.getByRole('textbox', { name: 'What should the proposal cover?' }).fill('Scope a licensing implementation.');
  await proposalForm.getByRole('button', { name: 'Request a proposal' }).click();
  await proposalForm.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  assert.equal(submissions[0]['mauticform[source_page]'], '/pricing/');
  assert.equal(submissions[0]['mauticform[request_type]'], 'proposal');

  // Direct contact URLs carry only bounded public context. Invalid source
  // values fall back to /contact/ and never forward queries or origins.
  submissions = [];
  await page.goto('about:blank');
  await page.goto(`${origin}/contact/?type=service&context=Licensing+review&email=never-forward@example.invalid&source=${encodeURIComponent('https://other.example.org/pricing/?email=secret@example.org')}`);
  const contactForm = page.locator('[data-starter-request-form]');
  assert.equal(await page.locator('[data-contact-context]').textContent(), 'About: Licensing review');
  const messageColors = await contactForm.locator('.starter-request-message').evaluate(label => ({
    label: getComputedStyle(label.querySelector('[data-message-label]')).color,
    required: getComputedStyle(label.querySelector('[data-message-required-marker]')).color,
  }));
  assert.notEqual(messageColors.label, messageColors.required, 'only the required marker uses stamp red');
  await contactForm.getByRole('textbox', { name: 'Email address' }).fill('service-owner@example.invalid');
  await contactForm.getByRole('textbox', { name: 'Your service and what you need' }).fill('We need to review licence applications.');
  await contactForm.getByRole('button', { name: 'Send message' }).click();
  await Promise.race([
    contactForm.locator('[data-starter-request-success]').waitFor({ state: 'visible' }),
    contactForm.locator('[data-starter-request-error]').waitFor({ state: 'visible' }).then(() => {
      throw new Error('Contact submission failed.');
    }),
  ]);
  assert.equal(submissions.length, 1);
  assert.deepEqual({ ...submissions[0], 'mauticform[request_token]': '<uuid>' }, {
    'mauticform[email]': 'service-owner@example.invalid',
    'mauticform[organization]': '',
    'mauticform[role]': '',
    'mauticform[message]': 'We need to review licence applications.',
    'mauticform[starter_id]': '',
    'mauticform[source_page]': '/contact/',
    'mauticform[request_token]': '<uuid>',
    'mauticform[request_type]': 'service',
    'mauticform[request_context]': 'Licensing review',
    'mauticform[website]': '',
    'mauticform[formId]': '1',
  });
  await page.goto(`${origin}/contact/?type=privacy&context=Delete+my+visit+history`);
  assert.equal(await page.getByRole('heading', { level: 2, name: 'Send a privacy request' }).count(), 1);
  assert.match(await page.locator('[data-request-privacy-copy]').textContent(), /do not use this request to link your current browser/i);
  assert.equal(await page.getByRole('button', { name: 'Send privacy request' }).count(), 1);
  assert.equal(new URL(await page.locator('[data-request-recovery]').getAttribute('href')).searchParams.get('subject'), 'Privacy request');
  assert.equal(await page.getByRole('textbox', { name: 'Your privacy request' }).getAttribute('required'), '');
  assert.equal(await page.locator('.starter-request-fallback').isVisible(), false);

  await page.goto(`${origin}/contact/?type=starter&context=Professional+licensing`);
  assert.equal(await page.getByRole('heading', { level: 2, name: 'Request access to this starter' }).count(), 1);
  assert.equal(await page.getByRole('textbox', { name: 'What are you trying to do?' }).getAttribute('required'), null);
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
  await disabledPage.getByRole('button', { name: 'Request access' }).click();
  await disabledPage.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  assert.equal(disabledSubmission.mautic_device_id, undefined);
  assert.equal(disabledSubmission.tracking_consent, undefined);
  assert.equal(disabledSubmission['mauticform[formId]'], '1');
  assert.equal(await disabledPage.locator('[data-tracking-preferences]').count(), 0);
  await disabledTracking.close();

  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noJs.newPage();
  await fallback.goto(`${origin}${path}`);
  assert.equal(await fallback.getByRole('button', { name: 'Request access' }).isDisabled(), true);
  assert.match(await fallback.locator('.starter-request-fallback a').getAttribute('href'), /^mailto:/);
  await noJs.close();

  const unconfigured = await browser.newContext();
  const unavailable = await unconfigured.newPage();
  for (const variant of [
    { type: 'privacy', context: 'Delete my visit history', heading: 'Send a privacy request', subject: 'Privacy request' },
    { type: 'proposal', context: 'Licensing implementation', heading: 'Request a proposal', subject: 'Proposal request for Registry Stack' },
    { type: 'starter', context: 'Professional licensing', heading: 'Request access to this starter', subject: 'Starter access request: Professional licensing' },
  ]) {
    await unavailable.goto(`${unconfiguredOrigin}/contact/?type=${variant.type}&context=${encodeURIComponent(variant.context)}`);
    assert.equal(await unavailable.locator('[data-starter-request-form]').count(), 0);
    assert.equal(await unavailable.getByRole('heading', { level: 2, name: variant.heading }).count(), 1);
    assert.equal(await unavailable.locator('[data-request-context-summary]').textContent(), `About: ${variant.context}`);
    assert.equal(new URL(await unavailable.locator('[data-request-recovery]').getAttribute('href')).searchParams.get('subject'), variant.subject);
  }
  await unconfigured.close();

  const unconfiguredNoJs = await browser.newContext({ javaScriptEnabled: false });
  const neutralFallback = await unconfiguredNoJs.newPage();
  await neutralFallback.goto(`${unconfiguredOrigin}/contact/?type=privacy&context=Delete+my+visit+history`);
  assert.equal(await neutralFallback.getByRole('heading', { level: 2, name: 'Send an enquiry' }).count(), 1);
  const neutralRecovery = new URL(await neutralFallback.locator('[data-request-recovery]').getAttribute('href'));
  assert.equal(neutralRecovery.searchParams.get('subject'), 'Contact Registry Stack');
  assert.match(neutralRecovery.searchParams.get('body'), /Request type .*Relevant starter .*Source page:/s);
  await unconfiguredNoJs.close();
  console.log('Enquiry browser checks passed: starter and contact payloads, no consent/cookies/tracking, safe context, failure recovery, accessibility, mobile and no-JS fallback.');
} finally {
  await browser.close();
  server.closeAllConnections();
  unconfiguredServer.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => unconfiguredServer.close(resolve));
}
