// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://registrystack.org',
  output: 'static',
  trailingSlash: 'always',
  // Keep old inbound links useful while the marketing site stays organized
  // around solutions. Product routes hand technical readers straight to docs.
  // Static output renders each redirect as a meta-refresh page, which is what
  // GitHub Pages can serve.
  redirects: {
    '/why/': '/',
    '/problem/': '/',
    '/ecosystem/': '/',
    '/ai/': '/customization/',
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
  integrations: [sitemap({ filter: (page) => !['/pilot/', '/tracking-bridge/'].includes(new URL(page).pathname) })],
});
