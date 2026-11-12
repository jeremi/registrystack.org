import { marketplaceMigrationEnabled } from '../src/lib/marketplace-routes.mjs';
import { existsSync, readFileSync } from 'node:fs';
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
const migrationEnabled = marketplaceMigrationEnabled(process.env.PUBLIC_MARKETPLACE_MIGRATION_ENABLED, process.env.MARKETPLACE_INDEXING_DECISION);
const failures = [];

const products = [
  { path: '/products/base-registry/', name: 'Base Registry Engine', tutorial: '/tutorials/first-breg/' },
  { path: '/products/evidence-gateway/', name: 'Evidence Gateway', tutorial: '/tutorials/first-evidence-assertion/' },
  { path: '/products/casework/', name: 'Registry Casework', tutorial: '/tutorials/review-breg-changes-in-casework/' },
  { path: '/products/render/', name: 'Registry Render', tutorial: '/tutorials/first-render-document/' },
  { path: '/products/messaging/', name: 'Registry Messaging', tutorial: '/tutorials/first-messaging/' },
];
// The Products menu starts with the service overview, then products, authoring and evaluation.
// Each core product also has a concise detail link in the homepage evaluation section.
const productMenuHrefs = [
  '/products/',
  ...products.map((product) => product.path),
  '/products/studio/',
  'https://marketplace.registrystack.org/',
  '/#developers',
  'https://docs.registrystack.org/',
];
const solutionMenuHrefs = [
  '/solutions/',
  ...[...readFileSync(resolve('src/data/solutions.ts'), 'utf8').matchAll(/slug: '(\/solutions\/[^']+)'/g)]
    .map((match) => match[1]),
];
const familySolutionHrefs = new Set(
  [...readFileSync(resolve('src/data/solutions.ts'), 'utf8')
    .matchAll(/slug: '(\/solutions\/[^']+)'[\s\S]*?kind: '(register-family|cross-cutting)'/g)]
    .filter((match) => match[2] === 'register-family')
    .map((match) => match[1]),
);
const redirects = [
  ['/why/', '/'],
  ['/problem/', '/'],
  ['/ecosystem/', '/'],
  ['/how-it-fits/', '/'],
  ['/use-cases/', '/solutions/'],
  ['/pilot/', '/pricing/'],
  ['/pilot/#support', '/pricing/#support'],
  ['/pilot/#scope', '/pricing/#scope'],
  ['/pilot/#stewardship', '/pricing/'],
  ['/notary/', '/products/evidence-gateway/'],
  ['/relay/', '/products/evidence-gateway/'],
  ['/products/registry-relay/', '/products/evidence-gateway/'],
  ['/solutions/base-registry/', '/products/base-registry/'],
  ['/solutions/evidence-gateway/', '/products/evidence-gateway/'],
  ['/solutions/protected-registry-apis/', '/products/evidence-gateway/'],
  ['/solutions/casework/', '/products/casework/'],
];

const isContactRoute = (href, type, context) => {
  if (!href) return false;
  const target = new URL(href, url);
  const allowed = new Set(['type', 'context', 'source']);
  if (target.origin !== new URL(url).origin || target.pathname !== '/contact/' ||
      [...target.searchParams.keys()].some((key) => !allowed.has(key)) ||
      target.searchParams.getAll('type').length !== 1 || target.searchParams.get('type') !== type) {
    return false;
  }
  const contexts = target.searchParams.getAll('context');
  return context === undefined ? contexts.length === 0 : contexts.length === 1 && contexts[0] === context;
};

