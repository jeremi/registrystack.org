// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractProse,
  findAmericanSpellings,
  collectPages,
} from '../scripts/report-spelling.mjs';

const script = fileURLToPath(new URL('../scripts/report-spelling.mjs', import.meta.url));

function writeSite(files) {
  const dist = mkdtempSync(path.join(tmpdir(), 'spelling-'));
  for (const [route, html] of Object.entries(files)) {
    const dir = path.join(dist, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), html);
  }
  return dist;
}

const page = (main) => `<html><body><nav>Organize the menu</nav><main>${main}</main><footer>Footer color</footer></body></html>`;

const pairs = (text) => findAmericanSpellings(text).map(({ word, suggestion }) => [word, suggestion]);

test('flags -ize and -yze spellings and keeps the capital letter', () => {
  assert.deepEqual(pairs('We organize records. Authorization stays with staff. Analyze the results.'), [
    ['organize', 'organise'],
    ['Authorization', 'Authorisation'],
    ['Analyze', 'Analyse'],
  ]);
});

test('keeps words where -ize is not a suffix', () => {
  assert.deepEqual(pairs('Resize the citizen prize list. A seized car of any size.'), []);
});

test('flags listed American spellings', () => {
  assert.deepEqual(pairs('The color of the center catalog, its behavior, an enrollment and a modeled form.'), [
    ['color', 'colour'],
    ['center', 'centre'],
    ['catalog', 'catalogue'],
    ['behavior', 'behaviour'],
    ['enrollment', 'enrolment'],
    ['modeled', 'modelled'],
  ]);
});

test('asks for a check where the British form depends on meaning', () => {
  assert.deepEqual(pairs('Each license and every social program.'), [
    ['license', 'licence (noun); license stays as the verb'],
    ['program', 'programme (unless it is a computer program)'],
  ]);
});

test('ignores the names of organisations and standards', () => {
  assert.deepEqual(pairs('International Organization for Standardization (ISO) and the World Health Organization agree.'), []);
});

test('ignores URLs, domains and paths', () => {
  assert.deepEqual(pairs('See https://example.org/authorize, /customization/ and docs.example.org/organize today.'), []);
});

test('extractProse keeps main text and drops code, navigation and footer', () => {
  const text = extractProse(page('<p>Send the <code>Authorization</code> header.</p><pre>authorize()</pre><p>Staff <kbd>Customize</kbd> it.</p>'));
  assert.match(text, /Send the\s+header\./);
  assert.doesNotMatch(text, /Authorization|authorize|Customize|Organize|color/);
});

test('collectPages skips French, legal, starter, error and redirect pages', () => {
  const dist = writeSite({
    '': page('<p>Home</p>'),
    'blog/post': page('<p>Article</p>'),
    'fr': page('<p>Accueil</p>'),
    'privacy': page('<p>Privacy</p>'),
    'terms': page('<p>Terms</p>'),
    'imprint': page('<p>Imprint</p>'),
    'starters/x': page('<p>Starter</p>'),
    '404': page('<p>Missing</p>'),
    'old': '<html><head><meta http-equiv="refresh" content="0; url=/"></head><body><main>Moved</main></body></html>',
  });
  assert.deepEqual(collectPages(dist).map((p) => p.route), ['/', '/blog/post/']);
});

test('CLI lists each word with its pages and exits 0', () => {
  const dist = writeSite({
    '': page('<p>We authorize staff.</p>'),
    'about': page('<p>Staff are authorized. We organize the work.</p>'),
  });
  const result = spawnSync(process.execPath, [script, '--dist', dist], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /authorized → authorised\s+1 page\s+\/about\//);
  assert.match(result.stdout, /authorize → authorise\s+1 page\s+\//);
  assert.match(result.stdout, /3 American spellings across 2 pages\./);
});

test('CLI --json returns the findings', () => {
  const dist = writeSite({ '': page('<p>We organize it.</p>') });
  const result = spawnSync(process.execPath, [script, '--dist', dist, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.pages, 1);
  assert.deepEqual(report.findings.map(({ route, word, suggestion }) => [route, word, suggestion]), [['/', 'organize', 'organise']]);
});

test('CLI exits 1 when the dist directory is missing', () => {
  const result = spawnSync(process.execPath, [script, '--dist', path.join(tmpdir(), 'no-such-dist-for-spelling')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dist directory not found/);
});
