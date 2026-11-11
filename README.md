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

The website helps a reader assess a new register or service, an adaptation to
an existing one, or a capability added beside an existing system; understand
what must be configured or integrated; and choose a delivery route and next step. Lead with the
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
- Use the AI overview to orient readers among service design, implementation
  and citizen access. Put the three jobs and their deliverables before any deep
  example. Keep runtime permissions and assistant logging claims scoped to
  citizen access; they are not guarantees about third-party design tools.
- Write the AI pages in the words a ministry adviser would say aloud: "your
  staff", "another government system", "the details you allow", "your official
  website", "check and submit". Keep product and engineering terms (fields,
  callers, permitted, review page) for the maintained documentation.
- Label an example card "Example" and name what it shows. Put the fictional
  marking in the caption under the card ("Fictional example. Rules and screens
  are configured for your service."), not in a bar above the visual.
- Present AI-assisted implementation as a scoped engagement with our team,
  service design as a method offered mainly through partners, and citizen access
  through an approved assistant as available in a pilot for a configured Base
  Registry Engine service. The citizen access page states that the integration
  is a Preview outside the compatibility promise and that a release may change
  or remove it. The overview and the homepage do not repeat that note. The
  person reviews and submits the request on the institution's site. The
  assistant cannot submit a request, approve it or change a record. The
  institution approves service rules and proposed implementation changes. The
  configured service runs with no AI model required. Registry Studio is an
  authoring tool in development. Its local prototype
  includes document-assisted drafting; this does not establish public access
  or a general conversational editing assistant. Studio has separate commercial
  terms and is not covered by the core runtime’s Apache-2.0 licence.
- State what AI does and who decides as plain positive claims. Do not undersell:
  state maturity in positive terms ("Available in a pilot") and give readers
  statements that are true by design. Keep interface stability notes and
  detailed limits on the page that describes the feature and in the maintained
  documentation. Use "an assistant you approve" for an assistant the institution
  has registered, and say that the connection uses Model Context Protocol (MCP),
  an open standard.
- Take the team's track record from `src/data/team.ts`. It describes registries
  the team has built across separate customer projects. Never present it as
  Registry Stack deployments, and name no product or customer.
- Explain headless architecture through the choice to use an existing portal,
  staff application or integration. Explain the access and operation scope of
  the interface being offered; link to maintained contracts for implementation
  detail.
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

## Product scope for website messaging

Registry Stack supplies configurable software for creating public registers and
services, adapting existing ones, and adding record, review or information-check
capabilities beside systems an institution keeps. A new service does not require
an existing digital service or register. The institution defines its records,
rules and responsibilities; an implementation supplies or adapts screens,
sign-in and integrations. These components are not complete, ready-made sector
applications. Core runtime software is Apache-2.0; implementation and support
are commercial services, and Studio has separate terms and availability.

This scope follows the maintained [product concepts](https://docs.registrystack.org/start/concepts/)
(“What runs” and “What no product owns”), the component descriptions below, and
the implementation responsibilities on this site. It is a scope statement, not
copy to repeat on every page. Use an existing-system example where it helps;
do not make possession of that system a condition of a general enquiry.

## Page purpose and section selection

- Name one reader, their decision and the useful next step before drafting.
  An independent reviewer checks final renders, including optional content,
  against that task before considering the implementation rationale.
- Check the page's implied starting condition against the product scope above.
  For a general entry or enquiry, can an institution with no existing digital
  service recognize a route as readily as one adapting a service? For a focused
  integration page, is the existing-system condition deliberate and clear?
  Review headings, examples, shared CTAs, contact states and metadata together.
  A neutral headline does not excuse a narrower next step. Do not force a
  “create and improve” formula into every heading or remove necessary limits.
- For each section ask: if it disappeared, which decision would be unanswered
  or which material misunderstanding would become likely? Accuracy alone does
  not earn space. An accordion does not make an unrelated topic relevant.
- Use current capabilities and bounded examples to support the offer. A possible
  service catalogue is a new topic on a registry implementation page. A separate
  guide needs its own reader task, maintained owner and approved scope first.
- Qualify the specific claim a reader could materially misinterpret, beside that
  claim. Preserve assistant permissions, independent register updates and the
  distinction between a signature and source accuracy. Do not add accreditation
  denials or general limitations where no related promise is made.
- Finish the agreed page job before proposing another topic, audience or guide.
  Stop for explicit scope approval before adding one. Reviewer requests are input,
  not permission to grow the brief; record adopted cuts as well as additions.
- An unresolved material off-purpose or unsupported-claim finding from the
  independent reviewer blocks readiness. Resolve it with an edit or an explicit
  owner decision on scope; passing automated checks does not clear that finding.

Automated checks establish navigation and selected factual boundaries. The
section-to-reader-decision review establishes whether the content belongs.

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

The shared inline form covers website contact invitations. Current configuration
access requests belong to the marketplace; archived reference pages link there. Set this public build variable to the exact HTTPS route for the unlinked
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
can still contact the team. The header Contact link opens the general contact page.

The homepage starts with use cases and customization. Product choices and
technical evaluation follow. The main site explains service fit; the configuration
marketplace owns pack browsing, model detail and access requests. Keep service
categories here and link each to its corresponding marketplace collection.
The old `/starters/` index offers seven collection handoffs. Its 84 detail pages
remain indexable reference snapshots, labelled with their catalogue version and
linked to the exact current marketplace configuration. They do not collect
requests for the archived model. Do not change live marketplace indexing as
part of website content work. Shared figures must identify their
illustrative purpose, keep fields inside the record they describe and distinguish stored
information from disclosed answers. Preserve no-JavaScript and reduced-motion
access. A hosted legacy lab is not evidence of the current product journey.

Preserve the civic-print design: civic-blue cover, quiet paper backgrounds,
Public Sans and IBM Plex Mono, ink text, stamp red and restrained brass on dark
backgrounds. Keep readable text, visible focus, adequate link targets and
layouts that work from mobile through desktop.

## Pages

- `/`: service outcomes, the team's track record, solution areas, how AI uses a
  register under the institution's rules, an example journey, ownership and
  reuse, the open-source/commercial relationship and technical evaluation paths.
- `/solutions/` and `/solutions/<area>/`: service-specific problems, capabilities,
  examples, relevant configurations and next steps.
- `/solutions/local-government/`: municipal services and an implementation path.
- `/ai/`: orientation among three uses: service design, implementation and
  citizen access, with scoped institutional control and routes to detail.
- `/products/studio/`: authoring and review of registry and service definitions,
  document-assisted drafting in the local prototype, handover and availability.
  Distinguish Studio's commercial terms from the core runtime licence.
- `/ai/service-design/`: a design method and an example school enrolment
  brief with scenarios for the implementation team to test.
- `/customization/`: scoped implementation, an example of adapting a service,
  how each change is tested before release, how AI is used in a pilot and
  Registry Studio in development.
- `/ai/citizen-access/`: access through an assistant the institution approves,
  available in a pilot, what the assistant can and cannot do, a documented
  handoff to the institution's review and submission page, and the Preview
  stability note in its FAQ and technical note.
- `/architecture/headless/`: connect your own interface through documented APIs
  or use an optional assistant channel for selected operations.
- `/digital-public-infrastructure/`: the choice to connect an existing source or
  establish a register, one facility example, and delivery and operating choices.
- `/data-spaces/`: participant roles, authoritative registers, API mappings and
  signed answers, with separate responsibilities for the space and its connector.
- `https://marketplace.registrystack.org/`: configuration browsing, model detail
  and access requests; the seven service categories link to matching collections.
- `/starters/`: a compatibility handoff to the seven marketplace collections.
- `/starters/<id>/`: versioned reference models retained during migration, with
  current configuration and access requests linked to the matching marketplace pack.
- `/products/base-registry/`, `/products/evidence-gateway/` and
  `/products/casework/`: component capabilities, boundaries and tutorials.
- `/pricing/`: implementation and support prices, responsibilities, inquiry and
  the open-source self-service option.
- `/security/` and `/faq/`: questions that affect evaluation and adoption.
- `/blog/`: published field guides, with historical notices on retired product
  material and an RSS feed at `/rss.xml`.

Keep former routes as redirects in `astro.config.mjs`. `/ai/` serves the AI
overview and links to `/customization/` for the implementation offer. `/pilot/`
preserves known section links into `/pricing/` and has a no-JavaScript fallback.
Historical plans do not override this structure.

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
The wire protocol stays version 2. New acceptances use persisted consent version 3,
which distinguishes fresh initialization from older saved acceptance. A coherent,
confirmed version 2 device continues with its original preference and expiry;
older acceptance without that device asks for a choice again before loading the
tracker. Refusals and unknown choices retain the compatible version 2 format.
Enquiries remain available without optional tracking or visit-history linking.
Other frames observe the change, and suspended pages check again on return. Browser DNT
and GPC signals keep Mautic tracking off. Umami remains separate aggregate
analytics and covers outbound links to documentation, demos and GitHub. Internal
website/documentation handoffs do not add acquisition UTMs. The bridge also
ignores the earlier internal handoff tuple in links from released pages.

The bridge accepts only the exact main website, documentation and separately
enrolled marketplace origins. Only the main website can request an identifier,
immediately before a form submission.
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
actual sites across the complete browser matrix. Set `MARKETPLACE_TRACKING_DIST` to a tracking-enabled canonical marketplace
build to exercise its separate enrollment. `TRACKING_SCENARIO=marketplace-enrollment`
selects that one journey for diagnosis; leave it unset for the final full run.
The website and docs copies of `shared-tracking-client.mjs` and
`tracking-protocol.mjs` must stay identical.

`node scripts/check-shared-tracking-mautic.mjs` provides optional native
acceptance against fresh, disposable `mautic/mautic:7.2.1-apache` and
`mysql:8.4.13` containers. It requires Docker, OpenSSL, Playwright Chromium,
an installed loopback-only Mautic instance with `null://null` mail, no
campaigns or form actions, and empty email queues. Set `MAUTIC_TEST_CONTAINER`,
`MAUTIC_TEST_MYSQL_CONTAINER`, and `MAUTIC_TEST_URL=http://127.0.0.1:<port>`.
`SHARED_TRACKING_TEST_SCRATCH` selects where browser artifacts are retained.
The fixture creates synthetic forms and contacts and consumes only the hit
queue. Never use production or a restored production database for this check.

## Marketplace route cutover

The default build retains indexable legacy references. Set neither migration
variable for this publication mode. `npm run check:marketplace` verifies every
legacy route, its individual catalogue content, and seven collection handoffs.

The optional cutover replaces the index and all 84 details with exact destination
documents. It requires both `PUBLIC_MARKETPLACE_MIGRATION_ENABLED=true` and an
explicit `MARKETPLACE_INDEXING_DECISION`:

- `require-indexable`: audit all destination responses, canonicals and indexing
  directives before building. Nonempty robots exclusions require manual review.
- `accept-current-noindex`: deliberately accept that the destination blocks
  indexing. This is a search-discoverability tradeoff, not an indexing fix.

The workflow reads these optional repository variables; it does not set them.
Do not enable cutover accidentally while the marketplace is blocked from search.
The default keeps current navigation going to the marketplace without retiring
searchable reference routes. Resolve indexing with the marketplace owner before
choosing the indexed cutover path.

GitHub Pages serves static HTML, so these are script/HTML-refresh redirects with
visible fallbacks, not HTTP 301 responses. Known category bookmarks map to their
collections with JavaScript; no-JavaScript category arrivals fall back to the
marketplace index. Redirect verification checks exact pack destinations and
supported fragments. The migrated routes leave the sitemap. No indexing setting
on the marketplace is changed by this build.

## GitHub Pages

The workflow installs locked dependencies and Chromium and runs `npm run check`
for pull requests and changes to `main`. The build uses read permissions;
publication permissions belong only to the deploy job, which runs on `main`.
The Pages source is GitHub Actions and `public/CNAME` preserves the custom domain.
