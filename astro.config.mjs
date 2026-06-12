// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://registrystack.org',
  output: 'static',
  trailingSlash: 'always',
  // The page lived at /why/ before the rename; keep inbound links working.
  redirects: { '/why/': '/problem/' },
  integrations: [sitemap()],
});

