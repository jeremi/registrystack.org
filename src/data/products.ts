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

// The released parts around the three products. Each has docs, not a product
// page: the home page names them once under the product cards, and a
// register family's working week labels the step a service does. `job` is
// the one line the home page prints, in the office's words.
export const companionServices = [
  {
    key: 'render', name: 'Registry Render',
    job: 'prints a certificate, extract or letter from the register, identical every time',
    href: 'https://docs.registrystack.org/start/registry-render/',
  },
  {
    key: 'messaging', name: 'Registry Messaging',
    job: 'sends the email or SMS notice an officer’s decision calls for',
    href: 'https://docs.registrystack.org/start/messaging/',
  },
  {
    key: 'scheduling', name: 'Registry Scheduling',
    job: 'books counter slots and appointments',
    href: 'https://docs.registrystack.org/reference/scheduling-configuration/',
  },
  {
    key: 'manifest', name: 'Registry Manifest',
    job: 'publishes what the register holds as a catalogue other services can read',
    href: 'https://docs.registrystack.org/products/registry-manifest/',
  },
] as const;
