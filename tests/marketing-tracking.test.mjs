import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { transform } from '@astrojs/compiler';
import { getConsentedTrackingAssociation, marketingTrackingUrl } from '../src/lib/marketing-tracking.ts';

const generation = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const state = { choice: 'accepted', generation, expiresAt: Date.now() + 60_000, revision: 10 };

test('accepts only an optional HTTPS Mautic origin', () => {
  assert.equal(marketingTrackingUrl(undefined), undefined);
  assert.equal(marketingTrackingUrl('   '), undefined);
  assert.equal(marketingTrackingUrl(' https://metrics.example.org/ '), 'https://metrics.example.org');
  for (const value of ['http://metrics.example.org', 'https://user:password@metrics.example.org',
    'https://metrics.example.org/mtc.js', 'https://metrics.example.org/?source=site',
    'https://metrics.example.org/#tracking', 'not-a-url']) {
    assert.throws(() => marketingTrackingUrl(value), /Mautic URL/i);
  }
});

test('solution handoffs link directly to canonical documentation without a referrer-losing redirect', async () => {
  const directory = new URL('../src/pages/solutions/', import.meta.url);
  const pages = (await readdir(directory)).filter(name => name.endsWith('.astro'));
  const sources = await Promise.all(pages.map(name => readFile(new URL(name, directory), 'utf8')));
  for (let index = 0; index < pages.length; index += 1) {
    assert.doesNotMatch(sources[index], /https:\/\/docs\.registrystack\.org\/explanation\/integration-patterns\//, pages[index]);
  }
  assert.ok(sources.some(source => source.includes('https://docs.registrystack.org/start/concepts/')));
});

test('requests a fresh current-generation association and does not use a cached parent identifier', async () => {
  const calls = [];
  const client = {
    state,
    associate: async (expectedGeneration, options) => {
      calls.push({ expectedGeneration, options });
      return { state, deviceId: 'a'.repeat(23) };
    },
  };
  assert.deepEqual(await getConsentedTrackingAssociation({ client, navigator: {} }), {
    deviceId: 'a'.repeat(23), generation,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedGeneration, generation);
  assert.equal(calls[0].options.timeoutMs, 750);
});

test('refusal, privacy signals, bridge failure, invalid IDs, and changed generations select the unlinked form', async () => {
  for (const environment of [
    { client: { state: { ...state, choice: 'rejected' } }, navigator: {} },
    { client: { state }, navigator: { doNotTrack: '1' } },
    { client: { state }, navigator: { globalPrivacyControl: true } },
    { client: { state, associate: async () => { throw new Error('unavailable'); } }, navigator: {} },
    { client: { state, associate: async () => ({ state, deviceId: 'invalid' }) }, navigator: {} },
    { client: { state, associate: async () => ({ state: { ...state, generation: 'different' }, deviceId: 'a'.repeat(23) }) }, navigator: {} },
  ]) assert.equal(await getConsentedTrackingAssociation(environment), undefined);
});

test('renders shared optional consent without putting a native tracker on parent pages', async () => {
  const root = new URL('../', import.meta.url);
  const [component, footer, base, form] = await Promise.all([
    readFile(new URL('src/components/TrackingPreferences.astro', root), 'utf8'),
    readFile(new URL('src/components/SiteFooter.astro', root), 'utf8'),
    readFile(new URL('src/layouts/Base.astro', root), 'utf8'),
    readFile(new URL('src/components/StarterRequestForm.astro', root), 'utf8'),
  ]);
  await Promise.all([component, footer, base, form].map(source => transform(source)));
  assert.match(component, /website and documentation/i);
  assert.match(component, /Accept optional cookies/);
  assert.match(component, /Reject optional cookies/);
  assert.match(component, /getSharedTrackingClient/);
  const openPreferences = component.match(/const openPreferences = [\s\S]*?const closePreferences/);
  assert.ok(openPreferences);
  assert.doesNotMatch(openPreferences[0], /errorMessage\.hidden = true/, 'State renders must not erase a tracking failure.');
  assert.match(component, /if \(client\.state\.choice === 'accepted' && client\.state\.generation === generation\) \{\s+sentGeneration = generation;/);
  assert.match(component, /if \(pendingGeneration === generation\) pendingGeneration = null;/);
  assert.match(component, /change your choice at any time/i);
  assert.doesNotMatch(component, /aria-modal|role="dialog"|<script[^>]+src=/i);
  assert.doesNotMatch(component, /startMauticTracking|saveTrackingPreference|window\.location\.reload/);
  assert.match(footer, /data-tracking-preferences-open/);
  assert.match(base, /noindex\s*\? undefined\s*: marketingTrackingUrl\(/);
  assert.match(form, /await getConsentedTrackingAssociation/);
  assert.match(form, /type !== 'privacy'/);
  assert.match(form, /\.abort\(/);
});
