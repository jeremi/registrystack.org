# registrystack.org

Static Astro site for `registrystack.org`, the single-page institutional
marketing site for Registry Stack.

The implementation follows `../registrystack-org-marketing-site-spec.md`.

## Commands

```sh
npm install
npm run dev
npm run check
```

Use `npm run check:content` before visual work to confirm the page still meets
the content contract from the spec.

## GitHub Pages

The site is ready for GitHub Pages when this directory is the repository root:

1. Push to the `main` branch.
2. In GitHub, set **Settings -> Pages -> Source** to **GitHub Actions**.
3. Configure the custom domain as `registrystack.org`.

The deployment workflow runs `npm ci`, installs the Chromium browser used by the
visual and accessibility checks, runs `npm run check`, then deploys `dist/`.
The `public/CNAME` file preserves the custom domain in the Pages artifact.
