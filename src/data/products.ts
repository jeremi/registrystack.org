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
    description: 'Maintain your register, control access and keep a history of changes. Open-source software that connects to your public services.',
    href: '/products/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'Create a local contact registry, add and read one contact, then confirm that a caller from another jurisdiction cannot list it.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', solution: 'Evidence Gateway', shortName: 'Evidence', featured: true, menu: true,
    intent: 'Let authorized services check register information',
    description: 'Let authorized services check information from your register. Return only the agreed answer, with a digital signature identifying the issuer.',
    href: '/products/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'Inspect the predefined adult-status project, request its signed answer from a synthetic source, and verify the JWS response.',
  },
  {
    key: 'casework', name: 'Registry Casework', solution: 'Casework', shortName: 'Casework', featured: false, menu: true,
    intent: 'Assign reviews and record staff decisions',
    description: 'Assign requests to staff, track due dates and record their decisions. Open-source review software that connects to your public services.',
    href: '/products/casework/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/review-breg-changes-in-casework/',
    tutorialLabel: 'Read the review integration tutorial',
    firstResult: 'Prepare and validate configuration for a proposed register change that requires staff review.',
  },
  {
    key: 'render', name: 'Registry Render', solution: 'Licence documents', shortName: 'Render', featured: false, menu: true,
    intent: 'Generate PDF documents from approved templates',
    description: 'Generate licence documents and certificates from supplied data and reviewed templates. Registry Render produces PDF files for your service.',
    href: '/products/render/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-render-document/',
    tutorialLabel: 'Run the document tutorial',
    firstResult: 'Generate a sample letter locally, then request the document over HTTP.',
  },
  {
    key: 'messaging', name: 'Registry Messaging', solution: 'Service notices', shortName: 'Messaging', featured: false, menu: true,
    intent: 'Send approved email and SMS notices',
    description: 'Send approved email or SMS notices through your configured provider. Record each request and follow its dispatch status.',
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
