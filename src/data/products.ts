// Shared names and evaluation destinations. The tutorials own install details.
export const products = [
  {
    key: 'base-registry', name: 'Base Registry Engine', shortName: 'Base Registry Engine', featured: true,
    intent: 'Build and run a registry',
    description: 'Store and manage records about people, households, organizations, and assets, with your rules for access, data quality, and changes.',
    href: '/solutions/base-registry/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-breg/',
    tutorialLabel: 'Run the registry tutorial',
    firstResult: 'Create and update a sample business record, then try a request that should be refused.',
  },
  {
    key: 'protected-registry-apis', name: 'Registry Relay', shortName: 'Relay', featured: false,
    intent: 'Share selected data',
    description: 'Publish selected data from an existing registry. Choose the fields each service can receive.',
    href: '/solutions/protected-registry-apis/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/publish-governed-sqlite-registry/',
    tutorialLabel: 'Run the Relay tutorial',
    firstResult: 'Read two permitted fields, try a forbidden field, and inspect the audit record.',
  },
  {
    key: 'evidence-gateway', name: 'Evidence Gateway', shortName: 'Evidence', featured: true,
    intent: 'Let services check a fact',
    description: 'Return verifiable answers about age, residence, registration status, and other defined facts without sharing the full source record.',
    href: '/solutions/evidence-gateway/',
    tutorialHref: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/',
    tutorialLabel: 'Run the evidence tutorial',
    firstResult: 'Request a signed adult-status answer from a synthetic source, then verify its signature.',
  },
] as const;
