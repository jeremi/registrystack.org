// French localization check, run on the built site (npm run build first).
// For every page listed in src/i18n.ts it checks the English and French pair:
// html lang, one canonical, reciprocal hreflang alternates (en, fr, x-default
// to English), one h1 and one language switch to the other page. On French
// pages it checks that every internal link and fragment exists, that links to
// pages with a French version stay French, that links to English content say
// so (hreflang="en" or "(en anglais)"), and that no English wording from the
// shared components is left. A French page that is not written yet is reported
// by name, once, and its pair is skipped.
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

import { episodesPagePath, frenchPagePaths as listedFrenchPagePaths } from '../src/i18n.ts';

const dist = resolve('dist');
const siteOrigin = 'https://registrystack.org';

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/index.html does not exist. Run npm run build first.');
  process.exit(1);
}

// The episodes pair exists only while an episode is published: when the
// English page was built, the pair is checked like the others (a missing
// French twin is then reported); when it was not, nothing about episodes is
// checked.
const frenchPagePaths = existsSync(resolve(dist, `.${episodesPagePath}`, 'index.html'))
  ? [...listedFrenchPagePaths, episodesPagePath]
  : [...listedFrenchPagePaths];

const frenchPath = (englishPath) => (englishPath === '/' ? '/fr/' : `/fr${englishPath}`);
const sourceFileFor = (englishPath) => (englishPath === '/' ? 'index.astro' : `${englishPath.slice(1, -1)}.astro`);
const translatedEnglishPaths = new Set(frenchPagePaths);
const failures = [];

const builtFileForPath = (pathname) => {
  const relative = pathname.replace(/^\/+/, '');
  return pathname.endsWith('/') ? resolve(dist, relative, 'index.html') : resolve(dist, relative);
};

// French pages not built yet: named once here, then skipped below.
const missingFrench = frenchPagePaths.filter((englishPath) => !existsSync(builtFileForPath(frenchPath(englishPath))));
const writtenPairs = frenchPagePaths.filter((englishPath) => !missingFrench.includes(englishPath));
const missingFrenchPaths = new Set(missingFrench.map(frenchPath));
for (const englishPath of missingFrench) {
  const file = sourceFileFor(englishPath);
  failures.push(`French page missing: ${frenchPath(englishPath)} (write src/pages/fr/${file} from src/pages/${file})`);
}

// Wording that the shared components show in English. A French page that
// still shows one of these uses a component that does not follow the locale.
const englishComponentWording = [
  'Skip to main content',
  'All solutions',
  'Shared capabilities',
  'How the products fit together',
  'Discuss your service',
  'Implementation and pricing',
  'Next step',
  'See the developer tutorials',
  'Open the full-size picture',
  'These questions can help you plan your service',
  'See an example',
  'See a service example',
  'Explore starting configurations',
  'Tracking preferences',
  'Digitally signed',
  'Not shared',
  'Printed document',
  'The core software is licensed under Apache-2.0',
];

const idsByFile = new Map();
const idsForFile = (file) => {
  if (!idsByFile.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsByFile.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
  }
  return idsByFile.get(file);
};

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.vtt': 'text/vtt',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  const file = join(dist, normalize(decodeURIComponent(pathname)).replace(/^\/+/, ''));
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const localOrigin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();

const goto = async (page, pathname) => {
  const response = await page.goto(`${localOrigin}${pathname}`, { waitUntil: 'load' });
  if (!response?.ok()) failures.push(`${pathname}: expected a built page, received HTTP ${response?.status() ?? 'no response'}`);
};

