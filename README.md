# registrystack.org

Static Astro site for `registrystack.org`, the public website for organizations
evaluating Registry Stack. Follow [AGENTS.md](AGENTS.md) when changing this site.

## Audience and editorial direction

Registry Stack serves organizations that manage authoritative records and need
to control how those records are maintained, accessed, and shared. Government
is the current primary focus and main source of examples. Keep general
explanations applicable to other organizations, including NGOs and banks, and
make sector-specific assumptions explicit. Possible applications do not imply
existing deployments, compliance, or demonstrated readiness for every sector.
A starter is a starting configuration, never a deployment or readiness claim.
Starter pages state what each starter includes from the catalogue data rather
than from prose. The one-line description shown for a starter (cards, family
lists, the starter hero and its meta description) is the catalogue `summary`,
a plain sentence maintained upstream in each starter's `display.description`;
the technical `task` paragraph belongs under "What it holds". Each starter page
lists the public registers it was modeled on, with a caption that modelling
does not imply use or endorsement by their operators.

Write primarily for people responsible for an organization's registries and
services: decision makers, programme and service owners, data stewards, and
governance teams. Technical evaluators and implementers are an important
secondary audience.

- Lead with concrete organizational needs, practical outcomes, and adoption
  decisions. Explain how the components fit systems the organization already
  uses and what remains under its control.
- Use plain, outcome-led language. Readers should understand why a capability
  matters and whether it fits their needs without knowing its implementation.
- Introduce technical concepts when they help the reader make a decision.
  Put code, configuration, and implementation procedures in the docs site;
  link to the relevant next step for technical readers.
- Treat developer and implementer experience as a product design requirement,
  not as the default editorial audience for every public page.
