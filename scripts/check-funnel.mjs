import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

for (const relative of ['dist/index.html', 'dist/use-cases/index.html']) {
  if (!existsSync(resolve(relative))) {
    console.error(`${relative} does not exist. Run npm run build first.`);
    process.exit(1);
  }
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
    response.writeHead(200, { 'content-type': type });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
// The funnel lives on the use-cases page; the homepage keeps the four-card
// grid and must NOT carry a second mechanism diagram.
const homeUrl = `http://127.0.0.1:${port}/`;
const url = `http://127.0.0.1:${port}/use-cases/`;

// Evidence-type spectrum the use-case grid must demonstrate (sorted).
const EXPECTED_TYPES = ['Bounded value set', 'Credential', 'Decision', 'Status'];

const claimOpacity = async (page) => {
  const claim = page.locator('.funnel-claim').first();
  if ((await claim.count()) === 0) return null;
  return claim.evaluate((el) => Number(getComputedStyle(el).opacity));
};

const browser = await chromium.launch();
const failures = [];

// 1. Structure: one funnel figure, one source record feeding several distinct
//    claims, a meaningful caption, and the four evidence types in the grid.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  await page.goto(url);

  const funnelCount = await page.locator('figure.funnel').count();
  if (funnelCount !== 1) failures.push(`expected exactly 1 funnel figure, found ${funnelCount}`);

  const sourceCount = await page.locator('.funnel-source').count();
  if (sourceCount !== 1) failures.push(`expected exactly 1 source record (same registry), found ${sourceCount}`);

  const claimCount = await page.locator('.funnel-claim').count();
  if (claimCount < 3) failures.push(`expected at least 3 distinct claims from one record, found ${claimCount}`);

  const claimsText = (await page.locator('.funnel-claims').first().innerText().catch(() => '')).toLowerCase();
  for (const needle of ['alive', 'over 18', 'district', 'not permitted']) {
    if (!claimsText.includes(needle)) failures.push(`claims missing distinct answer: "${needle}"`);
  }

  // A denied request shows the gate enforces purpose, not just trims data.
  const deniedCount = await page.locator('.funnel-claim-denied').count();
  if (deniedCount < 1) failures.push(`expected at least 1 denied request, found ${deniedCount}`);

  // Each granted claim is linked to the source field it derives from.
  const linked = await page.evaluate(() => {
    const claims = [...document.querySelectorAll('.funnel-claim[data-source]')];
    const fieldIds = new Set([...document.querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field')));
    const unmatched = claims
      .map((claim) => claim.getAttribute('data-source'))
      .filter((source) => !fieldIds.has(source));
    return { claimCount: claims.length, unmatched };
  });
  if (linked.claimCount < 3) failures.push(`expected >= 3 claims linked to a source field, found ${linked.claimCount}`);
  if (linked.unmatched.length > 0) {
    failures.push(`claim data-source(s) with no matching source field: ${JSON.stringify(linked.unmatched)}`);
  }

  const replayVisible = await page
    .locator('.funnel-replay')
    .first()
    .isVisible()
    .catch(() => false);
  if (!replayVisible) failures.push('replay control is not visible when JavaScript is enabled');

  // The "stays with the owner" footer must list real field labels, not
  // stringified objects.
  const staysText = (await page.locator('.funnel-stays').first().innerText().catch(() => '')).toLowerCase();
  if (staysText.includes('[object')) failures.push('stays footer renders "[object Object]" instead of field labels');
  if (!staysText.includes('date of birth')) failures.push('stays footer missing a known field label (date of birth)');

  const caption = (await page.locator('figure.funnel figcaption').first().textContent().catch(() => '')) ?? '';
  for (const needle of ['evidence a service needs', 'stays with']) {
    if (!caption.toLowerCase().includes(needle)) {
      failures.push(`funnel caption missing phrase: "${needle}"`);
    }
  }

  await context.close();
}

// 1b. Homepage: the four-card use-case grid demonstrates the evidence-type
//     spectrum, and the mechanism is drawn exactly once (the harness diagram),
//     so no funnel figure appears there.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  await page.goto(homeUrl);

  const homeFunnelCount = await page.locator('figure.funnel').count();
  if (homeFunnelCount !== 0) {
    failures.push(`expected no funnel figure on the homepage (it lives on /use-cases/), found ${homeFunnelCount}`);
  }

  const badges = (await page.locator('.use-case .evidence-type').allTextContents())
    .map((text) => text.trim())
    .sort();
  if (JSON.stringify(badges) !== JSON.stringify(EXPECTED_TYPES)) {
    failures.push(`evidence-type badges ${JSON.stringify(badges)} != ${JSON.stringify(EXPECTED_TYPES)}`);
  }

  const farmer = (await page.locator('.use-case', { hasText: 'Farmer registry' }).first().innerText().catch(() => '')).toLowerCase();
  for (const needle of ['2.5 ha', 'farmer']) {
    if (!farmer.includes(needle)) failures.push(`farmer card missing returned value: "${needle}"`);
  }
  for (const needle of ['plot', 'household', 'crop', 'financial']) {
    if (!farmer.includes(needle)) failures.push(`farmer card not-shared list missing: "${needle}"`);
  }

  await context.close();
}

// 2. Reduced motion: the funnel shows its final state immediately, with no
//    scroll trigger and no motion. The claims must be visible.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(url);
  const opacity = await claimOpacity(page);
  if (!(opacity > 0.99)) {
    failures.push(`reduced-motion: claim opacity ${opacity}, expected ~1 (final state shown without animation)`);
  }
  await context.close();
}

// 3. No JavaScript: progressive enhancement means the funnel is fully visible
//    even when the IntersectionObserver never runs.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(url);
  const opacity = await claimOpacity(page);
  if (!(opacity > 0.99)) {
    failures.push(`no-js: claim opacity ${opacity}, expected ~1 (funnel visible without JS)`);
  }
  await context.close();
}

// 4. Play on scroll, replayable: with motion allowed the funnel starts hidden,
//    reveals when scrolled into view, then resets when scrolled back out.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(() => window.scrollTo(0, 0));

  const before = await page.evaluate(() => {
    const figure = document.querySelector('figure.funnel');
    const claim = document.querySelector('.funnel-claim');
    return {
      inView: figure ? figure.classList.contains('in-view') : null,
      opacity: claim ? Number(getComputedStyle(claim).opacity) : null,
    };
  });
  if (before.inView !== false) failures.push(`expected funnel not in-view before scroll, got ${before.inView}`);
  if (!(before.opacity < 0.05)) {
    failures.push(`expected first claim hidden (~0) before scroll, got ${before.opacity}`);
  }

  await page.locator('figure.funnel').scrollIntoViewIfNeeded();
  await page
    .waitForFunction(() => document.querySelector('figure.funnel')?.classList.contains('in-view'), null, { timeout: 3000 })
    .catch(() => failures.push('funnel did not gain in-view class after scroll'));
  await page
    .waitForFunction(
      () => {
        const claim = document.querySelector('.funnel-claim');
        return claim && Number(getComputedStyle(claim).opacity) > 0.99;
      },
      null,
      { timeout: 4000 }
    )
    .catch(() => failures.push('claims did not animate to visible after scroll into view'));

  // Scrolling fully away resets the figure so it can replay on return.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .waitForFunction(() => document.querySelector('figure.funnel')?.classList.contains('in-view') === false, null, { timeout: 3000 })
    .catch(() => failures.push('funnel did not reset (drop in-view) after scrolling away'));

  await context.close();
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('funnel check passed');