// Exploring solutions, describing a service, understanding the products,
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
  await page.goto(url);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content', exact: true });
  if (!await skip.evaluate((link) => link === document.activeElement)) fail('the first keyboard stop must skip repeated navigation');
  await page.keyboard.press('Enter');
  if (!await page.locator('main').evaluate((main) => main === document.activeElement)) fail('the skip link must focus the main content without JavaScript');
  // Buyers can enter through customization, programme-level DPI, or a local
  // service without choosing a starter or relying on JavaScript.
  for (const route of ['/customization/', '/digital-public-infrastructure/', '/data-spaces/', '/solutions/local-government/']) {
    const response = await page.goto(new URL(route, url).href);
    if (response?.status() !== 200) {
      fail(`buyer route ${route} does not open successfully`);
      continue;
    }
    if (!await page.locator('main h1').isVisible()) fail(`buyer route ${route} has no visible title`);
    const nextSteps = page.locator('main a[href="/pricing/"], main a[href^="/contact/?type=service&context="]');
    if (!await nextSteps.count()) fail(`buyer route ${route} has no way to discuss delivery`);
    const serviceInquiries = page.locator('main a[data-journey="service-inquiry"]');
    for (const inquiry of await serviceInquiries.all()) {
      if (!isContactRoute(await inquiry.getAttribute('href'), 'service',
          new URL(await inquiry.getAttribute('href'), url).searchParams.get('context'))) {
        fail(`buyer route ${route} has a service inquiry without its contextual contact route`);
      }
    }
  }
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

  // The old /ai/ entry now serves an overview. Each path leads to a
  // different next step, including for readers without JavaScript.
  const aiLink = page.getByRole('navigation', { name: 'Main navigation' }).locator('a[href="/ai/"]');
  if (await aiLink.count() !== 1 || !await aiLink.isVisible()) {
    fail('main navigation must offer one visible AI overview link');
  } else {
    await aiLink.click();
    if (new URL(page.url()).pathname !== '/ai/' || !await page.locator('main h1').isVisible()) {
      fail('AI navigation must open the overview rather than redirect to the pilot offer');
    } else {
      for (const [route, nextStep] of [
        ['/ai/service-design/', '/customization/'],
        ['/customization/', '/pricing/'],
        ['/ai/citizen-access/', 'https://docs.registrystack.org/configure/breg-mcp/'],
        ['/products/studio/', '/customization/'],
        ['/architecture/headless/', 'https://docs.registrystack.org/start/adopt/'],
      ]) {
        await page.goto(new URL('/ai/', url).href);
        const link = page.locator(`main a[href="${route}"]:visible`).first();
        if (!await link.count()) {
          fail(`AI overview must give readers a visible link to ${route}`);
          continue;
        }
        await link.click();
        if (new URL(page.url()).pathname !== route || !await page.locator('main h1').isVisible()) {
          fail(`the AI overview link did not open ${route}`);
        } else if (!await page.locator(`main a[href^="${nextStep}"]:visible`).count()) {
          fail(`${route} must offer its next step at ${nextStep}`);
        }
      }
    }
  }
  for (const [route, exampleTarget, inquiryContext] of [
    ['/ai/', '#uses', 'AI-assisted public services'],
    ['/ai/service-design/', '#worked-example', 'AI-assisted service design'],
    ['/customization/', '#change-example', 'AI-assisted implementation'],
    ['/ai/citizen-access/', '#correction-example', 'AI for citizen access'],
  ]) {
    const landingUrl = new URL(route, url).href;
    await page.goto(landingUrl);
    const hero = page.locator('main .hero');
    const figure = hero.locator('figure figcaption').filter({ hasText: 'Fictional example' });
    if (route !== '/ai/' && (await figure.count() !== 1 || !await figure.isVisible())) {
      fail(`${route} must show a labelled illustration in its hero`);
    }

    const inquiry = hero.locator('a.button-primary[data-journey="service-inquiry"]');
    if (await inquiry.count() !== 1 || !isContactRoute(await inquiry.getAttribute('href'), 'service', inquiryContext)) {
      fail(`${route} must lead with a contextual service inquiry`);
    } else {
      await inquiry.click();
      if (!isContactRoute(page.url(), 'service', inquiryContext) || !await page.locator('#contact-title').isVisible()) {
        fail(`${route} hero inquiry must open the contact page with its service context`);
      }
      await page.goto(landingUrl);
    }
    await followAnchor(hero.locator('a.button-secondary'), exampleTarget, `${route} hero example`);
  }
  // Verify the specialist page's own example rather than requiring an
  // unrelated interface-choice page to advertise it.
  await page.goto(new URL('/data-spaces/', url).href);
  await followAnchor(page.locator('.hero .hero-actions a').first(), '#example', 'data spaces example');
  await page.goto(url);

  const heroPrimary = page.locator('.hero .hero-actions a').first();
  if (await heroPrimary.count() !== 1 || await heroPrimary.getAttribute('href') !== '/solutions/' || !await heroPrimary.isVisible()) {
    fail('hero primary action must visibly lead to /solutions/');
  } else {
    await heroPrimary.click();
    await page.waitForLoadState('domcontentloaded');
    if (new URL(page.url()).pathname !== '/solutions/' || !await page.locator('main h1').isVisible()) {
      fail('hero primary action did not open the solutions page');
    } else {
      if (await page.locator('#registers .solution-area-grid a').count() !== familySolutionHrefs.size) {
        fail('the solutions directory must retain every service family');
      }
      const licensing = page.locator('#registers a[href="/solutions/licensing/"]');
      if (await licensing.count() !== 1) {
        fail('the service catalogue must offer a route to licensing');
      } else {
        await licensing.click();
        await page.waitForLoadState('domcontentloaded');
        const localExample = page.locator('main a[href="/solutions/local-government/"]');
        if (await localExample.count() !== 1) {
          fail('the licensing page must provide a route to its local-permit example');
        } else {
          await localExample.click();
          await page.waitForLoadState('domcontentloaded');
          if (new URL(page.url()).pathname !== '/solutions/local-government/' || !await page.locator('main h1').isVisible()) {
            fail('the local-permit example must open from the licensing page');
          }
        }
      }
      for (const route of ['/solutions/check-a-fact/', '/solutions/review-changes/', '/solutions/verifiable-credentials/']) {
        await page.goto(url);
        if (await page.locator(`#shared-work a[href="${route}"]`).count() !== 1) {
          fail(`the homepage must offer a clear route to ${route}`);
        }
        await page.goto(`${url}solutions/`);
        const taskLink = page.locator(`main a[href="${route}"]`);
        if (await taskLink.count() !== 1) {
          fail(`the solutions overview must offer a clear route to ${route}`);
          continue;
        }
        await taskLink.click();
        await page.waitForLoadState('domcontentloaded');
        if (new URL(page.url()).pathname !== route || !await page.locator('main h1').isVisible()) {
          fail(`the solutions overview link did not open ${route}`);
        }
        for (const anchor of ['example', 'fit']) {
          const action = page.locator(`.hero-actions a[href="#${anchor}"]`);
          if (await action.count() !== 1 || await page.locator(`#${anchor}`).count() !== 1) {
            fail(`${route} must lead to its ${anchor} section`);
          }
        }
      }
      await page.goto(`${url}solutions/`);
      const inquiry = page.locator('.final-cta a[href^="/contact/?type=service&context="]');
      if (await inquiry.count() !== 1 || !isContactRoute(await inquiry.getAttribute('href'), 'service', 'Registry Stack')) {
        fail('the solutions closing invitation must let readers describe their service without choosing a configuration');
      }
      for (const route of solutionMenuHrefs.slice(1)) {
        const response = await page.goto(new URL(route, url).href);
        if (response?.status() !== 200) {
          fail(`${route} must open before a reader discusses a service`);
          continue;
        }
        const contact = page.locator('.final-cta .button-primary');
        const contactHref = await contact.getAttribute('href');
        const contactContext = new URL(contactHref, url).searchParams.get('context');
        if (await contact.count() !== 1 || !contactContext || !isContactRoute(contactHref, 'service', contactContext)) {
          fail(`${route} must offer a contextual service inquiry`);
        }
        if (familySolutionHrefs.has(route)) {
          const duplicateIds = await page.locator('[id]').evaluateAll(elements => {
            const ids = elements.map(element => element.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index);
          });
          if (duplicateIds.length) fail(`${route} has duplicate IDs: ${duplicateIds.join(', ')}`);
          const key = route.split('/').filter(Boolean).at(-1);
          const collection = `https://marketplace.registrystack.org/collections/${key}/`;
          if (await page.locator(`#starters a[href="${collection}"]`).count() !== 1 ||
              await page.locator('main a[href^="/starters/"]').count() !== 0) {
            fail(`${route} must hand configuration browsing to its matching marketplace collection`);
          }
          if (!await page.locator('main a[href="/#developers"]').count()) {
            fail(`${route} must retain the technical evaluation route`);
          }
        }
      }
    }
  }
  await page.goto(url);
  // Check visible choices and adoption facts, not the historical #customization
  // identifier, which is retained as an inbound anchor for the AI entry.
  const homeOrder = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('main > section')];
    const linksTo = (section, path) => [...section.querySelectorAll('a')]
      .some(link => new URL(link.href).pathname === path);
    return {
      services: sections.findIndex(section => linksTo(section, '/solutions/licensing/') && linksTo(section, '/solutions/')),
      adoption: sections.findIndex(section => linksTo(section, '/pricing/') && /Apache[- ]2\.0/.test(section.innerText) && /Aubex/.test(section.innerText)),
      ai: sections.findIndex(section => linksTo(section, '/ai/')),
      technical: sections.findIndex(section => [...section.querySelectorAll('a')]
        .some(link => new URL(link.href).hostname === 'docs.registrystack.org' && new URL(link.href).pathname.startsWith('/tutorials/'))),
    };
  });
  if (Object.values(homeOrder).some(index => index < 0) ||
      Math.max(homeOrder.services, homeOrder.adoption) >= homeOrder.technical) {
    fail('homepage must show actual service choices and adoption/ownership before technical tutorials');
  }
  if (Math.max(homeOrder.services, homeOrder.adoption) >= homeOrder.ai) {
    fail('homepage must explain service fit and ownership before the AI overview route');
  }
  // The licensing detail sequence keeps all four steps readable: the highlight
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
  const heroInquiry = page.locator('.hero .hero-actions a').nth(1);
  if (!isContactRoute(await heroInquiry.getAttribute('href'), 'service', 'Registry Stack') || !await heroInquiry.isVisible()) {
    fail('hero secondary action must be a visible contextual "Discuss your service" form route');
  }
  // A register family page tells the same kind of story for its own record,
  // and its hero leads to that figure.
  await page.goto(`${url}solutions/licensing/`);
  await followAnchor(page.locator('.hero .hero-actions a').first(), '#example', 'licensing hero primary action');
  await checkWeek('licensing');
  // These are alternative journeys. Start the developer path from a fresh page.
  await page.goto(url);
  const developerMenu = page.locator('.nav-group').nth(1);
  await developerMenu.locator('summary').click();
  const developersLink = developerMenu.locator('a[href="/#developers"]');
  if (await developersLink.count() !== 1) fail('Products menu must lead to /#developers');
  else {
    await developersLink.click();
    await page.waitForURL((current) => current.hash === '#developers');
    if (!await page.locator('#developers').isVisible()) fail('the developer menu link did not reach a visible #developers');
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
  // The designed service remains readable without JavaScript and with reduced motion.
  const mockup = page.locator('figure.home-service-mockup');
  if (!await mockup.isVisible() || !await mockup.locator('figcaption').isVisible()) {
    fail('the designed service and its illustrative caption must remain visible');
  }
  for (const part of ['.application-content', '.staff-review', '.register-panel']) {
    if (!await mockup.locator(part).isVisible()) fail(`service mockup is missing visible ${part}`);
  }
  if (await mockup.locator('button, input, select, textarea, [role="button"]').count()) {
    fail('the static service illustration must not expose nonfunctional controls');
  }

  // Solutions first, then Products; opening one menu leaves the other closed.
  await page.goto(url);
  const solutionsMenu = page.locator('.nav-group').nth(0);
  const productsMenu = page.locator('.nav-group').nth(1);
  await solutionsMenu.locator('summary').click();
  const solutionLinks = await solutionsMenu.locator('a').evaluateAll(
    (links) => links.map((link) => new URL(link.href).pathname),
  );
  if (solutionLinks.length !== solutionMenuHrefs.length ||
      solutionLinks.some((path, index) => path !== solutionMenuHrefs[index]) ||
      !await solutionsMenu.locator('a').first().isVisible()) {
    fail('the Solutions menu must list all solutions followed by service areas and shared capabilities');
  }
  const footerSolutions = await page.locator('.site-footer .footer-col').first().locator('a').evaluateAll(
    (links) => links.map((link) => new URL(link.href).pathname),
  );
  if (footerSolutions.length !== solutionMenuHrefs.length ||
      footerSolutions.some((path, index) => path !== solutionMenuHrefs[index])) {
    fail('the footer must use the same service-area navigation as the Solutions menu');
  }
  await productsMenu.locator('summary').click();
  const menuLinks = await productsMenu.locator('a').evaluateAll(
    (links) => links.map((link) => {
      const { origin, pathname, hash } = new URL(link.href);
      return `${origin}${pathname}${hash}`;
    }),
  );
  const expectedProductLinks = productMenuHrefs.map((href) => {
    const { origin, pathname, hash } = new URL(href, url);
    return `${origin}${pathname}${hash}`;
  });
  if (menuLinks.length !== expectedProductLinks.length || expectedProductLinks.some((href) => !menuLinks.includes(href))) {
    fail(`the Products menu must list the overview, maintained products, Studio, marketplace, tutorials and documentation (found ${menuLinks.join(', ')})`);
  }
  if (options.javaScriptEnabled !== false && await solutionsMenu.evaluate((menu) => menu.open)) {
    fail('opening the Products menu must close the Solutions menu');
  }
  const navLinks = await page.locator('.top-nav a').evaluateAll((links) => links.map((link) => {
    const { origin, pathname, hash } = new URL(link.href);
    return { origin, pathname, hash };
  }));
  for (const href of ['/ai/', '/pricing/', 'https://docs.registrystack.org/', '/contact/']) {
    const target = new URL(href, url);
    const index = navLinks.findIndex((link) => link.origin === target.origin &&
      link.pathname === target.pathname && link.hash === target.hash);
    if (index === -1 || !await page.locator('.top-nav a').nth(index).isVisible()) fail(`main navigation is missing ${href}`);
  }
  await productsMenu.locator('summary').click();
  if (options.javaScriptEnabled === false) await solutionsMenu.locator('summary').click();

  const productLinks = page.locator('.home-product-links a');
  if (await productLinks.count() !== products.length) {
    fail('homepage must retain one product detail link per maintained product');
  }

  // Follow the actual product links, then verify both next steps on the page
  // they open. Merely checking hrefs would miss a stale or broken destination.
  for (const product of products) {
    await page.goto(url);
    const link = page.locator(`.home-product-links a[href="${product.path}"]`).first();
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
    await followAnchor(page.locator('.hero .hero-actions a').nth(1), '#fit', `${product.name} implementation fit action`);
    const tutorial = page.locator(`#developers a[href^="https://docs.registrystack.org${product.tutorial}"]`);
    if (!await tutorial.count() || !await tutorial.first().isVisible() ||
        new URL(await tutorial.first().getAttribute('href')).pathname !== product.tutorial) {
      fail(`${product.name} is missing its maintained tutorial`);
    }
    if (!await page.locator('.final-cta a[href="/pricing/"]').isVisible()) fail(`${product.name} is missing its closing pricing path`);
    const serviceInquiry = page.locator('.final-cta .button-primary');
    if (!await serviceInquiry.isVisible() || !isContactRoute(await serviceInquiry.getAttribute('href'), 'service', product.name)) {
      fail(`${product.name} is missing its contextual service inquiry`);
    }
    const unnamedSections = await page.locator('main > section').evaluateAll((sections) => sections.filter((section) => {
      if (section.getAttribute('aria-label')?.trim()) return false;
      const labels = section.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
      return labels.length === 0 || labels.some((id) => !document.getElementById(id)?.textContent.trim());
    }).length);
    if (unnamedSections > 0) fail(`${product.name} has ${unnamedSections} section(s) without an accessible name`);
  }

  await page.goto(`${url}products/`);
  const journey = page.locator('figure.product-service-journey');
  if (!await journey.isVisible() || !await journey.locator('figcaption').isVisible()) fail('product overview must show its service diagram and caption');
  for (const product of products) {
    if (!await journey.locator(`a[href="${product.path}"]`).isVisible()) fail(`product overview is missing the ${product.name} detail path`);
  }
  const implementation = page.locator('a[href="/pricing/#process"]');
  if (!await implementation.isVisible()) fail('product overview must expose implementation responsibilities');

  await page.goto(`${url}pricing/`);
  // The light question comes before the brief and asks for no budget; the
  // brief keeps budget and timing optional. Its meaning is reviewed independently.
  const questionLinks = page.locator('main a[data-journey="ask-question"]');
  if (await questionLinks.count() !== 1 || !isContactRoute(await questionLinks.getAttribute('href'), 'question', 'Registry Stack') ||
      !await questionLinks.isVisible()) {
    fail('pricing page is missing its "Ask a question" action');
  }
  const briefLinks = page.locator('main a[data-journey="implementation-support-inquiry"]');
  if (await briefLinks.count() !== 1) fail('pricing page is missing its inquiry action');
  for (const inquiry of await briefLinks.all()) {
    if (!isContactRoute(await inquiry.getAttribute('href'), 'proposal')) {
      fail('pricing proposal action must preserve the proposal request type');
    }
  }
  const proposalGuidance = await page.locator('.pilot-brief').innerText();
  for (const [name, field] of [
    ['optional timing', /timing.*optional/i],
    ['optional budget', /budget.*optional/i],
  ]) {
    if (!field.test(proposalGuidance)) fail(`pricing proposal guidance is missing ${name}`);
  }
  const inquiryLinks = briefLinks;
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

  // The migration gate verifies redirected routes separately, without sending
  // browser fixtures to the live marketplace.
  if (!migrationEnabled) {
  await page.goto(`${url}starters/`);
  const collectionLinks = await page.locator('main .configuration-areas a[href^="https://marketplace.registrystack.org/collections/"]').evaluateAll((links) => links.map((a) => a.href));
  const expectedCollections = [...familySolutionHrefs].map((route) => `https://marketplace.registrystack.org/collections/${route.split('/').filter(Boolean).at(-1)}/`);
  if (collectionLinks.length !== expectedCollections.length || expectedCollections.some((href) => !collectionLinks.includes(href))) fail('the former catalogue must retain seven exact collection handoffs');
  if (await page.locator('main .starter-card').count()) fail('the former catalogue must not repeat the marketplace pack listing');

  // Old bookmarks remain readable, while current models and access requests
  // have one home in the marketplace.
  await page.goto(`${url}starters/professional-licensing/`);
  if (!await page.locator('main h1').isVisible()) fail('the archived reference must remain readable');
  const currentConfiguration = page.locator('main .hero a[data-journey="marketplace-current-configuration"]');
  if (await currentConfiguration.count() !== 1 || await currentConfiguration.getAttribute('href') !== 'https://marketplace.registrystack.org/packs/professional-licensing/') fail('the archived reference must lead to its exact current pack');
  if (await page.locator('main [data-starter-request-form], main a[download], main a[href$=".zip"]').count()) fail('archived references must not offer outdated local access or downloads');

  }

  await page.goto(`${url}contact/`);
  const currentContact = page.locator('.top-nav a[aria-current="page"]').filter({ hasText: 'Contact' });
  if (await currentContact.count() !== 1 || !await currentContact.isVisible()) {
    fail('contact page must highlight Contact in the main navigation');
  }

  // Contact source attribution must not rewrite a same-document skip link,
  // reload the page or replace the referring service's source query.
  await page.goto(`${url}contact/?type=question&context=Registry+Studio&source=%2Fproducts%2Fstudio%2F`);
  const contactBeforeSkip = new URL(page.url());
  const contactSkip = page.getByRole('link', { name: 'Skip to main content', exact: true });
  if (await contactSkip.getAttribute('href') !== '#main-content') fail('contact skip link must remain a fragment');
  await contactSkip.focus();
  await page.keyboard.press('Enter');
  if (new URL(page.url()).search !== contactBeforeSkip.search ||
      !await page.locator('main').evaluate((main) => main === document.activeElement)) fail('contact skip navigation must preserve source and focus');

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
