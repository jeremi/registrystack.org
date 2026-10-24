// Browser acceptance for the shared consent and Mautic journey. Every HTTP(S)
// request is fulfilled from a local build or a deterministic fixture. The
// optional native-Mautic check exercises the real upstream tracker separately.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { chromium, firefox, webkit } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, 'node_modules/.cache');
await mkdir(cache, { recursive: true });
const scratch = await mkdtemp(join(cache, 'shared-marketing-tracking-'));
const websiteDist = join(scratch, 'website');
const configuredDocsDist = process.env.DOCS_TRACKING_DIST?.trim();
const docsDist = configuredDocsDist ? resolve(configuredDocsDist) : null;
const configuredScreenshotDir = process.env.TRACKING_SCREENSHOT_DIR?.trim();
const screenshotDir = configuredScreenshotDir ? resolve(configuredScreenshotDir) : null;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

const mainOrigin = 'https://registrystack.org';
const docsOrigin = 'https://docs.registrystack.org';
const trackerOrigin = 'https://mautic.example.test';
const formsOrigin = 'https://forms.example.test';
const kioskEndpoint = `${formsOrigin}/form/submit?formId=1&privacy=kiosk`;
const trackedEndpoint = `${formsOrigin}/form/submit?formId=2&privacy=consented`;
const desktopViewport = { width: 1280, height: 900 };
const mobileViewport = { width: 390, height: 844 };
const consentKey = 'registrystack.shared-marketing-tracking.v2';
const localRefusalKey = 'registrystack.tracking-local-refusal.v2';
const identityKey = 'registrystack.shared-mautic-identity.v2';
const nativeIdentityKeys = ['mtc_id', 'mautic_device_id'];
const legacyConsentKey = 'registrystack.marketing-tracking';
const blockedStorageScript = `<script>
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    Object.defineProperty(Storage.prototype, method, {
      configurable: true,
      value() { throw new DOMException('Storage blocked by acceptance fixture.', 'SecurityError'); },
    });
  }
</script>`;
const bridgeRequestProbeScript = `<script>
  window.addEventListener('message', event => {
    const type = event.data?.type;
    if (!['read', 'choose', 'pageview', 'associate'].includes(type)) return;
    void fetch('/__acceptance/bridge-request?type=' + encodeURIComponent(type), {
      method: 'POST',
      keepalive: true,
    });
  });
</script>`;
const resultAliases = [
  'email', 'organization', 'role', 'message', 'starter_id', 'source_page',
  'request_token', 'request_type', 'request_context',
];

const build = spawnSync('npm', ['run', 'build', '--', '--outDir', websiteDist], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
  env: {
    ...process.env,
    PUBLIC_STARTER_REQUEST_ENDPOINT: kioskEndpoint,
    PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT: trackedEndpoint,
    PUBLIC_MAUTIC_URL: trackerOrigin,
    PUBLIC_UMAMI_WEBSITE_ID: '',
  },
});
assert.equal(build.status, 0, build.stderr || build.stdout);

