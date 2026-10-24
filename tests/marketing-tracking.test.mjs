import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from '@astrojs/compiler';

import {
  CONSENT_STORAGE_KEY,
  buildMauticPageview,
  clearMauticIdentity,
  getConsentedDeviceId,
  marketingTrackingUrl,
  readTrackingPreference,
  rejectMauticTracking,
  saveTrackingPreference,
  startMauticTracking,
} from '../src/lib/marketing-tracking.ts';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('src/components/TrackingPreferences.astro', root);
const footerUrl = new URL('src/components/SiteFooter.astro', root);
const baseUrl = new URL('src/layouts/Base.astro', root);
const now = Date.UTC(2026, 9, 24);

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

const browser = (storage, overrides = {}) => ({
  storage,
  navigator: { doNotTrack: '0', globalPrivacyControl: false },
  now: () => now,
  ...overrides,
});

test('accepts only an optional HTTPS Mautic origin', () => {
  assert.equal(marketingTrackingUrl(undefined), undefined);
  assert.equal(marketingTrackingUrl('   '), undefined);
  assert.equal(marketingTrackingUrl(' https://metrics.example.org/ '), 'https://metrics.example.org');

  for (const value of [
    'http://metrics.example.org',
    'https://user:password@metrics.example.org',
    'https://metrics.example.org/mtc.js',
    'https://metrics.example.org/?source=site',
    'https://metrics.example.org/#tracking',
    'not-a-url',
  ]) {
    assert.throws(() => marketingTrackingUrl(value), /Mautic URL/i);
  }
});

test('persists a versioned choice for 180 days and expires it', () => {
  const storage = new MemoryStorage();
  assert.equal(readTrackingPreference(browser(storage)), undefined);
  assert.equal(saveTrackingPreference('accepted', browser(storage)), true);
  assert.equal(readTrackingPreference(browser(storage)), 'accepted');

  const saved = JSON.parse(storage.getItem(CONSENT_STORAGE_KEY));
  assert.equal(saved.version, 1);
  assert.equal(saved.choice, 'accepted');
  assert.equal(saved.expiresAt, now + 180 * 24 * 60 * 60 * 1000);

  assert.equal(
    readTrackingPreference(browser(storage, { now: () => saved.expiresAt + 1 })),
    undefined,
  );
  assert.equal(storage.getItem(CONSENT_STORAGE_KEY), null);
});

test('DNT and GPC deny tracking even after an earlier opt-in', () => {
  for (const navigator of [
    { doNotTrack: '1', globalPrivacyControl: false },
    { doNotTrack: '0', globalPrivacyControl: true },
  ]) {
    const storage = new MemoryStorage();
    saveTrackingPreference('accepted', browser(storage));
    assert.equal(readTrackingPreference(browser(storage, { navigator })), 'rejected');
    storage.setItem('mautic_device_id', 'a1b2c3d4e5f6g7h8i9j0k1l');
    assert.equal(getConsentedDeviceId(browser(storage, { navigator })), undefined);
  }
});

test('returns a validated Mautic device only for current explicit consent', () => {
  const storage = new MemoryStorage();
  storage.setItem('mautic_device_id', 'a1b2c3d4e5f6g7h8i9j0k1l');
  assert.equal(getConsentedDeviceId(browser(storage)), undefined);

  saveTrackingPreference('accepted', browser(storage));
  assert.equal(getConsentedDeviceId(browser(storage)), 'a1b2c3d4e5f6g7h8i9j0k1l');

  storage.setItem('mautic_device_id', 'not a valid device id');
  assert.equal(getConsentedDeviceId(browser(storage)), undefined);
});

