#!/usr/bin/env node
// Report-only: lists sentences and phrases repeated across built pages so
// reviewers can decide what to cut. Never a gate; exits 1 only when the dist
// directory cannot be read.
//
// Usage: node scripts/report-repetition.mjs [--dist <dir>] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_SENTENCE_WORDS = 5;
const MIN_SENTENCE_PAGES = 2;
const SHINGLE_WORDS = 6;
const MIN_PHRASE_PAGES = 3;
const MAX_ROUTES = 5;

// Not worth reviewing: product names, nav/CTA boilerplate and link labels that
// are expected to recur. A sentence or phrase is dropped when nothing is left
// after removing product names and boilerplate strings.
const PRODUCT_NAMES = [
  'registry stack', 'registry base', 'registry relay', 'registry notary', 'registry render',
  'registry messaging', 'registry scheduling', 'registry manifest', 'registry studio',
  'registry', 'stack', 'base', 'relay', 'notary', 'render', 'messaging', 'scheduling', 'manifest', 'studio',
];
const BOILERPLATE = [
  'ask a question',
  'talk to us',
  'contact us',
  'book a call',
  'read the docs',
  'read the documentation',
  'view on github',
  'learn more',
  'get started',
  'back to top',
  'skip to main content',
];

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const DROPPED_ELEMENTS = new Set(['script', 'style', 'svg', 'nav', 'header', 'footer', 'noscript', 'template']);
const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section',
  'summary', 'table', 'td', 'th', 'tr', 'ul', 'button', 'label', 'option',
]);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '...', mdash: '-', ndash: '-', lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function normaliseText(text) {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[ \t\r\f\v ]+/g, ' ');
}

