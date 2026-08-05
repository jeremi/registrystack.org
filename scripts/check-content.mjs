import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Structural invariant checks only. Marketing copy is intentionally reviewed
// by people, not pinned in this script. These checks protect the solution-first
// information architecture, redirects, required components, and site wiring.

const failures = [];

const readSource = (relativePath) => {
  const fullPath = resolve(relativePath);
  if (!existsSync(fullPath)) {
    failures.push(`missing file: ${relativePath}`);
    return '';
  }
  return readFileSync(fullPath, 'utf8');
};

const listAstroFiles = (relativeDir) =>
  readdirSync(resolve(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return listAstroFiles(relativePath);
    return entry.isFile() && entry.name.endsWith('.astro') ? [relativePath] : [];
  });

const sweptFiles = [
  ...listAstroFiles('src/pages'),
  ...listAstroFiles('src/components'),
];

// 1. Superseded marketing routes exist only as redirects for inbound links.
// Reader-facing links should point directly to the page or docs that replaced
// them so the simplified information architecture does not slowly grow back.
const supersededRoutes = [
  '/notary/',
  '/relay/',
  '/manifest/',
  '/problem/',
  '/ecosystem/',
  '/ai/',
  '/pricing/',
];
for (const relativePath of sweptFiles) {
  const source = readSource(relativePath);
  for (const route of supersededRoutes) {
    if (source.includes(`href="${route}"`) || source.includes(`href: '${route}'`)) {
      failures.push(`${relativePath} links to superseded marketing route ${route}`);
    }
  }
}

// 2. Homepage guardrails.
const homeSource = readSource('src/pages/index.astro');

// The homepage hero must carry the looping answer card as its visual anchor.
const heroMatch = homeSource.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/);
if (!heroMatch) {
  failures.push('missing hero section');
} else if (!heroMatch[0].includes('HeroAnswerCard')) {
  failures.push('hero is missing the answer-card visual anchor');
}

// The homepage now routes first to the two solution patterns; the live lab
// remains present as proof. Product implementation detail stays in the docs.
// Like the nav check below, the routes count whether they appear as literal
// href attributes (double-quoted) or in a data array (single-quoted).
const workflowIndex = homeSource.indexOf('class="home-workflow"');
const solutionGridIndex = homeSource.indexOf('class="home-solution-grid"');
if (workflowIndex === -1) {
  failures.push('homepage is missing the outcome-first workflow');
} else if (solutionGridIndex !== -1 && workflowIndex > solutionGridIndex) {
  failures.push('homepage must explain the institutional workflow before routing to solutions');
}

const workflowSource = homeSource.match(/const workflowSteps = \[([\s\S]*?)\n\];/)?.[1] ?? '';
const workflowStepCount = (workflowSource.match(/\bnumber:/g) ?? []).length;
if (workflowStepCount !== 4) {
  failures.push(`homepage workflow must contain 4 steps, found ${workflowStepCount}`);
}

for (const route of ['/solutions/evidence-gateway/', '/solutions/protected-registry-apis/']) {
  if (!homeSource.includes(`href="${route}"`) && !homeSource.includes(`'${route}'`)) {
    failures.push(`homepage primary solution routing is missing ${route}`);
  }
}
if (!homeSource.includes('https://lab.registrystack.org/')) {
  failures.push('homepage is missing the live demo link (lab.registrystack.org)');
}
if (!homeSource.includes('home-solution-grid')) {
  failures.push('homepage is missing the two-card solution routing grid');
}
if (!homeSource.includes('home-audience-grid')) {
  failures.push('homepage is missing the government customer audience grid');
}
if (!homeSource.includes('/how-it-fits/')) {
  failures.push('homepage is missing the How it fits handoff');
}
for (const productRoute of ['/notary/', '/relay/', '/manifest/']) {
  if (homeSource.includes(`href="${productRoute}"`) || homeSource.includes(`'${productRoute}'`)) {
    failures.push(`homepage links to removed product marketing route ${productRoute}`);
  }
}
if (homeSource.includes('home-product-strip')) {
  failures.push('homepage still contains the removed product marketing strip');
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
  '/use-cases/',
  '/how-it-fits/',
  '/security/',
  '/faq/',
  '/pilot/',
]) {
  // The nav and footer build their links from data arrays (single-quoted
  // route strings) as well as literal href attributes (double-quoted), so a
  // route counts as wired if it appears in either form.
  if (!navigationSource.includes(`"${route}"`) && !navigationSource.includes(`'${route}'`)) {
    failures.push(`site navigation is missing a link to ${route}`);
  }
}

const headerSource = readSource('src/components/SiteHeader.astro');
for (const staleRoute of ['/notary/', '/relay/', '/manifest/', '/problem/', '/ecosystem/', '/ai/', '/pricing/']) {
  if (headerSource.includes(`'${staleRoute}'`) || headerSource.includes(`"${staleRoute}"`)) {
    failures.push(`header still links to superseded route ${staleRoute}`);
  }
}
// Product marketing pages are removed. Their former routes must go directly to
// technical documentation, while consolidated editorial routes redirect to
// the page that absorbed their useful material.
for (const oldPage of ['notary', 'relay', 'manifest', 'problem', 'ecosystem', 'ai', 'pricing']) {
  if (existsSync(resolve(`src/pages/${oldPage}.astro`))) {
    failures.push(`superseded marketing page still exists: src/pages/${oldPage}.astro`);
  }
}
const redirectsSource = readSource('astro.config.mjs');
const expectedRedirects = [
  "'/why/': '/'",
  "'/problem/': '/'",
  "'/ecosystem/': '/how-it-fits/'",
  "'/ai/': '/use-cases/'",
  "'/pricing/': '/pilot/'",
  "'/notary/': '/solutions/evidence-gateway/'",
  "'/relay/': 'https://docs.registrystack.org/products/registry-relay/'",
  "'/manifest/': 'https://docs.registrystack.org/products/registry-manifest/'",
];
for (const redirect of expectedRedirects) {
  if (!redirectsSource.includes(redirect)) failures.push(`missing redirect: ${redirect}`);
}

// Each solution teaches the customer journey and then hands technical readers
// to the open-source components in the docs.
for (const page of [
  'src/pages/solutions/evidence-gateway.astro',
  'src/pages/solutions/protected-registry-apis.astro',
]) {
  const source = readSource(page);
  if (!source.includes('class="technical-component-grid"')) {
    failures.push(`${page} is missing the open-source component handoff`);
  }
  if (!source.includes('https://docs.registrystack.org/products/')) {
    failures.push(`${page} does not link product detail to the technical docs`);
  }
}

// 4. Every non-home marketing page hands off to the docs for the "how".
// Legal and error pages end on their own terms, not a marketing handoff.
const handoffExempt = new Set([
  'src/pages/index.astro',
  'src/pages/privacy.astro',
  'src/pages/terms.astro',
  'src/pages/imprint.astro',
  'src/pages/404.astro',
]);
for (const relativePath of sweptFiles) {
  if (!relativePath.startsWith('src/pages/') || handoffExempt.has(relativePath)) continue;
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