test('builds a bounded pageview from canonical data and allowlisted UTM slugs only', () => {
  assert.deepEqual(
    buildMauticPageview({
      canonicalUrl: 'https://registrystack.org/starters/professional-licensing/?ignored=1#top',
      pageTitle: '  Professional   licensing | Registry Stack  ',
      currentUrl:
        'https://registrystack.org/starters/professional-licensing/?utm_source=registry_stack&utm_medium=site&utm_campaign=starter.launch&utm_content=request-cta&utm_term=licensing&email=person%40example.org&bad=value',
      referrer: 'https://example.org/research/registers/?person=someone#private',
    }),
    {
      page_url: 'https://registrystack.org/starters/professional-licensing/',
      page_title: 'Professional licensing | Registry Stack',
      page_referrer: 'https://example.org',
      utm_source: 'registry_stack',
      utm_medium: 'site',
      utm_campaign: 'starter.launch',
      utm_content: 'request-cta',
      utm_term: 'licensing',
    },
  );

  const unsafe = buildMauticPageview({
    canonicalUrl: 'https://registrystack.org/privacy/?secret=yes#hash',
    pageTitle: 'Privacy',
    currentUrl:
      `https://registrystack.org/privacy/?utm_source=${'x'.repeat(81)}&utm_medium=email%40example.org&utm_campaign=one&utm_campaign=two&contact=person%40example.org`,
    referrer: 'data:text/plain,private',
  });
  assert.deepEqual(unsafe, {
    page_url: 'https://registrystack.org/privacy/',
    page_title: 'Privacy',
    page_referrer: '',
  });
  assert.doesNotMatch(JSON.stringify(unsafe), /secret|hash|contact|example\.org/);
  assert.equal('referrer' in unsafe, false);

  const sameSite = buildMauticPageview({
    canonicalUrl: 'https://registrystack.org/privacy/',
    pageTitle: 'Privacy',
    currentUrl: 'https://registrystack.org/privacy/',
    referrer: 'https://registrystack.org/pricing/?email=person%40example.org#inquiry',
  });
  assert.equal(sameSite.page_referrer, 'https://registrystack.org');
});

test('the Mautic loader is consent-gated and queues one explicit pageview', () => {
  const storage = new MemoryStorage();
  const appended = [];
  const document = {
    createElement: () => ({ dataset: {}, addEventListener() {} }),
    head: { append: (node) => appended.push(node) },
    querySelector: (selector) =>
      selector === 'script[data-registry-mautic]' ? appended[0] ?? null : null,
  };
  const window = {};
  const pageview = { page_url: '/privacy/', page_title: 'Privacy' };
  const environment = browser(storage, { document, window, console: { error() {} } });

  storage.setItem('mtc_id', 'stale-contact');
  storage.setItem('mautic_device_id', 'a1b2c3d4e5f6g7h8i9j0k1l');
  assert.equal(startMauticTracking('https://metrics.example.org', pageview, environment), false);
  assert.equal(appended.length, 0);
  assert.equal(window.mt, undefined);
  assert.equal(storage.getItem('mtc_id'), null);
  assert.equal(storage.getItem('mautic_device_id'), null);

  saveTrackingPreference('accepted', environment);
  assert.equal(startMauticTracking('https://metrics.example.org', pageview, environment), true);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://metrics.example.org/mtc.js');
  assert.equal(appended[0].async, true);
  assert.equal(appended[0].referrerPolicy, 'no-referrer');
  assert.equal(window.MauticTrackingObject, 'mt');
  assert.equal(window.mt.q.length, 1);
  assert.deepEqual(window.mt.q[0].slice(0, 3), ['send', 'pageview', pageview]);
  assert.equal(typeof window.mt.q[0][3].onload, 'function');
  assert.equal(typeof window.mt.q[0][3].onerror, 'function');

  assert.equal(startMauticTracking('https://metrics.example.org', pageview, environment), true);
  assert.equal(appended.length, 1);
  assert.equal(window.mt.q.length, 1);
});

test('initial rejection leaves a clean state for same-document acceptance', () => {
  const storage = new MemoryStorage();
  const appended = [];
  const document = {
    createElement: () => ({ dataset: {}, addEventListener() {} }),
    head: { append: (node) => appended.push(node) },
    querySelector: (selector) =>
      selector === 'script[data-registry-mautic]' ? appended[0] ?? null : null,
  };
  const window = {};
  const environment = browser(storage, { document, window, console: { error() {} } });
  const pageview = {
    page_url: 'https://registrystack.org/privacy/',
    page_title: 'Privacy',
    page_referrer: '',
  };

  assert.equal(rejectMauticTracking(environment), 'saved');
  assert.equal(window.mt, undefined);
  assert.equal(window.__registryMauticPageviewSent, undefined);

  assert.equal(saveTrackingPreference('accepted', environment), true);
  assert.equal(startMauticTracking('https://metrics.example.org', pageview, environment), true);
  assert.equal(appended.length, 1);
  assert.equal(window.mt.q.length, 1);
  assert.deepEqual(window.mt.q[0].slice(0, 3), ['send', 'pageview', pageview]);
});

