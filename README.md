# registrystack.org

Static Astro site for `registrystack.org`, the public website for organizations
evaluating Registry Stack. Follow [AGENTS.md](AGENTS.md) when changing this site.

## Audience and editorial direction

Write first for institutional decision makers, programme and service owners,
data stewards and governance teams. Government is the primary audience and
source of examples, at national, regional and local levels. General
entry pages should reflect that breadth; local-government services are one
application area. Organize general navigation by service area and show examples
from different government levels together. Technical evaluators and implementers
have dedicated product, starter and documentation paths.

The website helps a reader understand which service they can improve, how the
software can be adapted, who can deliver it and what to do next. Lead with the
service or problem. Explain open source, interoperability and reusable
components through the choices they give the institution. DPI is relevant to
funders, national digital teams and implementation partners; define the term
before using the abbreviation.

- Use concrete nouns, short sentences and familiar verbs. Avoid idioms,
  metaphors, clever slogans and unexplained technical vocabulary. Assume many
  readers use English as an additional language.
- Address the person evaluating the service. Keep editorial instructions,
  sales strategy and internal acceptance criteria in code comments or private
  working documents, never in visible copy.
- Let readers describe their needs before selecting a product or starting
  configuration. Browsing configurations is an optional evaluation path.
- Explain the current AI-assisted implementation offer: our team uses
  AI-assisted authoring to adapt configuration and application code; the
  institution reviews the result. Ordinary service operation does not require
  an AI model. The planned direct AI assistant in Registry Studio is a separate
  future capability. Do not imply an available autonomous self-service builder.
- Sell a configured solution and the work to deliver it without presenting
  every component as a complete application. A written implementation scope
  agrees screens, integrations, migration, hosting, operation and handover.
- Describe current capabilities accurately. Illustrations are fictional
  examples, not product screenshots, live demonstrations or customer evidence.
  No unsupported deployment, efficiency, compliance or certification claims.
- Explain a limitation where it affects an adoption decision. Do not turn every
  section into a warning or require a blanket Beta banner. Keep technical
  maturity and operational detail in the maintained documentation.
- Present the core software as Apache-2.0 open source. Do not imply that every
  current or future companion product, private support service or Studio
  offering has that licence. Open source does not include a free delivery team.
- Keep Aubex as the provider attribution. Prices belong on `/pricing/`: scoped
  implementation pilots from US$20,000 and annual support from US$7,500.
  Do not invent package inclusions, turnaround times or service levels.
- Use “register” for the records an institution maintains and the full product
  names for software. Use “starting configuration” before introducing
  “starter”. Keep “licence” and “programme”; otherwise use American spelling.
- Put code, configuration instructions and deployment procedures in the docs.
  Link to a relevant tutorial instead of making the public website a manual.

