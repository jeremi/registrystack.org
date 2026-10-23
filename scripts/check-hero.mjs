import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const htmlPath = resolve('dist/index.html');
if (!existsSync(htmlPath)) {
  console.error('dist/index.html does not exist. Run npm run build first.');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const { readFile } = await import('node:fs/promises');
  const { extname, join, normalize } = await import('node:path');
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const relative = normalize(pathname).replace(/^\/+/, '');
  const filePath = join(resolve('dist'), relative);
  const type = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
  }[extname(filePath)] ?? 'application/octet-stream';
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': type });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();
const failures = [];

const products = [
  { path: '/products/base-registry/', name: 'Base Registry Engine', tutorial: '/tutorials/first-breg/' },
  { path: '/products/evidence-gateway/', name: 'Evidence Gateway', tutorial: '/tutorials/first-evidence-assertion/' },
  { path: '/products/casework/', name: 'Registry Casework', tutorial: '/start/casework/' },
];
// The Products menu lists every product page, and each product has an equal
// card on the homepage.
const productMenuRoutes = products.map((product) => product.path);
const redirects = [
  ['/why/', '/'],
  ['/problem/', '/'],
  ['/ecosystem/', '/'],
  ['/how-it-fits/', '/'],
  ['/ai/', '/solutions/'],
  ['/use-cases/', '/solutions/'],
  ['/pilot/', '/pricing/'],
  ['/pilot/#support', '/pricing/#support'],
  ['/pilot/#scope', '/pricing/#scope'],
  ['/pilot/#stewardship', '/pricing/#stewardship'],
  ['/notary/', '/products/evidence-gateway/'],
  ['/relay/', '/products/evidence-gateway/'],
  ['/products/registry-relay/', '/products/evidence-gateway/'],
  ['/solutions/base-registry/', '/products/base-registry/'],
  ['/solutions/evidence-gateway/', '/products/evidence-gateway/'],
  ['/solutions/protected-registry-apis/', '/products/evidence-gateway/'],
  ['/solutions/casework/', '/products/casework/'],
];

