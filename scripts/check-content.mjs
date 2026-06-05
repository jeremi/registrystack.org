import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pagePath = resolve('src/pages/index.astro');
const source = readFileSync(pagePath, 'utf8');
const failures = [];

const requireText = (needle, label = needle) => {
  if (!source.includes(needle)) failures.push(`missing: ${label}`);
};

const requireOrder = (items) => {
  let lastIndex = -1;
  for (const item of items) {
    const index = source.indexOf(item);
    if (index === -1) {
      failures.push(`missing ordered item: ${item}`);
      continue;
    }
    if (index <= lastIndex) {
      failures.push(`out of order: ${item}`);
    }
    lastIndex = index;
  }
};

requireText('Public service delivery with registry data people can trust.');
requireText('For country digital teams and partners');
requireText('Why it matters');
requireText('Public service delivery');
requireText('Trust and safeguards');
requireText('Practical path to scale');
requireText('Who benefits');
requireText('People and businesses');
requireText('Public administrations');
requireText('Programs and partners');
requireText('evidence a service needs');
requireText('Prepare and describe');
requireText('Expose');
requireText('Verify');
requireText('Audit');
requireText('CSV');
requireText('XLSX');
requireText('Parquet');
requireText('PostgreSQL');
requireText('DCAT-AP');
requireText('OGC APIs');
requireText('SP-DCI');
requireText('PublicSchema');
requireText('GovStack');
requireText('wallets');
requireText('Not a registry replacement');
requireText('Not an open-data portal');
requireText('Not a national data exchange layer');
requireText('Not a workflow engine');
requireText('Not a wallet');
requireText('Not an AI decision system');
requireText('Not a solution to foundational identity');
requireText('AI-assisted integration');
requireText('Controlled requests');
requireText('Narrow answers');
requireText('Reviewable trail');
requireText('One registry source, many bounded answers.');
requireText('Protected consultation');
requireText('RelayBoundedAnswers');
requireText('class="partner-strip"', 'interop credibility strip');

const heroMatch = source.match(/<section class="hero"[\s\S]*?<\/section>/);
if (!heroMatch) {
  failures.push('missing hero section');
} else {
  const heroSource = heroMatch[0];
  const disallowedHeroSignals = ['<code', 'GET /', 'claim:', 'disclosure:', 'metadata:'];
  for (const signal of disallowedHeroSignals) {
    if (heroSource.includes(signal)) {
      failures.push(`hero starts too technically: ${signal}`);
    }
  }
  // The hero carries a plain-language visual anchor (the looping answer card).
  if (!heroSource.includes('HeroAnswerCard')) {
    failures.push('hero is missing the answer-card visual anchor');
  }
}

const mainMatch = source.match(/<main>[\s\S]*?<\/main>/);
if (!mainMatch) {
  failures.push('missing main content');
} else {
  const mainSource = mainMatch[0];
  const disallowedMainSignals = [
    '<code',
    'GET /',
    'claim:',
    'disclosure:',
    'metadata:',
    'Registry Relay',
    'Registry Notary',
    'Registry Manifest',
    'technical proof',
    'Technical proof',
  ];
  for (const signal of disallowedMainSignals) {
    if (mainSource.includes(signal)) {
      failures.push(`main story is too technical: ${signal}`);
    }
  }
}

requireOrder([
  'id="why-it-matters"',
  'id="who-benefits"',
  'id="stack"',
  'id="bounded-answers"',
  'id="use-cases"',
  'id="ecosystem"',
  'id="why-adopt"',
  'id="boundaries"',
]);

const useCaseMatches = [...source.matchAll(/question:\s*'([^']+)'[\s\S]*?evidence:\s*'([^']+)'[\s\S]*?notShared:\s*'([^']+)'/g)];
if (useCaseMatches.length < 4) {
  failures.push(`expected at least 4 structured use cases, found ${useCaseMatches.length}`);
}

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
  'full-stack platform',
  'end-to-end replacement',
  'universal registry',
  '—',
  '–',
  'TODO',
  'TBD',
  'FIXME',
];

