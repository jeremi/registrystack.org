// Shared names and evaluation destinations. The tutorials own install details.
// `name` is the product and the label the Products menu, footer, and page
// title use. `solution` is a shorter outcome label for the developer tutorial
// headings; the solution areas the site leads with live in solutions.ts.
// `description` is the product page's search snippet, under 155 characters.
// `featured` marks the two flagship products, which lead the menus and the
// homepage developer section. The Products menu lists every product, so
// `menu` is not read by the site.
export const products = [
  {
    key: 'base-registry', name: 'Base Registry Engine', solution: 'Base registry', shortName: 'Base Registry Engine', featured: true, menu: true,
    intent: 'Build and run a base registry',
    description: 'Open-source software to build and run a base registry: define the records, control who may change them, keep a history, and serve other applications.',
    href: '/products/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'Create and update a sample business record, then try a request that should be refused.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', solution: 'Evidence Gateway', shortName: 'Evidence', featured: true, menu: true,
    intent: 'Let services check a fact',
    description: 'Give approved services a signed answer to a defined question from your register, without handing over the record. Open-source software.',
    href: '/products/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'Request a signed adult-status answer from a synthetic source, then verify its signature.',
  },
  {
    key: 'casework', name: 'Registry Casework', solution: 'Casework', shortName: 'Casework', featured: false, menu: true,
    intent: 'Coordinate human decisions',
    description: 'One queue for the changes that need a person to decide: who holds each item, what is due and who decided. Open source, works with your register.',
    href: '/products/casework/',
    tutorialHref: 'https://docs.registrystack.org/start/casework/',
    tutorialLabel: 'Read the Casework overview',
    firstResult: 'See what runs where, how work reaches the inbox, and which guide to open next for your role.',
  },
] as const;
