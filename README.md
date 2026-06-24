# registrystack.org

Static Astro site for `registrystack.org`, the institutional marketing site for
Registry Stack.

The site is solution-led: the homepage carries the promise (prove facts from
registries without sharing the records) and routes visitors into two solutions,
then shows the three open-source products those solutions are built from, in
priority order. The original single-page direction is recorded in
`../registrystack-org-marketing-site-spec.md` and the multi-page split in
`../registry-stack-docs-marketing-split-plan-2026-06-05.md`; where this site and
those documents disagree, the site and `scripts/check-content.mjs` are current.

- `/` home: the promise, two solution doors, the three products they are built
  from (in priority order), a proof band, and links out to the deeper pages.
- `/solutions/evidence-gateway` Evidence Gateway: share proof of a fact, a yes
  or no, a status, or a credential, without sharing the record.
- `/solutions/protected-registry-apis` Protected Registry APIs: open an existing
  registry safely for approved services, read-only and audited.
- `/notary` Registry Notary: configured signed claim results and wallet credentials (Verify).
- `/relay` Registry Relay: protected APIs over existing files and tables (Expose).
- `/manifest` Registry Manifest: portable standards-facing metadata (Describe).
- `/problem` the recurring registry problems (`/why` redirects here).
- `/use-cases` the sell gallery (question, bounded answer, what is not shared).
- `/ecosystem` positioning, complementary-not-competitive (footer-linked).
- `/ai` a harness for AI in public services (context, not product); a static
  stub at `/why-now` redirects here.
- `/security` the security model, what you can verify, and how to report a
  vulnerability.
- `/faq` short, honest answers that link out to the deeper pages.
- `/pilot` what a pilot looks like, and `/pricing` the packages.

The audience is program and policy people; code stays in the docs site. The
voice is plain and outcome-led; release engineering detail such as versioning
and maturity notes lives in the docs and the product repositories. The two
solutions are the primary route from the homepage; the hosted lab at
`https://lab.registrystack.org/` is the "see it running" action on the solution
and product pages, and `npm run check:links` verifies it is reachable on every
build.

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
