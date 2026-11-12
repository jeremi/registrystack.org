// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractMainText,
  splitSentences,
  findRepeats,
  collectPages,
} from '../scripts/report-repetition.mjs';

const script = fileURLToPath(new URL('../scripts/report-repetition.mjs', import.meta.url));

function page(route, text) {
  return { route, text };
}

function writeSite(files) {
  const dist = mkdtempSync(path.join(tmpdir(), 'repetition-'));
  for (const [route, html] of Object.entries(files)) {
    const dir = path.join(dist, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), html);
  }
  return dist;
}

const shell = (main) =>
  `<html><body><header>Header words that should vanish here</header><nav>Nav words that should vanish here</nav>${main}<footer>Footer words that should vanish here</footer></body></html>`;

test('extractMainText keeps only visible text inside main', () => {
  const html = shell(
    `<main><h1>Title &amp; more</h1><p>Visible &ldquo;quoted&rdquo; text.</p>` +
      `<div aria-hidden="true"><span>Hidden decoration</span></div>` +
      `<script>var x = 1;</script><style>.a{}</style><svg><text>Icon label</text></svg>` +
      `<p>It&rsquo;s   fine.</p></main>`,
  );
  const text = extractMainText(html);
  assert.match(text, /Title & more/);
  assert.match(text, /Visible "quoted" text\./);
  assert.match(text, /It's fine\./);
  for (const gone of ['Header', 'Nav words', 'Footer', 'Hidden decoration', 'var x', 'Icon label']) {
    assert.ok(!text.includes(gone), `${gone} is excluded`);
  }
});

test('splitSentences splits on terminal punctuation and block boundaries', () => {
  const sentences = splitSentences('First sentence is here. Second one follows now!\nA heading line');
  assert.deepEqual(sentences, ['First sentence is here.', 'Second one follows now!', 'A heading line']);
});

test('a sentence of five or more words on two pages is reported', () => {
  const s = 'Everything is configured for your service today.';
  const result = findRepeats([page('/a/', s), page('/b/', s), page('/c/', 'Something else entirely different lives here.')]);
  assert.equal(result.sentences.length, 1);
  assert.equal(result.sentences[0].count, 2);
  assert.deepEqual(result.sentences[0].routes, ['/a/', '/b/']);
});

test('a sentence on one page, or under five words, is not reported', () => {
  const result = findRepeats([
    page('/a/', 'This sentence appears only on one page. Short one here.'),
    page('/b/', 'Short one here.'),
  ]);
  assert.deepEqual(result.sentences, []);
});

test('a six-word phrase on three pages is reported once as the longest shared run', () => {
  const run = 'built around your rules and your data';
  const result = findRepeats([
    page('/a/', `Alpha opens with ${run} always.`),
    page('/b/', `Beta closes with ${run} sometimes.`),
    page('/c/', `Gamma mentions ${run} rarely.`),
  ]);
  assert.equal(result.phrases.length, 1);
  assert.equal(result.phrases[0].text, run);
  assert.equal(result.phrases[0].count, 3);
});

test('a six-word phrase on only two pages is not reported', () => {
  const run = 'built around your rules and your data';
  const result = findRepeats([page('/a/', `Alpha ${run} one.`), page('/b/', `Beta ${run} two.`)]);
  assert.deepEqual(result.phrases, []);
});

test('ignored boilerplate is not reported', () => {
  for (const s of [
    'Ask a question, ask a question, ask a question, ask a question.',
    'Registry Stack Registry Relay Registry Notary Registry Base Registry Render.',
  ]) {
    const result = findRepeats([page('/a/', s), page('/b/', s), page('/c/', s)]);
    assert.deepEqual(result.sentences, [], s);
    assert.deepEqual(result.phrases, [], s);
  }
});

test('collectPages skips starters, blog articles, redirects and 404', () => {
  const dist = writeSite({
    pilot: shell('<main><p>Real page content lives here today.</p></main>'),
    blog: shell('<main><p>Blog index content stays included here.</p></main>'),
    'blog/some-article': shell('<main><p>Article content is skipped here today.</p></main>'),
    'starters/aircraft-register': shell('<main><p>Starter content is skipped here today.</p></main>'),
    moved: '<html><head><meta http-equiv="refresh" content="0; url=/pilot/"></head><body>Redirecting</body></html>',
    404: shell('<main><p>Not found content is skipped here.</p></main>'),
  });
  const routes = collectPages(dist).map((p) => p.route).sort();
  assert.deepEqual(routes, ['/blog/', '/pilot/']);
});

test('a missing dist directory exits non-zero with a build hint', () => {
  const result = spawnSync(process.execPath, [script, '--dist', path.join(tmpdir(), 'repetition-does-not-exist')], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /run npm run build first/);
});

test('the CLI exits 0 and reports repeats, including as JSON', () => {
  const s = 'Everything is configured for your service today.';
  const dist = writeSite({
    a: shell(`<main><p>${s}</p></main>`),
    b: shell(`<main><p>${s}</p></main>`),
  });
  const text = spawnSync(process.execPath, [script, '--dist', dist], { encoding: 'utf8' });
  assert.equal(text.status, 0);
  assert.match(text.stdout, /configured for your service/);
  assert.match(text.stdout, /1 repeated sentence/);
  const json = spawnSync(process.execPath, [script, '--dist', dist, '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0);
  assert.equal(JSON.parse(json.stdout).sentences[0].count, 2);
});
