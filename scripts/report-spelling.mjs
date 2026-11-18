#!/usr/bin/env node
// Report-only: lists American spellings in the English prose of built pages,
// so writers can move the site to British spelling in the GOV.UK style.
// Never a gate; exits 1 only when the dist directory cannot be read.
//
// Code, URLs and the names of organisations and standards keep their own
// spelling and are not reported. French, legal and synced starter pages are
// skipped.
//
// Usage: node scripts/report-spelling.mjs [--dist <dir>] [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractMainText } from './report-repetition.mjs';

const CONTEXT_CHARS = 40;

// Names keep the spelling their owners use.
const PROPER_NAMES = [
  'International Organization for Standardization',
  'World Health Organization',
  'Food and Agriculture Organization',
  'World Customs Organization',
  'World Intellectual Property Organization',
  'Organization for Economic Co-operation and Development',
];

// Words where "ize" is not a suffix that British spelling changes.
const IZE_EXCEPTIONS = new Set([
  'size', 'sizes', 'sized', 'sizing', 'resize', 'resizes', 'resized', 'resizing', 'oversize', 'oversized',
  'prize', 'prizes', 'prized', 'seize', 'seizes', 'seized', 'seizing', 'capsize', 'capsized',
]);

const LISTED = new Map(Object.entries({
  color: 'colour', colors: 'colours',
  behavior: 'behaviour', behaviors: 'behaviours',
  favor: 'favour', favorite: 'favourite',
  honor: 'honour', labor: 'labour', neighbor: 'neighbour', neighbors: 'neighbours',
  center: 'centre', centers: 'centres', centered: 'centred',
  catalog: 'catalogue', catalogs: 'catalogues',
  defense: 'defence', offense: 'offence',
  enroll: 'enrol', enrolls: 'enrols', enrollment: 'enrolment', enrollments: 'enrolments',
  fulfill: 'fulfil', fulfills: 'fulfils', fulfillment: 'fulfilment',
  modeled: 'modelled', modeling: 'modelling',
  labeled: 'labelled', labeling: 'labelling',
  canceled: 'cancelled', canceling: 'cancelling',
  traveled: 'travelled', traveling: 'travelling',
  gray: 'grey',
  license: 'licence (noun); license stays as the verb',
  licenses: 'licences (noun); licenses stays as the verb',
  program: 'programme (unless it is a computer program)',
  programs: 'programmes (unless they are computer programs)',
}));

function matchCase(source, replacement) {
  return source[0] === source[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

function britishFor(word) {
  const lower = word.toLowerCase();
  if (LISTED.has(lower)) return matchCase(word, LISTED.get(lower));
  if (/iz(e|es|ed|er|ers|ing|ation|ations|able)$/.test(lower) && !IZE_EXCEPTIONS.has(lower)) {
    return word.replace(/iz(?=(e|es|ed|er|ers|ing|ation|ations|able)$)/i, (iz) => (iz[0] === 'I' ? 'Is' : 'is'));
  }
  if (/yz(e|es|ed|ing)$/.test(lower)) return word.replace(/yz(?=(e|es|ed|ing)$)/i, 'ys');
  return null;
}

// Blank out text that keeps its own spelling, so offsets still line up.
function maskUnchecked(text) {
  const blank = (match) => ' '.repeat(match.length);
  let masked = text;
  for (const name of PROPER_NAMES) masked = masked.split(name).join(blank(name));
  return masked
    .replace(/\S*:\/\/\S+/g, blank)
    .replace(/(^|\s)\/\S*/g, blank)
    .replace(/\S+\.(?:org|com|net|io|dev|gov|int)\S*/g, blank);
}

// Returns [{ word, suggestion, context }] in reading order.
export function findAmericanSpellings(text) {
  const masked = maskUnchecked(text);
  const findings = [];
  for (const match of masked.matchAll(/[A-Za-z]+/g)) {
    const suggestion = britishFor(match[0]);
    if (!suggestion) continue;
    const start = Math.max(0, match.index - CONTEXT_CHARS);
    const end = Math.min(text.length, match.index + match[0].length + CONTEXT_CHARS);
    findings.push({ word: match[0], suggestion, context: text.slice(start, end).replace(/\s+/g, ' ').trim() });
  }
  return findings;
}

// Main text of a page without code samples.
export function extractProse(html) {
  return extractMainText(html.replace(/<(code|pre|kbd|samp)\b[^>]*>[\s\S]*?<\/\1>/gi, ' '));
}

function isSkippedRoute(route) {
  return route === '/404/' ||
    route === '/fr/' || route.startsWith('/fr/') ||
    route.startsWith('/starters/') ||
    ['/privacy/', '/terms/', '/imprint/'].includes(route);
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
    pages.push({ route, text: extractProse(html) });
  }
  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function main(argv) {
  const distIndex = argv.indexOf('--dist');
  const dist = path.resolve(distIndex >= 0 ? (argv[distIndex + 1] ?? '') : 'dist');
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`report-spelling: dist directory not found at ${dist}; run npm run build first.`);
    return 1;
  }
  const pages = collectPages(dist);
  const findings = pages.flatMap(({ route, text }) => findAmericanSpellings(text).map((finding) => ({ route, ...finding })));
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ pages: pages.length, findings }, null, 2));
    return 0;
  }
  const byWord = new Map();
  for (const { route, word, suggestion } of findings) {
    const key = `${word} → ${suggestion}`;
    const entry = byWord.get(key) ?? { count: 0, routes: new Set() };
    entry.count += 1;
    entry.routes.add(route);
    byWord.set(key, entry);
  }
  const rows = [...byWord].sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b));
  console.log('American spellings in English prose (code, URLs and names skipped)');
  console.log(rows.map(([key, { routes }]) => `  ${key}  ${plural(routes.size, 'page')}  ${[...routes].sort().join(', ')}`).join('\n') || '  none');
  const pagesWithFindings = new Set(findings.map((finding) => finding.route)).size;
  console.log(`\n${plural(findings.length, 'American spelling')} across ${plural(pagesWithFindings, 'page')}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
