import { marketplaceMigrationEnabled } from '../src/lib/marketplace-routes.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

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

const browser = await chromium.launch();
const migrationEnabled = marketplaceMigrationEnabled(process.env.PUBLIC_MARKETPLACE_MIGRATION_ENABLED, process.env.MARKETPLACE_INDEXING_DECISION);
const failures = [];

const paths = [
  '/',
  '/products/base-registry/',
  '/products/evidence-gateway/',
  '/products/casework/',
  '/solutions/',
  '/products/studio/',
  '/ai/',
  '/ai/service-design/',
  '/ai/citizen-access/',
  '/customization/',
  '/architecture/headless/',
  '/digital-public-infrastructure/',
  '/data-spaces/',
  '/solutions/local-government/',
  '/solutions/licensing/',
  '/solutions/business-and-tax/',
  '/solutions/people-and-social-programmes/',
  '/solutions/land-property-and-assets/',
  '/solutions/agriculture-food-and-environment/',
  '/solutions/health-and-safety/',
  '/solutions/reference-registers/',
  '/solutions/check-a-fact/',
  '/solutions/review-changes/',
  '/solutions/verifiable-credentials/',
  '/starters/',
  ...JSON.parse(readFileSync(resolve('src/data/starters.json'), 'utf8')).starters.map(({ id }) => `/starters/${id}/`),
  '/blog/',
  '/blog/before-you-connect-a-registry-define-the-question/',
  '/blog/choose-a-registry-interface/',
  '/blog/reconstruct-registry-access/',
  '/security/',
  '/pricing/',
  '/contact/',
  '/contact/?type=proposal',
  '/contact/?type=privacy&context=delete+tracked+information',
  '/faq/',
  '/privacy/',
  '/terms/',
  '/imprint/',
  '/404.html',
].filter((path) => !migrationEnabled || !path.startsWith('/starters/'));
for (const path of paths) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const response = await page.goto(`http://127.0.0.1:${port}${path}`);
  if (response?.status() !== 200) failures.push(`- ${path} did not serve its built page`);
  if (await page.locator('main').count() !== 1 || await page.locator('main h1').count() !== 1) failures.push(`- ${path} must have one main landmark and primary heading`);
  if (await page.locator('.site-header').count() && await page.locator('main#main-content[tabindex="-1"]').count() !== 1) failures.push(`- ${path} missing keyboard skip destination`);

  const results = await new AxeBuilder({ page }).analyze();
  const missingLabels = await page.locator('[aria-labelledby]').evaluateAll((elements) =>
    elements.flatMap((element) => element.getAttribute('aria-labelledby').split(/\s+/)
      .filter((id) => !document.getElementById(id))));
  for (const id of missingLabels) failures.push(`- ${path} missing accessible label target: ${id}`);
  for (const violation of results.violations) {
    failures.push(`- ${path} ${violation.id} (${violation.impact}): ${violation.help}`);
  }
  // Every generated description is exercised at mobile width too; screenshots
  // use representative templates, not 84 near-identical full-page images.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) failures.push(`- ${path} horizontal overflow at 390px`);
  await context.close();
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`axe check passed (0 violations on ${paths.length} pages)`);
