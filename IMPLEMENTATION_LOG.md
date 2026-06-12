# Registry Stack site implementation log

## Pitfalls and decisions

- `https://lab.registrystack.org/` failed TLS verification locally, and
  `http://lab.registrystack.org/` returned `404`. The homepage omits the live
  lab CTA for v1. Add the lab link after the hosted lab is reachable with a
  valid certificate.
- The visual tokens follow `registry-docs/src/styles/custom.css`, but the
  docs blue `#000091` is intentionally replaced with `#173b7a` for a globally
  neutral public-sector accent.
- Technical snippets were selected from current Registry Relay and Registry
  Notary docs and code during the earlier technical proof pass:
  - `GET /v1/datasets/{dataset_id}/entities/{entity}/records`
  - `claim: person-is-alive`
  - `disclosure: predicate`
  - `audit: redacted, tamper-evident`
  They are no longer rendered on the homepage because the main persona is
  country digital teams and delivery partners; technical depth belongs in the
  docs.
- The first implementation placed API and claim snippets in the hero. User
  review caught that this was too technical for the primary audience. The hero
  now leads with country adoption and service-delivery outcomes, with technical
  details pushed to the docs.
- The page rhythm was adjusted after reviewing examples from MOSIP/Inji-style
  institutional infrastructure pages and DIGIT: short centered hero, proof
  strip, principles, simple stack diagram, ecosystem fit, and adoption path.
- A later review and user correction found the homepage still felt too
  technical, even with snippets lower on the page. The main story now removes
  code snippets and product/component names, uses an implementation handoff near
  the end, and links technical reviewers to the docs.
- Header and footer links now have at least 36px rendered touch targets, and
  the visual check enforces that target size across mobile, tablet, and desktop.
- A reviewer found an axe `landmark-complementary-is-top-level` warning caused
  by a hero `<aside>` inside `<main>`. The hero proof panel is now ordinary
  section content, and the accessibility script now fails on any axe violation.
- Contact links are intentionally checked: the pilot CTA must include
  `mailto:jeremi@joslin.fr`, and mailto addresses must match a basic
  email-address shape.
- Browser QA scripts must serve `dist/` over local HTTP. Opening
  `dist/index.html` through `file://` does not load Astro's absolute CSS asset
  paths and produces false layout failures.
- `npm install` completed but reported five moderate vulnerabilities in
  dev-tooling transitive dependencies under `@astrojs/check` /
  `yaml-language-server`. `npm audit --omit=dev` reports zero runtime
  vulnerabilities. No forced audit fix was applied because that would introduce
  breaking dependency changes outside the requested site implementation.
- A 2026-06-10 review reversed the "no product names on the homepage" decision.
  The products were invisible until the footer, and what product detail leaked
  through was Relay-heavy, the inverse of the intended priority. The homepage
  now presents Registry Notary, Registry Relay, and Registry Manifest in that
  priority order, with policy-friendly one-liners and small concrete artifacts
  (a credential card, a file-to-API flow, a manifest-to-standards fan-out)
  instead of code. Dedicated `/notary/`, `/relay/`, and `/manifest/` pages carry
  the depth; the audience remains program and policy people, so code still
  stays in the docs.
- The hosted lab is now reachable with a valid certificate, so the primary CTA
  on the homepage and product pages is `https://lab.registrystack.org/` (the
  wallet test and service anchors). `check-links.mjs` verifies the lab on every
  build and falls back to GET because the lab returns `501` to HEAD requests.
- `check-content.mjs` no longer pins exact copy strings; that made every copy
  edit a two-file change and encoded stale policy (it banned product names and
  the lab link). It now enforces invariants only: the banned-term and em-dash
  sweep over all pages and components discovered from the filesystem, the
  plain-language hero guardrail, the Notary-Relay-Manifest priority order, nav
  and handoff wiring, and the OG image. Where the older spec documents disagree
  with the site, the site and the check scripts are current.
- The QA static server in `check-a11y.mjs` and `check-visual.mjs` wrote a 200
  header before reading the file, so any request that failed mid-read (for
  example `/notary/` resolving to a directory) crashed Node with
  `ERR_HTTP_HEADERS_SENT`. It never surfaced while only `/` was checked. Both
  servers now resolve trailing-slash paths to `index.html` and read before
  writing headers; a11y and visual checks now cover all four key pages.

## 2026-06-10 (later): tone pass and status-page removal

