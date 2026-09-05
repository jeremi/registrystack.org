# Registry Stack public website guidance

This repository owns the public website for organizations evaluating Registry
Stack. Read the [README audience and editorial direction](README.md#audience-and-editorial-direction)
before writing or reviewing pages, navigation, calls to action, or metadata.
It is the maintained audience policy for this site.

## Audience and review

- Address organizations managing registries. Government is the current primary
  focus and source of examples; general explanations also apply to other
  organizations, including NGOs and banks.
- Write primarily for decision makers, programme and service owners, data
  stewards, and governance teams. Technical evaluators and implementers are an
  important secondary audience. Developer experience is a product requirement;
  it does not set the default audience for public website content.
- Lead with the reader's problem, practical outcomes, fit with existing
  systems, and adoption decisions. Explain technical concepts when they help
  that decision; route implementation instructions to the documentation.
- Review entry pages as a programme or service owner without implementation
  knowledge: can they understand why this matters, whether it fits their needs,
  and what to do next? For a page serving a narrower audience, check that its
  purpose and route from the wider site are clear.
- Keep sector examples and claims grounded. A possible application does not
  establish a deployment, compliance claim, or readiness for that sector.

## Sources and scope

Use the README for site structure and commands, current site source for routes,
and maintained public product docs for behavior claims. Older site plans are
historical where they conflict with current maintained guidance. Keep private
planning, deployment details, and review findings out of public content.

## Verification

Use `npm` and the applicable checks in `package.json`. Automated content checks
cover selected copy and structural rules, not whether the writing suits its
audience. Perform the reader review as well.
Use the broader `npm run check` for changes affecting site behavior or layout.
For guidance-only edits, review wording, links, and the diff without requiring
a site build or visual checks.
