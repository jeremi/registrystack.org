// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORGANIZATION_ID,
  SITE_LOGO_URL,
  articleLd,
  organizationLd,
  websiteLd,
} from '../src/lib/structured-data.ts';
import { authorFor } from '../src/data/authors.ts';

test('the organization logo is the square brand mark, not the social card', () => {
  const org = organizationLd();
  assert.equal(org['@type'], 'Organization');
  assert.equal(org['@id'], ORGANIZATION_ID);
  assert.equal(org.logo, SITE_LOGO_URL);
  assert.equal(SITE_LOGO_URL, 'https://registrystack.org/icon-512.png');
});

test('the website node names the site and points at the organization', () => {
  const site = websiteLd();
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.name, 'Registry Stack');
  assert.equal(site.url, 'https://registrystack.org/');
  assert.deepEqual(site.publisher, { '@id': ORGANIZATION_ID });
});

const article = {
  headline: 'A field guide',
  description: 'What it covers.',
  url: 'https://registrystack.org/blog/a-field-guide/',
  image: 'https://registrystack.org/blog-field-notes-og.png',
  publishedAt: '2026-07-30T00:00:00.000Z',
};

test('a named author is marked up as a person with a profile link', () => {
  const ld = articleLd({ ...article, author: 'Jeremi Joslin' });
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.author['@type'], 'Person');
  assert.equal(ld.author.name, 'Jeremi Joslin');
  assert.match(ld.author.url, /^https:\/\//);
  assert.equal(ld.publisher.logo.url, SITE_LOGO_URL);
});

test('an organization byline stays an organization', () => {
  const ld = articleLd({ ...article, author: 'Registry Stack' });
  assert.equal(ld.author['@type'], 'Organization');
  assert.equal(ld.author.name, 'Registry Stack');
});

test('the modified date appears only when the post records one', () => {
  assert.equal(articleLd({ ...article, author: 'Registry Stack' }).dateModified, undefined);
  const updated = articleLd({ ...article, author: 'Registry Stack', updatedAt: '2026-11-05T00:00:00.000Z' });
  assert.equal(updated.dateModified, '2026-11-05T00:00:00.000Z');
});

test('an unknown author name fails instead of silently becoming the organization', () => {
  assert.throws(() => authorFor('Jeremy Joslin'), /unknown blog author/);
});

test('every person author has a short visible bio', () => {
  const person = authorFor('Jeremi Joslin');
  assert.equal(person.kind, 'person');
  assert.ok(person.bio.length > 0 && person.bio.length < 320, 'bio stays two lines or so');
  assert.ok(!person.bio.includes('—'), 'bio has no em dash');
});