Base Registry Engine manages records, permissions, changes and history.
Registry Casework coordinates review work; a decision does not by itself
change a register. Evidence Gateway returns approved answers to predefined
questions; a digital signature establishes origin and integrity, not whether
the source information is true. Use independent products or combine them as
needed. [Registry Relay is retired](https://docs.registrystack.org/decisions/registry-relay-retirement-2026-10-03/)
and must not be marketed as current software.

Review each page as its intended reader: can they understand the value, assess
fit and find a next step without knowing our internal vocabulary? Automated
checks protect wiring and selected factual boundaries; they cannot answer that
editorial question.

Review existing copy before reusing it. Name the actor, task and object, then
explain the useful result. For staff reviews, use “Review requests and record
decisions” and explain assignment and due dates with a concrete request. For
information checks, use “Check information from another register” and name a
question a connected service needs answered. A procurement system checking a
supplier’s registration is clearer than “share a limited answer.” Keep these
meanings consistent across cards, menus and metadata; adapt the sentence to the
reader rather than repeating a slogan.

For verifiable credentials, explain what information the institution issues,
who receives it and which service will accept it. The implementation connects
and tests the wallet and receiving service. Keep credential validity, source
freshness and the receiving service's decision distinct; issuance alone does
not establish a complete wallet service.

Product pages follow the same buyer-first approach: describe the institutional
task, show a concrete example, explain practical capabilities and describe how
the product fits existing systems. Keep the technical-team handoff short and
link to maintained tutorials. Protocol names, configuration contracts and
command-line instructions belong in the documentation. Explain approvals,
access, source freshness and implementation responsibilities in plain language
where they affect the buyer's decision.

## Site implementation

Solution areas and their starter membership live in `src/data/solutions.ts`.
The local-government page brings together municipal use cases without adding a
new starter family. Product names, availability notes and tutorial destinations
live in `src/data/products.ts`. Product pages share `src/layouts/Product.astro`.

Starter catalogue data in `src/data/starters.json` is generated, not hand-edited:

```sh
npm run sync:starters -- EXPORT_DIR --release TAG --repo PATH
```

Use a compatible catalogue export from the owning starters repository;
`scripts/sync-starters.mjs` defines the required input files.
`src/upstream/starters.json` records the upstream release, revision and catalogue
digest. Until that release is publicly downloadable, starter
pages offer an email request, not a working-download claim. Do not regenerate
the catalogue just to change website prose.

A starter is a starting configuration, not a complete service or evidence of
readiness. Summaries come from the upstream `display.description`; technical
identifiers belong in expandable details. Public source registers are modelling
references and do not imply adoption or endorsement. The shared starter wording
and request emails are covered by unit tests.

All general contact links use `src/data/contact.ts`. `describeServiceHref`
invites the service, its users and the result needed. `askQuestionHref` supports
a lighter question. The pricing inquiry includes optional budget and timing.
Print the email address beside mailto buttons so readers without an email app
can still contact the team. The header Contact link opens the pricing inquiry.

The homepage starts with use cases and customization. Product choices and
technical evaluation follow. Shared figures must identify their illustrative
purpose, keep fields inside the record they describe and distinguish stored
information from disclosed answers. Preserve no-JavaScript and reduced-motion
access. A hosted legacy lab is not evidence of the current product journey.

Preserve the civic-print design: civic-blue cover, quiet paper backgrounds,
Public Sans and IBM Plex Mono, ink text, stamp red and restrained brass on dark
backgrounds. Keep readable text, visible focus, adequate link targets and
layouts that work from mobile through desktop.

## Pages

- `/`: service outcomes, solution areas, AI-assisted customization, an example
  journey, ownership and reuse, products, adoption options and developer paths.
- `/solutions/` and `/solutions/<area>/`: service-specific problems, capabilities,
  examples, relevant configurations and next steps.
- `/solutions/local-government/`: municipal services and an implementation path.
- `/customization/`: needs-first customization, today's assisted implementation
  and the planned Studio assistant.
- `/digital-public-infrastructure/`: reusable registries within a DPI programme,
  interoperability, institutional control and documented standards scope.
- `/starters/` and `/starters/<id>/`: configurations available by request, their
  included parts and what an implementation still needs.
- `/products/base-registry/`, `/products/evidence-gateway/` and
  `/products/casework/`: component capabilities, boundaries and tutorials.
- `/pricing/`: implementation and support prices, responsibilities, inquiry and
  the open-source self-service option.
- `/security/` and `/faq/`: questions that affect evaluation and adoption.
- `/blog/`: published field guides, with historical notices on retired product
  material and an RSS feed at `/rss.xml`.

Keep former routes as redirects in `astro.config.mjs`. `/ai/` now leads to
customization. `/pilot/` preserves known section links into `/pricing/` and has
a no-JavaScript fallback. Historical plans do not override this structure.

## Commands

```sh
npm ci
npm run dev
npm run check
```

`npm run check` runs unit tests, content wiring, Astro diagnostics, production
build, internal links, accessibility, responsive layout, keyboard navigation,
data-sharing illustrations and buyer/developer journeys. Journey coverage
includes no JavaScript and reduced motion. Inspect rendered pages as well as
these automated results.

When the homepage headline or branding changes, update `scripts/build-og.mjs`
and run `npm run build:og` before the final build. Commit the generated social
image with its source. Fonts are bundled, so the image render works offline.

Optional analytics distinguishes tutorial and inquiry link clicks. A click is
not proof of tutorial completion or a submitted, qualified inquiry.

## GitHub Pages

The deployment workflow installs locked dependencies and Chromium, runs
`npm run check`, and deploys `dist/` when `main` changes. The Pages source is
GitHub Actions and `public/CNAME` preserves the custom domain.
