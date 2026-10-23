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
  '/ai/',
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

// 2. Homepage orientation: start from the service, explain customization and
// an example journey, then ownership, products, adoption and developer paths.
const homeSource = readSource('src/pages/index.astro');
const productSource = readSource('src/data/products.ts');
const heroMatch = homeSource.match(/<section class="hero[^"]*"[\s\S]*?<\/section>/);
if (!homeSource.includes('<ServiceOutline')) {
  failures.push('homepage is missing its service-owner outline');
}
if (!homeSource.includes('<RegisterDay')) {
  failures.push('homepage is missing the example journey from request to current record');
}
if (!heroMatch || !heroMatch[0].includes('href="/solutions/"') ||
    !heroMatch[0].includes('href={describeServiceHref()}') ||
    !heroMatch[0].includes('data-journey="service-inquiry"')) {
  failures.push('homepage hero is missing its solution route or needs-first service inquiry');
}
// `how-it-works` and `start-testing` are kept for inbound links to the
// former product and developer anchors.
for (const anchor of ['registers', 'customization', 'how-a-register-runs', 'shared-work', 'open-source', 'products', 'how-it-works', 'get-started', 'developers', 'start-testing', 'project-status']) {
  if (!homeSource.includes(`id="${anchor}"`)) failures.push(`homepage is missing the ${anchor} destination`);
}
const buyerEntryIndexes = ['registers', 'customization'].map((id) => homeSource.indexOf(`id="${id}"`));
const evaluationIndexes = ['products', 'developers'].map((id) => homeSource.indexOf(`id="${id}"`));
if (buyerEntryIndexes.some((index) => index < 0) || evaluationIndexes.some((index) => index < 0) ||
    Math.max(...buyerEntryIndexes) > Math.min(...evaluationIndexes)) {
  failures.push('homepage must introduce solutions and customization before product and technical evaluation');
}
if (!homeSource.includes('home-solution-grid') || !homeSource.includes('developer-tutorial')) {
  failures.push('homepage is missing its product choices or developer tutorials');
}
// The three core products are equal cards on the homepage, each with its own page.
const homeProductCards = homeSource.match(/class="home-solution-card"/g) ?? [];
if (homeProductCards.length !== productPages.length ||
    productPages.some(({ route }) => !homeSource.includes(`href="${route}"`))) {
  failures.push(`homepage must show ${productPages.length} product cards, one for each product page`);
}
if (!homeSource.includes('registerFamilies') || !homeSource.includes('href="/starters/"') || !homeSource.includes('area.audience')) {
  failures.push('homepage is missing its register families, their audience lines, or the link to the starters catalogue');
}
if (/US\$/.test(homeSource)) failures.push('homepage repeats a price; prices belong on the pricing page');
// The homepage headline, the default page title, and the social image agree.
const homeHeadline = homeSource.match(/<h1 id="hero-title">([^<]+)<\/h1>/)?.[1]?.trim() ?? '';
const ogHeadline = (readSource('scripts/build-og.mjs').match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '')
  .replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim();
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

