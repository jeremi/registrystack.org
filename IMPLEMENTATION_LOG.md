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
  `mailto:hello@registrystack.org`, and mailto addresses must match a basic
  email-address shape.
- Browser QA scripts must serve `dist/` over local HTTP. Opening
  `dist/index.html` through `file://` does not load Astro's absolute CSS asset
  paths and produces false layout failures.
- `npm install` completed but reported five moderate vulnerabilities in
  dev-tooling transitive dependencies under `@astrojs/check` /
  `yaml-language-server`. `npm audit --omit=dev` reports zero runtime
  vulnerabilities. No forced audit fix was applied because that would introduce
  breaking dependency changes outside the requested site implementation.
