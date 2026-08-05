# registrystack.org

Static Astro site for `registrystack.org`, the institutional marketing site for
Registry Stack.

The site is outcome-led: the homepage explains how a registry owner can provide
a signed minimum-disclosure answer or selected data, then routes visitors into
two product patterns. Product implementation details live in the technical
documentation. The original single-page direction is recorded in
`../registrystack-org-marketing-site-spec.md` and the multi-page split in
`../registry-stack-docs-marketing-split-plan-2026-06-05.md`; where this site and
those documents disagree, the site and `scripts/check-content.mjs` are current.

- `/` home: the public-service outcome, the four-step evidence exchange,
  program outcomes, two solution doors, participating authorities, and
  verifiable proof.
- `/solutions/evidence-gateway` Evidence Gateway: return one signed answer to a
  predefined question without sharing the source record.
- `/solutions/protected-registry-apis` Protected Registry APIs: let a public
  or partner service read agreed fields from an existing registry, read-only
  and recorded.
- `/use-cases` worked public-service scenarios and the limited role of
  AI-assisted services.
- `/how-it-fits` positioning Registry Stack next to the source registry and
  before any exchange layer, alongside identity systems, catalogs, and
  standards.
- `/security` the security model, what you can verify, and how to report a
  vulnerability.
- `/faq` short, honest answers that link out to the deeper pages.
- `/pilot` what is open source, what paid delivery and support cover, and how to
  start with one registry.

The retired `/notary` route redirects to Evidence Gateway. The former
`/relay` and `/manifest` marketing routes redirect to their product
documentation. `/problem`, `/ecosystem`, `/ai`, and `/pricing` redirect to the
pages that absorbed their useful content.

The audience is program and policy people; code stays in the docs site. The
voice is plain and outcome-led; release engineering detail such as versioning
and maturity notes lives in the docs and the product repositories. The two
solutions are the primary route from the homepage; the hosted lab at
`https://lab.registrystack.org/` is the "see it running" action on the solution
pages. `npm run check:links` verifies that the link is present and warns if the
independently deployed lab is temporarily unreachable.

### Copy standard

- Prefer a literal description over a slogan. A heading should name the
  subject, action, and object without relying on the preceding section.
- Use the terms a government program team would use: registry owner, public or
  partner service, predefined question, purpose, signed answer, selected
  fields, and audit record.
- Do not compress a process into fragments such as "agree, check, return" or
  use abstract labels such as "the right route" when a concrete sentence is
  available.
- Explain the two current product paths: Evidence Gateway when a service needs
  only a fact, and Registry Relay when it needs selected data. Do not describe
  the underlying Evidence service as a credential lifecycle, wallet service,
  or decision engine.
- State only current, inspectable capabilities. Product implementation detail
  belongs in the technical documentation.
- Keep `Answer the question. Keep the records.` as the deliberate homepage
  headline. Its following paragraph must immediately explain what the phrase
  means.

Before accepting copy, ask whether a reader new to Registry Stack could explain
the sentence in their own words and identify who does what. If not, rewrite it
more literally.

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

`npm run check:content` enforces structural invariants only: solution-first
routing, redirects, required components, and site wiring. Copy quality is
reviewed against the copy standard above; automated checks do not pin or ban
marketing phrases.

## GitHub Pages

The site is ready for GitHub Pages when this directory is the repository root:

1. Push to the `main` branch.
2. In GitHub, set **Settings -> Pages -> Source** to **GitHub Actions**.
3. Configure the custom domain as `registrystack.org`.

The deployment workflow runs `npm ci`, installs the Chromium browser used by the
visual and accessibility checks, runs `npm run check`, then deploys `dist/`.
The `public/CNAME` file preserves the custom domain in the Pages artifact.