// The copy-quality sweep (banned SaaS terms, em dashes, scaffolding markers) now
// runs across the homepage, every marketing page, and the shared components, so
// the multi-page site holds the same copy bar the single page did.
const copyCheckedSources = {
  'src/pages/index.astro': source,
  'src/pages/why.astro': '',
  'src/pages/use-cases.astro': '',
  'src/pages/ecosystem.astro': '',
  'src/pages/why-now.astro': '',
  'src/pages/status.astro': '',
  'src/components/SiteHeader.astro': '',
  'src/components/SiteFooter.astro': '',
  'src/components/DocsHandoff.astro': '',
};
for (const relativePath of Object.keys(copyCheckedSources)) {
  if (relativePath === 'src/pages/index.astro') continue;
  const fullPath = resolve(relativePath);
  copyCheckedSources[relativePath] = existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

// Strip scoped <style> blocks before the copy sweep: properties like
// `text-transform` are legitimate CSS, not marketing copy, and the banned terms
// only apply to reader-facing prose.
const stripStyleBlocks = (text) => text.replace(/<style>[\s\S]*?<\/style>/g, '');

for (const [relativePath, rawText] of Object.entries(copyCheckedSources)) {
  const text = stripStyleBlocks(rawText);
  for (const term of forbidden) {
    if (text.includes(term)) {
      failures.push(`forbidden term present in ${relativePath}: ${term}`);
    }
  }
  if (text.includes('lab.registrystack.org')) {
    failures.push(`lab link present in ${relativePath} even though the hosted lab is not verified reachable`);
  }
}

// The homepage routes to the deeper marketing pages instead of carrying the full
// persuasion layer itself, so the top nav must reach each new page.
for (const route of ['/why/', '/use-cases/', '/ecosystem/', '/why-now/', '/status/']) {
  if (!source.includes(`href="${route}"`)) {
    failures.push(`homepage nav is missing a link to ${route}`);
  }
}

// Multi-page contract: the persuasion layer migrated from the docs site lives on
// dedicated pages now. Each page must still carry its key messaging on the right
// route, end in a docs handoff, and keep the project registry-generic without
// over-claiming. The forbidden-term and em-dash sweep below also runs against
// every page source.
const readPage = (relativePath) => {
  const fullPath = resolve(relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing page: ${relativePath}`);
    return '';
  }
  return readFileSync(fullPath, 'utf8');
};

const pageContracts = {
  'src/pages/why.astro': [
    'Registry data exists. The service contract around it often does not.',
    'Data exists, but is not service-ready',
    'APIs over-share records',
    'Safeguards need technical enforcement',
    'Integrations become one-off negotiations',
    'Capabilities are hard to discover',
    'Semantics do not line up',
    'Identity and matching are unclear',
  ],
  'src/pages/use-cases.astro': [
    'Ask for the evidence a service needs, not the whole record.',
    'Civil registration',
    'Social protection',
    'Business registry',
    'Farmer registry',
    'Record not over-shared',
    'Smallest pilot',
    'MinimizationFunnel',
  ],
  'src/pages/ecosystem.astro': [
    'Designed to work with the infrastructure governments already choose.',
    'Complementary, not competitive.',
    'Domain registry platforms',
    'Workflow engines',
    'Exchange layers',
    'Wallets',
    // The plan calls for the layered exchange-layer example (Relay behind X-Road).
    'Behind an exchange layer, in front of a registry source.',
    'X-Road',
  ],
  'src/pages/why-now.astro': [
    // AI is context and urgency, not the product. Both must be present.
    'Registry Stack is not an AI product.',
    'is not to open registries to AI',
    'controlled answer',
    'is this request legitimate?',
  ],
  'src/pages/status.astro': [
    'What is built today',
    'no claimed production integrations',
    'Not a registry replacement.',
    'Not an open-data portal.',
    'Not a national data exchange layer.',
    'Not a workflow engine.',
    'Not a wallet.',
    'Not an AI decision system.',
    'Not a solution to foundational identity',
  ],
};

const pageSources = {};
for (const [relativePath, needles] of Object.entries(pageContracts)) {
  const pageSource = readPage(relativePath);
  pageSources[relativePath] = pageSource;
  if (!pageSource) continue;
  for (const needle of needles) {
    if (!pageSource.includes(needle)) {
      failures.push(`${relativePath} missing: ${needle}`);
    }
  }
  // Every marketing page must hand off to the docs for the "how", via the shared
  // DocsHandoff band.
  if (!pageSource.includes('DocsHandoff')) {
    failures.push(`${relativePath} is missing the docs handoff CTA (DocsHandoff)`);
  }
}

// The shared handoff band must actually point at the docs.
const handoffSource = readPage('src/components/DocsHandoff.astro');
if (handoffSource && !handoffSource.includes('https://docs.registrystack.org/')) {
  failures.push('DocsHandoff component does not link to the docs site');
}

// At least one non-social-protection example must remain on the use-cases sell
// gallery (the plan's claim boundary: keep it registry-generic).
const useCasesSource = pageSources['src/pages/use-cases.astro'] ?? '';
if (useCasesSource && !useCasesSource.includes('Business registry')) {
  failures.push('use-cases page lost its non-social-protection (business registry) example');
}

// Social sharing: the layout declares a large-image card, so it must point at a
// real OG image asset that actually exists.
const layoutPath = resolve('src/layouts/Base.astro');
const layoutSource = readFileSync(layoutPath, 'utf8');
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

console.log('content contract passed');
