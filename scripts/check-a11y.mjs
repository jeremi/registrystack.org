import { existsSync } from 'node:fs';
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
const failures = [];

const paths = [
  '/',
  '/notary/',
  '/relay/',
  '/manifest/',
  '/pricing/',
  '/problem/',
  '/solutions/evidence-gateway/',
  '/solutions/protected-registry-apis/',
];
for (const path of paths) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}${path}`);

  const results = await new AxeBuilder({ page }).analyze();
  for (const violation of results.violations) {
    failures.push(`- ${path} ${violation.id} (${violation.impact}): ${violation.help}`);
  }
  await context.close();
}

await browser.close();
server.close();

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`axe check passed (0 violations on ${paths.length} pages)`);
