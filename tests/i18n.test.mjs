// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  alternatePaths,
  frenchPagePaths,
  hasFrenchPage,
  localeForPath,
  localizedPath,
  translator,
  englishHreflang,
} from '../src/i18n.ts';

const expectedPaths = [
  '/',
  '/solutions/',
  '/solutions/agriculture-food-and-environment/',
  '/solutions/business-and-tax/',
  '/solutions/check-a-fact/',
  '/solutions/health-and-safety/',
  '/solutions/land-property-and-assets/',
  '/solutions/licensing/',
  '/solutions/local-government/',
  '/solutions/people-and-social-programmes/',
  '/solutions/reference-registers/',
  '/solutions/review-changes/',
  '/solutions/verifiable-credentials/',
  '/products/',
  '/products/base-registry/',
  '/products/evidence-gateway/',
  '/products/casework/',
  '/products/render/',
  '/products/messaging/',
  '/products/studio/',
  '/ai/',
  '/ai/service-design/',
  '/ai/citizen-access/',
  '/customization/',
  '/pricing/',
  '/faq/',
  '/security/',
  '/about/',
  '/contact/',
  '/digital-public-infrastructure/',
  '/data-spaces/',
  '/architecture/headless/',
];

test('the French page list is exactly the 32 agreed pages, each with an English source', () => {
  assert.deepEqual([...frenchPagePaths].sort(), [...expectedPaths].sort());
  assert.equal(new Set(frenchPagePaths).size, frenchPagePaths.length);
  for (const path of frenchPagePaths) {
    const file = path === '/' ? 'index' : path.slice(1, -1);
    const englishSource = [`src/pages/${file}.astro`, `src/pages/${file}/index.astro`]
      .some((candidate) => existsSync(new URL(`../${candidate}`, import.meta.url)));
    assert.ok(englishSource, `${path} has an English page`);
  }
});

test('locale detection respects the French path boundary', () => {
  assert.equal(localeForPath('/fr/faq/'), 'fr');
  assert.equal(localeForPath('/fr/'), 'fr');
  assert.equal(localeForPath('/fr'), 'fr');
  assert.equal(localeForPath('/france/'), 'en');
  assert.equal(localeForPath('/frameworks/'), 'en');
  assert.equal(localeForPath('/'), 'en');
});

test('every listed page maps both ways', () => {
  for (const path of expectedPaths) {
    const french = path === '/' ? '/fr/' : `/fr${path}`;
    assert.equal(localizedPath(path, 'fr'), french);
    assert.equal(localizedPath(french, 'en'), path);
    assert.equal(localizedPath(french, 'fr'), french);
    assert.equal(localizedPath(path, 'en'), path);
    assert.equal(hasFrenchPage(path), true);
    assert.equal(hasFrenchPage(french), true);
    assert.deepEqual(alternatePaths(path), { en: path, fr: french });
    assert.deepEqual(alternatePaths(french), { en: path, fr: french });
  }
});

test('localized links keep their query and fragment', () => {
  assert.equal(localizedPath('/pricing/?source=menu#support', 'fr'), '/fr/pricing/?source=menu#support');
  assert.equal(localizedPath('/fr/pricing/#support', 'en'), '/pricing/#support');
  assert.equal(localizedPath('/#developers', 'fr'), '/fr/#developers');
  assert.equal(localizedPath('/contact/?type=question&context=Registry+Stack', 'fr'),
    '/fr/contact/?type=question&context=Registry+Stack');
});

test('English-only pages, assets and external links are never given invented French routes', () => {
  for (const href of [
    '/privacy/',
    '/terms/',
    '/imprint/',
    '/pilot/',
    '/blog/',
    '/blog/choose-a-registry-interface/',
    '/starters/',
    '/starters/professional-licensing/',
    '/unknown/',
    '/favicon.svg',
    '/solutions',
    'https://docs.registrystack.org/',
    'https://marketplace.registrystack.org/',
    '//example.org/',
    'mailto:contact@registrystack.org',
    '#fit',
  ]) {
    assert.equal(localizedPath(href, 'fr'), href, href);
  }
  for (const path of ['/privacy/', '/terms/', '/imprint/', '/pilot/', '/blog/', '/starters/', '/starters/professional-licensing/', '/404.html']) {
    assert.equal(hasFrenchPage(path), false, path);
    assert.equal(alternatePaths(path), null, path);
  }
});

test('translator() gives a t(en, fr) that returns the text for the page locale', () => {
  assert.equal(translator('en')('Products', 'Produits'), 'Products');
  assert.equal(translator('fr')('Products', 'Produits'), 'Produits');
});

test('a French page marks links that lead to English content', () => {
  for (const href of ['/privacy/', '/blog/', '/starters/farmer-registry/', 'https://docs.registrystack.org/', 'https://marketplace.registrystack.org/']) {
    assert.equal(englishHreflang(href, 'fr'), 'en', href);
  }
  for (const href of ['/pricing/', '/fr/pricing/', '/#developers', '#faq', '/fr/contact/?type=question', 'mailto:hello@example.org']) {
    assert.equal(englishHreflang(href, 'fr'), undefined, href);
  }
  assert.equal(englishHreflang('/privacy/', 'en'), undefined);
});
