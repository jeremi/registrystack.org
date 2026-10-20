// Shared names and evaluation destinations. The tutorials own install details.
// `name` is the product and the label the Products menu, footer, and page
// title use. `solution` is a shorter outcome label for the developer tutorial
// headings; the solution areas the site leads with live in solutions.ts.
// `featured` marks the two flagship products the homepage leads with. The
// Products menu lists every product, so `menu` is not read by the site.
export const products = [
  {
    key: 'base-registry', name: 'Base Registry Engine', solution: 'Base registry', shortName: 'Base Registry Engine', featured: true, menu: true,
    intent: 'Build and run a base registry',
    description: 'Store and manage records about people, households, organizations, and assets, with your rules for access, data quality, and changes.',
    href: '/products/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'Create and update a sample business record, then try a request that should be refused.',
  },
  {
    key: 'protected-registry-apis', name: 'Registry Relay', solution: 'Protected registry APIs', shortName: 'Relay', featured: false, menu: false,
    intent: 'Share selected data',
    description: 'Publish selected data from an existing registry. Choose the fields each service can receive.',
    href: '/products/registry-relay/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/publish-governed-sqlite-registry/',
    tutorialLabel: 'Run the Relay tutorial',
    firstResult: 'Read two permitted fields, try a forbidden field, and inspect the audit record.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', solution: 'Evidence Gateway', shortName: 'Evidence', featured: true, menu: true,
    intent: 'Let services check a fact',
    description: 'Return verifiable answers about age, residence, registration status, and other defined facts without sharing the full source record.',
    href: '/products/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'Request a signed adult-status answer from a synthetic source, then verify its signature.',
  },
  {
    key: 'casework', name: 'Registry Casework', solution: 'Casework', shortName: 'Casework', featured: false, menu: true,
    intent: 'Coordinate human decisions',
    description: 'Give the staff who review requests one accountable inbox: who holds each item, what is due, and who decided.',
    href: '/products/casework/',
    tutorialHref: 'https://docs.registrystack.org/start/casework/',
    tutorialLabel: 'Read the Casework overview',
    firstResult: 'See what runs where, how work reaches the inbox, and which guide to open next for your role.',
  },
] as const;
