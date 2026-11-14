// Run with: npm test
// The register family pages in French. SolutionStarters shows no catalogue
// text: it links to the English-only marketplace collection, so there are no
// starter names to translate; the link itself is labelled and marked English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as en from '../src/data/register-week.ts';
import * as fr from '../src/data/fr/register-week.ts';
import { solutionAreas } from '../src/data/solutions.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('SolutionStarters follows the locale and marks the English marketplace link', () => {
  const source = read('src/components/SolutionStarters.astro');
  assert.match(source, /translator\(locale\)/);
  assert.match(source, /localeForPath\(Astro\.url\.pathname\)/);
  assert.match(source, /\(en anglais\)/);
  assert.match(source, /hreflang=\{englishHreflang\(/);
});

test('RegisterWeek and RegisterDay follow the locale', () => {
  const week = read('src/components/RegisterWeek.astro');
  assert.match(week, /data-pause-label/);
  assert.match(week, /data-play-label/);
  assert.match(week, /localizedPath\(step\.productHref/);
  assert.match(read('src/components/RegisterDay.astro'), /locale === 'fr' \? frenchSteps/);
});

test('the French register-week data names the same products as the English', () => {
  for (const key of ['base-registry', 'casework', 'evidence-gateway', 'render', 'messaging']) {
    assert.deepEqual(fr.weekProduct(key), en.weekProduct(key));
  }
  assert.throws(() => fr.weekProduct('missing'), /Unknown product/);
});

test('each register family has a French page built from the French data', () => {
  const families = solutionAreas.filter((area) => area.kind === 'register-family');
  assert.equal(families.length, 7);
  for (const area of families) {
    const path = `src/pages/fr/solutions/${area.key}.astro`;
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} exists`);
    const source = read(path);
    assert.match(source, /data\/fr\/solutions/);
    assert.match(source, /data\/fr\/register-week/);
    assert.match(source, /id="[a-z]+-week"/);
    assert.match(source, /fictives?\./);
    assert.doesNotMatch(source, /—/);
  }
});
