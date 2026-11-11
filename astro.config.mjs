// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import startersData from './src/data/starters.json' with { type: 'json' };
import { assertMarketplaceIndexingDecision, inspectMarketplace, marketplaceMigrationEnabled } from './src/lib/marketplace-routes.mjs';

const indexingDecision = process.env.MARKETPLACE_INDEXING_DECISION;
const migrateStarters = marketplaceMigrationEnabled(process.env.PUBLIC_MARKETPLACE_MIGRATION_ENABLED, indexingDecision);
const starterIds = startersData.starters.map((starter) => starter.id);
if (migrateStarters) {
  const report = await inspectMarketplace({ starterIds, collectionKeys: ['licensing', 'business-and-tax', 'people-and-social-programmes', 'land-property-and-assets', 'agriculture-food-and-environment', 'health-and-safety', 'reference-registers'] });
  assertMarketplaceIndexingDecision(report, indexingDecision);
  console.info(`[marketplace] Verified ${report.pages.length} destinations; indexing decision: ${indexingDecision}. Static redirects are HTML refresh documents, not HTTP 301s.`);
}

export default defineConfig({
  site: 'https://registrystack.org',
  output: 'static',
  trailingSlash: 'always',
  // Keep old inbound links useful while the marketing site stays organized
  // around solutions. Product routes hand technical readers straight to docs.
  // Static output renders each redirect as a meta-refresh page, which is what
  // GitHub Pages can serve.
  redirects: {
    // Starter source pages own their fragment-aware migration documents.
    // Config redirects would replace those pages with bare meta refreshes.
    '/why/': '/',
    '/problem/': '/',
    '/ecosystem/': '/',
    '/use-cases/': '/solutions/',
    '/how-it-fits/': '/',
    '/notary/': '/products/evidence-gateway/',
    '/relay/': '/products/evidence-gateway/',
    // Registry Relay was retired upstream on 2026-10-03; Evidence Gateway
    // carries the retirement note.
    '/products/registry-relay/': '/products/evidence-gateway/',
    '/solutions/base-registry/': '/products/base-registry/',
    '/solutions/evidence-gateway/': '/products/evidence-gateway/',
    '/solutions/casework/': '/products/casework/',
    '/solutions/protected-registry-apis/': '/products/evidence-gateway/',
    '/manifest/': 'https://docs.registrystack.org/products/registry-manifest/',
  },
  // The compatibility page redirects visitors and should not be indexed.
  integrations: [sitemap({ filter: (page) => {
    const pathname = new URL(page).pathname;
    return !['/pilot/', '/tracking-bridge/'].includes(pathname) && !(migrateStarters && pathname.startsWith('/starters/'));
  } })],
});