// Returns the visible text of <main>, with block boundaries kept as newlines.
export function extractMainText(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '');
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let out = '';
  let last = 0;
  let mainDepth = 0;
  let skipName = null;
  let skipDepth = 0;
  let match;
  while ((match = tagPattern.exec(source))) {
    const [raw, closing, rawName, attrs] = match;
    const name = rawName.toLowerCase();
    if (mainDepth > 0 && skipName === null) out += source.slice(last, match.index);
    last = match.index + raw.length;
    const selfClosing = VOID_ELEMENTS.has(name) || attrs.trim().endsWith('/');

    if (skipName !== null) {
      if (name === skipName && !selfClosing) skipDepth += closing ? -1 : 1;
      if (skipDepth === 0) skipName = null;
      continue;
    }
    if (name === 'main') {
      mainDepth = Math.max(0, mainDepth + (closing ? -1 : 1));
      out += '\n';
      continue;
    }
    if (mainDepth === 0) continue;
    if (!closing && !selfClosing && (DROPPED_ELEMENTS.has(name) || /\baria-hidden\s*=\s*["']?true/i.test(attrs))) {
      skipName = name;
      skipDepth = 1;
      continue;
    }
    if (BLOCK_ELEMENTS.has(name)) out += '\n';
  }
  return decodeEntities(normaliseText(out))
    .split('\n')
    .map((line) => normaliseText(line).trim())
    .filter(Boolean)
    .join('\n');
}

export function splitSentences(text) {
  const sentences = [];
  for (const line of text.split('\n')) {
    for (const part of line.split(/(?<=[.!?]["')\]]?)\s+(?=["'(\[]?[A-Z0-9])/)) {
      const sentence = part.trim();
      if (sentence) sentences.push(sentence);
    }
  }
  return sentences;
}

function words(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [];
}

function isIgnored(text) {
  let rest = ` ${words(text).join(' ')} `;
  for (const phrase of [...PRODUCT_NAMES, ...BOILERPLATE]) {
    while (rest.includes(` ${phrase} `)) rest = rest.split(` ${phrase} `).join('  ');
  }
  return rest.trim() === '';
}

function routesOf(pages) {
  return [...pages].sort();
}

function rank(a, b) {
  return b.count - a.count || b.text.length - a.text.length || a.text.localeCompare(b.text);
}

// pages: [{ route, text }]. Returns { sentences, phrases }, each entry
// { count, text, routes } (routes is the full sorted list).
export function findRepeats(pages) {
  const sentenceMap = new Map();
  const shingleMap = new Map();
  const pageSentences = pages.map(({ route, text }) => {
    const sentences = splitSentences(text).map((sentence) => ({ sentence, words: words(sentence) }));
    for (const { sentence, words: ws } of sentences) {
      if (ws.length >= MIN_SENTENCE_WORDS) {
        const key = ws.join(' ');
        const entry = sentenceMap.get(key) ?? { text: sentence, pages: new Set() };
        entry.pages.add(route);
        sentenceMap.set(key, entry);
      }
      for (let i = 0; i + SHINGLE_WORDS <= ws.length; i++) {
        const key = ws.slice(i, i + SHINGLE_WORDS).join(' ');
        if (!shingleMap.has(key)) shingleMap.set(key, new Set());
        shingleMap.get(key).add(route);
      }
    }
    return { route, sentences };
  });

  const sentences = [...sentenceMap.values()]
    .filter((entry) => entry.pages.size >= MIN_SENTENCE_PAGES && !isIgnored(entry.text))
    .map((entry) => ({ count: entry.pages.size, text: entry.text, routes: routesOf(entry.pages) }))
    .sort(rank);

  // Merge consecutive qualifying shingles within a sentence into one longest run.
  const qualifying = new Set([...shingleMap].filter(([, set]) => set.size >= MIN_PHRASE_PAGES).map(([key]) => key));
  const phraseMap = new Map();
  for (const { route, sentences: pageParts } of pageSentences) {
    for (const { words: ws } of pageParts) {
      let i = 0;
      while (i + SHINGLE_WORDS <= ws.length) {
        if (!qualifying.has(ws.slice(i, i + SHINGLE_WORDS).join(' '))) {
          i++;
          continue;
        }
        let end = i + SHINGLE_WORDS;
        while (end + 1 <= ws.length && qualifying.has(ws.slice(end + 1 - SHINGLE_WORDS, end + 1).join(' '))) end++;
        const phrase = ws.slice(i, end).join(' ');
        if (!phraseMap.has(phrase)) phraseMap.set(phrase, new Set());
        phraseMap.get(phrase).add(route);
        i = end - SHINGLE_WORDS + 1;
      }
    }
  }

  const sentenceTexts = sentences.map((entry) => ({ text: words(entry.text).join(' '), count: entry.count }));
  const candidates = [...phraseMap].map(([text, set]) => ({ text, count: set.size, routes: routesOf(set) }));
  const phrases = candidates
    .filter((c) => !isIgnored(c.text))
    // Drop a phrase already covered by a longer phrase or a reported sentence seen on at least as many pages.
    .filter((c) => !candidates.some((o) => o !== c && o.text.length > c.text.length && o.count >= c.count && ` ${o.text} `.includes(` ${c.text} `)))
    .filter((c) => !sentenceTexts.some((s) => s.count >= c.count && ` ${s.text} `.includes(` ${c.text} `)))
    .sort(rank);

  return { sentences, phrases };
}

function isSkippedRoute(route) {
  return route === '/404/' || route.startsWith('/starters/') || /^\/blog\/.+/.test(route);
}

function isRedirectDocument(html) {
  return /<meta\s[^>]*http-equiv\s*=\s*["']?refresh/i.test(html);
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name === 'index.html') yield full;
  }
}

export function collectPages(dist) {
  const pages = [];
  for (const file of [...walk(dist)].sort()) {
    const rel = path.relative(dist, path.dirname(file)).split(path.sep).join('/');
    const route = rel ? `/${rel}/` : '/';
    if (isSkippedRoute(route)) continue;
    const html = readFileSync(file, 'utf8');
    if (isRedirectDocument(html)) continue;
    pages.push({ route, text: extractMainText(html) });
  }
  return pages;
}

function formatEntry({ count, text, routes }) {
  const shown = routes.slice(0, MAX_ROUTES).join(', ');
  const more = routes.length > MAX_ROUTES ? `, +${routes.length - MAX_ROUTES} more` : '';
  return `${String(count).padStart(3)} pages  "${text}"\n             ${shown}${more}`;
}

function summary({ sentences, phrases }, pageCount) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(sentences.length, 'repeated sentence')}, ${plural(phrases.length, 'repeated phrase')} across ${plural(pageCount, 'page')}.`;
}

function main(argv) {
  const distIndex = argv.indexOf('--dist');
  const dist = path.resolve(distIndex >= 0 ? (argv[distIndex + 1] ?? '') : 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`report-repetition: dist directory not found at ${dist}; run npm run build first.`);
    return 1;
  }
  const pages = collectPages(dist);
  const result = findRepeats(pages);
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ pages: pages.length, ...result }, null, 2));
    return 0;
  }
  console.log('Repeated sentences (5+ words, 2+ pages)');
  console.log(result.sentences.map(formatEntry).join('\n') || '  none');
  console.log('\nRepeated phrases (6 words, 3+ pages)');
  console.log(result.phrases.map(formatEntry).join('\n') || '  none');
  console.log(`\n${summary(result, pages.length)}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
