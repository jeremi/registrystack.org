// Run with: node --test tests/french-films.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const mediaSource = await read('src/data/media.ts');
const films = [...mediaSource.matchAll(/'([a-z0-9-]+-film)': \{ length: '[^']+' \}/g)].map(([, name]) => name);
const allFilms = [...films, 'registry-stack-ai-film'];

// The cues and NOTE headings of a WebVTT file, in order.
function parse(text) {
  const [header, ...blocks] = text.replace(/\r\n/g, '\n').trim().split(/\n\n+/);
  assert.equal(header, 'WEBVTT');
  return blocks.map((block) => {
    if (block.startsWith('NOTE')) return { note: true };
    const [timing, ...lines] = block.split('\n');
    assert.match(timing, /^\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}$/, `timing line: ${timing}`);
    return { timing, lines };
  });
}

test('the films of the explainer series include the three expected ones', () => {
  assert.deepEqual(films.sort(), ['registry-stack-film', 'registry-stack-studio-film']);
});

for (const name of allFilms) {
  test(`${name} has French captions cue for cue with the English ones`, async () => {
    const en = parse(await read(`public/films/${name}-en.vtt`));
    const fr = parse(await read(`public/films/${name}-fr.vtt`));
    assert.equal(fr.length, en.length, 'same number of cues and NOTE breaks');
    en.forEach((block, index) => {
      assert.equal(Boolean(fr[index].note), Boolean(block.note), `block ${index + 1} is a NOTE in both or neither`);
      assert.equal(fr[index].timing, block.timing, `block ${index + 1} has the same timing`);
    });
  });

  test(`${name} French cues fit two short lines`, async () => {
    for (const block of parse(await read(`public/films/${name}-fr.vtt`))) {
      if (block.note) continue;
      assert.ok(block.lines.length >= 1 && block.lines.length <= 2, `two lines at most: ${block.lines.join(' / ')}`);
      for (const line of block.lines) assert.ok([...line].length <= 52, `line too long (${[...line].length}): ${line}`);
    }
  });

  test(`${name} French captions use French typography`, async () => {
    const text = await read(`public/films/${name}-fr.vtt`);
    assert.doesNotMatch(text, /—/, 'no em dash');
    assert.doesNotMatch(text, /\w'\w/, 'typographic apostrophe');
    assert.doesNotMatch(text, / [:;?!]/, 'no-break space before double punctuation');
  });
}

test('the AI film has English captions with every cue timed', async () => {
  const cues = parse(await read('public/films/registry-stack-ai-film-en.vtt'));
  assert.equal(cues.length, 24);
});

test('Film.astro gives French pages the French track first and by default', async () => {
  const source = await read('src/components/Film.astro');
  assert.match(source, /<track kind="captions"[^>]*srclang="en"/);
  const french = source.indexOf('srclang="fr"');
  assert.ok(french > 0, 'a French track exists');
  assert.ok(french < source.indexOf('srclang="en"'), 'French comes before English');
  assert.match(source.slice(french - 120, french + 120), /\bdefault\b/);
  assert.match(source, /-fr\.vtt/);
});

test('every film has a French length in media.ts', async () => {
  const french = mediaSource.match(/filmLengthsFr[^=]*=\s*\{([^}]*)\}/)?.[1] ?? '';
  for (const name of films) assert.match(french, new RegExp(`'${name}':\\s*'[^']+'`), name);
});

test('the English citizen access page captions the AI film', async () => {
  const page = await read('src/pages/ai/citizen-access.astro');
  assert.match(page, /<track kind="captions" src="\/films\/registry-stack-ai-film-en\.vtt" srclang="en" label="English" \/>/);
});

test('the French citizen access page captions the AI film in French first, then English', async () => {
  const page = await read('src/pages/fr/ai/citizen-access.astro');
  const fr = page.indexOf('/films/registry-stack-ai-film-fr.vtt');
  const en = page.indexOf('/films/registry-stack-ai-film-en.vtt');
  assert.ok(fr > 0 && en > fr);
  assert.match(page.slice(fr - 60, fr + 120), /srclang="fr"[^>]*default|default[^>]*srclang="fr"/);
});
