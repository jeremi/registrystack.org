#!/usr/bin/env node
// Every browser request is fulfilled locally or aborted. Use the actual built
// marketplace HTML when supplied; otherwise fetch only known destination HTML
// read-only in Node. Never submit a form or run a production network journey.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { registerFamilies, startersData } from './marketplace-inputs.mjs';
import { MARKETPLACE_ORIGIN, marketplaceCollectionHref, marketplacePackHref } from '../src/lib/marketplace-routes.mjs';

const dist = process.argv[2];
if (!dist) throw new Error('Usage: node scripts/check-marketplace-journey.mjs DIST');
const marketplaceDist = process.env.MARKETPLACE_TRACKING_DIST || process.argv[3];
const websiteOrigin = 'https://registrystack.org';
const allowedDestinations = new Set([`${MARKETPLACE_ORIGIN}/`, ...registerFamilies.map((area) => marketplaceCollectionHref(area.key)), ...startersData.starters.map((starter) => marketplacePackHref(starter.id))]);
const destinationHtml = new Map();
const marketplaceHtml = async (url) => {
  const href = `${url.origin}${url.pathname}`;
  if (!allowedDestinations.has(href)) throw new Error(`Unexpected marketplace document: ${href}`);
  if (!destinationHtml.has(href)) {
    if (marketplaceDist) {
      destinationHtml.set(href, await readFile(path.join(marketplaceDist, `${url.pathname.slice(1)}index.html`)));
    } else {
      const response = await fetch(href, { signal: AbortSignal.timeout(15000) });
      if (response.status !== 200 || response.url !== href) throw new Error(`Cannot read exact marketplace document ${href}: ${response.status} ${response.url}`);
      destinationHtml.set(href, await response.text());
    }
  }
  return destinationHtml.get(href);
};
const browser = await chromium.launch({ headless: true });
const serve = async (context) => context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (route.request().method() !== 'GET') return route.abort();
  if (url.origin === MARKETPLACE_ORIGIN) {
    if (!route.request().isNavigationRequest()) return route.abort();
    return route.fulfill({ contentType: 'text/html', body: await marketplaceHtml(url) });
  }
  if (url.origin !== websiteOrigin) return route.abort();
  const relative = url.pathname.endsWith('/') ? `${url.pathname.slice(1)}index.html` : url.pathname.slice(1);
  try {
    return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/html', body: await readFile(path.join(dist, relative)) });
  } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
});

try {
  const context = await browser.newContext();
  await serve(context);
  const page = await context.newPage();
  for (const area of registerFamilies) {
    await page.goto(`${websiteOrigin}/starters/#${area.key}`);
    await page.waitForURL(marketplaceCollectionHref(area.key));
  }
  for (const hash of ['', '#unknown', '#__proto__']) {
    await page.goto(`${websiteOrigin}/starters/${hash}`);
    await page.waitForURL(`${MARKETPLACE_ORIGIN}/`);
  }
  for (const starter of startersData.starters) {
    await page.goto(`${websiteOrigin}/starters/${starter.id}/`);
    await page.waitForURL(marketplacePackHref(starter.id));
  }
  for (const starter of startersData.starters) {
    for (const id of ['starter-title', 'records-title', 'actions-title', 'access-title', 'whats-inside']) {
      await page.goto(`${websiteOrigin}/starters/${starter.id}/#${id}`);
      await page.waitForURL(`${marketplacePackHref(starter.id)}#${id}`);
      assert.equal(await page.locator(`[id="${id}"]`).count(), 1, `${starter.id}: actual marketplace fragment ${id}`);
    }
  }
  await context.close();
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  await serve(noScript);
  const fallback = await noScript.newPage();
  await fallback.goto(`${websiteOrigin}/starters/#licensing`);
  await fallback.waitForURL(`${MARKETPLACE_ORIGIN}/`);
  await fallback.goto(`${websiteOrigin}/starters/professional-licensing/`);
  await fallback.waitForURL(marketplacePackHref('professional-licensing'));
  await noScript.close();
  console.log(`Verified cutover browser journeys: seven family bookmarks, unknown hashes, all84 exact packs, all420 section-fragment targets and no-JavaScript fallback; all browser requests intercepted; marketplace HTML from ${marketplaceDist ? 'actual local build' : 'read-only live HTML fetch'}.`);
} finally { await browser.close(); }
