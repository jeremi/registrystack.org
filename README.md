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
- Give Base Registry Engine and Evidence Gateway the most prominent product
  paths, with Registry Relay in a supporting role and its own product page.
  Use the full **Base Registry Engine** name in public copy; its abbreviation
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
  Ask for the help needed, budget, and timing before substantive scoping.
  Self-service use has no software license fee and does not include a delivery
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

Product names, summaries, and tutorial destinations live in
`src/data/products.ts`. Product pages share `src/layouts/Product.astro`.
The main page uses a static, labeled example that works without JavaScript.
Data illustrations use shared record and signed-answer components. Keep each
entity's fields inside its own labelled record; show relationships between
records explicitly and distinguish stored information from returned answers.
Its developer section links to maintained local tutorials; the separate pricing
page explains paid delivery before opening a structured email inquiry.

## Pages

- `/`: organizational needs, examples, product choices, and evaluation paths.
- `/solutions/base-registry/`: build and maintain a registry.
- `/solutions/evidence-gateway/`: return a signed answer to a predefined question.
- `/solutions/protected-registry-apis/`: publish selected existing data with Relay.
- `/solutions/casework/`: coordinate the human decisions behind a registry with Casework.
- `/use-cases/`: illustrative registry and service scenarios.
- `/blog/`: field guides for registry owners and reviewers, published from `src/content/blog/` with an RSS feed at `/rss.xml`.
- `/pricing/`: implementation pilots, annual support contracts, and a budget-qualified inquiry.
- `/security/` and `/faq/`: boundaries, responsibilities, and adoption questions.

Former product and editorial routes retain redirects in `astro.config.mjs`,
including `/how-it-fits/` to the homepage. The redirect-only `/pilot/` page
preserves known section links to `/pricing/`, with a native fallback to the
pricing page when JavaScript is disabled.
Historical site plans do not override this structure.

## Commands

```sh
npm ci
npm run dev
npm run check
```

`npm run check` runs content wiring, Astro diagnostics, the production build,
links, accessibility, responsive layout, keyboard navigation, data-sharing illustrations,
and the homepage evaluation journey. The journey check covers no-JavaScript and
reduced-motion visitors. Existing optional analytics distinguishes outgoing tutorial links and the paid
implementation and support email action. Clicks are not proof of tutorial completion or a submitted,
qualified inquiry.

When the homepage headline or branding changes, update
`scripts/build-og.mjs` and run `npm run build:og` before the final build.
Commit the generated social image with its source.

## GitHub Pages

The existing deployment workflow installs locked dependencies and Chromium,
runs `npm run check`, and deploys `dist/` when `main` changes.
The Pages source is GitHub Actions and the custom domain is preserved by
`public/CNAME`.