- Removed the "Where it stands" sections from the product pages and the
  `/status/` page and nav item. Versioning and maturity notes belong in the
  docs and the product repositories; the site states what each product does
  and builds on, in positive terms.
- Replaced per-product status/boundary splits with "Open by design" sections
  carrying the same factual content (standards, formats, where authority
  stays) stated affirmatively.
- Homepage: removed the seven-item "Not a ..." boundaries section (the
  ecosystem section already carries the complementary-not-competitive
  message), warmed the hero lead with a concrete human outcome, and made the
  "who benefits" heading declarative.
- `/why/`: reframed "What this is not" as "Division of labour", same facts as
  affirmative statements about where institutional responsibility stays.
- check-content.mjs: `/status/` removed from required routes; maturity
  self-deprecation terms added to the forbidden list so they cannot return.

## 2026-06-10 (evening): civic-print redesign and homepage restructure

- Homepage cut from twelve sections to seven: cover hero, works-with strip,
  products, a "why it matters" divider band, the operating model, use cases
  with the funnel, a "built in the open" proof band, and the closing CTA.
  The "who benefits" grid, problem cards, ecosystem tile grid, and adoption
  split moved into the claim band copy or onto their dedicated pages.
- "One registry source, many bounded answers" moved from the homepage to
  `/relay/`, where the component belongs.
- New visual identity ("civic print"): the hero is set like the cover of the
  Registry Stack brief (civic blue, brass accent bar, extra-bold white type),
  inner pages get quiet paper heroes with security-print arcs, section
  eyebrows carry stamp-red register numbers, the claim band is a tinted
  divider with a pill label, and a circular SVG seal (`RegistrySeal.astro`)
  overlaps the hero answer card. All motifs are CSS/SVG, no licensed assets.
- Palette: teal accent retired everywhere in favour of the civic blue family;
  brass (`--registry-brass`) added for dark bands, stamp red
  (`--registry-stamp`) for seals and register numbers, paper tones for
  backgrounds.
- Proof band states the honest evidence: open source end to end, the hosted
  lab as a live demo, credential and catalog standards (SD-JWT VC over
  OpenID4VCI as used by the European Digital Identity Wallet ecosystem,
  DCAT-AP, SP-DCI, GovStack Digital Registries pattern), and contributor
  participation in GovStack and DCI standards work. The once-only principle
  anchors the policy framing.
- check-content.mjs: hero guardrail regex now tolerates hero modifier
  classes (`hero hero-cover`).
- Full `npm run check` green: 8 pages, links, axe (0 violations on 4 pages),
  visual/keyboard, funnel, and hero checks all pass.

## 2026-06-10 (late evening): audit-round refinements

- Hero cover simplified after review: brass accent bar dropped, security-print
  arc patterns removed from all bands (hero, proof band, CTA), every band is
  now a solid color. The seal shrank to 110px, lost its translucent backing
  disc, and anchors to the answer card's top-right corner instead of floating
  in the hero column.
- Closing CTA restyled from civic blue to the amber divider tint so the two
  tinted bands bookend the page and it no longer ends on two stacked dark
  bands.
- Works-with strip rebuilt as a centered row of even chips; operating-model
  flow arrows enlarged to be visible.
- Proof band's standards column shortened; the credential-format detail moved
  to a mono fact line.
- Teal verified gone: a computed-style scan across all elements on all eight
  built pages found zero colors in the green/teal hue family; the last true
  remnant was the OG image template (`scripts/build-og.mjs`), now on the blue
  and stamp-red palette with the image regenerated.
- Copy: products heading now "Three products. Adopt one, or compose them.";
  the proof-band intro carries one idea per sentence (once-only principle,
  then the alignment claim). README identity paragraph updated to match the
  current design.
- Full `npm run check` green after each pass.

## 2026-06-10 (night): harness diagram and the /ai/ page

- New `HarnessDiagram.astro`, adapted from the brief's "answering point"
  figure: asker (never sees the record), dashed stewardship boundary around
  the answering point and the registry, question arrow in civic blue, signed
  minimized answer arrow in stamp red, audit-trail bar beneath. Two variants:
  the homepage maps the three checks onto Relay, Manifest, and Notary; the
  /ai/ variant names the open standards (ODRL, SHACL, CCCEV) and foregrounds
  the automated asker. HTML/CSS, no SVG transform attributes, role="img"
  with a full text alternative.
