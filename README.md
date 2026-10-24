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
pages offer access requests with an email fallback, not a working-download claim. Do
not regenerate the catalogue just to change website prose.

A starter is a starting configuration, not a complete service or evidence of
readiness. Summaries come from the upstream `display.description`; technical
identifiers belong in expandable details. Public source registers are modelling
references and do not imply adoption or endorsement. The shared starter wording
and request journeys are covered by tests.

### Website enquiries

The shared inline form covers website contact invitations and every starter
page. Set this public build variable to the exact HTTPS route for the unlinked
native Mautic form:

```sh
PUBLIC_STARTER_REQUEST_ENDPOINT='https://mautic.example.org/form/submit?formId=1&privacy=kiosk'
```

When the variable is unset, the contact and starter flows show their email
recovery instead. The form works without accepting visit tracking. It records
the canonical source page, a bounded request type, a short page-specific
context, and the starter ID when the enquiry comes from a specific starter
page. A catalogue invitation can carry starter context without claiming a
specific starter ID. See
[server/README.md](server/README.md) for the two Mautic forms, narrow proxy
routes, deployment, and verification setup.

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

## Optional request capture and visit tracking

`PUBLIC_STARTER_REQUEST_ENDPOINT` enables sitewide enquiry forms through the
unlinked native Mautic form while preserving each email fallback.
`PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT` optionally names a second, same-origin
native form that links an opted-in visitor's existing Mautic device to the
request. Both variables contain a full HTTPS
`/form/submit?formId=...&privacy=...` URL. See [native form and proxy
setup](server/README.md).

`PUBLIC_MAUTIC_URL` enables an optional shared website and documentation tracking choice. Leave it unset
to omit the tracker and preference UI. Configure it as an HTTPS origin.
The native Mautic tracker runs only inside the main-origin `/tracking-bridge/`
frame after explicit consent. The main site and canonical documentation exchange
strictly validated messages with that frame. It holds the shared version-2
preference and server-issued device identity; neither property places identity
in navigation URLs or a parent-domain cookie. Earlier website-only acceptance
does not authorize this expanded scope. Refusing tracking does not prevent an
enquiry. A fresh, main-site-only association can attach the opted-in browser's
history to the submitted email through the consented form; the email is self-asserted, never an
authentication credential. An unlinked submission adds no new browser-device
association, but matching an existing Contact by email does not erase that
Contact's previously associated history.

The website records canonical page URLs, titles, referring site origins,
and bounded campaign labels. Tracking preferences are remembered for 180 days;
withdrawal rotates the shared consent generation and clears the shared identifiers.
Other frames observe the change, and suspended pages check again on return. Browser DNT
and GPC signals keep Mautic tracking off. Umami remains separate aggregate
analytics and covers outbound links to documentation, demos and GitHub. Internal
website/documentation handoffs do not add acquisition UTMs. The bridge also
ignores the earlier internal handoff tuple in links from released pages.

The bridge trusts exactly the main website and documentation origins. Only the
main website can request an identifier, immediately before a form submission.
Iframe, storage, lock, or tracker failures keep attribution off and select the
unlinked form. A tracked request is aborted if consent changes while it is
pending; a request already accepted by Mautic cannot be recalled by withdrawal.
The bridge is noindex and excluded from the sitemap. GitHub Pages does not set
a path-specific frame-ancestors header; origin and window-source validation
enforce the message boundary.

Follow [Mautic tracking operations](server/mautic-tracking.md) before activation,
including exact-origin CORS, the tracking-cookie proxy boundary, zero form
actions, and absence of sending Campaigns. The workflow reads all three public
settings from repository variables. This source change does not publish the
forms or load the proxy configuration.

`npm run check:marketing-tracking` verifies the configured browser flow with a
deterministic tracking server. Set `DOCS_TRACKING_DIST` to the canonical docs
build directory and `TRACKING_BROWSERS=chromium,firefox,webkit` to verify both
actual sites across the complete browser matrix. The website and docs copies
of `shared-tracking-client.mjs` and `tracking-protocol.mjs` must stay identical.

`node scripts/check-shared-tracking-mautic.mjs` provides optional native
acceptance against fresh, disposable `mautic/mautic:7.2.1-apache` and
`mysql:8.4.13` containers. It requires Docker, OpenSSL, Playwright Chromium,
an installed loopback-only Mautic instance with `null://null` mail, no
campaigns or form actions, and empty email queues. Set `MAUTIC_TEST_CONTAINER`,
`MAUTIC_TEST_MYSQL_CONTAINER`, and `MAUTIC_TEST_URL=http://127.0.0.1:<port>`.
`SHARED_TRACKING_TEST_SCRATCH` selects where browser artifacts are retained.
The fixture creates synthetic forms and contacts and consumes only the hit
queue. Never use production or a restored production database for this check.

## GitHub Pages

The workflow installs locked dependencies and Chromium and runs `npm run check`
for pull requests and changes to `main`. The build uses read permissions;
publication permissions belong only to the deploy job, which runs on `main`.
The Pages source is GitHub Actions and `public/CNAME` preserves the custom domain.