- Lead with the register a reader keeps: the solution areas and the starters.
  Products are the second layer and keep their full pages. A solution area
  page is written for the office that runs that kind of register and has the
  problem: it opens with the pain and the promise, heads each section with
  what changes for that office, and keeps implementation vocabulary (record
  types, access profiles, signed answers, APIs, starters as zips) for its FAQ,
  the starter pages and the product pages. `scripts/check-content.mjs`
  enforces the vocabulary rule. Terminology: "register" is the thing an
  office keeps; "registry" appears only in product names and the defined term
  "base registry". Solution and starter pages address "your office"; other
  pages address "your organization". The nouns "licence" and "programme" keep
  their British spelling ("licence fee"); everything else is American
  spelling. Within that layer,
  Base Registry Engine and Evidence Gateway remain the flagship products, with
  Registry Casework in a supporting role. Registry Relay was retired upstream on
  2026-10-03 (https://docs.registrystack.org/decisions/registry-relay-retirement-2026-10-03/);
  the site does not market it, and the content check enforces that. Use the full **Base Registry Engine** name in public copy; its abbreviation
  belongs in technical documentation and command names.
- Describe the products as independent choices. The organization owns its
  records; connecting components requires explicit configuration.
- Establish each product's core job and breadth before using an example to
  illustrate it. Base Registry Engine stores and manages records, including
  people and households; approvals are one capability within that role.
  A scenario must not make the product appear limited to one sector or workflow.
  Keep useful depth on product pages and distinct next steps for understanding
  the product, discussing a use case, and running a developer tutorial.
- Describe current capabilities accurately. Do not present planned features,
  deployments, integrations, or demonstrations as available today.
- Make paid help available without making it the focus of every page.
  Lead with Registry Stack and the services offered. Keep Aubex as a secondary
  provider attribution, rather than a headline or call to action.
  Aubex-led implementation pilots start at **US$20,000 per scoped engagement**.
  For teams implementing and operating the software themselves, support
  contracts start at **US$7,500 per year**. Final scope and fees are agreed with
  the customer. Present the two prices on the pricing page before the inquiry
  action; other pages should link there without repeating the amounts.
  The written brief asks for the help needed; budget and timing are optional
  fields that help scoping. The light path is an "Ask a question" email
  (`askQuestionHref` in `src/data/contact.ts`) in the header, the footer and
  the closing bands, with the address printed in text next to every mailto
  button, because many government desktops have no mail client. The site never
  states a reply time, a customer name or an outcome it cannot show.
  Self-service use has no software licence fee and does not include a delivery
  team or private support.

Review the page from its reader's perspective: can a programme or service
owner understand the value, organizational fit, and next step without reading
code? A page for a narrower audience must make its purpose clear.

Release engineering, versioning, maturity notes, and operational caveats belong
in the docs and product repositories. Lead the public website with value, fit,
and concrete examples; do not require blanket Beta notices or maturity warnings.

Link technical evaluators to maintained tutorials and state which exercise they
will run. Website illustrations explain a scenario; they are not live software
demonstrations. The hosted lab currently shows legacy Notary workflows, so do
not promote it as a demonstration of the current flagship products. Reachability
alone does not establish that a demo matches the product being described.

Preserve the refreshed civic-print visual design: civic-blue cover hero, quiet
paper backgrounds, register typography, example cards, and tinted divider bands.
Accent colors come from the registry palette (civic blue, stamp red, brass on
dark bands); decorative motifs are CSS and SVG. Improve the explanation and
content sequence within that design.

## Site implementation

Solution areas (the register families and the cross-cutting jobs) and the
starters each family groups live in `src/data/solutions.ts`. The starters
catalogue data lives in `src/data/starters.json`, read through
`src/data/starters.ts`. That file is generated, not edited: run
`npm run sync:starters -- EXPORT_DIR --release TAG --repo PATH` on an export
made by `registry-starters export-catalogue` in the breg-registry-starters
repository. The starter zips are assets of the GitHub release named by the tag,
published with that repository's `scripts/publish-catalogue-release`; the site
never stores them, so refreshing the catalogue adds no binaries to this
repository. Until that release is public, a starter page does not link its zip:
it asks for a request by email (`contact@registrystack.org`, journey
`starter-request`), and the content check enforces that. `src/upstream/starters.json` records the release
tag, the starters revision and the catalogue digest the site was built from.
A register family may name a `featuredStarter`, the starter its page's example
is about and the one shown first with a "Start here" tag; the content check
requires it to be in the family's list. A family without one highlights none.
Each area also carries an `audience` line ("For licensing boards, ...") shown
on its card and a `description` under 155 characters used as its page's meta
description. Catalogue cards show a starter's title and summary only (`starterLead` in
`src/data/starter-words.ts`: the summary, else the task's first sentence);
counts of record types, actions and roles belong on the starter page, in its
section headings. Every starter request email is built by
`starterRequestHref(title)` in the same file, so subject and body fields match
from page to page. Every register family page ends its FAQ with
`sharedFamilyFaq` from `src/data/solutions.ts` (cost, hosting, staff screens,
exit, first step) and closes with the "Ask a question" band;
`SolutionStarters` takes an optional `featuredNote` saying what the featured
starter covers of the page's example. A starter page shows the catalogue's identifiers in
words (`src/data/starter-words.ts`, covered by `npm test`), with the
identifiers themselves in "Technical details" disclosures.
Product names, summaries, and tutorial destinations
live in `src/data/products.ts`. Product pages live under `/products/` and share
`src/layouts/Product.astro`.
The main page opens on the register families and uses a static, labeled
example that works without JavaScript.
Data illustrations use shared record and signed-answer components. Keep each
entity's fields inside its own labelled record; show relationships between
records explicitly and distinguish stored information from returned answers.
Its developer section links to maintained local tutorials; the separate pricing
page explains paid delivery before opening a structured email inquiry. Every
mailto on the site is built with `src/data/contact.ts` (`contactEmail`,
`mailtoHref`, `askQuestionHref`), covered by `npm test`.

## Pages

- `/`: how a register runs (one licence from request to answer, with the two pages every register shares), what stays under the organization's control, the register families and the starters, the three products as equal cards, the developer paths, where the project stands, and the closing band.
- `/solutions/` and `/solutions/<area>/`: one page per solution area in `src/data/solutions.ts`.
- `/starters/` and `/starters/<id>/`: the starters catalogue, one page per starter.
- `/products/base-registry/`: build and maintain a registry.
- `/products/evidence-gateway/`: return a signed answer to a predefined question.
- `/products/casework/`: coordinate the human decisions behind a registry with Casework.
- `/blog/`: field guides for registry owners and reviewers, published from `src/content/blog/` with an RSS feed at `/rss.xml`.
- `/pricing/`: public prices for implementation pilots and annual support contracts, who does the work, and the written brief (budget and timing optional).
- `/security/` and `/faq/`: boundaries, responsibilities, and adoption questions.

Former product and editorial routes retain redirects in `astro.config.mjs`,
including `/how-it-fits/` to the homepage, the former `/solutions/<product>/`
pages to `/products/`, and `/use-cases/` to `/solutions/`. The redirect-only `/pilot/` page
preserves known section links to `/pricing/`, with a native fallback to the
pricing page when JavaScript is disabled.
Historical site plans do not override this structure.

## Commands

```sh
npm ci
npm run dev
npm run check
```

`npm run check` runs the unit tests, content wiring, Astro diagnostics, the production build,
links, accessibility, responsive layout, keyboard navigation, data-sharing illustrations,
and the homepage evaluation journey. The journey check covers no-JavaScript and
reduced-motion visitors. Existing optional analytics distinguishes outgoing tutorial links and the paid
implementation and support email action. Clicks are not proof of tutorial completion or a submitted,
qualified inquiry.

When the homepage headline or branding changes, update
`scripts/build-og.mjs` and run `npm run build:og` before the final build; the
script renders with the static `@fontsource/public-sans` files, declared as a
dev dependency.
Commit the generated social image with its source.

## GitHub Pages

The existing deployment workflow installs locked dependencies and Chromium,
runs `npm run check`, and deploys `dist/` when `main` changes.
The Pages source is GitHub Actions and the custom domain is preserved by
`public/CNAME`.
