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
    intent: 'Keep your register’s records and history',
    description: 'Base Registry Engine keeps your register and its history of changes. It applies your access rules. It is open source and connects to your public services.',
    href: '/products/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'You create a local contact registry, add one contact and read it back, then confirm a caller from another jurisdiction cannot list it.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', solution: 'Evidence Gateway', shortName: 'Evidence', featured: true, menu: true,
    intent: 'Let services you authorise check your register',
    description: 'Evidence Gateway lets services you authorise check your register. They get the agreed answer, not the whole record. A digital signature shows the issuer.',
    href: '/products/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'You inspect the predefined adult-status project, request its signed answer from a synthetic source and verify the JWS response.',
  },
  {
    key: 'casework', name: 'Registry Casework', solution: 'Casework', shortName: 'Casework', featured: false, menu: true,
    intent: 'Assign reviews to staff and record decisions',
    description: 'Registry Casework assigns requests to staff for review, tracks due dates and records decisions. It is open source and connects to your public services.',
    href: '/products/casework/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/review-breg-changes-in-casework/',
    tutorialLabel: 'Read the review integration tutorial',
    firstResult: 'Prepare and validate configuration for a proposed register change that requires staff review.',
  },
  {
    key: 'render', name: 'Registry Render', solution: 'Licence documents', shortName: 'Render', featured: false, menu: true,
    intent: 'Generate and digitally sign PDF documents',
    description: 'Registry Render makes PDF licences and certificates from data you send and templates you approve. It can add your digital seal and an optional timestamp.',
    href: '/products/render/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-render-document/',
    tutorialLabel: 'Run the document tutorial',
    firstResult: 'Generate a sample letter locally, then request the document over HTTP.',
  },
  {
    key: 'messaging', name: 'Registry Messaging', solution: 'Service notices', shortName: 'Messaging', featured: false, menu: true,
    intent: 'Send approved email and SMS notices',
    description: 'Registry Messaging sends approved email or SMS notices through the provider you configure. It records each request. Staff can follow the dispatch status.',
    href: '/products/messaging/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-messaging/',
    tutorialLabel: 'Run the messaging tutorial',
    firstResult: 'Send a template-based notice through a local mock provider and inspect its status.',
  },
] as const;

// Additional parts used in service examples. They keep a documentation
// destination rather than requiring a marketing page for each component.
export const companionServices = [
  {
    key: 'scheduling', name: 'Registry Scheduling',
    job: 'defines capacity, holds and appointment-booking rules',
    href: 'https://docs.registrystack.org/start/scheduling/',
    status: 'released',
  },
  {
    key: 'manifest', name: 'Registry Manifest',
    job: 'publishes what the register holds as a catalogue other services can read',
    href: 'https://docs.registrystack.org/products/registry-manifest/',
    status: 'released',
  },
] as const;
