// Run with: node --test tests/contact-routes-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const pagesDir = new URL('src/pages/', root);

const pageFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir.pathname, entry.name);
    if (entry.isDirectory()) return pageFiles(new URL(`file://${path}/`));
    return entry.isFile() && entry.name.endsWith('.astro') ? [path] : [];
  }));
  return nested.flat();
};

test('website enquiry prompts use contextual contact routes', async () => {
  const files = await pageFiles(pagesDir);
  const sources = new Map(await Promise.all(files.map(async (file) => [
    relative(root.pathname, file),
    await readFile(file, 'utf8'),
  ])));

  for (const [file, source] of sources) {
    if (file === 'src/pages/contact.astro' || file === 'src/pages/imprint.astro') continue;
    assert.doesNotMatch(source, /mailto:contact@registrystack\.org|\bcontactEmail\b/, `${file} bypasses the contact form`);
  }

  assert.match(sources.get('src/pages/index.astro'), /describeServiceHref\(\)/);
  assert.match(sources.get('src/pages/pricing.astro'), /askQuestionHref\(\)/);
  assert.match(sources.get('src/pages/pricing.astro'), /proposalHref\(\)/);
  assert.match(sources.get('src/pages/faq.astro'), /askQuestionHref\(\)/);
  assert.match(sources.get('src/pages/privacy.astro'), /contactHref\('privacy'/);
  assert.match(sources.get('src/pages/terms.astro'), /contactHref\('terms'/);

  const solutionPages = [...sources].filter(([file]) => file.startsWith('src/pages/solutions/'));
  for (const [file, source] of solutionPages) {
    assert.match(source, /describeServiceHref\(/, `${file} lacks a contextual service form route`);
  }
});

test('shared navigation and product calls to action use forms while legal and security routes stay distinct', async () => {
  const [header, footer, product, imprint, security] = await Promise.all([
    readFile(new URL('src/components/SiteHeader.astro', root), 'utf8'),
    readFile(new URL('src/components/SiteFooter.astro', root), 'utf8'),
    readFile(new URL('src/layouts/Product.astro', root), 'utf8'),
    readFile(new URL('src/pages/imprint.astro', root), 'utf8'),
    readFile(new URL('src/pages/security.astro', root), 'utf8'),
  ]);

  assert.match(header, /href=\{contactHref\(\)\}/);
  assert.match(header, /aria-current=\{current === 'contact' \? 'page' : undefined\}/);
  assert.match(footer, /askQuestionHref\(\)/);
  assert.doesNotMatch(footer, /mailto:|contactEmail/);
  assert.match(product, /describeServiceHref\(product\.name\)/);
  assert.doesNotMatch(product, /contactEmail|email/i);
  assert.match(imprint, /mailto:contact@registrystack\.org/);
  assert.match(security, /github\.com\/registrystack\/registry-stack\/security\/advisories\/new/);
  assert.doesNotMatch(security, /mailto:contact@registrystack\.org|\bcontactEmail\b/);
});