// Seeing how a register runs, asking a question, understanding the products,
// trying a tutorial, and finding paid help must all work without JavaScript
// and with reduced motion.
for (const options of [
  { viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false },
  { viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' },
]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const mode = options.javaScriptEnabled === false ? 'no JavaScript' : 'reduced motion';
  const fail = (message) => failures.push(`${mode}: ${message}`);
  const followAnchor = async (link, target, label) => {
    if (await link.count() !== 1 || await link.getAttribute('href') !== target) {
      fail(`${label} must lead to ${target}`);
      return;
    }
    await link.click();
    if (new URL(page.url()).hash !== target || !await page.locator(target).isVisible()) {
      fail(`${label} did not reach a visible ${target} destination`);
    }
  };
  await page.goto(url);

  await followAnchor(page.locator('.hero .hero-actions a').first(), '#how-a-register-runs', 'hero primary action');
  if (await page.locator('main > section').nth(1).getAttribute('id') !== 'how-a-register-runs') {
    fail('the first section after the hero must show how a register runs');
  }
  // The register-day sequence keeps all four steps readable: the highlight
  // moves, the text never changes. The pause control only exists when the
  // script is allowed to move the highlight.
  const checkWeek = async (label) => {
    const daySteps = page.locator('.register-week .day-step');
    if (await daySteps.count() !== 4 || !(await daySteps.evaluateAll((steps) => steps.every((step) => step.getBoundingClientRect().height > 0)))) {
      fail(`${label}: the working-week sequence must show four visible steps`);
    }
    if (await page.locator('.register-week .day-step.is-active').count() !== 1) {
      fail(`${label}: exactly one working-week step is highlighted`);
    }
    if (await page.locator('.register-week .day-pause').count() !== 0) {
      fail(`${label}: the working-week pause control must not appear without JavaScript or with reduced motion`);
    }
  };
  await checkWeek('home');
  // The light contact action opens a prefilled question, not a scoping brief.
  const isQuestionMailto = (href) => {
    if (!href?.startsWith('mailto:contact@registrystack.org?')) return false;
    const params = new URL(href).searchParams;
    return /^Question about /.test(params.get('subject') ?? '') && !/budget/i.test(params.get('body') ?? '');
  };
  const heroQuestion = page.locator('.hero .hero-actions a').nth(1);
  if (!isQuestionMailto(await heroQuestion.getAttribute('href')) || !await heroQuestion.isVisible()) {
    fail('hero secondary action must be a visible "Ask a question" email');
  }
  // A register family page tells the same kind of story for its own record,
  // and its hero leads to that figure.
  await page.goto(`${url}solutions/licensing/`);
  await followAnchor(page.locator('.hero .hero-actions a').first(), '#example', 'licensing hero primary action');
  await checkWeek('licensing');
  await page.goto(url);
  const navQuestion = page.locator('.top-nav > a[href^="mailto:"]');
  if (await navQuestion.count() !== 1 || !isQuestionMailto(await navQuestion.getAttribute('href')) || !await navQuestion.isVisible()) {
    fail('main navigation must offer one visible "Ask a question" email');
  }
  // These are alternative journeys. Start the developer path from a fresh
  // page instead of clicking while the first anchor is still smoothly scrolling.
  await page.goto(url);
  const developersLink = page.locator('.top-nav a[href="/#developers"]');
  if (await developersLink.count() !== 1) {
    fail('main navigation must lead to /#developers');
  } else {
    await developersLink.click();
    await page.waitForURL((current) => current.hash === '#developers');
    if (!await page.locator('#developers').isVisible()) fail('the developer navigation link did not reach a visible #developers');
  }

  const tutorialLinks = await page.locator('#developers a.developer-tutorial').evaluateAll(
    (links) => links.map((link) => {
      const { origin, pathname } = new URL(link.href);
      return { origin, pathname };
    }),
  );
  if (tutorialLinks.length !== 2 || products.slice(0, 2).some((product) =>
    tutorialLinks.filter((link) => link.origin === 'https://docs.registrystack.org' && link.pathname === product.tutorial).length !== 1)) {
    fail('developer chooser must link once to each maintained flagship tutorial');
  }
  if (!await page.locator('#developers #start-testing, #start-testing #developers').count()) {
    fail('the old start-testing anchor must still reach the developer chooser');
  }
  // The public name is intentional. URLs and element IDs may still use the CLI name.
  if (/\bBReg\b/.test(await page.locator('body').innerText())) {
    fail('homepage exposes the internal product abbreviation');
  }
  if (!await page.locator('.registry-example').isVisible()) fail('registry example is hidden');
  if (!await page.locator('#registry-example-caption').isVisible()) fail('example caption is missing');

  // Solutions first, then Products; opening one menu leaves the other closed.
  const solutionsMenu = page.locator('.nav-group').nth(0);
  const productsMenu = page.locator('.nav-group').nth(1);
  await solutionsMenu.locator('summary').click();
  const solutionLinks = await solutionsMenu.locator('a').evaluateAll(
    (links) => links.map((link) => new URL(link.href).pathname),
  );
  if (solutionLinks[0] !== '/solutions/' || solutionLinks.length < 2 ||
      solutionLinks.slice(1).some((path) => !/^\/solutions\/[a-z-]+\/$/.test(path)) ||
      !await solutionsMenu.locator('a').first().isVisible()) {
    fail('the Solutions menu must open with all solutions, then list the solution area pages');
  }
  await productsMenu.locator('summary').click();
  const menuLinks = await productsMenu.locator('a').evaluateAll(
    (links) => links.map((link) => new URL(link.href).pathname),
  );
  if (menuLinks.length !== productMenuRoutes.length || productMenuRoutes.some((route) => !menuLinks.includes(route))) {
    fail('the Products menu must list every product page');
  }
  if (options.javaScriptEnabled !== false && await solutionsMenu.evaluate((menu) => menu.open)) {
    fail('opening the Products menu must close the Solutions menu');
  }
  const navLinks = await page.locator('.top-nav a').evaluateAll((links) => links.map((link) => {
    const { origin, pathname, hash } = new URL(link.href);
    return { origin, pathname, hash };
  }));
  for (const href of ['/starters/', '/blog/', '/pricing/', 'https://docs.registrystack.org/', '/#developers']) {
    const target = new URL(href, url);
    const index = navLinks.findIndex((link) => link.origin === target.origin &&
      link.pathname === target.pathname && link.hash === target.hash);
    if (index === -1 || !await page.locator('.top-nav a').nth(index).isVisible()) fail(`main navigation is missing ${href}`);
  }
  await productsMenu.locator('summary').click();
  if (options.javaScriptEnabled === false) await solutionsMenu.locator('summary').click();

  const cardLinks = await page.locator('.home-solution-card').evaluateAll(
    (cards) => cards.map((card) => [...card.querySelectorAll('a')].map((link) => link.getAttribute('href'))),
  );
  if (cardLinks.length !== products.length || products.some((product) =>
    cardLinks.filter((links) => links.length === 1 && links[0] === product.path).length !== 1)) {
    fail('each product card must lead to its own product page');
  }

  // Follow the actual product links, then verify both next steps on the page
  // they open. Merely checking hrefs would miss a stale or broken destination.
  for (const product of products) {
    await page.goto(url);
    const link = page.locator(`.home-solution-card a[href="${product.path}"]`).first();
    if (!await link.isVisible()) {
      fail(`homepage is missing its ${product.name} product link`);
      continue;
    }
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    if (new URL(page.url()).pathname !== product.path || !await page.locator('h1').isVisible() ||
        !(await page.title()).includes(product.name)) {
      fail(`${product.name} link did not open its product page`);
      continue;
    }
    await followAnchor(page.locator('.hero .hero-actions a').first(), '#product-example', `${product.name} primary action`);
    await page.goto(new URL(product.path, url).href);
    await followAnchor(page.locator('.hero .hero-actions a').nth(1), '#developers', `${product.name} developer action`);
    const tutorial = page.locator(`#developers a[href^="https://docs.registrystack.org${product.tutorial}"]`);
    if (!await tutorial.count() || !await tutorial.first().isVisible() ||
        new URL(await tutorial.first().getAttribute('href')).pathname !== product.tutorial) {
      fail(`${product.name} is missing its maintained tutorial`);
    }
    if (!await page.locator('.final-cta a[href="/pricing/"]').isVisible()) fail(`${product.name} is missing its closing pricing path`);
    const unnamedSections = await page.locator('main > section').evaluateAll((sections) => sections.filter((section) => {
      if (section.getAttribute('aria-label')?.trim()) return false;
      const labels = section.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
      return labels.length === 0 || labels.some((id) => !document.getElementById(id)?.textContent.trim());
    }).length);
    if (unnamedSections > 0) fail(`${product.name} has ${unnamedSections} section(s) without an accessible name`);
  }

  await page.goto(`${url}pricing/`);
  // The light question comes before the brief and asks for no budget; the
  // brief asks for the register and help needed, with budget and timing optional.
  const questionLinks = page.locator('main a[data-journey="ask-question"]');
  if (await questionLinks.count() !== 1 || !isQuestionMailto(await questionLinks.getAttribute('href')) ||
      !await questionLinks.isVisible()) {
    fail('pricing page is missing its "Ask a question" action');
  }
  const briefLinks = page.locator('main a[data-journey="implementation-support-inquiry"]');
  if (await briefLinks.count() !== 1) fail('pricing page is missing its inquiry action');
  for (const inquiry of await briefLinks.all()) {
    const body = new URL(await inquiry.getAttribute('href')).searchParams.get('body') ?? '';
    for (const [name, field] of [
      ['organization', /organization/i],
      ['register and help needed', /register and the help you need/i],
      ['optional timing', /^timing[^\n]*\(optional\)/im],
      ['optional budget', /^budget[^\n]*\(optional\)/im],
    ]) {
      if (!field.test(body)) fail(`pricing inquiry is missing its ${name} field`);
    }
  }
  if (!await page.locator('#team').isVisible()) fail('pricing page is missing its visible #team block');
  const inquiryLinks = page.locator('main a[href^="mailto:"]');
  for (const inquiry of await inquiryLinks.all()) {
    for (const price of ['US$20,000', 'US$7,500']) {
      const priceBeforeInquiry = await inquiry.evaluate((link, expectedPrice) => {
        const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.includes(expectedPrice)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          const style = getComputedStyle(node.parentElement);
          if (rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && style.opacity !== '0' &&
              (node.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) &&
              rect.top <= link.getBoundingClientRect().top) return true;
        }
        return false;
      }, price);
      if (!priceBeforeInquiry) fail(`the visible ${price} starting price must appear before each inquiry action`);
    }
  }
  if (!/\/\s*year/.test(await page.locator('#support .starting-fee').innerText())) {
    fail('the support starting price must state its annual billing period');
  }
  if (!await page.locator('main a[href="/#developers"]').first().isVisible()) {
    fail('pricing page is missing the self-service developer path');
  }

  for (const [from, to] of redirects) {
    await page.goto(new URL(from, url).href);
    const target = new URL(to, url);
    // Static refresh cannot carry an incoming fragment without JavaScript.
    // Its fallback still opens the full pricing page and readable scope.
    if (options.javaScriptEnabled === false && from.startsWith('/pilot/')) target.hash = '';
    try {
      await page.waitForURL(target.href, { timeout: 5000 });
      if (!await page.locator('main h1').isVisible()) fail(`${from} redirects to a missing page`);
      if (from.startsWith('/pilot/')) {
        const section = new URL(to, url).hash || '#scope';
        if (!await page.locator(section).isVisible()) fail(`${from} redirects without readable ${section} content`);
      }
    } catch {
      fail(`${from} did not redirect to ${target.pathname}${target.hash}`);
    }
  }
  await context.close();
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('homepage evaluation journey passed');
