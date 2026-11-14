import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const pages = [
  { path: 'src/pages/about.astro', place: /San Francisco, United States/g, notice: /<a href="\/imprint\/">legal notice<\/a>/ },
  {
    path: 'src/pages/fr/about.astro',
    place: /San Francisco, aux États-Unis/g,
    notice: /<a href="\/imprint\/" hreflang="en">mentions légales \(en anglais\)<\/a>/,
  },
];

for (const { path, place, notice } of pages) {
  test(`${path} states where the company is based once, outside the hero`, () => {
    const source = read(path);
    const hero = source.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] ?? '';
    assert.match(hero, /Aubex Consulting LLC/, 'the hero names the company');
    assert.doesNotMatch(hero, /San Francisco/, 'the hero does not open on the company location');
    assert.equal(source.match(place)?.length, 1, 'the page states the location exactly once');
    const note = source.match(/<p class="company-note">[\s\S]*?<\/p>/)?.[0] ?? '';
    assert.match(note, place, 'the company note states the location');
    assert.match(note, notice, 'the company note links the legal notice');
  });
}