const inspectPageContract = async (page, pathname, locale, counterpart) => {
  const englishUrl = new URL(locale === 'fr' ? counterpart : pathname, siteOrigin).toString();
  const frenchUrl = new URL(locale === 'fr' ? pathname : counterpart, siteOrigin).toString();
  const expectedAlternates = { en: englishUrl, fr: frenchUrl, 'x-default': englishUrl };
  const contract = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((link) => link.href),
    alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => ({
      language: link.getAttribute('hreflang'),
      href: link.href,
    })),
    h1Count: document.querySelectorAll('h1').length,
    switches: [...document.querySelectorAll('.language-switch')].map((link) => ({
      href: link.getAttribute('href'),
      lang: link.getAttribute('lang'),
      hreflang: link.getAttribute('hreflang'),
      label: link.getAttribute('aria-label'),
    })),
  }));

  if (contract.lang !== locale) failures.push(`${pathname}: expected html lang=${locale}, found ${contract.lang || 'none'}`);
  const expectedCanonical = new URL(pathname, siteOrigin).toString();
  if (contract.canonical.length !== 1 || contract.canonical[0] !== expectedCanonical) {
    failures.push(`${pathname}: expected one canonical ${expectedCanonical}, found ${contract.canonical.join(', ') || 'none'}`);
  }
  for (const [language, expectedHref] of Object.entries(expectedAlternates)) {
    const matches = contract.alternates.filter((alternate) => alternate.language === language);
    if (matches.length !== 1 || matches[0].href !== expectedHref) {
      failures.push(`${pathname}: expected one ${language} alternate ${expectedHref}, found ${matches.map((item) => item.href).join(', ') || 'none'}`);
    }
  }
  if (contract.alternates.length !== 3) failures.push(`${pathname}: expected 3 hreflang alternates, found ${contract.alternates.length}`);
  if (contract.h1Count !== 1) failures.push(`${pathname}: expected exactly one h1, found ${contract.h1Count}`);
  const expectedLanguage = locale === 'fr' ? 'en' : 'fr';
  if (contract.switches.length !== 1) {
    failures.push(`${pathname}: expected exactly one language switch, found ${contract.switches.length}`);
  } else {
    const languageSwitch = contract.switches[0];
    if (languageSwitch.href !== counterpart || languageSwitch.lang !== expectedLanguage ||
        languageSwitch.hreflang !== expectedLanguage || !languageSwitch.label?.trim()) {
      failures.push(`${pathname}: language switch must point to ${counterpart} and identify ${expectedLanguage}`);
    }
  }
};

