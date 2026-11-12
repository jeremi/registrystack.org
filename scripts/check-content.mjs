import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Structural invariant checks only. Marketing copy is intentionally reviewed
// by people, not pinned in this script. These checks protect the buyer-first
// information architecture (services, customization, then products),
// redirects, required components, and site wiring.

const failures = [];
const warnings = [];

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

// Product pages live under /products/<slug>/.
const productPages = [
  { key: 'base-registry', route: '/products/base-registry/', file: 'src/pages/products/base-registry.astro' },
  { key: 'evidence-gateway', route: '/products/evidence-gateway/', file: 'src/pages/products/evidence-gateway.astro' },
  { key: 'casework', route: '/products/casework/', file: 'src/pages/products/casework.astro' },
  { key: 'render', route: '/products/render/', file: 'src/pages/products/render.astro' },
  { key: 'messaging', route: '/products/messaging/', file: 'src/pages/products/messaging.astro' },
];

// Solution areas come from src/data/solutions.ts. The script reads the source
// text so it runs on any supported Node version without a TypeScript loader.
const solutionsSource = readSource('src/data/solutions.ts');
const solutionAreas = [...solutionsSource.matchAll(
  /key: '([^']+)',\s*slug: '([^']+)',[\s\S]*?kind: '([^']+)'/g,
)].map(([, key, slug, kind]) => ({ key, slug, kind }));
if (solutionAreas.length === 0) failures.push('could not read any solution areas from src/data/solutions.ts');
for (const area of solutionAreas) {
  if (area.slug !== `/solutions/${area.key}/`) {
    failures.push(`solution area ${area.key} has slug ${area.slug}, expected /solutions/${area.key}/`);
  }
}

// 1. Superseded marketing routes exist only as redirects for inbound links.
// Reader-facing links should point directly to the page or docs that replaced
// them so the simplified information architecture does not slowly grow back.
// The retired scenario page and the former product routes under /solutions/.
const retiredIaRoutes = [
  '/use-cases/',
  '/solutions/base-registry/',
  '/solutions/evidence-gateway/',
  '/solutions/protected-registry-apis/',
  '/solutions/casework/',
];
const supersededRoutes = [
  '/notary/',
  '/relay/',
  '/products/registry-relay/',
  '/manifest/',
  '/problem/',
  '/ecosystem/',
  '/how-it-fits/',
  '/pilot/',
  ...retiredIaRoutes,
];
for (const relativePath of sweptFiles) {
  const source = readSource(relativePath);
  for (const route of supersededRoutes) {
    if (source.includes(`href="${route}`) || source.includes(`href: '${route}`)) {
      failures.push(`${relativePath} links to superseded marketing route ${route}`);
    }
  }
}
// Data files and blog posts carry routes too; they must not point at the
// retired scenario page or the former product routes either.
const markdownLinkFiles = readdirSync(resolve('src/content/blog'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => `src/content/blog/${name}`);
for (const relativePath of ['src/data/products.ts', ...markdownLinkFiles]) {
  const source = readSource(relativePath);
  for (const route of retiredIaRoutes) {
    if (source.includes(`'${route}`) || source.includes(`(${route}`)) {
      failures.push(`${relativePath} links to superseded marketing route ${route}`);
    }
  }
}

// 2. Homepage orientation: service choices and adoption/ownership precede
// technical evaluation. Section IDs separately preserve inbound destinations.
const homeSource = readSource('src/pages/index.astro');
const productSource = readSource('src/data/products.ts');
const heroMatch = homeSource.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/);
if (!homeSource.includes('<HomeServiceMockup')) {
  failures.push('homepage is missing its illustrative configured-service mockup');
}
if (!heroMatch || !heroMatch[0].includes('href="/solutions/"') ||
    !heroMatch[0].includes('href={describeServiceHref()}') ||
    !heroMatch[0].includes('data-journey="service-inquiry"')) {
  failures.push('homepage hero is missing its solution route or needs-first service inquiry');
}
// `how-it-works`, `start-testing` and `customization` preserve older inbound
// destinations. The last now holds the AI entry; its name is not a content claim.
for (const anchor of ['registers', 'customization', 'how-a-register-runs', 'shared-work', 'open-source', 'products', 'how-it-works', 'get-started', 'developers', 'start-testing', 'project-status']) {
  if (!homeSource.includes(`id="${anchor}"`)) failures.push(`homepage is missing the ${anchor} destination`);
}
const buyerEntryIndexes = ['registers', 'open-source'].map((id) => homeSource.indexOf(`id="${id}"`));
const evaluationIndexes = ['products', 'developers'].map((id) => homeSource.indexOf(`id="${id}"`));
if (buyerEntryIndexes.some((index) => index < 0) || evaluationIndexes.some((index) => index < 0) ||
    Math.max(...buyerEntryIndexes) > Math.min(...evaluationIndexes)) {
  failures.push('homepage must introduce service choices and adoption before technical evaluation');
}
if (homeSource.indexOf('id="customization"') < homeSource.indexOf('id="open-source"')) {
  failures.push('homepage must explain the core service and implementation before its AI entry');
}
const adoptionSource = homeSource.match(/<section\b[^>]*id="open-source"[\s\S]*?<\/section>/)?.[0] ?? '';
if (!adoptionSource.includes('href="/pricing/"') || !/Apache[- ]2\.0/.test(adoptionSource)) {
  failures.push('homepage adoption section must expose the paid delivery route and core licence');
}
if (!homeSource.includes('home-product-links') || !homeSource.includes('developer-tutorial')) {
  failures.push('homepage is missing its product choices or developer tutorials');
}
// Product details remain reachable without repeating the capability inventory.
if (!homeSource.includes('products.map') || !homeSource.includes('href={product.href}')) {
  failures.push('homepage must link each maintained product in its technical evaluation section');
}
if (!homeSource.includes('registerFamilies') || !readSource('src/components/SiteHeader.astro').includes("'https://marketplace.registrystack.org/'") || !homeSource.includes('area.audience')) {
  failures.push('homepage is missing its register families, their audience lines, or the marketplace evaluation route');
}
if (/US\$/.test(homeSource)) failures.push('homepage repeats a price; prices belong on the pricing page');
// The homepage headline, the default page title, and the social image agree.
const homeHeadline = homeSource.match(/<h1 id="hero-title">([^<]+)<\/h1>/)?.[1]?.trim() ?? '';
const ogSource = readSource('scripts/build-og.mjs');
const ogCardHeadline = (file) => (ogSource.match(new RegExp(`file: '${file}',[\\s\\S]*?headline: '([^']*)'`))?.[1] ?? '')
  .replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim();
