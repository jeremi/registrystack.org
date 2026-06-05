# registrystack.org

Static Astro site for `registrystack.org`, the institutional marketing site for
Registry Stack.

The homepage follows `../registrystack-org-marketing-site-spec.md`. The site has
grown to multiple pages to absorb the persuasion layer migrated out of the docs
site (see `../registry-stack-docs-marketing-split-plan-2026-06-05.md`):

- `/` home: condensed hero, highlights, and links out to the deeper pages.
- `/why` the recurring registry problems.
- `/use-cases` the sell gallery (question, bounded answer, what is not shared).
- `/ecosystem` positioning, complementary-not-competitive.
- `/why-now` AI and automation as urgency for safeguards (context, not product).
- `/status` maturity, what is built today, and pitch-form boundaries.

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