const inspectFrenchPage = async (page, sourcePath) => {
  const { links, text } = await page.evaluate(() => {
    const body = document.body.cloneNode(true);
    for (const element of body.querySelectorAll('script, style, [hidden]')) element.remove();
    const labels = [...document.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label'));
    return {
      links: [...document.querySelectorAll('a[href]')].map((anchor) => ({
        href: anchor.getAttribute('href'),
        hreflang: anchor.getAttribute('hreflang'),
        text: (anchor.textContent ?? '').replace(/\s+/g, ' ').trim(),
        isSwitch: anchor.classList.contains('language-switch'),
        languageUnknown: anchor.hasAttribute('data-language-unknown'),
      })),
      text: [(body.textContent ?? '').replace(/\s+/g, ' '), ...labels].join(' | '),
    };
  });

  for (const wording of englishComponentWording) {
    if (text.includes(wording)) failures.push(`${sourcePath}: shows the English component wording "${wording}"`);
  }

  const unwrittenTargets = new Set();
  for (const link of links) {
    if (!link.href || link.isSwitch || /^(mailto|tel):/.test(link.href)) continue;
    let target;
    try {
      target = new URL(link.href, new URL(sourcePath, siteOrigin));
    } catch {
      failures.push(`${sourcePath}: invalid link ${link.href}`);
      continue;
    }
    const saysEnglish = link.hreflang === 'en' || /\ben anglais\b/i.test(link.text);
    if (target.origin !== siteOrigin) {
      // An outside site states its language; most are in English.
      // A link marked data-language-unknown (the video channel) names no language.
      if (!link.hreflang && !saysEnglish && !link.languageUnknown) failures.push(`${sourcePath}: external link must state its language (hreflang or "(en anglais)"): ${link.href}`);
      continue;
    }
    if (missingFrenchPaths.has(target.pathname)) {
      unwrittenTargets.add(target.pathname);
      continue;
    }
    const targetFile = builtFileForPath(target.pathname);
    if (!existsSync(targetFile)) {
      failures.push(`${sourcePath}: missing internal target ${target.pathname} from ${link.href}`);
      continue;
    }
    if (target.hash) {
      let fragment;
      try {
        fragment = decodeURIComponent(target.hash.slice(1));
      } catch {
        failures.push(`${sourcePath}: invalid fragment encoding in ${link.href}`);
        continue;
      }
      if (targetFile.endsWith('.html') && !idsForFile(targetFile).has(fragment)) {
        failures.push(`${sourcePath}: missing fragment #${fragment} on ${target.pathname}`);
      }
    }
    // Files such as pictures and captions have no language.
    const isPage = target.pathname.endsWith('/') || target.pathname.endsWith('.html');
    if (!isPage || target.pathname.startsWith('/fr/')) continue;
    if (translatedEnglishPaths.has(target.pathname)) {
      if (!saysEnglish) failures.push(`${sourcePath}: link must go to the French page ${frenchPath(target.pathname)}, not ${link.href}`);
    } else if (!saysEnglish) {
      failures.push(`${sourcePath}: link to the English-only page ${target.pathname} must say so (hreflang="en" or "(en anglais)")`);
    }
  }
  if (unwrittenTargets.size > 0) {
    failures.push(`${sourcePath}: links to ${unwrittenTargets.size} French page(s) not written yet: ${[...unwrittenTargets].sort().join(', ')}`);
  }
};

try {
  const staticContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false });
  const staticPage = await staticContext.newPage();
  for (const englishPath of writtenPairs) {
    const localized = frenchPath(englishPath);
    await goto(staticPage, englishPath);
    await inspectPageContract(staticPage, englishPath, 'en', localized);
    await goto(staticPage, localized);
    await inspectPageContract(staticPage, localized, 'fr', englishPath);
    await inspectFrenchPage(staticPage, localized);
  }

  // An English page with no French version leads to the French home page.
  await goto(staticPage, '/privacy/');
  const fallbackSwitch = await staticPage.locator('.language-switch').getAttribute('href');
  if (fallbackSwitch !== '/fr/') failures.push(`/privacy/: language switch must lead to /fr/, found ${fallbackSwitch}`);

  // The visible FAQ in each language is the Q/A set given to search engines.
  for (const faqPath of ['/faq/', '/fr/faq/']) {
    if (missingFrenchPaths.has(faqPath)) continue;
    await goto(staticPage, faqPath);
    const faq = await staticPage.evaluate(() => {
      const normalizeText = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
      const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map((script) => JSON.parse(script.textContent ?? 'null'))
        .find((entry) => entry?.['@type'] === 'FAQPage');
      return {
        rendered: [...document.querySelectorAll('.faq-item')].map((item) => ({
          question: normalizeText(item.querySelector('summary')?.textContent),
          answer: normalizeText(item.querySelector('.faq-answer > p')?.textContent),
        })),
        structured: (schema?.mainEntity ?? []).map((item) => ({
          question: normalizeText(item.name),
          answer: normalizeText(item.acceptedAnswer?.text),
        })),
      };
    });
    if (faq.rendered.length === 0) failures.push(`${faqPath}: expected rendered FAQ questions`);
    if (JSON.stringify(faq.rendered) !== JSON.stringify(faq.structured)) {
      failures.push(`${faqPath}: rendered questions and answers must exactly match FAQPage JSON-LD`);
    }
  }

  // The switch works without scripts, both ways.
  await goto(staticPage, '/');
  await staticPage.locator('.language-switch').click();
  await staticPage.waitForURL(`${localOrigin}/fr/`);
  if (await staticPage.locator('html').getAttribute('lang') !== 'fr') failures.push('home language switch did not reach the French page');
  await staticPage.locator('.language-switch').click();
  await staticPage.waitForURL(`${localOrigin}/`);
  if (await staticPage.locator('html').getAttribute('lang') !== 'en') failures.push('French home language switch did not return to the English page');
  await staticContext.close();

  // On a phone the switch is reachable and a menu closes on Escape.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const mobilePage = await mobileContext.newPage();
  await goto(mobilePage, '/fr/');
  const mobileMenu = mobilePage.locator('.nav-group').first();
  await mobileMenu.locator('summary').click();
  if (!await mobileMenu.evaluate((menu) => menu.open)) failures.push('390px French navigation menu did not open');
  await mobilePage.keyboard.press('Escape');
  if (await mobileMenu.evaluate((menu) => menu.open)) failures.push('390px French navigation menu did not close on Escape');
  const switchBox = await mobilePage.locator('.language-switch').boundingBox();
  if (!switchBox || switchBox.height < 24 || switchBox.x + switchBox.width > 391) {
    failures.push('390px French language switch is not a visible target inside the viewport');
  }
  await mobileContext.close();

  // Written French pages fit on a phone and a desktop screen.
  for (const viewport of [{ width: 390, height: 900 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of writtenPairs.map(frenchPath)) {
      await goto(page, route);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        elements: [...document.querySelectorAll('h1, h2, h3, p, li, a')]
          .filter((element) => !element.closest('details:not([open])'))
          .filter((element) => {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility !== 'visible') return false;
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && (bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1);
          })
          .slice(0, 5)
          .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70)),
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        failures.push(`${route} at ${viewport.width}px: horizontal scroll ${overflow.scrollWidth} > ${overflow.clientWidth}`);
      }
      if (overflow.elements.length > 0) {
        failures.push(`${route} at ${viewport.width}px: content extends outside viewport: ${overflow.elements.join(' | ')}`);
      }
    }
    await context.close();
  }
} catch (error) {
  failures.push(`French check stopped unexpectedly: ${error.stack ?? error}`);
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

if (failures.length > 0) {
  console.error(`French check failed (${writtenPairs.length} of ${frenchPagePaths.length} French pages written):`);
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`French check passed (${frenchPagePaths.length} reciprocal page pairs)`);
