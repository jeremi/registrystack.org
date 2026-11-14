import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('SolutionFit lists the French products and links to their French pages', () => {
  const source = read('src/components/SolutionFit.astro');
  assert.match(source, /from '\.\.\/data\/fr\/products'/);
  assert.match(source, /locale === 'fr' \? frenchProducts : englishProducts/);
  assert.match(source, /href=\{localizedPath\(product\.href, locale\)\}/);
  assert.match(source, /localizedPath\('\/solutions\/review-changes\/#what-your-office-calls-it', locale\)/);
});

test('SolutionExample localizes its link', () => {
  const source = read('src/components/SolutionExample.astro');
  assert.match(source, /localizedPath\(link\.href, locale\)/);
  assert.match(source, /englishHreflang\(/);
});

test('MinimizationFunnel keeps the fictional record and gives each visible text a French twin', () => {
  const source = read('src/components/MinimizationFunnel.astro');
  assert.match(source, /name="Maya Okafor"/);
  assert.match(source, /Exemple illustratif avec une fiche de personne fictive/);
  assert.doesNotMatch(source, />\s*[A-Z][a-z]+ [a-z ]+<\//, 'visible English text outside t()');
});
