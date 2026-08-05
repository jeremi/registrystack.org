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
    '/ecosystem/': '/how-it-fits/',
    '/ai/': '/use-cases/',
    '/pricing/': '/pilot/',
    '/notary/': '/solutions/evidence-gateway/',
    '/relay/': 'https://docs.registrystack.org/products/registry-relay/',
    '/manifest/': 'https://docs.registrystack.org/products/registry-manifest/',
  },
  integrations: [sitemap()],
});
