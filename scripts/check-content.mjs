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
  '/how-it-fits/',
  '/pilot/',
];
for (const relativePath of sweptFiles) {
  const source = readSource(relativePath);
  for (const route of supersededRoutes) {
    if (source.includes(`href="${route}"`) || source.includes(`href: '${route}'`)) {
      failures.push(`${relativePath} links to superseded marketing route ${route}`);
    }
  }
}

// 2. Homepage orientation and the two flagship evaluation paths.
const homeSource = readSource('src/pages/index.astro');
const productSource = readSource('src/data/products.ts');
const heroMatch = homeSource.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/);
if (!homeSource.includes('<RegistryExample')) {
  failures.push('homepage is missing its explanatory registry example');
}
if (!heroMatch || !heroMatch[0].includes('href="#how-it-works"') || !heroMatch[0].includes('href="#developers"')) {
  failures.push('homepage hero is missing its explanation and developer actions');
}
for (const anchor of ['how-it-works', 'developers', 'start-testing']) {
  if (!homeSource.includes(`id="${anchor}"`)) failures.push(`homepage is missing the ${anchor} destination`);
}
if (!homeSource.includes('home-solution-grid') || !homeSource.includes('developer-tutorial')) {
  failures.push('homepage is missing its product choices or developer tutorials');
}
for (const route of [
  '/solutions/base-registry/',
  '/solutions/evidence-gateway/',
  '/solutions/protected-registry-apis/',
]) {
  if (!productSource.includes(route)) failures.push('product data is missing ' + route);
}
for (const route of [
  'https://docs.registrystack.org/tutorials/first-breg/',
  'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
  'https://docs.registrystack.org/tutorials/publish-governed-sqlite-registry/',
]) {
  if (!productSource.includes(route)) failures.push('product data is missing a current tutorial: ' + route);
}

// 3. Site wiring: shared navigation and footer reach every marketing route.
const navigationSource = [
  homeSource,
  readSource('src/components/SiteHeader.astro'),
  readSource('src/components/SiteFooter.astro'),
  productSource,
].join('\n');
for (const route of [
  '/solutions/base-registry/',
  '/solutions/evidence-gateway/',
  '/solutions/protected-registry-apis/',
  '/use-cases/',
  '/security/',
  '/faq/',
  '/pricing/',
  '/#developers',
]) {
  // The nav and footer build their links from data arrays (single-quoted
  // route strings) as well as literal href attributes (double-quoted), so a
  // route counts as wired if it appears in either form.
  if (!navigationSource.includes(`"${route}"`) && !navigationSource.includes(`'${route}'`)) {
    failures.push(`site navigation is missing a link to ${route}`);
  }
}

const footerSource = readSource('src/components/SiteFooter.astro');
if (!footerSource.includes('Base Registry Engine')) {
  failures.push('footer open-source components column is missing Base Registry Engine');
}

const headerSource = readSource('src/components/SiteHeader.astro');
for (const staleRoute of supersededRoutes) {
  if (headerSource.includes(`'${staleRoute}'`) || headerSource.includes(`"${staleRoute}"`)) {
    failures.push(`header still links to superseded route ${staleRoute}`);
  }
}
// Former routes redirect to the product, pricing page, home explanation, or
// technical documentation that now owns the reader's next step.
for (const oldPage of ['notary', 'relay', 'manifest', 'problem', 'ecosystem', 'ai', 'how-it-fits']) {
  if (existsSync(resolve(`src/pages/${oldPage}.astro`))) {
    failures.push(`superseded marketing page still exists: src/pages/${oldPage}.astro`);
  }
}
const redirectsSource = readSource('astro.config.mjs');
const expectedRedirects = [
  "'/why/': '/'",
  "'/problem/': '/'",
  "'/ecosystem/': '/'",
  "'/how-it-fits/': '/'",
  "'/ai/': '/use-cases/'",
  "'/notary/': '/solutions/evidence-gateway/'",
  "'/relay/': '/solutions/protected-registry-apis/'",
  "'/manifest/': 'https://docs.registrystack.org/products/registry-manifest/'",
];
for (const redirect of expectedRedirects) {
  if (!redirectsSource.includes(redirect)) failures.push(`missing redirect: ${redirect}`);
}

// The retired pilot route has a small redirect document so existing section
// links can retain their destination, with native refresh as the no-JS fallback.
const pilotRedirect = readSource('src/pages/pilot.astro');
if (!/<meta\b[^>]*http-equiv=["']refresh["']/i.test(pilotRedirect) ||
    !pilotRedirect.includes('/pricing/') || !/rel=["']canonical["']/.test(pilotRedirect) ||
    /<Base\b|<SiteHeader\b|<DocsHandoff\b|<section\b/.test(pilotRedirect)) {
  failures.push('pilot route must be a redirect-only document with canonical pricing and a native refresh fallback');
}

// Product pages explain the product before handing developers to a tutorial.
for (const page of [
  'src/pages/solutions/base-registry.astro',
  'src/pages/solutions/evidence-gateway.astro',
  'src/pages/solutions/protected-registry-apis.astro',
]) {
  const source = readSource(page);
  if (!source.includes('<Product')) failures.push(page + ' is missing the product layout');
  if (!source.includes('id="product-example"') || !source.includes('id="developers"') ||
      !source.includes('href={product.tutorialHref}')) {
    failures.push(page + ' is missing its example, developer section, or maintained tutorial');
  }
}
const productLayout = readSource('src/layouts/Product.astro');
if (!productLayout.includes('href="#product-example"') || !productLayout.includes('href="#developers"')) {
  failures.push('product layout is missing its example or developer action');
}
const productClosing = productLayout.match(/<section class="final-cta"[\s\S]*?<\/section>/);
const productContentIndex = productLayout.indexOf('<slot');
if (!productClosing || !productClosing[0].includes('href="/pricing/"') || productContentIndex < 0 ||
    productClosing.index < productContentIndex) {
  failures.push('product layout is missing a shared closing pricing CTA after its page content');
}

// 4. Every non-home marketing page hands off to the docs for the "how".
// Legal and error pages end on their own terms, not a marketing handoff.
const handoffExempt = new Set([
  'src/pages/index.astro',
  'src/pages/pricing.astro',
  'src/pages/pilot.astro',
  'src/pages/privacy.astro',
  'src/pages/terms.astro',
  'src/pages/imprint.astro',
  'src/pages/404.astro',
]);
for (const relativePath of sweptFiles) {
  if (!relativePath.startsWith('src/pages/') || handoffExempt.has(relativePath)) continue;
  if (!/DocsHandoff|<Product/.test(readSource(relativePath))) {
    failures.push(`${relativePath} is missing the docs handoff CTA (DocsHandoff)`);
  }
}

const handoffSource = readSource('src/components/DocsHandoff.astro');
if (!handoffSource.includes('/#developers') || !handoffSource.includes('/pricing/')) {
  failures.push('DocsHandoff component is missing the developer chooser or pricing path');
}
if (handoffSource.includes('mailto:')) {
  failures.push('DocsHandoff must show pricing before opening a commercial inquiry');
}

const pricingSource = readSource('src/pages/pricing.astro');
if (!pricingSource.includes('US$20,000') || !pricingSource.includes('US$7,500') || !pricingSource.includes('mailto:')) {
  failures.push('pricing page is missing a pilot/support starting price or inquiry action');
}
if (!pricingSource.includes('/#developers')) {
  failures.push('pricing page is missing the self-service developer path');
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