const ogHeadline = ogCardHeadline('public/og-image.png');
if (!homeHeadline || homeHeadline !== ogHeadline) {
  failures.push(`homepage H1 "${homeHeadline}" and scripts/build-og.mjs headline "${ogHeadline}" differ (update the script and run npm run build:og)`);
}
if (!readSource('src/layouts/Base.astro').includes(`'Registry Stack | ${homeHeadline.replace(/\.$/, '')}'`)) {
  failures.push('the default page title in Base.astro does not match the homepage H1');
}
for (const { route } of productPages) {
  if (!productSource.includes(`'${route}'`)) failures.push('product data is missing ' + route);
}
for (const route of [
  'https://docs.registrystack.org/tutorials/first-breg/',
  'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
  'https://docs.registrystack.org/tutorials/review-breg-changes-in-casework/',
]) {
  if (!productSource.includes(route)) failures.push('product data is missing a current tutorial: ' + route);
}

// 3. Site wiring: shared navigation reaches the general marketing routes;
// scoped service examples are reached through the solutions overview.
const navigationSource = [
  homeSource,
  readSource('src/components/SiteHeader.astro'),
  readSource('src/components/SiteFooter.astro'),
  productSource,
].join('\n');
for (const route of [
  ...productPages.map((page) => page.route),
  '/solutions/',
  '/ai/',
  '/customization/',
  '/architecture/headless/',
  '/digital-public-infrastructure/',
  '/data-spaces/',
  'https://marketplace.registrystack.org/',
  '/blog/',
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

// The header and footer build their solution and product entries from the
// shared data, so every solution area and product page is reachable.
const footerSource = readSource('src/components/SiteFooter.astro');
const headerSource = readSource('src/components/SiteHeader.astro');
for (const [label, source] of [['header', headerSource], ['footer', footerSource]]) {
  if (!source.includes("from '../data/solutions'") || !source.includes('area.slug')) {
    failures.push(`${label} does not build its solution entries from solutions.ts`);
  }
  if (!source.includes("from '../data/products'") || !source.includes('product.href') || !source.includes('product.name')) {
    failures.push(`${label} does not build its product entries from products.ts by product name`);
  }
  if (!source.includes("'https://marketplace.registrystack.org/'")) failures.push(`${label} is missing the starting configurations`);
  if (!source.includes('Shared capabilities')) {
    failures.push(`${label} does not group the cross-cutting solution areas under "Shared capabilities"`);
  }
}
if (!headerSource.includes('href="/solutions/"') || !headerSource.includes('All solutions')) {
  failures.push('the Solutions menu must open with all solutions');
}
for (const route of ['https://marketplace.registrystack.org/', '/#developers', 'https://docs.registrystack.org/']) {
  if (!headerSource.includes(`href: '${route}'`)) failures.push(`the Products menu is missing ${route}`);
}
for (const route of ['/ai/', '/pricing/']) {
  if (!headerSource.includes(`href: '${route}'`)) failures.push(`header is missing its direct ${route} route`);
}
if (!headerSource.includes('href={contactHref()}') || !headerSource.includes('>Contact</a>')) {
  failures.push('header Contact action must lead to the general contact form');
}
if (!footerSource.includes('href: describeServiceHref()') || !footerSource.includes('href: askQuestionHref()')) {
  failures.push('footer must route service discussions and questions through the contact form');
}
if (/mailto:|contactEmail/.test(footerSource)) {
  failures.push('footer must not bypass the contact form with a direct email link');
}
for (const route of ['/solutions/', '/ai/', '/customization/', '/architecture/headless/', '/digital-public-infrastructure/', '/data-spaces/', 'https://marketplace.registrystack.org/', '/blog/', '/security/', '/faq/']) {
  if (!footerSource.includes(`href: '${route}'`)) failures.push(`footer is missing ${route}`);
}

for (const staleRoute of supersededRoutes) {
  if (headerSource.includes(`'${staleRoute}'`) || headerSource.includes(`"${staleRoute}"`)) {
    failures.push(`header still links to superseded route ${staleRoute}`);
  }
}
// Former routes redirect to the product, pricing page, home explanation, or
// technical documentation that now owns the reader's next step.
for (const oldPage of ['notary', 'relay', 'manifest', 'problem', 'ecosystem', 'how-it-fits', 'use-cases']) {
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
  "'/use-cases/': '/solutions/'",
  "'/notary/': '/products/evidence-gateway/'",
  "'/relay/': '/products/evidence-gateway/'",
  "'/products/registry-relay/': '/products/evidence-gateway/'",
  "'/solutions/base-registry/': '/products/base-registry/'",
  "'/solutions/evidence-gateway/': '/products/evidence-gateway/'",
  "'/solutions/casework/': '/products/casework/'",
  "'/solutions/protected-registry-apis/': '/products/evidence-gateway/'",
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
// Each looks its product up by key, so the order of products.ts does not matter.
for (const { key, file: page } of productPages) {
  const source = readSource(page);
  if (!source.includes('<Product')) failures.push(page + ' is missing the product layout');
  if (!source.includes(`products.find((p) => p.key === '${key}')`)) {
    failures.push(page + ` must look up its product by key '${key}'`);
  }
  if (!source.includes('id="product-example"') || !source.includes('id="fit"') || !source.includes('id="developers"') ||
      !source.includes('href={product.tutorialHref}')) {
    failures.push(page + ' is missing its example, implementation fit, developer section, or maintained tutorial');
  }
}
// The former product pages under src/pages/solutions/ moved to /products/.
for (const { file } of productPages) {
  const formerFile = file.replace('src/pages/products/', 'src/pages/solutions/');
  if (existsSync(resolve(formerFile))) failures.push(`former product page still exists: ${formerFile}`);
}

// Registry Relay was retired upstream on 2026-10-03 and the site no longer
// markets it. Pages, components and data must not mention it, and its former
// routes redirect to Evidence Gateway. A blog post that discusses it carries
// a dated note linking the retirement decision.
const relayDecision = 'https://docs.registrystack.org/decisions/registry-relay-retirement-2026-10-03/';
const listFiles = (relativeDir, suffix) =>
  readdirSync(resolve(relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return listFiles(relativePath, suffix);
    return entry.isFile() && entry.name.endsWith(suffix) ? [relativePath] : [];
  });
for (const file of [...sweptFiles, ...listFiles('src/data', '.ts'), ...listFiles('src/content/blog', '.md'), 'public/llms.txt', 'README.md']) {
  const source = readSource(file);
  if (!/\bRelay\b|registry-relay|protected-registry-apis/.test(source)) continue;
  if (!source.includes(relayDecision)) failures.push(`${file} mentions Registry Relay without linking its retirement decision`);
  if (/\/products\/registry-relay\/|publish-governed-sqlite-registry/.test(source)) failures.push(`${file} links a retired Registry Relay page`);
}

// Every solution area has its own page. Until the first area page lands this
// only warns; once src/pages/solutions/ holds any area page, a missing one fails.
const solutionPageFiles = solutionAreas.map((area) => ({ area, file: `src/pages/solutions/${area.key}.astro` }));
const presentAreaPages = solutionPageFiles.filter(({ file }) => existsSync(resolve(file)));
for (const { area, file } of solutionPageFiles) {
  if (existsSync(resolve(file))) continue;
  const message = `solution area ${area.key} is missing its page ${file}`;
  if (presentAreaPages.length > 0) failures.push(message);
  else warnings.push(message);
}

// Register-family pages are written for the person who runs the register, not
// for a technical evaluator: implementation vocabulary belongs on starter and
// product pages. Cross-cutting capability pages may explain the capability
// they are specifically about. Each term is matched as a whole word, ignoring
// case, in the page's visible text and attributes alike.
const solutionPageVocabulary = [
  'record type', 'record types', 'access profile', 'access profiles', 'mutation mode', 'create-only',
  'scopes', 'signed answer', 'signed answers', 'schema', 'schemas', 'API', 'APIs', 'zip', 'toolchain',
];
for (const { area, file } of solutionPageFiles) {
  const source = readSource(file);
  if (!source) continue;
  // Only the template body: the frontmatter imports product and area data by name.
  const body = source.replace(/^---[\s\S]*?---/, '');
  if (area.kind === 'register-family') {
    for (const term of solutionPageVocabulary) {
      const pattern = new RegExp(`(^|[^A-Za-z-])${term.replace(/[-]/g, '\\-')}(?=$|[^A-Za-z-])`, 'im');
      if (pattern.test(body)) failures.push(`register-family page ${file} uses the term "${term}"; keep implementation vocabulary on starter and product pages`);
    }
  }
  if (source.includes('SolutionDevelopers')) failures.push(`solution page ${file} renders a developer section; developer next steps live in its FAQ`);
  // A register family tells one request, start to finish, for its own kind of record,
  // then what changes for the office; the product-by-product fit section
  // and the prose example belong to the cross-cutting pages only.
  if (area.kind === 'register-family') {
    if (!source.includes('<RegisterWeek')) failures.push(`solution page ${file} must tell its register's working week with <RegisterWeek>`);
    for (const retired of ['<SolutionExample', '<SolutionFit']) {
      if (source.includes(retired)) failures.push(`solution page ${file} still renders ${retired}>; the request figure and the what-changes section replace it`);
    }
    if (!source.includes('id="what-changes"')) failures.push(`solution page ${file} is missing its what-changes section`);
    const order = ['<RegisterWeek', 'id="what-changes"', '<SolutionStarters', '<SolutionFaq', '<DocsHandoff'].map((marker) => source.indexOf(marker));
    if (order.some((index, position) => index < 0 || (position > 0 && index < order[position - 1]))) {
      failures.push(`solution page ${file} sections must run: the request figure, what changes, starters, questions, work with us`);
    }
  }
}

// The starters catalogue: every starter belongs to exactly one register
// family, every id a family lists is in the catalogue, every download points
// at the site or the starters repository's GitHub releases, and the sync
// record agrees with the catalogue.
const startersCatalogue = JSON.parse(readSource('src/data/starters.json') || '{"starters":[]}');
const catalogueStarters = startersCatalogue.starters ?? [];
const catalogueIds = new Set(catalogueStarters.map((starter) => starter.id));
const familyStarterIds = [...solutionsSource.matchAll(
  /key: '([^']+)',[\s\S]*?starters: \[([^\]]*)\],(?:\s*featuredStarter: '([^']+)',)?(?:\s*openFirst: \[([^\]]*)\],)?/g,
)].map(([, key, list, featured, openFirst]) => ({
  key,
  ids: [...list.matchAll(/'([^']+)'/g)].map(([, id]) => id),
  featured,
  openFirst: [...(openFirst ?? '').matchAll(/'([^']+)'/g)].map(([, id]) => id),
}));
const familiesByStarter = new Map();
for (const { key, ids, featured, openFirst } of familyStarterIds) {
  // A family that names starters to open first names them from its own list.
  if (featured && !ids.includes(featured)) failures.push(`solution area ${key} features starter ${featured}, which is not in its starters list`);
  for (const id of openFirst) {
    if (!ids.includes(id)) failures.push(`solution area ${key} opens first with starter ${id}, which is not in its starters list`);
  }
  for (const id of ids) {
    if (!catalogueIds.has(id)) failures.push(`solution area ${key} lists starter ${id}, which is not in src/data/starters.json`);
    familiesByStarter.set(id, [...(familiesByStarter.get(id) ?? []), key]);
  }
}
for (const starter of catalogueStarters) {
  const families = familiesByStarter.get(starter.id) ?? [];
  if (families.length !== 1) {
    failures.push(`starter ${starter.id} belongs to ${families.length} register families (${families.join(', ') || 'none'}), expected exactly one`);
  }
  const downloadPath = starter.download?.path ?? '';
  const releasePrefix = 'https://github.com/registrystack/breg-registry-starters/releases/download/';
  const isSiteDownload = downloadPath === `/downloads/starters/${starter.id}-starter.zip`;
  const isReleaseDownload = downloadPath.startsWith(releasePrefix) && downloadPath.endsWith(`/${starter.id}-starter.zip`);
  if (!isSiteDownload && !isReleaseDownload) {
    failures.push(`starter ${starter.id} download ${downloadPath || '(none)'} is neither /downloads/starters/${starter.id}-starter.zip nor a breg-registry-starters release asset`);
  }
}
// Until the catalogue is published for download, a starter page asks for
// access through the native form or shared contact route and never links the zip.
const starterPageSource = readSource('src/pages/starters/[id].astro');
if (starterPageSource.includes('href={starter.download.path}')) failures.push('starter page links the zip; access to starters is available on request');
if (!starterPageSource.includes('marketplacePackHref(starter.id)') ||
    !starterPageSource.includes('data-journey="marketplace-current-configuration"')) {
  failures.push('each archived reference must lead to its exact current marketplace configuration');
}
if (starterPageSource.includes('<StarterRequestForm')) failures.push('archived references must not request access to an outdated snapshot locally');
if (!starterPageSource.includes('startersSource.breg.version') || !starterPageSource.includes('model snapshot')) {
  failures.push('archived references must identify the catalogue snapshot being described');
}
const startersIndexSource = readSource('src/pages/starters/index.astro');
if (!startersIndexSource.includes('registerFamilies.map') || !startersIndexSource.includes('marketplaceCollectionHref(area.key)')) {
  failures.push('the former catalogue index must retain all seven service-area handoffs to matching marketplace collections');
}
if (startersIndexSource.includes('<StarterCard')) failures.push('the former catalogue index must not repeat marketplace pack listings');
const startersUpstream = JSON.parse(readSource('src/upstream/starters.json') || '{}');
if (startersUpstream.starterCount !== catalogueStarters.length) {
  failures.push(`src/upstream/starters.json starterCount ${startersUpstream.starterCount} does not match the ${catalogueStarters.length} starters in src/data/starters.json`);
}

const productLayout = readSource('src/layouts/Product.astro');
if (!productLayout.includes('product.name')) {
  failures.push('product layout title must use the product name');
}
if (!productLayout.includes('href="#product-example"') || !productLayout.includes('href="#fit"')) {
  failures.push('product layout is missing its example or implementation fit action');
}
const productClosing = productLayout.match(/<section class="final-cta"[\s\S]*?<\/section>/);
const productContentIndex = productLayout.indexOf('<slot');
if (!productClosing || !productClosing[0].includes('href="/pricing/"') || productContentIndex < 0 ||
    productClosing.index < productContentIndex) {
  failures.push('product layout is missing a shared closing pricing CTA after its page content');
}

// 4. Every non-home marketing page hands off to the docs for the "how".
// Legal, error, and tracking service documents have no marketing handoff.
const handoffExempt = new Set([
  'src/pages/index.astro',
  'src/pages/pricing.astro',
  'src/pages/contact.astro',
  'src/pages/pilot.astro',
  'src/pages/privacy.astro',
  'src/pages/terms.astro',
  'src/pages/imprint.astro',
  'src/pages/404.astro',
  'src/pages/tracking-bridge.astro',
]);
for (const relativePath of sweptFiles) {
  if (!relativePath.startsWith('src/pages/') || handoffExempt.has(relativePath)) continue;
  const source = readSource(relativePath);
  const hasBuyerHandoff = (/data-journey="service-inquiry"/.test(source) &&
    /<section class="final-cta"[\s\S]*?href="\/pricing\//.test(source)) ||
    // An unreleased authoring tool offers a contextual question and a delivery
    // route, rather than implying it is included in runtime pilot pricing.
    (/askQuestionHref\('[^']+'\)/.test(source) &&
      /<section class="final-cta"[\s\S]*?href="\/customization\//.test(source));
  const hasSecurityHandoff = relativePath === 'src/pages/security.astro' &&
    /href=\{securityDocsHref\}/.test(source) && /href=\{askQuestionHref\(/.test(source);
  if (!/DocsHandoff|<Product|<Article/.test(source) && !hasBuyerHandoff && !hasSecurityHandoff) {
    failures.push(`${relativePath} is missing a docs or buyer delivery handoff`);
  }
}
// Blog articles reach the handoff through their shared layout.
if (!readSource('src/layouts/Article.astro').includes('DocsHandoff')) {
  failures.push('blog Article layout is missing the docs handoff CTA (DocsHandoff)');
}

const handoffSource = readSource('src/components/DocsHandoff.astro');
if (!handoffSource.includes('/#developers') || !handoffSource.includes('/pricing/')) {
  failures.push('DocsHandoff component is missing the developer chooser or pricing path');
}
if (handoffSource.includes('mailto:')) {
  failures.push('DocsHandoff must show pricing before opening a commercial inquiry');
}

// The blog posts point readers at two downloadable worksheets; both must
// ship with the site.
for (const relativePath of [
  'public/downloads/registry-question-worksheet.yaml',
  'public/downloads/registry-access-review-checklist.md',
]) {
  if (!existsSync(resolve(relativePath))) {
    failures.push(`missing download: ${relativePath}`);
  }
}

const pricingSource = readSource('src/pages/pricing.astro');
if (!pricingSource.includes('US$20,000') || !pricingSource.includes('US$7,500') ||
    !pricingSource.includes('data-journey="implementation-support-inquiry"') || !pricingSource.includes('href={proposalRoute}')) {
  failures.push('pricing page is missing a pilot/support starting price or inquiry action');
}
// The light tier asks for nothing but a question; the brief marks budget and
// timing optional so a reader without them can still write.
if (!pricingSource.includes('href={askQuestionHref()}')) failures.push('pricing page is missing the "Ask a question" action');
if (!/Budget[^'\n]*\(optional\)/.test(pricingSource) || !/Timing[^'\n]*\(optional\)/.test(pricingSource)) {
  failures.push('pricing brief must mark budget and timing as optional');
}
// The brief's audience assumptions and meaning belong to independent reader
// review. Do not lock an editorial sentence into this structural gate.
// The two prices appear on the pricing page only; other pages link to it.
for (const relativePath of sweptFiles) {
  if (relativePath === 'src/pages/pricing.astro') continue;
  if (/US\$\d/.test(readSource(relativePath))) failures.push(`${relativePath} repeats a price; link to /pricing/ instead`);
}

// The FAQ routes product, solution, starter, and provider questions to the pages
// that answer them, and closes on the light "Ask a question" action.
const faqSource = readSource('src/pages/faq.astro');
for (const route of ['/solutions/', '/products/', 'https://marketplace.registrystack.org/', '/imprint/']) {
  if (!faqSource.includes(`"href": "${route}"`)) failures.push(`FAQ is missing its link to ${route}`);
}
if (!/<DocsHandoff[\s\S]*?primaryHref=\{askQuestionHref\(\)\}[\s\S]*?\/>/.test(faqSource)) {
  failures.push('FAQ closing band must offer "Ask a question"');
}

// Every product has a search snippet short enough to show in full.
const productDescriptions = [...productSource.matchAll(/\bdescription: '([^']*)'/g)].map(([, text]) => text);
if (productDescriptions.length !== productPages.length) {
  failures.push(`products.ts has ${productDescriptions.length} descriptions for ${productPages.length} products`);
}
for (const text of productDescriptions) {
  if (text.length === 0 || text.length >= 155) failures.push(`product description must be 1 to 154 characters (${text.length}): ${text}`);
}
if (!productLayout.includes('description={product.description}')) {
  failures.push('product layout does not use the product description as the page description');
}
if (!pricingSource.includes('/#developers')) {
  failures.push('pricing page is missing the self-service developer path');
}

// Public calls to action preserve the request type and context in the contact
// route. Direct mail is reserved for recovery inside the form and the imprint.
const contactSource = readSource('src/data/contact.ts');
for (const mapping of [
  ["contactHref('question', about)", 'question'],
  ["contactHref('service', about)", 'service'],
  ["contactHref('proposal')", 'proposal'],
]) {
  if (!contactSource.includes(mapping[0])) failures.push(`contact route helper is missing its ${mapping[1]} type`);
}
for (const relativePath of listAstroFiles('src/pages')) {
  if (['src/pages/contact.astro', 'src/pages/imprint.astro'].includes(relativePath)) continue;
  const source = readSource(relativePath);
  if (/mailto:contact@registrystack\.org|\bcontactEmail\b/.test(source)) {
    failures.push(`${relativePath} bypasses the contextual contact form`);
  }
}

// Registry Studio carries its status label wherever it is marketed, so it
// stays distinguished from the core runtime.
const customizationSource = readSource('src/pages/customization.astro');
const studioSection = customizationSource.match(/<section\b[^>]*id="studio"[\s\S]*?<\/section>/)?.[0] ?? '';
if (studioSection && (!/Registry Studio/i.test(studioSection) || !/\bPreview\b/.test(studioSection))) {
  failures.push('a marketed Studio section must show its Preview status');
}

// Buyer pages present the software as ready to adopt. Maturity is a status
// label (Preview) on the product it applies to, and "pilot" describes the
// institution's register, never the software or the offer. Interface
// stability notes and detailed limits live in the documentation.
const notReadyFraming = [
  [/\bBeta\b/, 'Beta'],
  [/\bself-hosted pilots?\b/i, 'self-hosted pilot'],
  [/\binstitutional pilots?\b/i, 'institutional pilot'],
  [/\bin development\b/i, 'in development'],
  [/\blocal prototype\b/i, 'local prototype'],
  [/\bimplementation pilots?\b/i, 'implementation pilot'],
  [/\bpilot-level\b/i, 'pilot-level'],
  [/\bcurrent limitations\b/i, 'current limitations'],
  [/\bcurrently (?:cannot|can't|has no|does not|doesn't)\b/i, 'currently cannot'],
];
for (const relativePath of [
  ...sweptFiles,
  ...listAstroFiles('src/layouts'),
  'src/data/solutions.ts',
  'src/data/products.ts',
  'public/llms.txt',
]) {
  const source = readSource(relativePath);
  for (const [pattern, phrase] of notReadyFraming) {
    if (pattern.test(source)) failures.push(`${relativePath} frames the product as not ready ("${phrase}")`);
  }
}

// Aubex is one person, so copy in Aubex's voice says "we", never "our team".
// FAQ questions are in the reader's voice and may name the reader's team.
const readerVoiceTeam = ['What will our team need to do?'];
for (const relativePath of [
  ...sweptFiles,
  ...listAstroFiles('src/layouts'),
  'src/data/solutions.ts',
  'src/data/products.ts',
  'src/data/team.ts',
  'src/lib/starter-request.ts',
  'public/llms.txt',
]) {
  let source = readSource(relativePath);
  for (const phrase of readerVoiceTeam) source = source.replaceAll(phrase, '');
  if (/\bour team\b/i.test(source)) failures.push(`${relativePath} says "our team"; Aubex is one person, so write "we"`);
}

// Focus order: licensing, then business and agricultural registers, lead the
// solution lists and the homepage selection; every register family stays.
const focusOrder = ['licensing', 'business-and-tax', 'agriculture-food-and-environment'];
const solutionKeys = [...readSource('src/data/solutions.ts').matchAll(/^\s*key: '([^']+)'/gm)].map(([, key]) => key);
if (focusOrder.some((key, index) => solutionKeys[index] !== key)) {
  failures.push(`src/data/solutions.ts must start with the focus order: ${focusOrder.join(', ')}`);
}
const featuredSelection = homeSource.match(/const featured = [^;]*/)?.[0] ?? '';
for (const key of focusOrder) {
  if (!featuredSelection.includes(`'${key}'`)) failures.push(`homepage featured registers must include ${key}`);
}

// Documentation is one click from every page, and the paid route is named
// for what it covers.
const headerDirectLinks = headerSource.match(/const links = \[([\s\S]*?)\];/)?.[1] ?? '';
if (!headerDirectLinks.includes("href: 'https://docs.registrystack.org/'")) {
  failures.push('header direct links are missing the documentation');
}
if (!headerDirectLinks.includes("href: '/pricing/', label: 'Implementation and pricing'")) {
  failures.push('header must name the /pricing/ route "Implementation and pricing"');
}
if (!/<section\b[^>]*id="process"/.test(pricingSource) || !/\btitle="Implementation and pricing\b/.test(pricingSource)) {
  failures.push('pricing page must carry its implementation process section (#process) and an "Implementation and pricing" title');
}

// The company page names the company and its lead, and takes the track
// record from its single source. The lead's name may arrive through that
// record.
const aboutSource = readSource('src/pages/about.astro');
const aboutRecord = aboutSource.match(/\b(teamRecord(?:Short|Full))\b/)?.[1];
const aboutRecordText = aboutRecord
  ? readSource('src/data/team.ts').match(new RegExp(`${aboutRecord} =\\s*'([^']+)'`))?.[1] ?? ''
  : '';
if (!/Aubex Consulting LLC/.test(aboutSource) || !/Jeremi Joslin/.test(aboutSource + aboutRecordText) || !aboutRecord) {
  failures.push('about page must name Aubex Consulting LLC and Jeremi Joslin, and take the track record from src/data/team.ts');
}
if (!readSource('src/components/SiteFooter.astro').includes("href: '/about/'")) {
  failures.push('footer must link the about page');
}

// Each illustrative example names what it shows. A stock caption sentence
// repeated across examples reads as a disclaimer rather than a description.
// The short sentence that marks records as fictional may repeat; the sentence
// that describes the example may not.
const fictionalMarkers = new Set(['The records are fictional.']);
const captionSentences = new Map();
const captionSources = [
  'src/components/HomeServiceMockup.astro',
  'src/components/AiLandingHero.astro',
  'src/components/RegisterWeek.astro',
  ...listAstroFiles('src/pages'),
];
for (const file of captionSources) {
  const captions = [...readSource(file).matchAll(/<figcaption\b[^>]*>([^<{]+)<|(?:exampleNote|caption) = '([^']+)'|\b(?:exampleNote|caption)="([^"]+)"/g)]
    .map(([, figcaption, note, attribute]) => (figcaption ?? note ?? attribute).trim());
  for (const sentence of captions.flatMap((caption) => caption.split(/(?<=\.)\s+/))) {
    if (fictionalMarkers.has(sentence)) continue;
    if (!captionSentences.has(sentence)) captionSentences.set(sentence, new Set());
    captionSentences.get(sentence).add(file);
  }
}
for (const [sentence, files] of captionSentences) {
  if (files.size > 1 && sentence.split(/\s+/).length > 3) {
    failures.push(`example caption sentence "${sentence}" is repeated in ${[...files].join(', ')}`);
  }
}

// A figure shared by several pages takes its caption from each page, so one
// stock caption cannot repeat under different examples.
for (const component of ['RegisterWeek']) {
  if (/\bcaption = '/.test(readSource(`src/components/${component}.astro`))) {
    failures.push(`${component} must not declare a default caption; each page passes its own`);
  }
}

// Pictures and films from the explainer series. Each page passes its own
// caption, which names what the example shows and marks it as fictional, so
// the caption checks above also cover them. Every file a figure points to
// exists, and a film starts only when the visitor asks, with English captions.
const mediaSource = readSource('src/data/media.ts');
const mediaNames = {
  Illustration: new Set([...mediaSource.matchAll(/'([a-z0-9-]+)': \{ width: \d+, height: \d+ \}/g)].map(([, name]) => name)),
  Film: new Set([...mediaSource.matchAll(/'([a-z0-9-]+)': \{ length: '[^']+' \}/g)].map(([, name]) => name)),
};
const mediaFiles = {
  Illustration: (name) => [800, 1600, 2400].map((width) => `public/illustrations/${name}-${width}.webp`),
  Film: (name) => [`public/films/${name}-720.mp4`, `public/films/${name}-poster.jpg`, `public/films/${name}-en.vtt`],
};
const mediaUses = listAstroFiles('src/pages').flatMap((file) =>
  [...readSource(file).matchAll(/<(Illustration|Film)\b([^>]*)\/>/g)].map(([, component, attributes]) => ({
    file,
    component,
    name: attributes.match(/\bname="([^"]+)"/)?.[1],
    label: attributes.match(component === 'Film' ? /\btitle="([^"]*)"/ : /\balt="([^"]*)"/)?.[1],
    caption: attributes.match(/\bcaption="([^"]*)"/)?.[1],
  })));
for (const use of mediaUses) {
  const figure = `${use.file}: ${use.component} "${use.name}"`;
  if (!use.name || !mediaNames[use.component].has(use.name)) failures.push(`${figure} is not listed in src/data/media.ts`);
  if (!/\bfictional\b/i.test(use.caption ?? '')) failures.push(`${figure} needs a literal caption that marks the example as fictional`);
  if (!use.label?.trim()) failures.push(`${figure} needs ${use.component === 'Film' ? 'a title' : 'alt text'}`);
  for (const asset of use.name ? mediaFiles[use.component](use.name) : []) {
    if (!existsSync(resolve(asset))) failures.push(`${figure} is missing ${asset}`);
  }
}
const mediaPlacements = [
  { file: 'src/pages/digital-public-infrastructure.astro', component: 'Illustration', name: 'same-parts-many-services' },
  { file: 'src/pages/digital-public-infrastructure.astro', component: 'Film', name: 'registry-stack-film' },
  { file: 'src/pages/data-spaces.astro', component: 'Illustration', name: 'same-definitions' },
  { file: 'src/pages/architecture/headless.astro', component: 'Illustration', name: 'requests-and-signed-answers' },
  { file: 'src/pages/solutions/local-government.astro', component: 'Illustration', name: 'service-template' },
  { file: 'src/pages/products/studio.astro', component: 'Film', name: 'registry-stack-studio-film' },
  { file: 'src/pages/customization.astro', component: 'Illustration', name: 'ai-drafted-change' },
];
// Every media file in the public repository is used: it belongs to a picture
// or film in src/data/media.ts, or a page links it directly. Films are large,
// so an unused one should not be committed by accident.
const mediaFileSet = new Set(Object.entries(mediaNames).flatMap(([component, names]) =>
  [...names].flatMap((name) => mediaFiles[component](name))));
const pageSources = listAstroFiles('src').map(readSource).join('\n');
for (const folder of ['public/illustrations', 'public/films']) {
  for (const entry of existsSync(resolve(folder)) ? readdirSync(resolve(folder)) : []) {
    const file = `${folder}/${entry}`;
    if (!entry.startsWith('.') && !mediaFileSet.has(file) && !pageSources.includes(file.replace(/^public/, ''))) {
      failures.push(`${file} is not used by any page or by src/data/media.ts`);
    }
  }
}
for (const { file, component, name } of mediaPlacements) {
  if (!mediaUses.some((use) => use.file === file && use.component === component && use.name === name)) {
    failures.push(`${file} is missing its ${component} "${name}"`);
  }
}
const filmComponent = readSource('src/components/Film.astro');
const filmVideo = filmComponent.match(/<video\b[^>]*>/)?.[0] ?? '';
if (!/\bcontrols\b/.test(filmVideo) || !/\bpreload="none"/.test(filmVideo) || !/\bposter=/.test(filmVideo) ||
    /\bautoplay\b/.test(filmVideo) || !/<track\b[^>]*\bkind="captions"[^>]*\bsrclang="en"/.test(filmComponent)) {
  failures.push('Film.astro must render a visitor-started video with controls, preload="none", a poster and an English captions track');
}
const illustrationComponent = readSource('src/components/Illustration.astro');
const illustrationImage = illustrationComponent.match(/<img\b[^>]*>/)?.[0] ?? '';
if (!/\bwidth=/.test(illustrationImage) || !/\bheight=/.test(illustrationImage) || !/\bsizes=/.test(illustrationImage) ||
    !/-800\.webp 800w/.test(illustrationImage) || !/-1600\.webp 1600w/.test(illustrationImage) ||
    !/-2400\.webp 2400w/.test(illustrationImage)) {
  failures.push('Illustration.astro must give its picture dimensions, sizes and 800w, 1600w and 2400w sources, so it stays sharp on high-density screens');
}
if (!/<a\b[^>]*href=[^>]*-2400\.webp/.test(illustrationComponent)) {
  failures.push('Illustration.astro must link the full-size picture for readers on small screens');
}

// The assistant channel states its maturity and the limit of what an
// assistant can do, on the page that offers it.
const citizenAccessSource = readSource('src/pages/ai/citizen-access.astro');
if (!/\bPreview\b/.test(citizenAccessSource) || !/outside the compatibility promise/.test(citizenAccessSource)) {
  failures.push('citizen access page must label the assistant integration as a Preview outside the compatibility promise');
}
if (!/cannot submit a request, approve it or change a record/.test(citizenAccessSource)) {
  failures.push('citizen access page must state that the assistant cannot submit a request, approve it or change a record');
}
if (!citizenAccessSource.includes('href="/security/"') && !citizenAccessSource.includes("href: '/security/'")) {
  failures.push('citizen access page must link to the security page');
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
// The AI pages share their own card, and its headline agrees with the AI
// overview H1.
const aiOverviewSource = readSource('src/pages/ai/index.astro');
const aiHeadline = aiOverviewSource.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() ?? '';
const aiOgHeadline = ogCardHeadline('public/og-ai.png');
if (!aiHeadline || aiHeadline !== aiOgHeadline) {
  failures.push(`AI overview H1 "${aiHeadline}" and scripts/build-og.mjs headline "${aiOgHeadline}" differ (update the script and run npm run build:og)`);
}
if (!existsSync(resolve('public/og-ai.png'))) {
  failures.push('public/og-ai.png is missing (run npm run build:og)');
}
// The overview routes distinct reader jobs; the runtime restriction belongs to
// its citizen-access card, not a universal claim about every use of AI.
for (const route of ['/ai/service-design/', '/customization/', '/ai/citizen-access/', '/products/studio/']) {
  if (!aiOverviewSource.includes(`href="${route}"`)) failures.push(`AI overview is missing its ${route} path`);
}
// The destination protects the substantive runtime boundary above. The
// overview's section relevance and scoped wording require editorial review;
// do not pin a second literal safety sentence here.
const studioSource = readSource('src/pages/products/studio.astro');
if (!/\bPreview\b/.test(studioSource) || !/separate licensing terms/.test(studioSource)) {
  failures.push('Studio must show its Preview status and separate commercial terms from the core runtime');
}
// The track record has one source, so its figures cannot drift between pages
// or be restated as Registry Stack deployments. It is Jeremi Joslin's own
// record from roles before Aubex.
const teamRecordSource = readSource('src/data/team.ts');
for (const file of ['src/pages/ai/index.astro', 'src/pages/index.astro']) {
  if (!/\bteamRecord(Short|Full)\b/.test(readSource(file))) {
    failures.push(`${file} must take the team track record from src/data/team.ts`);
  }
}
for (const file of ['src/pages/ai/index.astro', 'src/pages/index.astro', 'src/pages/about.astro']) {
  if (/\b\d+\s+countries\b|\bmillion people\b/.test(readSource(file))) {
    failures.push(`${file} restates track record figures; use the wording in src/data/team.ts`);
  }
}
const teamRecords = [...teamRecordSource.matchAll(/export const (teamRecord\w*) =\s*'([^']+)'/g)];
if (teamRecords.length < 2) failures.push('src/data/team.ts must export teamRecordShort and teamRecordFull as single-quoted strings');
for (const [, name, text] of teamRecords) {
  if (!text.startsWith('Before Aubex')) failures.push(`${name} must attribute the record to Jeremi Joslin's roles before Aubex`);
}
for (const file of ['src/pages/ai/index.astro', 'src/pages/ai/service-design.astro', 'src/pages/ai/citizen-access.astro', 'src/pages/customization.astro']) {
  if (!readSource(file).includes('ogImagePath="/og-ai.png"')) {
    failures.push(`${file} does not use the AI social card`);
  }
}
if (!layoutSource.includes('type="application/rss+xml"')) {
  failures.push('layout does not advertise the RSS feed with a rel="alternate" link');
}

// Starters are sent on request while their repository and releases stay
// private, so llms.txt must not tell agents a public download exists.
const llmsText = readSource('public/llms.txt');
if (/breg-registry-starters|\bzip\b|SHA-256|checksum/i.test(llmsText)) {
  failures.push('public/llms.txt describes a public starter download; starters are available on request');
}

// GitHub Pages drops dot-directories from the artifact unless told to keep
// them, which left /.well-known/security.txt returning 404.
if (existsSync(resolve('public/.well-known'))) {
  const deployWorkflow = readSource('.github/workflows/deploy.yml');
  if (!/upload-pages-artifact@[\s\S]*?include-hidden-files:\s*true/.test(deployWorkflow)) {
    failures.push('deploy workflow must set include-hidden-files: true so public/.well-known is published');
  }
}

// 6. Every shadow is one of the brand's offset tokens: a hard edge with no
// blur. An inset rule draws an accent underline, not a shadow, so it stays.
// HeroAnswerCard is unused and waits on the branch cleanup that may remove it.
const shadowExempt = new Set(['src/components/HeroAnswerCard.astro']);
for (const relativePath of [
  'src/styles/global.css',
  ...listAstroFiles('src/layouts'),
  ...sweptFiles,
]) {
  if (shadowExempt.has(relativePath)) continue;
  for (const [, value] of readSource(relativePath).matchAll(/box-shadow\s*:\s*([^;}]+)/g)) {
    const shadow = value.trim();
    if (shadow === 'none' || shadow.startsWith('inset ') || /^var\(--offset-(sm|md|lg)\)$/.test(shadow)) continue;
    failures.push(`${relativePath} sets a shadow that is not an offset token: ${shadow}`);
  }
}

// 7. Public Sans is the brand's one variable file, so every weight is drawn
// true; weights stay to the brand's set (weight-regular to weight-bold), so a
// stray value does not slip in now that the font no longer refuses it.
const globalStyles = readSource('src/styles/global.css');
if (!globalStyles.includes("@import '@fontsource-variable/public-sans';")) {
  failures.push('global.css does not load the variable Public Sans');
}
if (globalStyles.includes('@fontsource/public-sans/')) {
  failures.push('global.css still loads static Public Sans files');
}
const brandWeights = new Set(['400', '500', '600', '700']);
for (const relativePath of [
  'src/styles/global.css',
  ...listAstroFiles('src/layouts'),
  ...sweptFiles,
]) {
  for (const [, value] of readSource(relativePath).matchAll(/font-weight\s*:\s*([^;}]+)/g)) {
    if (!brandWeights.has(value.trim())) {
      failures.push(`${relativePath} sets font-weight ${value.trim()}, outside the brand's 400, 500, 600 and 700`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(warnings.map((warning) => `warning: ${warning}`).join('\n'));
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('content invariants passed');