// 3. Site wiring: shared navigation and footer reach every marketing route.
const navigationSource = [
  homeSource,
  readSource('src/components/SiteHeader.astro'),
  readSource('src/components/SiteFooter.astro'),
  productSource,
].join('\n');
for (const route of [
  ...productPages.map((page) => page.route),
  '/solutions/',
  '/solutions/local-government/',
  '/customization/',
  '/digital-public-infrastructure/',
  '/starters/',
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
  if (!source.includes("'/starters/'")) failures.push(`${label} is missing the starting configurations`);
  if (!source.includes('Shared capabilities')) {
    failures.push(`${label} does not group the cross-cutting solution areas under "Shared capabilities"`);
  }
}
if (!headerSource.includes('href="/solutions/"') || !headerSource.includes('All solutions') ||
    !headerSource.includes('href="/solutions/local-government/"')) {
  failures.push('the Solutions menu must open with all solutions and the local-government route');
}
for (const route of ['/starters/', '/#developers', 'https://docs.registrystack.org/']) {
  if (!headerSource.includes(`href: '${route}'`)) failures.push(`the Products menu is missing ${route}`);
}
for (const route of ['/customization/', '/pricing/']) {
  if (!headerSource.includes(`href: '${route}'`)) failures.push(`header is missing its direct ${route} route`);
}
if (!headerSource.includes('href="/pricing/#inquiry"') || !headerSource.includes('>Contact</a>')) {
  failures.push('header Contact action must lead to /pricing/#inquiry');
}
// The footer prints the address itself, not only a button that opens it.
if (!/label: contactEmail\b|>contact@registrystack\.org</.test(footerSource)) {
  failures.push('footer does not print the contact address in text');
}
for (const route of ['/solutions/', '/solutions/local-government/', '/customization/', '/digital-public-infrastructure/', '/starters/', '/blog/', '/security/', '/faq/', '/pricing/#inquiry']) {
  if (!footerSource.includes(`href: '${route}'`)) failures.push(`footer is missing ${route}`);
}
if (!footerSource.includes("'/pricing/#team'")) failures.push('footer is missing the About link to /pricing/#team');

for (const staleRoute of supersededRoutes) {
  if (headerSource.includes(`'${staleRoute}'`) || headerSource.includes(`"${staleRoute}"`)) {
    failures.push(`header still links to superseded route ${staleRoute}`);
  }
}
// Former routes redirect to the product, pricing page, home explanation, or
// technical documentation that now owns the reader's next step.
for (const oldPage of ['notary', 'relay', 'manifest', 'problem', 'ecosystem', 'ai', 'how-it-fits', 'use-cases']) {
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
  "'/ai/': '/customization/'",
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
  if (!source.includes('id="product-example"') || !source.includes('id="developers"') ||
      !source.includes('href={product.tutorialHref}')) {
    failures.push(page + ' is missing its example, developer section, or maintained tutorial');
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
// Until the catalogue is published for download, a starter page asks for a
// request by email and never links the zip.
const starterPageSource = readSource('src/pages/starters/[id].astro');
if (starterPageSource.includes('href={starter.download.path}')) failures.push('starter page links the zip; starters are sent on request');
if (!starterPageSource.includes('data-journey="starter-request"')) failures.push('starter page is missing the starter request action');
const startersIndexSource = readSource('src/pages/starters/index.astro');
if (!/not public yet[\s\S]*email request|email request[\s\S]*not public yet/i.test(startersIndexSource)) {
  failures.push('starters catalogue must state that unpublished starter files are available by email request');
}
const startersUpstream = JSON.parse(readSource('src/upstream/starters.json') || '{}');
if (startersUpstream.starterCount !== catalogueStarters.length) {
  failures.push(`src/upstream/starters.json starterCount ${startersUpstream.starterCount} does not match the ${catalogueStarters.length} starters in src/data/starters.json`);
}

const productLayout = readSource('src/layouts/Product.astro');
if (!productLayout.includes('product.name')) {
  failures.push('product layout title must use the product name');
}
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
  const source = readSource(relativePath);
  const hasBuyerHandoff = /data-journey="service-inquiry"/.test(source) &&
    /<section class="final-cta"[\s\S]*?href="\/pricing\//.test(source);
  if (!/DocsHandoff|<Product|<Article/.test(source) && !hasBuyerHandoff) {
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
    !pricingSource.includes('data-journey="implementation-support-inquiry"') || !pricingSource.includes('href={contactHref}')) {
  failures.push('pricing page is missing a pilot/support starting price or inquiry action');
}
// The light tier asks for nothing but a question; the brief marks budget and
// timing optional so a reader without them can still write.
if (!pricingSource.includes('href={askQuestionHref()}')) failures.push('pricing page is missing the "Ask a question" action');
if (!/Budget[^'\n]*\(optional\)/.test(pricingSource) || !/Timing[^'\n]*\(optional\)/.test(pricingSource)) {
  failures.push('pricing brief must mark budget and timing as optional');
}
for (const need of [/service you need/i, /who will use it/i, /what should improve/i]) {
  if (!need.test(pricingSource)) failures.push(`pricing brief is missing the needs-first field ${need}`);
}
if (!pricingSource.includes('id="team"') || !pricingSource.includes('id="stewardship"')) {
  failures.push('pricing page is missing the team block (#team) or the #stewardship anchor the pilot redirect keeps');
}
// The two prices appear on the pricing page only; other pages link to it.
for (const relativePath of sweptFiles) {
  if (relativePath === 'src/pages/pricing.astro') continue;
  if (/US\$\d/.test(readSource(relativePath))) failures.push(`${relativePath} repeats a price; link to /pricing/ instead`);
}

// The FAQ routes product, solution, starter, and team questions to the pages
// that answer them, and closes on the light "Ask a question" action.
const faqSource = readSource('src/pages/faq.astro');
for (const route of ['/solutions/', '/solutions/#products', '/starters/', '/pricing/#team']) {
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

// Inquiry mailtos use encoded real line breaks, and the service path asks for
// the need, users and desired improvement before a buyer chooses a product.
const contactSource = readSource('src/data/contact.ts');
if (!contactSource.includes("bodyLines.join('\\n')") || contactSource.includes("bodyLines.join('\\\\n')")) {
  failures.push('contact mailtos must join fields with real newline characters');
}
for (const field of ['The service you need: ', 'Who will use it: ', 'What should improve: ']) {
  if (!contactSource.includes(`'${field}'`)) failures.push(`service inquiry email is missing field: ${field.trim()}`);
}

// Planned product and standards work stays clearly distinguished from what a
// buyer can use today.
const customizationSource = readSource('src/pages/customization.astro');
const studioSection = customizationSource.match(/<section\b[^>]*id="studio"[\s\S]*?<\/section>/)?.[0] ?? '';
if (!/Registry Studio/i.test(studioSection) ||
    !/\b(planned|in development|developing|future|not (?:yet|currently) available)\b/i.test(studioSection)) {
  failures.push('customization page must identify Registry Studio as planned or in development');
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
