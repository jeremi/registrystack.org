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
  const relative = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
  const filePath = join(resolve('dist'), relative);
  const type = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
  }[extname(filePath)] ?? 'application/octet-stream';
  try {
    response.writeHead(200, { 'content-type': type });
    response.end(await readFile(filePath));
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

const failures = [];
const browser = await chromium.launch();

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}.png`), fullPage: true });

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    clippedButtons: [...document.querySelectorAll('a, button')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width <= 0 || rect.height <= 0;
    }).length,
    undersizedNavTargets: [...document.querySelectorAll('.top-nav a, .site-footer nav a')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 36 || rect.height < 36;
    }).length,
    overlappingText: [...document.querySelectorAll('h1, h2, h3, p, li, a')].some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
    }),
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    failures.push(`${viewport.name}: horizontal scroll ${metrics.scrollWidth} > ${metrics.clientWidth}`);
  }
  if (metrics.clippedButtons > 0) {
    failures.push(`${viewport.name}: ${metrics.clippedButtons} clipped interactive element(s)`);
  }
  if (metrics.undersizedNavTargets > 0) {
    failures.push(`${viewport.name}: ${metrics.undersizedNavTargets} nav/footer link target(s) below 36px`);
  }
  if (metrics.overlappingText) {
    failures.push(`${viewport.name}: text extends outside viewport`);
  }

  await page.close();
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
