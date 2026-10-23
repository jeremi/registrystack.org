import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const htmlPath = resolve('dist/index.html');
const outputDir = resolve('test-results');

if (!existsSync(htmlPath)) {
  console.error('dist/index.html does not exist. Run npm run build first.');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

// The header has two menus: Solutions opens with "All solutions", followed
// by service areas and shared capabilities. Products lists every core product plus
// starters, developer tutorials and documentation.
const countMatches = (relativePath, pattern) => (readFileSync(resolve(relativePath), 'utf8').match(pattern) ?? []).length;
const expectedMenuLinks = [
  1 + countMatches('src/data/solutions.ts', /slug: '\/solutions\//g),
  3 + countMatches('src/data/products.ts', /href: '\/products\//g),
];

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

const viewports = [
  { name: 'mobile', width: 390, height: 1200 },
  { name: 'tablet', width: 768, height: 1200 },
  { name: 'desktop', width: 1440, height: 1200 },
];

const routes = [
  { name: 'home', path: '/' },
  { name: 'base-registry', path: '/products/base-registry/' },
  { name: 'evidence-gateway', path: '/products/evidence-gateway/' },
  { name: 'casework', path: '/products/casework/' },
  { name: 'solutions', path: '/solutions/' },
  { name: 'customization', path: '/customization/' },
  { name: 'digital-public-infrastructure', path: '/digital-public-infrastructure/' },
  { name: 'solutions-local-government', path: '/solutions/local-government/' },
  { name: 'solutions-licensing', path: '/solutions/licensing/' },
  { name: 'solutions-business-and-tax', path: '/solutions/business-and-tax/' },
  { name: 'solutions-people-and-social-programmes', path: '/solutions/people-and-social-programmes/' },
  { name: 'solutions-land-property-and-assets', path: '/solutions/land-property-and-assets/' },
  { name: 'solutions-agriculture-food-and-environment', path: '/solutions/agriculture-food-and-environment/' },
  { name: 'solutions-health-and-safety', path: '/solutions/health-and-safety/' },
  { name: 'solutions-reference-registers', path: '/solutions/reference-registers/' },
  { name: 'solutions-check-a-fact', path: '/solutions/check-a-fact/' },
  { name: 'solutions-review-changes', path: '/solutions/review-changes/' },
  { name: 'starters', path: '/starters/' },
  { name: 'starter-professional-licensing', path: '/starters/professional-licensing/' },
  { name: 'starter-health-facilities', path: '/starters/health-facilities/' },
  { name: 'starter-public-funding-state-aid', path: '/starters/public-funding-state-aid/' },
  { name: 'blog', path: '/blog/' },
  { name: 'security', path: '/security/' },
  { name: 'pricing', path: '/pricing/' },
  { name: 'faq', path: '/faq/' },
];

const failures = [];
const browser = await chromium.launch();

for (const route of routes) {
for (const viewport of viewports) {
  const label = `${route.name} ${viewport.name}`;
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${port}${route.path}`);
  await page.screenshot({ path: resolve(outputDir, `${route.name}-${viewport.name}.png`), fullPage: true });
  if (route.name === 'solutions') {
    await page.locator('#services').screenshot({ path: resolve(outputDir, `solutions-services-${viewport.name}.png`) });
  }

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // Links inside the closed Solutions and Products disclosures are
    // intentionally hidden, not clipped.
    clippedButtons: [...document.querySelectorAll('a, button')].filter((element) => {
      if (element.closest('details:not([open])')) return false;
      const rect = element.getBoundingClientRect();
      return rect.width <= 0 || rect.height <= 0;
    }).length,
    undersizedNavTargets: [...document.querySelectorAll('.top-nav a, .site-footer nav a')].filter((element) => {
      if (element.closest('details:not([open])')) return false;
      const rect = element.getBoundingClientRect();
      return rect.width < 36 || rect.height < 36;
    }).length,
    overlappingText: [...document.querySelectorAll('h1, h2, h3, p, li, a')].some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
    }),
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    failures.push(`${label}: horizontal scroll ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  }
  if (metrics.clippedButtons > 0) {
    failures.push(`${label}: ${metrics.clippedButtons} clipped interactive element(s)`);
  }
  if (metrics.undersizedNavTargets > 0) {
    failures.push(`${label}: ${metrics.undersizedNavTargets} nav/footer link target(s) below 36px`);
  }
  if (metrics.overlappingText) {
    failures.push(`${label}: text extends outside viewport`);
  }

  // Homepage link titles, descriptions and audiences must remain separate
  // blocks, even when the page still fits inside the viewport without CSS.
  if (route.path === '/') {
    const layouts = await page.evaluate(() => {
      const bounds = (element) => {
        const { top, right, bottom, left } = element.getBoundingClientRect();
        return { top, right, bottom, left };
      };
      return {
        registers: [...document.querySelectorAll('.register-grid')].map((list) => ({
          items: [...list.children].map((item) => ({
            ...bounds(item),
            marker: getComputedStyle(item).listStyleType,
            parts: [...item.querySelectorAll('a > span')].map(bounds),
          })),
        })),
        developers: [...document.querySelectorAll('.developer-grid > article')].map(bounds),
      };
    });

    const checkArrangement = (name, items, count, stacked) => {
      if (items.length !== count) {
        failures.push(`${label}: expected ${count} ${name} items, found ${items.length}`);
        return;
      }
      const arranged = items.every((item, index) => {
        if (index === 0) return true;
        const previous = items[index - 1];
        return stacked
          ? item.top >= previous.bottom - 1 && Math.abs(item.left - previous.left) <= 1
          : Math.abs(item.top - previous.top) <= 1 && item.left >= previous.right + 16;
      });
      if (!arranged) {
        failures.push(`${label}: ${name} items must form ${stacked ? 'a vertical stack' : 'a spaced row'}`);
      }
    };

    if (layouts.registers.length !== 2) {
      failures.push(`${label}: expected both homepage solution and capability link groups`);
    } else {
      checkArrangement('solution', layouts.registers[0].items, 3, viewport.name !== 'desktop');
      checkArrangement('capability', layouts.registers[1].items, 2, viewport.name === 'mobile');
      for (const [index, group] of layouts.registers.entries()) {
        for (const [itemIndex, item] of group.items.entries()) {
          const name = `homepage link group ${index + 1}, item ${itemIndex + 1}`;
          if (item.marker !== 'none') failures.push(`${label}: ${name} has a default list marker`);
          if (item.parts.length < 2 || item.parts.some((part, partIndex) =>
            partIndex > 0 && part.top < item.parts[partIndex - 1].bottom + 3)) {
            failures.push(`${label}: ${name} title and supporting text run together`);
          }
        }
      }
    }
    checkArrangement('developer tutorial', layouts.developers, 2, viewport.name === 'mobile');

    for (const section of ['registers', 'shared-work', 'developers']) {
      await page.locator(`#${section}`).screenshot({
        path: resolve(outputDir, `home-${section}-${viewport.name}.png`),
      });
    }
    await page.locator('.site-footer').screenshot({
      path: resolve(outputDir, `home-footer-${viewport.name}.png`),
    });
  }

  // The Solutions and Products disclosures must present every listed route at
  // tappable size once opened, on every checked route and viewport.
  {
    const menus = await page.evaluate(() =>
      [...document.querySelectorAll('.nav-group')].map((details) => {
        details.setAttribute('open', '');
        const links = [...details.querySelectorAll('a')].map((link) => {
          const rect = link.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        details.removeAttribute('open');
        return { links };
      }),
    );
    if (menus.length !== expectedMenuLinks.length ||
        menus.some((menu, index) => menu.links.length !== expectedMenuLinks[index])) {
      failures.push(`${label}: nav disclosure link counts do not match expected menus`);
    } else if (menus.flatMap((menu) => menu.links).some((rect) => rect.width < 36 || rect.height < 36)) {
      failures.push(`${label}: open nav menu links are below 36px`);
    }
  }

  if (route.path === '/') {
    const solutionsMenu = page.locator('.nav-group').first();
    await solutionsMenu.locator('summary').click();
    await page.screenshot({ path: resolve(outputDir, `home-solutions-menu-${viewport.name}.png`) });
    await solutionsMenu.locator('summary').click();
  }

  // On desktop the three homepage product cards should read as a balanced row.
  if (route.path === '/' && viewport.name === 'desktop') {
    const align = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.home-solution-card')];
      const cardHeights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
      return { count: cards.length, cardHeights };
    });

    if (align.count !== 3) {
      failures.push(`desktop: expected 3 homepage product cards, found ${align.count}`);
    } else {
      const heightSpread = Math.max(...align.cardHeights) - Math.min(...align.cardHeights);
      if (heightSpread > 2) {
        failures.push(`desktop: homepage product cards have unequal heights (spread ${heightSpread}px)`);
      }
    }
  }

  await page.close();
}
}

// A desktop menu must fit inside a short viewport. Keyboard focus should enter
// at the first link and reach the last link, scrolling the panel when needed.
const shortDesktop = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const [index, name] of ['Solutions', 'Products'].entries()) {
  await shortDesktop.goto(`http://127.0.0.1:${port}/`);
  const menu = shortDesktop.locator('.nav-group').nth(index);
  const summary = menu.locator('summary');
  const panel = menu.locator('.nav-group-panel');
  const links = panel.locator('a');
  await summary.focus();
  await shortDesktop.keyboard.press('Enter');

  const panelBounds = await panel.boundingBox();
  if (!panelBounds || panelBounds.y + panelBounds.height > 721) {
    failures.push(`1280x720: ${name} menu extends below the viewport`);
  }

  await shortDesktop.keyboard.press('Tab');
  const firstReachable = await links.first().evaluate((link) => {
    const rect = link.getBoundingClientRect();
    return document.activeElement === link && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  if (!firstReachable) failures.push(`1280x720: keyboard cannot reach the first ${name} menu link`);

  const linkCount = await links.count();
  for (let position = 1; position < linkCount; position += 1) {
    await shortDesktop.keyboard.press('Tab');
  }
  const lastReachable = await links.last().evaluate((link) => {
    const rect = link.getBoundingClientRect();
    return document.activeElement === link && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  if (!lastReachable) failures.push(`1280x720: keyboard cannot reach the last ${name} menu link`);
}
await shortDesktop.close();

const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/`);
const focusableCount = await page.locator('a[href], button').count();
for (let i = 0; i < Math.min(focusableCount, 20); i += 1) {
  await page.keyboard.press('Tab');
  const visibleFocus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return false;
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    return rect.width > 0 && rect.height > 0 && style.outlineStyle !== 'none';
  });
  if (!visibleFocus) {
    failures.push(`keyboard focus is not visibly outlined at tab stop ${i + 1}`);
    break;
  }
}
// Closing a disclosure from one of its links must leave a usable keyboard
// position instead of dropping focus back to the page body. Both header menus
// (Solutions, Products) behave the same way.
for (const [index, name] of ['Solutions', 'Products'].entries()) {
  await page.goto(`http://127.0.0.1:${port}/`);
  const menu = page.locator('.nav-group').nth(index);
  await menu.locator('summary').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const enteredMenu = await menu.locator('a').first().evaluate((link) => link === document.activeElement);
  await page.keyboard.press('Escape');
  const restoredMenuFocus = await menu.evaluate((group) =>
    !group.open && document.activeElement === group.querySelector('summary'));
  if (!enteredMenu || !restoredMenuFocus) {
    failures.push(`Escape from a ${name} menu link must close the menu and return focus to its summary`);
  }
}
await page.close();
await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('visual and keyboard checks passed');
