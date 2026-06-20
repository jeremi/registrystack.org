import { existsSync, mkdirSync } from 'node:fs';
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
  { name: 'notary', path: '/notary/' },
  { name: 'relay', path: '/relay/' },
  { name: 'manifest', path: '/manifest/' },
  { name: 'pricing', path: '/pricing/' },
  { name: 'problem', path: '/problem/' },
  { name: 'evidence-gateway', path: '/solutions/evidence-gateway/' },
  { name: 'protected-registry-apis', path: '/solutions/protected-registry-apis/' },
];

const failures = [];
const browser = await chromium.launch();

for (const route of routes) {
for (const viewport of viewports) {
  const label = `${route.name} ${viewport.name}`;
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${port}${route.path}`);
  await page.screenshot({ path: resolve(outputDir, `${route.name}-${viewport.name}.png`), fullPage: true });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // Links inside a closed <details> disclosure (the Products menu) are
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

  // Each nav disclosure must present its expected links at tappable size once
  // opened, on every checked route and viewport. Solutions intentionally has
  // two entries; Products has three; In practice gathers the supporting reading.
  {
    const menus = await page.evaluate(() =>
      [...document.querySelectorAll('.nav-group')].map((details) => {
        details.setAttribute('open', '');
        const label = details.querySelector('summary')?.textContent?.trim() ?? '';
        const links = [...details.querySelectorAll('a')].map((link) => {
          const rect = link.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        details.removeAttribute('open');
        return { label, links };
      }),
    );
    const expectedMenuSizes = new Map([
      ['Solutions', 2],
      ['Products', 3],
      ['In practice', 5],
    ]);
    const missing = [...expectedMenuSizes].filter(
      ([menuLabel, expected]) => !menus.some((menu) => menu.label === menuLabel && menu.links.length === expected),
    );
    if (missing.length > 0) {
      failures.push(`${label}: nav disclosure link counts do not match expected menus`);
    } else if (menus.flatMap((menu) => menu.links).some((rect) => rect.width < 36 || rect.height < 36)) {
      failures.push(`${label}: open nav menu links are below 36px`);
    }
  }

  // On desktop the homepage solution cards are the main routing decision and
  // should read as a balanced pair.
  if (route.path === '/' && viewport.name === 'desktop') {
    const align = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.home-solution-card')];
      const cardHeights = cards.map((card) => Math.round(card.getBoundingClientRect().height));
      return { count: cards.length, cardHeights };
    });

    if (align.count !== 2) {
      failures.push(`desktop: expected 2 homepage solution cards, found ${align.count}`);
    } else {
      const heightSpread = Math.max(...align.cardHeights) - Math.min(...align.cardHeights);
      if (heightSpread > 2) {
        failures.push(`desktop: homepage solution cards have unequal heights (spread ${heightSpread}px)`);
      }
    }
  }

  await page.close();
}
}

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
await page.close();
await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('visual and keyboard checks passed');
