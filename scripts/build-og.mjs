// Generates the social-sharing card at public/og-image.png (1200x630).
// The brand fonts are embedded as base64 so the render is fully offline and
// reproducible. Re-run with `npm run build:og` whenever the headline, wordmark,
// or brand colours change; the produced PNG is committed to the repo.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const fontData = (path) => readFileSync(resolve(path)).toString('base64');

const sans800 = fontData('node_modules/@fontsource/public-sans/files/public-sans-latin-800-normal.woff2');
const sans400 = fontData('node_modules/@fontsource/public-sans/files/public-sans-latin-400-normal.woff2');
const mono500 = fontData('node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: 'Public Sans'; font-weight: 800; src: url(data:font/woff2;base64,${sans800}) format('woff2'); }
      @font-face { font-family: 'Public Sans'; font-weight: 400; src: url(data:font/woff2;base64,${sans400}) format('woff2'); }
      @font-face { font-family: 'IBM Plex Mono'; font-weight: 500; src: url(data:font/woff2;base64,${mono500}) format('woff2'); }
      :root {
        --blue: #173b7a;
        --stamp: #9d2c1d;
        --ink: #161616;
        --muted: #6a6a6a;
        --rule: #e5e5e5;
      }
      * { box-sizing: border-box; margin: 0; }
      html, body { height: 630px; width: 1200px; }
      body {
        background: #ffffff;
        border-top: 10px solid var(--blue);
        display: flex;
        flex-direction: column;
        font-family: 'Public Sans', sans-serif;
        justify-content: space-between;
        padding: 72px;
      }
      .brand { align-items: center; display: flex; gap: 18px; }
      .mark { height: 64px; width: 64px; }
      .wordmark { color: var(--ink); font-size: 34px; font-weight: 800; letter-spacing: -0.01em; }
      .kicker {
        color: var(--stamp);
        font-family: 'IBM Plex Mono', monospace;
        font-size: 18px;
        font-weight: 500;
        letter-spacing: 0.06em;
        margin-bottom: 22px;
        text-transform: uppercase;
      }
      h1 {
        color: var(--ink);
        font-size: 62px;
        font-weight: 800;
        letter-spacing: -0.015em;
        line-height: 1.06;
        max-width: 1000px;
      }
      .foot {
        align-items: center;
        border-top: 1px solid var(--rule);
        display: flex;
        justify-content: space-between;
        padding-top: 22px;
      }
      .url { color: var(--blue); font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 500; }
      .works { color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="brand">
      <svg class="mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect x="8" y="8" width="48" height="48" fill="#173b7a" />
        <path d="M20 25h18M20 32h26M20 39h14" stroke="#ffffff" stroke-width="5" stroke-linecap="square" />
      </svg>
      <span class="wordmark">Registry Stack</span>
    </div>
    <div>
      <p class="kicker">For country digital teams and partners</p>
      <h1>Prove facts from registries without sharing the records.</h1>
    </div>
    <div class="foot">
      <span class="url">registrystack.org</span>
      <span class="works">Works with CSV &middot; XLSX &middot; Parquet &middot; PostgreSQL &middot; DCAT-AP &middot; OGC APIs &middot; SP-DCI &middot; PublicSchema &middot; GovStack patterns</span>
    </div>
  </body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve('public/og-image.png') });
await browser.close();

console.log('og image written to public/og-image.png (1200x630)');
