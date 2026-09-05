// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://registrystack.org',
  output: 'static',
  trailingSlash: 'always',
  // Keep old inbound links useful while the marketing site stays organized
  // around solutions. Product routes hand technical readers straight to docs.
  redirects: {
    '/why/': '/',
    '/problem/': '/',
    '/ecosystem/': '/',
    '/ai/': '/use-cases/',
    '/how-it-fits/': '/',
    '/notary/': '/solutions/evidence-gateway/',
    '/relay/': '/solutions/protected-registry-apis/',
    '/manifest/': 'https://docs.registrystack.org/products/registry-manifest/',
  },
  // The compatibility page redirects visitors and should not be indexed.
  integrations: [sitemap({ filter: (page) => new URL(page).pathname !== '/pilot/' })],
});