test('withdrawal clears only Mautic identity storage and host/domain cookies', () => {
  const storage = new MemoryStorage();
  storage.setItem('mtc_id', 'contact');
  storage.setItem('mautic_device_id', 'device');
  storage.setItem('unrelated', 'keep');
  const cookieWrites = [];
  const document = {
    set cookie(value) {
      cookieWrites.push(value);
    },
  };

  clearMauticIdentity({ storage, document });

  assert.equal(storage.getItem('mtc_id'), null);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  for (const name of ['mtc_id', 'mautic_device_id']) {
    assert.ok(cookieWrites.some((value) => value.startsWith(`${name}=`) && !value.includes('Domain=')));
    assert.ok(cookieWrites.some((value) => value.startsWith(`${name}=`) && value.includes('Domain=registrystack.org')));
    assert.ok(cookieWrites.some((value) => value.startsWith(`${name}=`) && value.includes('Domain=.registrystack.org')));
  }
});

test('a persisted withdrawal requires reload even when cookie clearing fails', () => {
  const storage = new MemoryStorage();
  saveTrackingPreference('accepted', browser(storage));
  const document = {
    querySelector: () => null,
    set cookie(_value) {
      throw new Error('cookies unavailable');
    },
  };
  const environment = browser(storage, {
    document,
    window: {},
    console: { error() {} },
  });

  assert.equal(rejectMauticTracking(environment), 'reload');
  assert.equal(readTrackingPreference(environment), 'rejected');
});

test('renders an accessible nonmodal choice only on configured indexable pages', async () => {
  const [component, footer, base] = await Promise.all([
    readFile(componentUrl, 'utf8'),
    readFile(footerUrl, 'utf8'),
    readFile(baseUrl, 'utf8'),
  ]);
  await Promise.all([
    transform(component, { filename: componentUrl.pathname }),
    transform(footer, { filename: footerUrl.pathname }),
    transform(base, { filename: baseUrl.pathname }),
  ]);

  assert.match(component, /Cookies on this website/);
  assert.match(component, /Accept optional cookies/);
  assert.match(component, /Reject optional cookies/);
  assert.equal(component.match(/class="tracking-choice"/g)?.length, 2);
  assert.match(component, /link[^<]*activity[^<]*enquiry/i);
  assert.match(component, /change your choice at any time/i);
  assert.doesNotMatch(component, /starter request|sign you up for email/i);
  assert.match(component, /href="\/privacy\/"/);
  assert.doesNotMatch(component, /aria-modal|role="dialog"/);
  assert.doesNotMatch(component, /<script[^>]+src=/i);
  assert.match(component, /addEventListener\('storage'/);
  assert.match(component, /event\.key !== CONSENT_STORAGE_KEY/);
  assert.match(component, /revokeMauticTracking\(\)[\s\S]*window\.location\.reload\(\)/);
  assert.match(component, /rejection === 'reload'[\s\S]*window\.location\.reload\(\)/);
  assert.doesNotMatch(component, /!saved \|\| !cleared/);

  assert.match(footer, /data-tracking-preferences-control hidden/);
  assert.match(footer, /data-tracking-preferences-open/);
  assert.match(footer, />\s*Tracking preferences\s*</);
  assert.match(base, /noindex\s*\? undefined\s*: marketingTrackingUrl\(/);
  assert.match(base, /mauticUrl && \(\s*<TrackingPreferences/);
  assert.match(base, /<meta name="referrer" content="strict-origin" \/>/);
  assert.match(base, /data-website-id=\{umamiWebsiteId\}/);
});
