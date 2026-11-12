// Run with: node --test tests/film-tracking.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from '@astrojs/compiler';
import { createFilmStartRecorder, filmFromSource, filmStartPageview } from '../src/lib/film-tracking.mjs';
import { createTrackingRequest } from '../src/lib/tracking-protocol.mjs';

const root = new URL('../', import.meta.url);
const generation = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const location = { origin: 'https://registrystack.org', pathname: '/products/studio/' };

function video(src, currentSrc = '') {
  return { querySelector: (selector) => (selector === 'source[src]' && src ? { src } : null), src: '', currentSrc };
}

function fixture({ choice = 'accepted', umami = true, pageview } = {}) {
  const umamiEvents = [];
  const pageviews = [];
  const pageviewOptions = [];
  const warnings = [];
  const mautic = {
    state: { choice, generation, expiresAt: Date.now() + 60_000, revision: 3 },
    pageview: pageview ?? (async (value, options) => { pageviews.push(value); pageviewOptions.push(options); }),
  };
  const record = createFilmStartRecorder({
    location,
    umami: () => (umami ? { track: (name, data) => umamiEvents.push({ name, data }) } : undefined),
    mautic: () => mautic,
    warn: (message) => warnings.push(message),
  });
  return { record, umamiEvents, pageviews, pageviewOptions, warnings, mautic };
}

test('a film is named after its file in /films/, whatever its resolution', () => {
  const { origin } = location;
  assert.deepEqual(filmFromSource('https://registrystack.org/films/registry-stack-film-720.mp4', origin),
    { film: 'registry-stack-film', path: '/films/registry-stack-film-720.mp4' });
  assert.deepEqual(filmFromSource('/films/registry-stack-ai-film-1080.mp4', origin),
    { film: 'registry-stack-ai-film', path: '/films/registry-stack-ai-film-1080.mp4' });
  assert.deepEqual(filmFromSource('/films/registry-stack-studio-film.mp4?t=3#start', origin),
    { film: 'registry-stack-studio-film', path: '/films/registry-stack-studio-film.mp4' });
  // Only a known video height is a resolution suffix; other trailing numbers
  // belong to the film's name.
  assert.deepEqual(filmFromSource('/films/launch-2026.mp4', origin),
    { film: 'launch-2026', path: '/films/launch-2026.mp4' });
  assert.deepEqual(filmFromSource('/films/launch-2026-1080.mp4', origin),
    { film: 'launch-2026', path: '/films/launch-2026-1080.mp4' });
  for (const other of ['', '/media/clip.mp4', '/films/poster.jpg', 'https://example.org/films/clip-720.mp4', 'not a url']) {
    assert.equal(filmFromSource(other, origin), null, other);
  }
});

test('a film start is a Mautic page hit on the film file the tracking protocol accepts', () => {
  const pageview = filmStartPageview({
    origin: location.origin,
    film: 'registry-stack-studio-film',
    path: '/films/registry-stack-studio-film-720.mp4',
  });
  assert.deepEqual(pageview, {
    page_url: 'https://registrystack.org/films/registry-stack-studio-film-720.mp4',
    page_title: 'Film started: registry-stack-studio-film',
    page_referrer: '',
  });
  assert.doesNotThrow(() => createTrackingRequest('pageview', { expectedGeneration: generation, pageview }));
});

test('the first play of each film is counted once in Umami and, with consent, in Mautic', async () => {
  const { record, umamiEvents, pageviews, pageviewOptions, warnings } = fixture();
  const studio = video('https://registrystack.org/films/registry-stack-studio-film-720.mp4');
  record(studio);
  record(studio);
  record(video('https://registrystack.org/films/registry-stack-film-720.mp4'));
  await Promise.resolve();
  assert.deepEqual(umamiEvents, [
    { name: 'film_play', data: { film: 'registry-stack-studio-film', source_path: '/products/studio/' } },
    { name: 'film_play', data: { film: 'registry-stack-film', source_path: '/products/studio/' } },
  ]);
  assert.deepEqual(pageviews.map((value) => value.page_url), [
    'https://registrystack.org/films/registry-stack-studio-film-720.mp4',
    'https://registrystack.org/films/registry-stack-film-720.mp4',
  ]);
  // A film hit is optional: if it fails, accepted consent stays in place.
  assert.deepEqual(pageviewOptions, [{ optional: true }, { optional: true }]);
  assert.deepEqual(warnings, []);
});

test('the file the browser chose to play names the film and the page hit', async () => {
  const { record, umamiEvents, pageviews } = fixture();
  record(video('/films/registry-stack-film-720.mp4', 'https://registrystack.org/films/registry-stack-film-1080.mp4'));
  await Promise.resolve();
  assert.equal(umamiEvents.length, 1);
  assert.deepEqual(pageviews.map((value) => value.page_url),
    ['https://registrystack.org/films/registry-stack-film-1080.mp4']);
});

test('a film played before consent reaches Mautic on its first play after acceptance', async () => {
  const { record, umamiEvents, pageviews, mautic } = fixture({ choice: null });
  const film = video('/films/registry-stack-film-720.mp4');
  record(film);
  mautic.state = { ...mautic.state, choice: 'accepted' };
  record(film);
  record(film);
  await Promise.resolve();
  assert.equal(umamiEvents.length, 1);
  assert.equal(pageviews.length, 1);
});

test('without accepted tracking a film start reaches Umami only', async () => {
  for (const choice of [null, 'rejected']) {
    const { record, umamiEvents, pageviews } = fixture({ choice });
    record(video('/films/registry-stack-film-720.mp4'));
    await Promise.resolve();
    assert.equal(umamiEvents.length, 1, String(choice));
    assert.deepEqual(pageviews, [], String(choice));
  }
});

test('a film start reaches Mautic when Umami is not loaded, and other videos are ignored', async () => {
  const { record, umamiEvents, pageviews } = fixture({ umami: false });
  record(video('/films/registry-stack-film-720.mp4'));
  record(video('https://registrystack.org/media/other-720.mp4'));
  record(video(''));
  await Promise.resolve();
  assert.deepEqual(umamiEvents, []);
  assert.equal(pageviews.length, 1);
});

test('a film start that Mautic cannot record is reported, not thrown', async () => {
  const failure = Object.assign(new Error('Shared tracking is unavailable.'), { code: 'broker-unavailable' });
  const { record, umamiEvents, warnings } = fixture({ pageview: async () => { throw failure; } });
  assert.doesNotThrow(() => record(video('/films/registry-stack-film-720.mp4')));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(umamiEvents.length, 1);
  assert.deepEqual(warnings, ['Film start for registry-stack-film was not recorded in Mautic: broker-unavailable']);
});

test('the base layout records film starts on every page, with Mautic only where it is configured', async () => {
  const base = await readFile(new URL('src/layouts/Base.astro', root), 'utf8');
  await transform(base);
  assert.match(base, /createFilmStartRecorder\(/);
  assert.match(base, /addEventListener\('play'/);
  assert.match(base, /\[data-tracking-preferences\]/);
});

test('privacy policy covers interaction events in Umami and Mautic without listing each one', async () => {
  const privacy = await readFile(new URL('src/pages/privacy.astro', root), 'utf8');
  await transform(privacy);
  assert.match(privacy, /may also record\s+interactions with page elements, such as links, buttons, films, pictures, downloads\s+and forms/i);
  assert.match(privacy, /never records what you type into a form/i);
  assert.match(privacy, /may also record how you\s+use those pages, for example the films you start or the files you download/i);
  assert.match(privacy, /which pages and\s+materials are useful/i);
  assert.match(privacy, /Effective date: November 12, 2026\./);
});
