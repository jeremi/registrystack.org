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
requireText('X-Road');
requireText('OpenFn');
requireText('OpenCRVS');
requireText('OpenSPP');
requireText('DHIS2');
requireText('OpenIMIS');
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

for (const term of forbidden) {
  if (source.includes(term)) {
    failures.push(`forbidden term present: ${term}`);
  }
}

if (source.includes('lab.registrystack.org')) {
  failures.push('lab link is present even though the hosted lab is not verified reachable');
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
