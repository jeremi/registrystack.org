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
    intent: 'Maintain records and their history',
    description: 'Open-source software to build and run a base registry: define the records, control who may change them, keep a history, and serve other applications.',
    href: '/products/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'Create a local contact registry, add and read one contact, then confirm that a caller from another jurisdiction cannot list it.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', solution: 'Evidence Gateway', shortName: 'Evidence', featured: true, menu: true,
    intent: 'Let authorized services check register information',
    description: 'Give approved services a signed answer to a defined question from your register, without handing over the record. Open-source software.',
    href: '/products/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'Inspect the predefined adult-status project, request its signed answer from a synthetic source, and verify the JWS response.',
  },
  {
    key: 'casework', name: 'Registry Casework', solution: 'Casework', shortName: 'Casework', featured: false, menu: true,
    intent: 'Assign reviews and record staff decisions',
    description: 'Assign requests to staff, track due dates and record their decisions. Open-source review software that connects to your register.',
    href: '/products/casework/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/review-breg-changes-in-casework/',
    tutorialLabel: 'Pair a registry proposal with Casework',
    firstResult: 'Pair a registry Proposal Action with a Casework review policy and bind Casework as its review authority.',
  },
] as const;

// Supporting parts around the three products. Each has docs, not a product
// page: the home page names them once under the product cards, and a
// register family's working week labels the step a service does. `job` is
// the one line the home page prints. `status` prevents documented development
// work from being presented as a released product.
export const companionServices = [
  {
    key: 'render', name: 'Registry Render',
    job: 'returns same bytes when package hash, document type, locale, canonical data and issuedAt match; callers retain hashes',
    href: 'https://docs.registrystack.org/start/registry-render/',
    status: 'released',
  },
  {
    key: 'messaging', name: 'Registry Messaging',
    job: 'delivers an approved email or SMS template when an authorized service requests it',
    href: 'https://docs.registrystack.org/start/messaging/',
    status: 'released',
  },
  {
    key: 'scheduling', name: 'Registry Scheduling',
    job: 'defines capacity, holds and appointment-booking rules',
    href: 'https://docs.registrystack.org/reference/scheduling-configuration/',
    status: 'development',
  },
  {
    key: 'manifest', name: 'Registry Manifest',
    job: 'publishes what the register holds as a catalogue other services can read',
    href: 'https://docs.registrystack.org/products/registry-manifest/',
    status: 'released',
  },
] as const;
