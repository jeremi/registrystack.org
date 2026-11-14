# registrystack.org

Static Astro site for `registrystack.org`, the public website for Registry Stack.
Contributors follow [AGENTS.md](AGENTS.md).

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
digest. The local detail pages are versioned reference snapshots; current
configuration access belongs to the marketplace. Catalogue metadata does not
establish current download availability. Do not regenerate it for a prose edit.

Starter summaries come from the upstream `display.description`; technical
identifiers belong in expandable details. The shared starter wording and archive
handoffs are covered by tests.

### Website enquiries

The shared inline form covers website contact invitations. Current configuration
access requests belong to the marketplace; archived reference pages link there. Set this public build variable to the exact HTTPS route for the unlinked
native Mautic form:

```sh
PUBLIC_STARTER_REQUEST_ENDPOINT='https://mautic.example.org/form/submit?formId=1&privacy=kiosk'
```

When the variable is unset, the contact flow shows email recovery. The form
works without accepting visit tracking and records the canonical source page,
a bounded request type and short page-specific context. The current contact
form leaves `starter_id` blank. Legacy starter-type invitations can retain
catalogue context; this compatibility is not permission to restore archive
forms. Archived detail pages send configuration access to the exact marketplace
pack. See [server/README.md](server/README.md) for the two Mautic forms, narrow
proxy routes, deployment and verification setup.

All general contact links use `src/data/contact.ts`. `describeServiceHref`
invites the service, its users and the result needed. `askQuestionHref` supports
a lighter question. The pricing inquiry includes optional budget and timing.
Print the email address beside mailto buttons so readers without an email app
can still contact the team. The header Contact link opens the general contact page.

The old `/starters/` index offers seven collection handoffs. Its 84 detail pages
remain indexable reference snapshots, labelled with their catalogue version and
linked to the exact current marketplace configuration. They do not collect
requests for the archived model. Do not change live marketplace indexing as
part of website content work. Preserve no-JavaScript and reduced-motion access.

Preserve the civic-print design: civic-blue cover, quiet paper backgrounds,
Public Sans and IBM Plex Mono, ink text, stamp red and restrained brass on dark
backgrounds. Keep readable text, visible focus, adequate link targets and
layouts that work from mobile through desktop.

## French localization

French pages live in `src/pages/fr/` under the same slug as their English page,
so `/pricing/` becomes `/fr/pricing/`. `src/i18n.ts` lists the English paths
that have a French version (`frenchPagePaths`) and provides the helpers:
`localeForPath`, `localizedPath`, `alternatePaths`, `englishHreflang` and
`translator`. Pages not in that list (starters, marketplace, blog, legal pages,
pilot, 404 and the docs) stay English.

- `Base.astro` sets `<html lang>`, the canonical URL and reciprocal `hreflang`
  alternates (`en`, `fr`, and `x-default` pointing to English) for every listed
  page, and switches the default title, description and social image
  (`public/og-image-fr.png`, built by `npm run build:og`) on French pages.
- Shared components read the locale from `Astro.url.pathname` and pick their
  wording with `t(english, french)`. French data lives in `src/data/fr/`: same
  keys, slugs and links as the English data, with every reader-facing text
  translated. `tests/french-data.test.mjs` enforces that parity.
- The header's language switch leads to the same page in the other language.
  An English page without a French version leads to `/fr/`. There is no
  automatic redirect by browser language.
- On French pages, internal links go to the French page when one exists
  (`localizedPath`). A link to an English page or an English outside site
  carries `hreflang="en"` and says "(en anglais)" in its text.
- French typography uses the typographic apostrophe (’), guillemets « » and a
  no-break space before `:` `;` `?` `!` and inside guillemets.
- Contact links pass the locale (`describeServiceHref(context, 'fr')`) and lead
  to `/fr/contact/`; the email fallback is then written in French.

`npm run check:french` (part of `npm run check`, after a build) checks every
listed pair: `lang`, one canonical, the alternates, one `h1`, the language
switch, French link destinations and fragments, labelled English links, no
English wording left from the shared components, and no horizontal overflow
on a phone or desktop screen. It names each French page that is not built.

## Pages

Routes, navigation and solution and product memberships live in
`src/data/solutions.ts`, `src/data/products.ts`, `src/components/SiteHeader.astro`
and `src/components/SiteFooter.astro`. Redirects live in `astro.config.mjs`.

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

`npm run report:repetition` lists sentences and phrases repeated across the
built pages in `dist/`; run it after a build. It only reports and is not part of
`npm run check`.

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