- The homepage operating-model section now carries the harness diagram in
  place of the three-node flow boxes (the flow-diagram styles remain in use
  on the product pages).
- /why-now/ became /ai/: AI-forward title ("A harness for AI in public
  services"), harness framing, the housing-benefit worked example
  (copy-the-records vs ask-the-question), the review-questions list, and the
  retained "not an AI product" section. A static stub at public/why-now/
  redirects with meta refresh, canonical to /ai/, noindex. Positioning is
  unchanged (AI as context); the packaging now carries the keyword.
- Nav label "Why now" is now "AI"; footer link "AI in public services"; the
  homepage proof-band link reads "Give AI agents answers, not records".
  Top-nav links gained min-width 36px so the two-letter label keeps an
  accessible tap target.
- check-content.mjs requires the /ai/ route from the homepage and the
  HarnessDiagram on both the homepage and /ai/ (written before the
  implementation, red then green).
- Full `npm run check` green: 9 HTML files, axe 0 violations, visual,
  funnel, hero.

## 2026-06-10 (late night): divider bands recolored to pale civic blue

Jeremi flagged the tinted divider bands as reading "teal" on his display.
The khaki/cream tint family is gone from the site:

- `.claim-band` and `.final-cta` backgrounds: #efe3c9 -> #dbe4f3, the pale
  civic-blue divider tint from the concept-note brief's `.d-blue` band.
- Band body text: #4a3a12 (dark amber) -> #26375c (the brief's navy lead
  color on that tint).
- The record-slip dashed border (`.product-artifact`) and the harness audit
  bar border: #c4bca2 (khaki) -> #c2cce0 (blue-gray), so no khaki-family
  color remains anywhere.
- The funnel's transient amber "deny" flash (#f4ecd6, amber-keyed) is
  unchanged.
- Full `npm run check` green after the change; both bands screenshot-verified
  from the built site.

## 2026-06-10 (later): situation-routed homepage and per-product harness placement

Jeremi stepped back to information hierarchy: a new visitor cannot pick
between Notary, Relay, and Manifest, because choosing requires already
understanding the architecture. Decisions (via AskUserQuestion): structure A
(situation-routed home), steward-led voice with the service side
acknowledged.

- Homepage No. 01 is now "Where you start": three doors headed by the
  steward's own sentence ("Services keep asking us to send the whole
  record." / "Our registry lives in a spreadsheet someone emails around." /
  "Partners cannot tell what our registry holds, or what the fields mean."),
  each resolving to its product ("That's Registry Notary") with the artifact
  slips retained. Door order keeps the Notary -> Relay -> Manifest invariant.
  A muted aside under the grid routes the service side to /use-cases/.
- The claim band moved above the doors, so problem recognition precedes any
  product name. Section rhythm: hero, strip, claim band (tint), doors
  (muted), operating model (white), use cases (muted), proof (navy), CTA.
- The home harness diagram dropped its product tags: one story (ask, checks,
  signed answer, record never leaves). HarnessDiagram gained a `highlight`
  prop: the highlighted check is bold and tagged with its product name, the
  other two dim to muted.
- Each product page gained an "In the stack" section just before the docs
  handoff, with its highlighted harness variant (notary/manifest white,
  relay muted, to keep each page's alternation). The per-product
  "How it works" flow diagrams were kept: they show internal steps, the
  harness shows position; .product-role styles removed as unused.
- check-content.mjs now requires `HarnessDiagram highlight="<product>"` on
  each product page (written first, red with 3 failures, then green).
- Full `npm run check` green; doors, home harness, and relay/notary
  highlight sections screenshot-verified from the built site.

## 2026-06-10 (later still): de-duplicating No. 02 and No. 03

Jeremi: "isn't No. 03 mostly repeating No. 02?" It was; the mechanism was
stated four times in a row. Two cuts:

- The "Controlled requests / Narrow answers / Reviewable trail" card grid
  under the harness diagram is gone; No. 02 is heading + diagram.
- The MinimizationFunnel left the homepage; it stays on /use-cases/, where
  it was already present. No. 03 on the home is now the four domain cards
  plus the gallery link: pure recognition, no second mechanism diagram.
- check-funnel.mjs now runs the funnel assertions against /use-cases/, keeps
  the four-badge grid and farmer-card assertions on the homepage, and
  asserts the homepage carries no funnel figure (written first, red, then
  green after the cuts).
- Full `npm run check` green; trimmed sections screenshot-verified.
