import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Invariant checks only. This script does not pin marketing copy; pages can be
// reworded freely. It enforces the rules that outlive any single rewrite:
// copy quality (no SaaS language, no em dashes, no scaffolding markers), the
// policy-audience guardrail on the hero, the product priority order, and the
// structural wiring every page must keep (nav routes, docs handoff, OG image).

const failures = [];

const readSource = (relativePath) => {
  const fullPath = resolve(relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing file: ${relativePath}`);
    return '';
  }
  return readFileSync(fullPath, 'utf8');
};

// Strip scoped <style> blocks before the copy sweep: properties like
// `text-transform` are legitimate CSS, not marketing copy, and the banned terms
// only apply to reader-facing prose.
const stripStyleBlocks = (text) => text.replace(/<style>[\s\S]*?<\/style>/g, '');

const listAstroFiles = (relativeDir) =>
  readdirSync(resolve(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return listAstroFiles(relativePath);
    return entry.isFile() && entry.name.endsWith('.astro') ? [relativePath] : [];
  });

// 1. Copy-quality sweep over every page and component, discovered from the
// filesystem so new pages are covered without editing this script.
const forbidden = [
  'Powerful',
  'powerful',
  'Seamless',
  'seamless',
  'Revolutionary',
  'revolutionary',
  'Unlock',
  'unlock',
  'Transform',
  'transform',
  'AI-powered',
  // Maturity self-deprecation belongs in the docs and the repos, not on the
  // marketing site.
  'Experimental',
  'experimental',
  'pre-1.0',
  'No claimed production',
  'no claimed production',
  'full-stack platform',
  'end-to-end replacement',
  'universal registry',
  '—',
  '–',
  'TODO',
  'TBD',
  'FIXME',
];

const sweptFiles = [
  ...listAstroFiles('src/pages'),
  ...listAstroFiles('src/components'),
];

for (const relativePath of sweptFiles) {
  const text = stripStyleBlocks(readSource(relativePath));
  for (const term of forbidden) {
    if (text.includes(term)) {
      failures.push(`forbidden term present in ${relativePath}: ${term}`);
    }
  }
}

// 2. Homepage guardrails.
const homeSource = readSource('src/pages/index.astro');

// The audience is program and policy people: the hero must stay plain-language
// and carry the looping answer card as its visual anchor.
const heroMatch = homeSource.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/);
if (!heroMatch) {
  failures.push('missing hero section');
} else {
  for (const signal of ['<code', 'GET /']) {
    if (heroMatch[0].includes(signal)) {
      failures.push(`hero starts too technically: ${signal}`);
    }
  }
  if (!heroMatch[0].includes('HeroAnswerCard')) {
    failures.push('hero is missing the answer-card visual anchor');
  }
}

// The three products appear on the homepage in priority order:
// Notary (most innovative) before Relay (easiest adoption) before Manifest.
{
  const order = ['Registry Notary', 'Registry Relay', 'Registry Manifest'];
  let lastIndex = -1;
  for (const name of order) {
    const index = homeSource.indexOf(name);
    if (index === -1) {
      failures.push(`homepage does not mention ${name}`);
      continue;
    }
    if (index <= lastIndex) failures.push(`homepage product order is wrong at: ${name}`);
    lastIndex = index;
  }
}

// The homepage now routes first to the two solution patterns; the live lab
// remains present as proof, but no longer owns the primary IA.
for (const route of ['/solutions/evidence-gateway/', '/solutions/protected-registry-apis/']) {
  if (!homeSource.includes(`href="${route}"`)) {
    failures.push(`homepage primary solution routing is missing ${route}`);
  }
}
if (!homeSource.includes('https://lab.registrystack.org/')) {
  failures.push('homepage is missing the live demo link (lab.registrystack.org)');
}
if (!homeSource.includes('home-solution-grid')) {
  failures.push('homepage is missing the two-card solution routing grid');
}
if (homeSource.includes('class="use-case"') || homeSource.includes('class="use-case-grid"')) {
  failures.push('homepage still carries the full use-case gallery; /use-cases/ owns that depth');
}

// 3. Site wiring: shared navigation and footer reach every marketing route.
const navigationSource = [
  homeSource,
  readSource('src/components/SiteHeader.astro'),
  readSource('src/components/SiteFooter.astro'),
].join('\n');
for (const route of [
  '/solutions/evidence-gateway/',
  '/solutions/protected-registry-apis/',
  '/notary/',
  '/relay/',
  '/manifest/',
  '/problem/',
  '/use-cases/',
  '/ecosystem/',
  '/ai/',
  '/pricing/',
  '/pilot/',
]) {
  if (!navigationSource.includes(`href="${route}"`)) {
    failures.push(`site navigation is missing a link to ${route}`);
  }
}

// The AI page carries the annotated harness variant, and each product page
// carries the variant with its own check highlighted. The homepage stays an
// orientation and routing page.
if (!readSource('src/pages/ai.astro').includes('HarnessDiagram')) {
  failures.push('src/pages/ai.astro is missing the harness diagram (HarnessDiagram)');
}
for (const product of ['notary', 'relay', 'manifest']) {
  if (!readSource(`src/pages/${product}.astro`).includes(`highlight="${product}"`)) {
    failures.push(`src/pages/${product}.astro is missing its highlighted harness diagram (HarnessDiagram highlight="${product}")`);
  }
}

// 4. Every non-home page hands off to the docs for the "how".
for (const relativePath of sweptFiles) {
  if (!relativePath.startsWith('src/pages/') || relativePath === 'src/pages/index.astro') continue;
  if (!readSource(relativePath).includes('DocsHandoff')) {
    failures.push(`${relativePath} is missing the docs handoff CTA (DocsHandoff)`);
  }
}

const handoffSource = readSource('src/components/DocsHandoff.astro');
if (handoffSource && !handoffSource.includes('https://docs.registrystack.org/')) {
  failures.push('DocsHandoff component does not link to the docs site');
}

// 5. Social sharing: the layout declares a large-image card, so it must point
// at a real OG image asset that actually exists.
const layoutSource = readSource('src/layouts/Base.astro');
for (const tag of ['og:image', 'twitter:image']) {
  if (!layoutSource.includes(tag)) {
    failures.push(`layout is missing social image tag: ${tag}`);
  }
}
if (!layoutSource.includes('og-image.png')) {
  failures.push('layout does not reference the og-image.png asset');
}
if (!existsSync(resolve('public/og-image.png'))) {
  failures.push('public/og-image.png is missing (run npm run build:og)');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('content invariants passed');
