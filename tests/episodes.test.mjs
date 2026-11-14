// Run with: node --test tests/episodes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import {
  episodeLinkText,
  episodesPageText,
  formatEpisodeDate,
  selectEpisodes,
} from '../src/lib/episodes.ts';

const file = (lang, number, overrides = {}) => ({
  id: `${lang}/${String(number).padStart(3, '0')}-slug`,
  data: {
    number,
    date: new Date('2026-11-14T00:00:00Z'),
    status: 'published',
    title: `Title ${number} ${lang}`,
    filmUrl: `https://video.example.org/${lang}/${number}`,
    ...overrides,
  },
});

test('the repository ships with no episode, so no episodes page is built', async () => {
  const entries = (await readdir(new URL('../src/content/episodes/', import.meta.url), { recursive: true }))
    .filter((name) => name.endsWith('.md'));
  assert.deepEqual(entries, []);
  assert.deepEqual(selectEpisodes([]), { en: [], fr: [] });
});

test('published episodes are listed newest first in each language', () => {
  const files = [
    file('en', 1, { date: new Date('2026-10-01T00:00:00Z') }), file('fr', 1, { date: new Date('2026-10-01T00:00:00Z') }),
    file('en', 2, { date: new Date('2026-11-14T00:00:00Z') }), file('fr', 2, { date: new Date('2026-11-14T00:00:00Z') }),
    file('en', 3, { date: new Date('2026-11-14T00:00:00Z') }), file('fr', 3, { date: new Date('2026-11-14T00:00:00Z') }),
  ];
  const { en, fr } = selectEpisodes(files);
  assert.deepEqual(en.map((episode) => episode.data.number), [3, 2, 1]);
  assert.deepEqual(fr.map((episode) => episode.data.number), [3, 2, 1]);
});

test('a draft is excluded, and a status left out means draft', () => {
  const files = [
    file('en', 1), file('fr', 1),
    file('en', 2, { status: 'draft' }), file('fr', 2, { status: 'draft' }),
    file('en', 3, { status: undefined }), file('fr', 3, { status: undefined }),
  ];
  const { en, fr } = selectEpisodes(files);
  assert.deepEqual(en.map((episode) => episode.data.number), [1]);
  assert.deepEqual(fr.map((episode) => episode.data.number), [1]);
});

test('a draft may be incomplete', () => {
  const draft = file('en', 2, { status: 'draft', filmUrl: undefined, title: undefined });
  assert.deepEqual(selectEpisodes([file('en', 1), file('fr', 1), draft]).en.length, 1);
});

test('a published episode needs both languages, published', () => {
  assert.throws(() => selectEpisodes([file('en', 4)]), /episode 4.*fr/i);
  assert.throws(() => selectEpisodes([file('fr', 4)]), /episode 4.*en/i);
  assert.throws(() => selectEpisodes([file('en', 4), file('fr', 4, { status: 'draft' })]), /episode 4.*fr/i);
});

test('a published episode needs a number, title, date and HTTPS film address', () => {
  const pair = (overrides) => [file('en', 5, overrides), file('fr', 5)];
  assert.throws(() => selectEpisodes(pair({ number: 0 })), /number/i);
  assert.throws(() => selectEpisodes(pair({ number: 1.5 })), /number/i);
  assert.throws(() => selectEpisodes(pair({ title: ' ' })), /title/i);
  assert.throws(() => selectEpisodes(pair({ date: new Date('nope') })), /date/i);
  assert.throws(() => selectEpisodes(pair({ filmUrl: 'http://video.example.org/1' })), /film/i);
  assert.throws(() => selectEpisodes(pair({ filmUrl: 'https://u:p@video.example.org/1' })), /film/i);
  assert.throws(() => selectEpisodes(pair({ filmUrl: undefined })), /film/i);
});

test('a number is used once per language, both languages share a date, and files sit under en or fr', () => {
  assert.throws(() => selectEpisodes([file('en', 1), file('fr', 1), { ...file('en', 1), id: 'en/001-other' }]), /more than one/i);
  assert.throws(() => selectEpisodes([file('en', 1), file('fr', 1, { date: new Date('2026-01-01T00:00:00Z') })]), /same date/i);
  assert.throws(() => selectEpisodes([{ ...file('en', 1), id: 'de/001-slug' }, file('fr', 1)]), /en\/ or fr\//i);
});

test('dates and page wording follow the language of the page', () => {
  const date = new Date('2026-11-14T00:00:00Z');
  assert.equal(formatEpisodeDate(date, 'en'), '14 November 2026');
  assert.equal(formatEpisodeDate(date, 'fr'), '14 novembre 2026');
  assert.equal(formatEpisodeDate(new Date('2026-10-01T00:00:00Z'), 'fr'), '1er octobre 2026');
  assert.equal(formatEpisodeDate(new Date('2026-10-01T00:00:00Z'), 'en'), '1 October 2026');
  assert.equal(episodeLinkText(3, 'en'), 'Watch episode 3 on the video channel');
  assert.equal(episodeLinkText(3, 'fr'), 'Regarder l’épisode 3 sur la chaîne vidéo');
  assert.deepEqual(episodesPageText('en'), {
    title: 'Episodes | Registry Stack',
    heading: 'Episodes',
    lead: 'The short written version of each of our films about building public services with Registry Stack. Newest first.',
  });
  assert.deepEqual(episodesPageText('fr'), {
    title: 'Épisodes | Registry Stack',
    heading: 'Épisodes',
    lead: 'La version écrite, en bref, de chacun de nos films sur la création de services publics avec Registry Stack. Les plus récents d’abord.',
  });
});

test('fixture episodes live under tests/fixtures and cover both languages', async () => {
  for (const lang of ['en', 'fr']) {
    const names = (await readdir(new URL(`./fixtures/episodes/${lang}/`, import.meta.url))).filter((name) => name.endsWith('.md'));
    assert.ok(names.length >= 2, `${lang} fixtures`);
    for (const name of names) {
      const text = await readFile(new URL(`./fixtures/episodes/${lang}/${name}`, import.meta.url), 'utf8');
      assert.match(text, /^---\n[\s\S]*?\n---\n/);
    }
  }
});

test('a status other than published, draft or absent fails naming the file', () => {
  for (const status of ['Published', 'publish', '', 'archived']) {
    assert.throws(() => selectEpisodes([file('en', 5, { status }), file('fr', 5)]), /en\/005-slug.*status/i, status);
  }
});

test('a film address carrying a share parameter fails, other parameters stay allowed', () => {
  for (const filmUrl of ['https://video.example.org/w?si=abc', 'https://video.example.org/w?feature=share', 'https://video.example.org/w?utm_campaign=x']) {
    assert.throws(() => selectEpisodes([file('en', 6, { filmUrl }), file('fr', 6)]), /(share|tracking).*film/i, filmUrl);
  }
  const ok = selectEpisodes([file('en', 7, { filmUrl: 'https://video.example.org/watch?v=abc' }), file('fr', 7)]);
  assert.equal(ok.en.length, 1);
});
