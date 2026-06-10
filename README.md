# registrystack.org

Static Astro site for `registrystack.org`, the institutional marketing site for
Registry Stack.

The site is product-led: the homepage carries the Registry Notary promise
(prove facts without sharing records), routes to the hosted lab as the primary
call to action, and routes visitors into the three products from their own
situation ("services keep asking us to send the whole record"), keeping the
products in priority order. The original
single-page direction is recorded in `../registrystack-org-marketing-site-spec.md`
and the multi-page split in `../registry-stack-docs-marketing-split-plan-2026-06-05.md`;
where this site and those documents disagree, the site and
`scripts/check-content.mjs` are current.

- `/` home: Notary-led hero, live-lab CTA, situation doors into the three
  products, the operating model, and links out to the deeper pages.
- `/notary` Registry Notary: signed answers and wallet credentials (Verify).
- `/relay` Registry Relay: protected APIs over existing files and tables (Expose).
- `/manifest` Registry Manifest: portable standards-facing metadata (Describe).
- `/why` the recurring registry problems.
- `/use-cases` the sell gallery (question, bounded answer, what is not shared).
- `/ecosystem` positioning, complementary-not-competitive (footer-linked).
- `/ai` a harness for AI in public services (context, not product); a static
  stub at `/why-now` redirects here.

The audience is program and policy people; code stays in the docs site. The
voice is plain and outcome-led; release engineering detail such as versioning
and maturity notes lives in the docs and the product repositories. The
primary call to action on the homepage and product pages is the hosted lab at
`https://lab.registrystack.org/`, which `npm run check:links` verifies is
reachable on every build.

The visual identity is civic print, drawn from the look of official records:
a solid civic-blue cover hero, quiet paper heroes on the inner pages, mono
register labels with stamp-red entry numbers, a circular seal on the hero
card, and tinted divider bands. Accent colors come from the registry palette
(civic blue, stamp red, brass on dark bands); decorative motifs are pure CSS
and SVG with no licensed assets.

## Commands

```sh
npm install
npm run dev
npm run check
```

`npm run check:content` enforces invariants only (copy quality, the
policy-audience hero guardrail, product priority order, required wiring); it
does not pin copy strings, so pages can be reworded freely.

## GitHub Pages

The site is ready for GitHub Pages when this directory is the repository root:

1. Push to the `main` branch.
2. In GitHub, set **Settings -> Pages -> Source** to **GitHub Actions**.
3. Configure the custom domain as `registrystack.org`.

The deployment workflow runs `npm ci`, installs the Chromium browser used by the
visual and accessibility checks, runs `npm run check`, then deploys `dist/`.
The `public/CNAME` file preserves the custom domain in the Pages artifact.
