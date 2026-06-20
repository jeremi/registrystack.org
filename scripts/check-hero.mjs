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
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();
const failures = [];

const activeIndex = (page) =>
  page.evaluate(() => {
    const slides = [...document.querySelectorAll('[data-answer-slide]')];
    return slides.findIndex((slide) => slide.classList.contains('is-active'));
  });

const firstSlideOpacity = (page) =>
  page
    .locator('[data-answer-slide]')
    .first()
    .evaluate((el) => Number(getComputedStyle(el).opacity))
    .catch(() => null);

// 1. Structure and content reuse: one hero card looping several concrete answer
//    slides, matching the examples expanded on the use-cases page.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(url);

  const cardCount = await page.locator('[data-answer-card]').count();
  if (cardCount !== 1) failures.push(`expected exactly 1 hero answer card, found ${cardCount}`);

  const slideCount = await page.locator('[data-answer-slide]').count();
  if (slideCount < 3) failures.push(`expected at least 3 looping answer slides, found ${slideCount}`);

  const activeCount = await page.locator('[data-answer-slide].is-active').count();
  if (activeCount !== 1) failures.push(`expected exactly 1 active slide at load, found ${activeCount}`);

  const stageText = (await page.locator('[data-answer-card]').first().innerText().catch(() => '')).toLowerCase();
  for (const needle of ['alive', 'enrolled', 'active', '2.5 ha']) {
    if (!stageText.includes(needle)) {
      failures.push(`hero card missing reused use-case answer: "${needle}"`);
    }
  }

  await context.close();
}

// 2. No JavaScript: the first answer is shown (progressive-enhancement baseline).
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(url);
  const opacity = await firstSlideOpacity(page);
  if (!(opacity > 0.99)) failures.push(`no-js: first slide opacity ${opacity}, expected ~1`);
  await context.close();
}

// 3. Reduced motion: the first answer is shown and the card does not rotate.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(url);
  const opacity = await firstSlideOpacity(page);
  if (!(opacity > 0.99)) failures.push(`reduced-motion: first slide opacity ${opacity}, expected ~1`);
  const before = await activeIndex(page);
  await page.waitForTimeout(4200);
  const after = await activeIndex(page);
  if (before !== 0 || after !== 0) {
    failures.push(`reduced-motion: slides must not rotate (active ${before} -> ${after}, expected 0 -> 0)`);
  }
  await context.close();
}

// 4. Motion allowed: the card rotates to the next answer on its own.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(url);
  const start = await activeIndex(page);
  await page
    .waitForFunction(
      (startIndex) => {
        const slides = [...document.querySelectorAll('[data-answer-slide]')];
        return slides.findIndex((slide) => slide.classList.contains('is-active')) !== startIndex;
      },
      start,
      { timeout: 8000 }
    )
    .catch(() => failures.push('motion: hero answer card did not rotate to the next slide'));
  await context.close();
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('hero answer card check passed');