if (docsDist) {
  await access(join(docsDist, 'index.html'));
  const docsIndex = await readFile(join(docsDist, 'index.html'), 'utf8');
  assert.match(
    docsIndex,
    /data-registry-shared-tracking[^>]+data-shared-tracking-bridge-url="https:\/\/registrystack\.org\/tracking-bridge\/"/,
    'DOCS_TRACKING_DIST must be a canonical Registry Docs build with shared tracking enabled.',
  );
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

async function staticAsset(directory, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '');
  const file = resolve(directory, relative === '' || decoded.endsWith('/')
    ? join(relative, 'index.html')
    : relative);
  if (file !== directory && !file.startsWith(`${directory}${sep}`)) return null;
  try {
    return {
      body: await readFile(file),
      contentType: contentTypes[extname(file)] ?? 'application/octet-stream',
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') return null;
    throw error;
  }
}

const fallbackClient = await readFile(join(root, 'src/lib/shared-tracking-client.mjs'), 'utf8');
const fallbackProtocol = await readFile(join(root, 'src/lib/tracking-protocol.mjs'), 'utf8');
const fallbackDocsHtml = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="referrer" content="strict-origin"><title>Registry Docs acceptance</title></head>
  <body>
    <main><h1>Registry Docs acceptance</h1><a href="/privacy/">Privacy</a></main>
    <footer><a href="/privacy/">Privacy</a><button type="button" data-tracking-preferences-open>Tracking preferences</button></footer>
    <aside data-registry-shared-tracking aria-labelledby="docs-tracking-title" hidden>
      <h2 id="docs-tracking-title">Cookies on Registry Stack</h2>
      <p>Optional tracking covers the main website and documentation.</p>
      <p data-tracking-error role="alert" hidden>Shared tracking is unavailable. Tracking remains off.</p>
      <button type="button" data-choice="accepted">Accept optional cookies</button>
      <button type="button" data-choice="rejected">Reject optional cookies</button>
    </aside>
    <script type="module">
      import { buildMauticPageview, createSharedTrackingClient } from '/shared-tracking-client.mjs';
      const panel = document.querySelector('[data-registry-shared-tracking]');
      const error = panel.querySelector('[data-tracking-error]');
      let sentGeneration = null;
      let pendingGeneration = null;
      const showError = () => { panel.hidden = false; error.hidden = false; };
      const client = createSharedTrackingClient({ onFailure: showError });
      const render = state => {
        if (state.choice === null) { panel.hidden = false; return; }
        panel.hidden = true;
        if (state.choice !== 'accepted' || !state.generation ||
            state.generation === sentGeneration || state.generation === pendingGeneration) return;
        pendingGeneration = state.generation;
        const pageview = buildMauticPageview({
          canonicalUrl: location.origin + location.pathname,
          currentUrl: location.href,
          pageTitle: document.title,
          referrer: document.referrer,
        });
        client.pageview(pageview).then(() => { sentGeneration = state.generation; })
          .catch(showError).finally(() => { pendingGeneration = null; });
      };
      client.subscribe(render);
      document.querySelector('[data-tracking-preferences-open]').addEventListener('click', () => {
        panel.hidden = false;
      });
      for (const button of panel.querySelectorAll('[data-choice]')) {
        button.addEventListener('click', () => client.choose(button.dataset.choice).then(render).catch(showError));
      }
      client.read().then(render).catch(showError);
    </script>
  </body>
</html>`;

function fallbackDocsAsset(pathname) {
  if (pathname === '/shared-tracking-client.mjs') {
    return { body: fallbackClient, contentType: contentTypes['.js'] };
  }
  if (pathname === '/tracking-protocol.mjs') {
    return { body: fallbackProtocol, contentType: contentTypes['.js'] };
  }
  if (pathname.endsWith('/')) {
    return { body: fallbackDocsHtml, contentType: contentTypes['.html'] };
  }
  return null;
}

function successfulFormResponse(data) {
  return {
    success: 1,
    results: Object.fromEntries(
      resultAliases.map(alias => [alias, data[`mauticform[${alias}]`]]),
    ),
  };
}

const trackerScript = `(() => {
  const queued = window.mt?.q ? [...window.mt.q] : [];
  const deliver = (command, event, data, callbacks = {}) => {
    if (command !== 'send' || event !== 'pageview') return;
    const body = new URLSearchParams(data);
    const device = localStorage.getItem('mtc_id') && localStorage.getItem('mautic_device_id');
    if (device) body.set('mautic_device_id', device);
    fetch(${JSON.stringify(`${trackerOrigin}/mtc/event`)}, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      credentials: 'include',
    }).then(response => response.json()).then(response => {
      if (response.id) {
        localStorage.setItem('mtc_id', response.id);
        localStorage.setItem('mautic_device_id', response.device_id);
        document.cookie = 'mtc_id=' + response.id + '; Path=/; SameSite=Lax';
        document.cookie = 'mautic_device_id=' + response.device_id + '; Path=/; SameSite=Lax';
      }
      document.dispatchEvent(new CustomEvent('mauticPageEventDelivered', {
        detail: { response },
      }));
      callbacks.onload?.({ response });
    }).catch(() => callbacks.onerror?.());
  };
  window.mt = deliver;
  for (const args of queued) deliver(...args);
})();`;

function createRecords(engine) {
  return {
    engine,
    errors: [],
    formSubmissions: [],
    pageviews: [],
    blocked: [],
    bridgeLoads: 0,
    bridgeRequests: [],
    docsCookieHeaders: [],
    nativeRequests: [],
    nativeEventRequests: 0,
    nextDevice: 0,
    nextContact: 0,
    contacts: new Map(),
  };
}

function deferred() {
  let release;
  const promise = new Promise(resolvePromise => { release = resolvePromise; });
  return { promise, release };
}

function delay(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));
}

async function configureContext(context, records, {
  blockBridge = false,
  blockStorage = false,
  excludeNativeVisitors = false,
  bridgeControl,
} = {}) {
  context.on('page', page => {
    page.on('pageerror', error => records.errors.push(`${page.url()}: ${error.message}`));
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.origin === mainOrigin) {
      if (url.pathname === '/__acceptance/bridge-request') {
        records.bridgeRequests.push(url.searchParams.get('type'));
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (url.pathname === '/tracking-bridge/') {
        records.bridgeLoads += 1;
      }
      if (bridgeControl?.failLoads > 0 && url.pathname === '/tracking-bridge/') {
        bridgeControl.failLoads -= 1;
        records.blocked.push(url.href);
        await route.abort('failed');
        return;
      }
      if (blockBridge && url.pathname === '/tracking-bridge/') {
        records.blocked.push(url.href);
        await route.fulfill({
          status: 503,
          contentType: contentTypes['.html'],
          body: '<!doctype html><title>Tracking bridge unavailable</title>',
        });
        return;
      }
      if (
        bridgeControl?.delayLoadNumber === records.bridgeLoads &&
        url.pathname === '/tracking-bridge/'
      ) {
        bridgeControl.delayStarted = true;
        bridgeControl.delayStartedAt = Date.now();
        if (bridgeControl.delayLoadMs !== undefined) {
          await delay(bridgeControl.delayLoadMs);
        } else {
          await bridgeControl.delayGate.promise;
        }
      }
      const asset = await staticAsset(websiteDist, url.pathname);
      if (blockStorage && url.pathname === '/tracking-bridge/' && asset) {
        asset.body = asset.body.toString().replace('<head>', `<head>${blockedStorageScript}`);
      }
      if (bridgeControl?.instrument && url.pathname === '/tracking-bridge/' && asset) {
        asset.body = asset.body.toString().replace('<head>', `<head>${bridgeRequestProbeScript}`);
      }
      await route.fulfill(asset ? { status: 200, ...asset } : { status: 404, body: 'Not found' });
      return;
    }

    if (url.origin === docsOrigin) {
      records.docsCookieHeaders.push(request.headers().cookie ?? '');
      const asset = docsDist ? await staticAsset(docsDist, url.pathname) : fallbackDocsAsset(url.pathname);
      if (asset) {
        await route.fulfill({ status: 200, ...asset });
      } else if (docsDist && request.resourceType() === 'document') {
        const notFound = await staticAsset(docsDist, '/404.html');
        await route.fulfill({ status: 404, ...notFound });
      } else {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
      return;
    }

    if (url.origin === trackerOrigin) {
      records.nativeRequests.push(url.href);
      if (url.pathname === '/mtc.js') {
        await route.fulfill({ status: 200, contentType: contentTypes['.js'], body: trackerScript });
        return;
      }
      assert.equal(url.pathname, '/mtc/event');
      records.nativeEventRequests += 1;
      if (excludeNativeVisitors) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': mainOrigin,
            'access-control-allow-credentials': 'true',
          },
          json: { success: 1, id: null, device_id: null, events: [false] },
        });
        return;
      }
      if (bridgeControl?.failNativeEvents > 0) {
        bridgeControl.failNativeEvents -= 1;
        records.blocked.push(url.href);
        await route.abort('failed');
        return;
      }
      if (bridgeControl?.delayNativeEventNumber === records.nativeEventRequests) {
        bridgeControl.nativeDelayStarted = true;
        bridgeControl.nativeDelayStartedAt = Date.now();
        await delay(bridgeControl.delayNativeEventMs);
        bridgeControl.nativeDelayCompletedAt = Date.now();
      }
      const data = Object.fromEntries(new URLSearchParams(request.postData() ?? ''));
      let deviceId = data.mautic_device_id;
      if (!deviceId) deviceId = `a${String(++records.nextDevice).padStart(22, '0')}`;
      let contactId = records.contacts.get(deviceId);
      if (!contactId) {
        contactId = String(++records.nextContact);
        records.contacts.set(deviceId, contactId);
      }
      records.pageviews.push({ ...data, deviceId, contactId });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': mainOrigin,
          'access-control-allow-credentials': 'true',
        },
        json: { id: contactId, device_id: deviceId },
      });
      return;
    }

    if (url.origin === formsOrigin) {
      assert.equal(url.pathname, '/form/submit');
      const data = Object.fromEntries(new URLSearchParams(request.postData() ?? ''));
      records.formSubmissions.push({ url: url.href, data, receivedAt: Date.now() });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': mainOrigin },
        json: successfulFormResponse(data),
      });
      return;
    }

    records.blocked.push(url.href);
    await route.abort('blockedbyclient');
  });
}

async function waitFor(predicate, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 25));
  }
  assert.fail(message);
}

async function submitForm(page, { email, message = '' }) {
  const form = page.locator('[data-starter-request-form]');
  await form.waitFor({ state: 'visible' });
  await form.locator('[data-starter-request-fields]').waitFor({ state: 'visible' });
  await form.getByRole('textbox', { name: 'Email address' }).fill(email);
  const messageBox = form.locator('textarea[name="message"]');
  if (message && await messageBox.count()) await messageBox.fill(message);
  await form.locator('button[type="submit"]').click();
  await form.locator('[data-starter-request-success]').waitFor({ state: 'visible' });
  return form;
}

function latestSubmission(records) {
  const submission = records.formSubmissions.at(-1);
  assert.ok(submission, 'Expected a captured form submission.');
  return submission;
}

function assertKioskSubmission(submission) {
  const url = new URL(submission.url);
  assert.equal(url.searchParams.get('formId'), '1');
  assert.equal(url.searchParams.get('privacy'), 'kiosk');
  assert.equal(submission.data['mauticform[formId]'], '1');
  assert.equal(submission.data.mautic_device_id, undefined);
}

async function assertNoIdentityInDocs(page, records, deviceIds) {
  const storage = await page.evaluate(() => Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(Boolean)
      .map(key => [key, localStorage.getItem(key)]),
  ));
  for (const key of [consentKey, identityKey, ...nativeIdentityKeys]) {
    assert.equal(storage[key], undefined, `Registry Docs must not store ${key}.`);
  }
  const serialized = JSON.stringify(storage);
  for (const deviceId of deviceIds) assert.ok(!serialized.includes(deviceId));
  const docsDocumentCookies = await page.evaluate(() => document.cookie);
  for (const key of nativeIdentityKeys) {
    assert.ok(!docsDocumentCookies.includes(`${key}=`), `Registry Docs can read ${key}.`);
    assert.ok(
      records.docsCookieHeaders.every(header => !header.includes(`${key}=`)),
      `Registry Docs received ${key} in an HTTP request.`,
    );
  }
}

async function assertCleanUrls(pages, deviceIds) {
  for (const page of pages) {
    const url = page.url();
    assert.ok(!/[?&](?:mtc_id|mautic_device_id)=/i.test(url), `Identity leaked into URL: ${url}`);
    for (const deviceId of deviceIds) assert.ok(!url.includes(deviceId), `Device ID leaked into URL: ${url}`);
  }
}

async function assertMobileConsentPanel(page, panel, engine, surface) {
  await page.setViewportSize(mobileViewport);
  await panel.waitFor({ state: 'visible' });
  const controls = [
    panel.getByRole('button', { name: 'Accept optional cookies' }),
    panel.getByRole('button', { name: 'Reject optional cookies' }),
  ];
  for (const control of controls) assert.equal(await control.isVisible(), true);

  const layout = await panel.evaluate((element, expectedViewport) => {
    const bounds = node => {
      const rect = node.getBoundingClientRect();
      return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
    };
    return {
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      panel: bounds(element),
      controls: [...element.querySelectorAll('button')].map(bounds),
      expectedViewport,
    };
  }, mobileViewport);
  assert.deepEqual(
    { width: layout.innerWidth, height: layout.innerHeight },
    mobileViewport,
    `${engine}: ${surface} mobile viewport was not applied.`,
  );
  assert.ok(
    Math.max(layout.bodyScrollWidth, layout.documentScrollWidth) <= mobileViewport.width,
    `${engine}: ${surface} consent page has horizontal overflow at 390px.`,
  );
  for (const [label, bounds] of [
    ['panel', layout.panel],
    ['accept control', layout.controls[0]],
    ['reject control', layout.controls[1]],
  ]) {
    assert.ok(
      bounds.left >= 0 && bounds.right <= layout.innerWidth &&
        bounds.top >= 0 && bounds.bottom <= layout.innerHeight,
      `${engine}: ${surface} ${label} is outside the mobile viewport.`,
    );
  }
  assert.deepEqual(
    (await new AxeBuilder({ page }).include(
      surface === 'main' ? '[data-tracking-preferences]' : '[data-registry-shared-tracking]',
    ).analyze()).violations,
    [],
    `${engine}: ${surface} mobile tracking preferences must pass axe.`,
  );
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, `${engine}-${surface}-tracking-preferences-mobile.png`),
    });
  }
  await page.setViewportSize(desktopViewport);
}

async function runKioskScenario(browser, engine, records, mode) {
  console.log(`${engine}: checking ${mode} kiosk mode.`);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  if (mode === 'dnt' || mode === 'gpc') {
    await context.addInitScript(selected => {
      Object.defineProperty(navigator, selected === 'dnt' ? 'doNotTrack' : 'globalPrivacyControl', {
        configurable: true,
        value: selected === 'dnt' ? '1' : true,
      });
    }, mode);
  }
  if (mode === 'storage') {
    await context.addInitScript(origin => {
      if (location.origin !== origin) return;
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        Object.defineProperty(Storage.prototype, method, {
          configurable: true,
          value() { throw new DOMException('Storage blocked by acceptance fixture.', 'SecurityError'); },
        });
      }
    }, mainOrigin);
  }
  if (mode === 'legacy') {
    await context.addInitScript(({ origin, key }) => {
      if (location.origin === origin) {
        localStorage.setItem(key, JSON.stringify({ choice: 'accepted', expiresAt: Date.now() + 60_000 }));
      }
    }, { origin: mainOrigin, key: legacyConsentKey });
  }
  await configureContext(context, records, {
    blockBridge: mode === 'bridge',
    blockStorage: mode === 'storage',
  });
  const page = await context.newPage();
  const pageviewsBefore = records.pageviews.length;
  const submissionsBefore = records.formSubmissions.length;
  await page.goto(`${mainOrigin}/starters/professional-licensing/`);
  const panel = page.locator('[data-tracking-preferences]');

  if (mode === 'dnt' || mode === 'gpc') {
    await page.locator('[data-tracking-preferences-open]').click();
    assert.equal(await panel.getByRole('button', { name: 'Accept optional cookies' }).isDisabled(), true);
  } else if (mode === 'storage') {
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    try {
      await panel.locator('[data-tracking-error]').waitFor({ state: 'visible' });
    } catch (error) {
      const state = await page.evaluate(() => {
        let storageProbe = 'succeeded';
        try { localStorage.getItem('acceptance-probe'); } catch (cause) { storageProbe = cause.name; }
        return {
          storageProbe,
          panelHidden: document.querySelector('[data-tracking-preferences]')?.hidden,
          errorHidden: document.querySelector('[data-tracking-error]')?.hidden,
        };
      });
      assert.fail(`${engine}: blocked storage did not report failure: ${JSON.stringify({
        ...state,
        pageviews: records.pageviews.length - pageviewsBefore,
        cause: error.message,
      })}`);
    }
  } else if (mode === 'bridge') {
    try {
      await panel.locator('[data-tracking-error]').waitFor({ state: 'visible', timeout: 12_000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        frameCount: document.querySelectorAll('iframe[src="https://registrystack.org/tracking-bridge/"]').length,
        panelHidden: document.querySelector('[data-tracking-preferences]')?.hidden,
        errorHidden: document.querySelector('[data-tracking-error]')?.hidden,
      }));
      assert.fail(`${engine}: blocked bridge did not report failure: ${JSON.stringify({
        ...state,
        blocked: records.blocked,
        cause: error.message,
      })}`);
    }
  } else {
    await panel.waitFor({ state: 'visible' });
  }

  await submitForm(page, { email: `${mode}-${engine}@example.invalid` });
  assert.equal(records.formSubmissions.length, submissionsBefore + 1);
  assertKioskSubmission(latestSubmission(records));
  assert.equal(records.pageviews.length, pageviewsBefore, `${mode} must not create a pageview.`);
  await context.close();
}

async function runBridgeRecoveryScenario(browser, engine) {
  console.log(`${engine}: checking bridge recovery without reload.`);
  const records = createRecords(`${engine}-bridge-recovery`);
  const bridgeControl = { failLoads: 1, instrument: true };
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records, { bridgeControl });
    const page = await context.newPage();
    await page.goto(`${mainOrigin}/solutions/licensing/`);
    const documentToken = await page.evaluate(() => {
      window.__trackingRecoveryDocument = crypto.randomUUID();
      return window.__trackingRecoveryDocument;
    });
    const panel = page.locator('[data-tracking-preferences]');
    await panel.locator('[data-tracking-error]').waitFor({ state: 'visible', timeout: 9_000 });
    assert.equal(records.bridgeLoads, 1, `${engine}: initial bridge failure retried before user action.`);

    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(
      () => records.pageviews.length === 1,
      `${engine}: consent did not recover after the initial bridge load failure.`,
      10_000,
    );
    assert.ok(records.bridgeLoads >= 2, `${engine}: recovery did not replace the failed bridge frame.`);
    assert.equal(
      await page.evaluate(() => window.__trackingRecoveryDocument),
      documentToken,
      `${engine}: bridge recovery reloaded the parent document.`,
    );
    await panel.waitFor({ state: 'hidden' });
    assert.deepEqual(records.errors, [], `${engine}: bridge recovery raised a page error.`);
  } finally {
    await context.close();
  }
}

async function runSlowReplacementAssociationScenario(browser, engine) {
  console.log(`${engine}: checking slow replacement bridge association budget.`);
  const records = createRecords(`${engine}-slow-association`);
  const delayGate = deferred();
  const bridgeControl = {
    delayGate,
    delayLoadNumber: 3,
    delayStarted: false,
    instrument: true,
  };
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records, { bridgeControl });
    const page = await context.newPage();
    await page.goto(`${mainOrigin}/starters/professional-licensing/`);
    const panel = page.locator('[data-tracking-preferences]');
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(() => records.pageviews.length === 1, `${engine}: initial consent pageview was not sent.`);

    await page.locator('[data-tracking-preferences-open]').click();
    await panel.getByRole('button', { name: 'Reject optional cookies' }).click();
    await panel.waitFor({ state: 'hidden' });
    await page.locator('[data-tracking-preferences-open]').click();
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await panel.waitFor({ state: 'hidden' });
    await waitFor(
      () => bridgeControl.delayStarted,
      `${engine}: post-consent replacement bridge did not start loading.`,
    );

    const submissionsBefore = records.formSubmissions.length;
    const associationsBefore = records.bridgeRequests.filter(type => type === 'associate').length;
    const form = page.locator('[data-starter-request-form]');
    await form.getByRole('textbox', { name: 'Email address' })
      .fill(`slow-replacement-${engine}@example.invalid`);
    await form.evaluate(element => {
      element.addEventListener('submit', () => {
        window.__trackingSubmitStartedAt = Date.now();
      }, { capture: true, once: true });
    });
    await form.locator('button[type="submit"]').click();
    await waitFor(
      () => records.formSubmissions.length === submissionsBefore + 1,
      `${engine}: optional association waited beyond its 750ms budget for a replacement bridge.`,
      1_500,
    );
    const submission = latestSubmission(records);
    const submitStartedAt = await page.evaluate(() => window.__trackingSubmitStartedAt);
    assert.equal(typeof submitStartedAt, 'number', `${engine}: submit start was not recorded.`);
    const submissionElapsedMs = submission.receivedAt - submitStartedAt;
    assert.ok(submissionElapsedMs < 1_250, `${engine}: kiosk request took ${submissionElapsedMs}ms.`);
    assertKioskSubmission(submission);
    assert.equal(
      records.bridgeRequests.filter(type => type === 'associate').length,
      associationsBefore,
      `${engine}: association reached the broker while its replacement frame was blocked.`,
    );

    delayGate.release();
    await waitFor(
      () => records.bridgeRequests.filter(type => type === 'pageview').length >= 2,
      `${engine}: delayed replacement bridge did not resume the consented pageview.`,
    );
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    assert.equal(
      records.bridgeRequests.filter(type => type === 'associate').length,
      associationsBefore,
      `${engine}: timed-out association was posted after the replacement bridge loaded.`,
    );
    assert.deepEqual(records.errors, [], `${engine}: slow replacement scenario raised a page error.`);
  } finally {
    delayGate.release();
    await context.close();
  }
}

async function runSplitStartupBudgetScenario(browser, engine) {
  console.log(`${engine}: checking independent bridge and native startup budgets.`);
  const records = createRecords(`${engine}-split-startup-budget`);
  const bridgeControl = {
    delayLoadNumber: 3,
    delayLoadMs: 3_500,
    delayStarted: false,
    delayStartedAt: 0,
    delayNativeEventNumber: 2,
    delayNativeEventMs: 3_500,
    nativeDelayStarted: false,
    nativeDelayStartedAt: 0,
    nativeDelayCompletedAt: 0,
    instrument: true,
  };
  assert.ok(bridgeControl.delayLoadMs < 6_500);
  assert.ok(bridgeControl.delayNativeEventMs < 4_000);
  assert.ok(bridgeControl.delayLoadMs + bridgeControl.delayNativeEventMs > 6_500);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records, { bridgeControl });
    const page = await context.newPage();
    await page.goto(`${mainOrigin}/solutions/licensing/`);
    const panel = page.locator('[data-tracking-preferences]');
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(() => records.pageviews.length === 1, `${engine}: initial startup pageview was not sent.`);

    await page.locator('[data-tracking-preferences-open]').click();
    await panel.getByRole('button', { name: 'Reject optional cookies' }).click();
    await panel.waitFor({ state: 'hidden' });
    await page.locator('[data-tracking-preferences-open]').click();
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await panel.waitFor({ state: 'hidden' });

    await waitFor(
      () => bridgeControl.delayStarted && bridgeControl.nativeDelayStarted,
      `${engine}: split startup delays were not both exercised.`,
      10_000,
    );
    await waitFor(
      () => records.pageviews.length === 2,
      `${engine}: tracking did not survive independent startup delays.`,
      12_000,
    );
    assert.ok(
      bridgeControl.nativeDelayCompletedAt - bridgeControl.delayStartedAt > 6_500,
      `${engine}: split startup did not exceed the original combined client deadline.`,
    );
    assert.equal(await panel.locator('[data-tracking-error]').isVisible(), false);
    assert.equal(await panel.isVisible(), false);
    const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), consentKey);
    assert.equal(state.choice, 'accepted');
    const resumed = records.pageviews.at(-1);
    await waitFor(async () => await page.evaluate(
      expected => localStorage.getItem('mautic_device_id') === expected,
      resumed.deviceId,
    ), `${engine}: split startup did not retain the recovered native device.`);
    assert.deepEqual(records.errors, [], `${engine}: split startup raised a page error.`);
  } finally {
    await context.close();
  }
}

async function runExplicitBootstrapRecoveryScenario(browser, engine) {
  console.log(`${engine}: checking explicit recovery from a failed first native request.`);
  const records = createRecords(`${engine}-explicit-bootstrap-recovery`);
  const bridgeControl = { failNativeEvents: 1, instrument: true };
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records, { bridgeControl });
    const page = await context.newPage();
    await page.goto(`${mainOrigin}/starters/professional-licensing/`);
    const panel = page.locator('[data-tracking-preferences]');
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await panel.locator('[data-tracking-error]').waitFor({ state: 'visible' });
    assert.equal(records.nativeEventRequests, 1);
    assert.equal(records.pageviews.length, 0);
    assert.equal(records.nextDevice, 0);

    const stranded = await page.frames()
      .find(frame => frame.url() === `${mainOrigin}/tracking-bridge/`)
      ?.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), identityKey);
    assert.equal(stranded?.status, 'pending');
    assert.equal(await page.evaluate(() => localStorage.getItem('mautic_device_id')), null);

    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(
      () => records.pageviews.length === 1,
      `${engine}: explicit same-choice retry did not recover tracking.`,
      10_000,
    );
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await panel.locator('[data-tracking-error]').isVisible(), false);
    assert.equal(records.nativeEventRequests, 2);
    assert.equal(records.nextDevice, 1);
    assert.equal(new Set(records.pageviews.map(view => view.deviceId)).size, 1);
    const recoveredDevice = records.pageviews[0].deviceId;

    await waitFor(async () => {
      for (const frame of page.frames()) {
        if (frame.url() !== `${mainOrigin}/tracking-bridge/`) continue;
        if (await frame.evaluate(key => {
          const identity = JSON.parse(localStorage.getItem(key) ?? 'null');
          return identity?.status === 'ready';
        }, identityKey)) return true;
      }
      return false;
    }, `${engine}: recovered bridge identity did not become ready.`);
    await submitForm(page, { email: `explicit-recovery-${engine}@example.invalid` });
    const submission = latestSubmission(records);
    assert.equal(new URL(submission.url).searchParams.get('privacy'), 'consented');
    assert.equal(submission.data.mautic_device_id, recoveredDevice);
    assert.deepEqual(records.errors, [], `${engine}: explicit bootstrap recovery raised a page error.`);
  } finally {
    await context.close();
  }
}

async function runExcludedVisitorScenario(browser, engine) {
  console.log(`${engine}: checking delivered tracking excluded by Mautic.`);
  const records = createRecords(`${engine}-excluded-visitor`);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records, { excludeNativeVisitors: true });
    const page = await context.newPage();
    await page.goto(`${mainOrigin}/starters/professional-licensing/`);
    const panel = page.locator('[data-tracking-preferences]');
    await panel.waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(() => records.nativeEventRequests === 1, `${engine}: excluded event was not delivered.`);
    await panel.waitFor({ state: 'hidden' });
    await submitForm(page, { email: `excluded-${engine}@example.invalid` });
    assertKioskSubmission(latestSubmission(records));
    assert.equal(await panel.locator('[data-tracking-error]').isVisible(), false);
    assert.equal(await panel.isVisible(), false);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), consentKey);
    assert.equal(saved.choice, 'accepted');
    const identity = await page.evaluate(key => localStorage.getItem(key), identityKey);
    assert.equal(identity, null);
    assert.equal(records.nextDevice, 0);
    assert.equal(records.pageviews.length, 0);
    assert.deepEqual(records.errors, [], `${engine}: excluded visitor raised a page error.`);
  } finally {
    await context.close();
  }
}

async function runRetainedLocalRefusalScenario(browser, engine) {
  console.log(`${engine}: checking retained local refusal startup replay.`);
  const records = createRecords(`${engine}-retained-local-refusal`);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await configureContext(context, records);
    // Observe the acknowledgement directly. A background fetch probe can be
    // cancelled when successful refusal removes its bridge iframe.
    await context.addInitScript(({ mainOrigin, docsOrigin }) => {
      if (location.origin !== docsOrigin) return;
      window.addEventListener('message', event => {
        const message = event.data;
        if (event.origin !== mainOrigin || message?.protocol !== 'registrystack-tracking' ||
            message?.version !== 2 || message?.ok !== true || message?.state?.choice !== 'rejected') return;
        document.documentElement.dataset.acceptanceRejectedRevision = String(message.state.revision);
      });
    }, { mainOrigin, docsOrigin });
    const seededAt = Date.now();
    const accepted = {
      version: 2,
      choice: 'accepted',
      generation: '00000000-0000-4000-8000-000000000001',
      expiresAt: seededAt + 60_000,
      revision: seededAt,
    };
    const sharedStorage = await context.newPage();
    await sharedStorage.goto(`${mainOrigin}/__acceptance/storage-seed`);
    await sharedStorage.evaluate(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, [consentKey, accepted]);

    const docsPage = await context.newPage();
    await docsPage.goto(`${docsOrigin}/__acceptance/storage-seed`);
    await docsPage.evaluate(([key, value]) => localStorage.setItem(key, value), [
      localRefusalKey,
      'rejected',
    ]);
    await docsPage.goto(`${docsOrigin}/start/concepts/`);
    const panel = docsPage.locator('[data-registry-shared-tracking]');
    await panel.waitFor({ state: 'attached' });

    let rejected;
    await waitFor(async () => {
      rejected = await sharedStorage.evaluate(key => {
        try {
          return JSON.parse(localStorage.getItem(key) ?? 'null');
        } catch {
          return null;
        }
      }, consentKey);
      return rejected?.choice === 'rejected' && rejected.revision > accepted.revision;
    }, `${engine}: retained local refusal did not reach the shared bridge.`);
    await waitFor(
      async () => await docsPage.locator('html').getAttribute('data-acceptance-rejected-revision') === String(rejected.revision),
      `${engine}: shared refusal acknowledgement did not arrive.`,
    );
    await waitFor(
      async () => await docsPage.evaluate(key => localStorage.getItem(key), localRefusalKey) === null,
      `${engine}: acknowledged refusal remained local.`,
    );
    assert.equal(records.nativeRequests.length, 0, `${engine}: retained refusal loaded Mautic.`);
    assert.equal(records.pageviews.length, 0, `${engine}: retained refusal sent a pageview.`);
    assert.equal(await panel.locator('[data-tracking-error]').isVisible(), false);
    assert.equal(await panel.isVisible(), false);
    assert.equal(await docsPage.evaluate(key => localStorage.getItem(key), localRefusalKey), null);
    await assertNoIdentityInDocs(docsPage, records, []);
    assert.deepEqual(records.errors, [], `${engine}: retained refusal raised a page error.`);

    await docsPage.reload();
    await panel.waitFor({ state: 'attached' });
    await waitFor(
      async () => await docsPage.locator('html').getAttribute('data-acceptance-rejected-revision') === String(rejected.revision),
      `${engine}: retained shared rejection was not acknowledged after reload.`,
    );
    await delay(250);
    assert.deepEqual(
      await sharedStorage.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), consentKey),
      rejected,
      `${engine}: reload replaced the retained shared rejection.`,
    );
    assert.equal(records.nativeRequests.length, 0, `${engine}: reload loaded Mautic after refusal.`);
    assert.equal(records.pageviews.length, 0, `${engine}: reload sent a pageview after refusal.`);
    assert.equal(await panel.locator('[data-tracking-error]').isVisible(), false);
    assert.equal(await panel.isVisible(), false);
    await assertNoIdentityInDocs(docsPage, records, []);
    assert.deepEqual(records.errors, [], `${engine}: refusal reload raised a page error.`);
  } finally {
    await context.close();
  }
}

async function runEngine(engine, browserType) {
  console.log(`${engine}: checking shared main/docs journey.`);
  const browser = await browserType.launch();
  const records = createRecords(engine);
  try {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: desktopViewport,
    });
    await configureContext(context, records);
    const mainPage = await context.newPage();
    await mainPage.goto(
      `${mainOrigin}/solutions/licensing/?utm_source=conference&utm_medium=referral&utm_campaign=external-review&utm_content=brief&email=private%40example.invalid#secret`,
    );
    const mainPanel = mainPage.locator('[data-tracking-preferences]');
    await mainPanel.waitFor({ state: 'visible' });
    assert.equal(records.nativeRequests.length, 0, 'Mautic must not load before consent.');
    assert.deepEqual(
      await mainPage.evaluate(keys => keys.map(key => localStorage.getItem(key)), nativeIdentityKeys),
      [null, null],
    );
    assert.deepEqual(
      (await new AxeBuilder({ page: mainPage }).include('[data-tracking-preferences]').analyze()).violations,
      [],
      `${engine}: main tracking preferences must pass axe.`,
    );
    await assertMobileConsentPanel(mainPage, mainPanel, engine, 'main');

    await mainPanel.getByRole('button', { name: 'Accept optional cookies' }).click();
    await waitFor(() => records.pageviews.length === 1, `${engine}: main acceptance did not send one pageview.`);
    const acceptedMain = records.pageviews[0];
    assert.equal(acceptedMain.page_url, `${mainOrigin}/solutions/licensing/`);
    assert.equal(acceptedMain.utm_source, 'conference');
    assert.equal(acceptedMain.utm_medium, 'referral');
    assert.equal(acceptedMain.utm_campaign, 'external-review');
    assert.equal(acceptedMain.utm_content, 'brief');
    assert.equal(acceptedMain.page_referrer, '');
    assert.ok(!JSON.stringify(acceptedMain).includes('private'));
    const firstDevice = acceptedMain.deviceId;
    await mainPage.waitForFunction(
      expected => localStorage.getItem('mautic_device_id') === expected,
      firstDevice,
    );
    assert.equal(await mainPage.evaluate(() => localStorage.getItem('mautic_device_id')), firstDevice);

    if (docsDist) {
      const notFoundPage = await context.newPage();
      const pageviewsBeforeNotFound = records.pageviews.length;
      const response = await notFoundPage.goto(`${docsOrigin}/unknown-or-private-path/`);
      assert.equal(response?.status(), 404);
      await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
      assert.equal(records.pageviews.length, pageviewsBeforeNotFound, `${engine}: docs 404 was tracked.`);
      assert.equal(await notFoundPage.locator('[data-registry-shared-tracking]').count(), 0);
      assert.equal(await notFoundPage.locator(`iframe[src="${mainOrigin}/tracking-bridge/"]`).count(), 0);
      await notFoundPage.close();
    }

    const docsLink = mainPage.locator(
      'a[href^="https://docs.registrystack.org/start/concepts/"]',
    ).first();
    await docsLink.evaluate(anchor => {
      const target = new URL(anchor.href);
      target.searchParams.set('utm_source', 'registry_docs');
      target.searchParams.set('utm_medium', 'docs');
      target.searchParams.set('utm_campaign', 'cross_site');
      target.searchParams.set('utm_content', location.pathname);
      anchor.href = target.toString();
      anchor.target = '_blank';
    });
    const docsDisclosure = docsLink.locator('xpath=ancestor::details');
    await docsDisclosure.locator('summary').click();
    await docsLink.waitFor({ state: 'visible' });
    const docsPopup = context.waitForEvent('page');
    await docsLink.click();
    const docsPage = await docsPopup;
    await docsPage.waitForLoadState('domcontentloaded');
    await docsPage.waitForURL(`${docsOrigin}/start/concepts/**`);
    await waitFor(() => records.pageviews.length === 2, `${engine}: docs did not join accepted tracking.`);
    const docsView = records.pageviews[1];
    assert.equal(docsView.page_url, `${docsOrigin}/start/concepts/`);
    assert.equal(docsView.page_referrer, mainOrigin);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      assert.equal(docsView[key], undefined, `${engine}: internal UTM ${key} reached Mautic.`);
    }
    const docsPanel = docsPage.locator('[data-registry-shared-tracking]');
    assert.equal(await docsPanel.isVisible(), false, `${engine}: docs showed a second consent banner.`);
    await docsPage.locator('[data-tracking-preferences-open]').click();
    await docsPanel.waitFor({ state: 'visible' });
    if (screenshotDir) {
      await docsPage.screenshot({
        path: join(screenshotDir, `${engine}-docs-tracking-preferences.png`),
        fullPage: true,
      });
    }
    assert.deepEqual(
      (await new AxeBuilder({ page: docsPage }).include('[data-registry-shared-tracking]').analyze()).violations,
      [],
      `${engine}: docs tracking preferences must pass axe.`,
    );
    await assertMobileConsentPanel(docsPage, docsPanel, engine, 'docs');
    await docsPage.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    });
    await docsPanel.evaluate(element => { element.hidden = true; });

    await docsPage.locator('footer a[href="/privacy/"]').click();
    await docsPage.waitForLoadState('domcontentloaded');
    await waitFor(() => records.pageviews.length === 3, `${engine}: docs navigation did not send a pageview.`);

    const starterPopup = context.waitForEvent('page');
    await docsPage.evaluate(origin => {
      const link = document.createElement('a');
      link.href = `${origin}/starters/professional-licensing/`;
      link.target = '_blank';
      document.body.append(link);
      link.click();
    }, mainOrigin);
    const starterPage = await starterPopup;
    await starterPage.waitForLoadState('domcontentloaded');
    await waitFor(() => records.pageviews.length === 4, `${engine}: main starter navigation was not tracked.`);
    assert.equal(await starterPage.locator('[data-tracking-preferences]').isVisible(), false);
    await submitForm(starterPage, { email: `accepted-${engine}@example.invalid` });
    const trackedSubmission = latestSubmission(records);
    const trackedUrl = new URL(trackedSubmission.url);
    assert.equal(trackedUrl.searchParams.get('formId'), '2');
    assert.equal(trackedSubmission.data['mauticform[formId]'], '2');
    assert.equal(trackedSubmission.data.mautic_device_id, firstDevice);

    await mainPage.goto(`${mainOrigin}/contact/?type=privacy&context=website%20privacy%20question`);
    await waitFor(() => records.pageviews.length === 5, `${engine}: privacy page was not tracked.`);
    await submitForm(mainPage, {
      email: `privacy-${engine}@example.invalid`,
      message: 'Please answer a privacy question.',
    });
    assertKioskSubmission(latestSubmission(records));
    assert.deepEqual(
      [...new Set(records.pageviews.slice(0, 5).map(view => view.deviceId))],
      [firstDevice],
      `${engine}: accepted journey did not retain one server-side device.`,
    );

    const retainedDocsDocumentToken = await docsPage.evaluate(() => {
      window.__retainedTrackingDocument = crypto.randomUUID();
      return window.__retainedTrackingDocument;
    });
    const docsBridge = docsPage.locator(`iframe[src="${mainOrigin}/tracking-bridge/"]`);
    assert.equal(await docsBridge.count(), 1, `${engine}: retained docs page has no consent bridge.`);
    await docsPage.locator('[data-tracking-preferences-open]').click();
    await docsPage.locator('[data-registry-shared-tracking]')
      .getByRole('button', { name: 'Reject optional cookies' }).click();
    await docsPage.locator('[data-registry-shared-tracking]').waitFor({ state: 'hidden' });
    await mainPage.waitForFunction(key => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null')?.choice === 'rejected';
      } catch {
        return false;
      }
    }, consentKey);
    await waitFor(
      async () => await docsBridge.count() === 0,
      `${engine}: retained docs page kept its native bridge after withdrawal.`,
    );
    const pageviewsBeforeRejectionNavigation = records.pageviews.length;
    const rejectedDocsPage = await context.newPage();
    await rejectedDocsPage.goto(`${docsOrigin}/accessibility/`);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    assert.equal(
      records.pageviews.length,
      pageviewsBeforeRejectionNavigation,
      `${engine}: rejection did not stop Registry Docs.`,
    );
    await rejectedDocsPage.close();
    await mainPage.goto(`${mainOrigin}/starters/professional-licensing/`);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    assert.equal(
      records.pageviews.length,
      pageviewsBeforeRejectionNavigation,
      `${engine}: rejection did not stop the main website.`,
    );
    await submitForm(mainPage, { email: `rejected-${engine}@example.invalid` });
    assertKioskSubmission(latestSubmission(records));

    await mainPage.locator('[data-tracking-preferences-open]').click();
    await mainPage.locator('[data-tracking-preferences]')
      .getByRole('button', { name: 'Accept optional cookies' }).click();
    await mainPage.locator('[data-tracking-preferences]').waitFor({ state: 'hidden' });
    await waitFor(
      () => records.pageviews.length > pageviewsBeforeRejectionNavigation,
      `${engine}: re-consent did not resume tracking.`,
    );
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    const resumedPageviews = records.pageviews.slice(pageviewsBeforeRejectionNavigation);
    assert.ok(
      resumedPageviews.length <= 3,
      `${engine}: a live document sent more than one pageview for the re-consent generation.`,
    );
    const resumedDevices = [...new Set(resumedPageviews.map(view => view.deviceId))];
    assert.equal(resumedDevices.length, 1, `${engine}: re-consent did not share one fresh device.`);
    const [secondDevice] = resumedDevices;
    assert.notEqual(secondDevice, firstDevice, `${engine}: re-consent reused the withdrawn device.`);

    const pageviewsBeforeDocsResume = records.pageviews.length;
    await docsPage.bringToFront();
    await docsPage.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(
      () => records.pageviews.length === pageviewsBeforeDocsResume + 1,
      `${engine}: retained docs page did not recover after re-consent.`,
    );
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
    assert.equal(
      records.pageviews.length,
      pageviewsBeforeDocsResume + 1,
      `${engine}: retained docs page sent more than one pageview after re-consent.`,
    );
    const resumedDocsView = records.pageviews.at(-1);
    assert.equal(resumedDocsView.page_url, `${docsOrigin}/privacy/`);
    assert.equal(
      await docsPage.evaluate(() => window.__retainedTrackingDocument),
      retainedDocsDocumentToken,
      `${engine}: retained docs page reloaded before recovery.`,
    );
    assert.equal(
      resumedDocsView.deviceId,
      secondDevice,
      `${engine}: retained docs page resumed with a stale identity.`,
    );
    assert.equal(await docsBridge.count(), 1, `${engine}: retained docs page did not replace its bridge.`);

    await assertNoIdentityInDocs(docsPage, records, [firstDevice, secondDevice]);
    await assertCleanUrls([mainPage, docsPage, starterPage], [firstDevice, secondDevice]);
    assert.deepEqual(records.errors, [], `${engine}: uncaught page errors were observed.`);
    await context.close();

    await runBridgeRecoveryScenario(browser, engine);
    await runSlowReplacementAssociationScenario(browser, engine);
    await runSplitStartupBudgetScenario(browser, engine);
    await runExplicitBootstrapRecoveryScenario(browser, engine);
    await runExcludedVisitorScenario(browser, engine);
    await runRetainedLocalRefusalScenario(browser, engine);

    for (const mode of ['legacy', 'bridge', 'storage', 'dnt', 'gpc']) {
      await runKioskScenario(browser, engine, records, mode);
    }
    assert.deepEqual(records.errors, [], `${engine}: uncaught page errors were observed.`);
    console.log(`${engine}: shared main/docs tracking journey passed.`);
  } finally {
    await browser.close();
  }
}

const availableBrowsers = new Map([
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
]);
const requestedBrowsers = (process.env.TRACKING_BROWSERS ?? 'chromium')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
assert.ok(requestedBrowsers.length > 0, 'TRACKING_BROWSERS must select at least one browser.');
assert.equal(
  new Set(requestedBrowsers).size,
  requestedBrowsers.length,
  'TRACKING_BROWSERS must not contain duplicates.',
);
for (const engine of requestedBrowsers) {
  assert.ok(availableBrowsers.has(engine), `Unsupported tracking browser: ${engine}`);
}

for (const engine of requestedBrowsers) {
  const browserType = availableBrowsers.get(engine);
  await runEngine(engine, browserType);
}

console.log(
  `Shared tracking browser checks passed in ${requestedBrowsers.join(', ')} (${docsDist ? 'canonical Registry Docs build' : 'shared-client docs fixture'}).`,
);
