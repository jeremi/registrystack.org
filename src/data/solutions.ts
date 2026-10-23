// The solution areas the site is organized by. A register family groups the
// starters a reader would recognize as the same kind of work; the two
// cross-cutting areas describe work every register family shares.
//
// `starters` lists the ids from the published starters catalogue
// (src/data/starters.json). Every active starter belongs to exactly one
// register family; the content check enforces that. `products` names the
// product pages the area leads to, by key from products.ts. `pageTitle` is
// the HTML title of the area page, worded the way a reader searches for it;
// `name` is what the menus and the page itself show. `featuredStarter`, when
// a register family names one, is the starter it suggests first: the one its
// page's example is about, and the one the starters work concentrates on. It
// must be one of the family's `starters`; the content check enforces that. A
// family with no single starter to open first can name several in
// `openFirst`, listed before the rest and labeled; the content check enforces
// that each is one of the family's `starters`. A family naming neither lists
// its starters in the order given and highlights none.
export interface SolutionArea {
  key: string;
  slug: string;
  name: string;
  pageTitle: string;
  intent: string;
  kind: 'register-family' | 'cross-cutting';
  starters: readonly string[];
  featuredStarter?: string;
  openFirst?: readonly string[];
  // The institutions the family is for, shown on its card.
  audience?: string;
  // The search snippet for the family page, under 155 characters.
  description?: string;
  products: readonly string[];
}

export const solutionAreas: readonly SolutionArea[] = [
  {
    key: 'licensing',
    slug: '/solutions/licensing/',
    name: 'Licensing and professional registers',
    pageTitle: 'Licensing register software',
    intent: 'Connect applications, decisions, licence records and renewal',
    kind: 'register-family',
    starters: [
      'driver-licensing',
      'firearms-possessors',
      'hunter-register',
      'immigration-sponsor-licences',
      'premises-licences',
      'professional-licensing',
      'rented-housing-registration',
      'road-transport-licensing',
    ],
    featuredStarter: 'professional-licensing',
    audience: 'For licensing boards, professional councils and local licensing teams.',
    description: 'Connect licensing applications, decisions, licence records and renewals, with controlled checks by employers and other services.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'business-and-tax',
    slug: '/solutions/business-and-tax/',
    name: 'Business, tax and finance registers',
    pageTitle: 'Business and tax register software',
    intent: 'Register businesses and changes, then support permitted checks',
    kind: 'register-family',
    starters: [
      'bank-account-register',
      'beneficial-ownership',
      'business-register',
      'central-credit-register',
      'collateral-interests',
      'customs-trader-authorisations',
      'energy-provider-registrations',
      'financial-services-register',
      'industrial-property-rights',
      'insolvency-and-inhibitions',
      'public-disclosure-filings',
      'public-funding-state-aid',
      'representation-mandates',
      'statistical-business-register',
      'statutory-organization-listings',
      'supplier-prequalification',
      'taxpayer-registration',
      'trade-authorizations',
    ],
    featuredStarter: 'business-register',
    audience: 'For company registrars, tax administrations, customs and financial supervisors.',
    description: 'Register businesses, taxpayers, suppliers and filings, review changes and provide permitted checks to connected services.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'people-and-social-programmes',
    slug: '/solutions/people-and-social-programmes/',
    name: 'People, households and social programmes',
    pageTitle: 'Population and social registry software',
    intent: 'Maintain people and household records for public programmes',
    kind: 'register-family',
    starters: [
      'alerts-watchlist',
      'contact-preferences',
      'criminal-records',
      'diplomatic-accreditation',
      'education-institutions',
      'identity-documents',
      'immigration-status',
      'learner-records',
      'population-register',
      'qualification-specifications',
      'social-insurance-contributors',
      'social-registry',
      'voter-registration',
    ],
    openFirst: ['population-register', 'social-registry'],
    audience: 'For population registries, social protection ministries and civil registration offices.',
    description: 'Maintain people and household records, record corrections and let programmes check a permitted fact without receiving a file.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'land-property-and-assets',
    slug: '/solutions/land-property-and-assets/',
    name: 'Land, property, vehicles and places',
    pageTitle: 'Land, property and vehicle register software',
    intent: 'Maintain accountable records of assets, relationships and changes',
    kind: 'register-family',
    starters: [
      'address-building-register',
      'aircraft-register',
      'aviation-obstacles',
      'energy-performance-certificates',
      'land-environmental-designations',
      'land-parcels',
      'mining-cadastre',
      'planning-register',
      'property-valuations',
      'public-transport-stops',
      'railway-registers',
      'reservoirs',
      'ship-register',
      'spectrum-assignments',
      'vehicle-titles',
    ],
    featuredStarter: 'land-parcels',
    audience: 'For cadastres, land registries, vehicle and vessel registries.',
    description: 'Maintain accountable records of parcels, buildings, vehicles, vessels and the relationships or rights recorded against them.',
    products: ['base-registry'],
  },
  {
    key: 'agriculture-food-and-environment',
    slug: '/solutions/agriculture-food-and-environment/',
    name: 'Agriculture, animals, food and environment',
    pageTitle: 'Farm, animal and environmental register software',
    intent: 'Register producers, sites, establishments, permits and resources',
    kind: 'register-family',
    starters: [
      'animal-breeding-organisations',
      'animal-health-status',
      'aquaculture-register',
      'companion-animals',
      'emas-register',
      'environmental-enforcement',
      'environmental-permits',
      'farmer-registry',
      'food-business-establishments',
      'food-feed-authorisations',
      'forestry-register',
      'guarantees-of-origin',
      'livestock-movement',
      'plant-protection-products',
      'seed-certification',
      'water-bodies-and-monitoring-sites',
    ],
    featuredStarter: 'farmer-registry',
    audience: 'For agriculture ministries, veterinary and food safety authorities and environment agencies.',
    description: 'Register producers, sites, food businesses, permits and natural resources, with traceable changes and controlled sharing.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'health-and-safety',
    slug: '/solutions/health-and-safety/',
    name: 'Health, safety and regulated products',
    pageTitle: 'Health and safety register software',
    intent: 'Maintain facility, operator, product and hazard records',
    kind: 'register-family',
    starters: [
      'clinical-trials',
      'cooling-towers',
      'donation-preferences-directives',
      'health-facilities',
      'medical-device-actors-certificates',
      'medicine-shortages',
      'pharmaceutical-operator-licensing',
      'radiation-protection',
    ],
    featuredStarter: 'health-facilities',
    audience: 'For health facility registrars, medicines and device regulators and radiation protection authorities.',
    description: 'Maintain facility, trial, device, operator and hazard records, including status changes and permitted checks by connected services.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'reference-registers',
    slug: '/solutions/reference-registers/',
    name: 'Public bodies, reference lists and catalogues',
    pageTitle: 'Reference register and public body directory software',
    intent: 'Maintain shared classifications, directories and reference data',
    kind: 'register-family',
    starters: [
      'administrative-metadata-catalogue',
      'geographic-reference',
      'public-organizations',
      'registered-legal-instruments',
      'tax-regime-catalogue',
      'trusted-lists',
    ],
    featuredStarter: 'geographic-reference',
    audience: 'For statistics offices, national mapping and gazetteer authorities, and any office that keeps a code list.',
    description: 'Maintain the code lists, place names and public-body directories that other registers and services rely on.',
    products: ['base-registry'],
  },
  {
    key: 'check-a-fact',
    slug: '/solutions/check-a-fact/',
    name: 'Check a fact between services',
    pageTitle: 'Check a fact between government services',
    intent: 'Return a permitted answer from a register without sharing the record',
    kind: 'cross-cutting',
    starters: [],
    description: 'Let an authorised service check a defined fact, such as an age threshold or licence status, without receiving the source record.',
    products: ['evidence-gateway'],
  },
  {
    key: 'review-changes',
    slug: '/solutions/review-changes/',
    name: 'Review changes that need a person',
    pageTitle: 'Review register changes that need a person',
    intent: 'Assign requests for human review and record accountable decisions',
    kind: 'cross-cutting',
    starters: [],
    description: 'Assign each request that needs human review, track its decision and keep the resulting register change separately authorised.',
    products: ['casework', 'base-registry'],
  },
] as const;

// Questions every register family page asks after its own, before the
// closing band. The answers stay true for any register a family groups.
export const sharedFamilyFaq: readonly { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'What can an implementation include?',
    a: 'A scoped implementation can configure the relevant Registry Stack components and starting configuration, and can include staff or public screens, identity, hosting, migration and integrations. The written scope says what the delivery team provides, what the institution provides and how the service will be accepted.',
    link: { href: '/pricing/', label: 'See implementation and support options' },
  },
  {
    q: 'What does it cost?',
    a: 'The core open-source Registry Stack components are Apache-2.0 licensed and carry no software licence fee. Implementation, support, hosting and other applications may have separate commercial terms. Integration, migration and operating costs depend on the service.',
    link: { href: '/pricing/', label: 'See the published prices' },
  },
  {
    q: 'Where does it run, and who runs it?',
    a: 'It can run on infrastructure your institution controls or infrastructure operated by a provider it appoints. The implementation scope identifies who hosts the service, manages identity and access, operates the database, keeps backups and retains audit records.',
    link: { href: '/security/', label: 'Who is responsible for what' },
  },
  {
    q: 'What do our staff use day to day?',
    a: 'Staff can use screens delivered as part of the implementation, or an existing application can connect to Registry Stack. Some starting configurations include a model of staff screens. The service design, roles and required public access are agreed during scoping.',
  },
  {
    q: 'What happens to our records if we stop?',
    a: 'If Evidence Gateway answers from an existing system, the source records remain there. Records held in Base Registry Engine remain in the institution’s PostgreSQL database with their history. The core components remain available under Apache-2.0, so another capable team can operate and adapt them. The proposal or contract should state the licence and ownership of any custom screens, integrations or configuration delivered with the service.',
  },
  {
    q: 'What does a first step look like?',
    a: 'Tell us about one service: who applies or asks for a change, what staff decide, which record must stay current and which systems people use today. We can identify a useful starting configuration and explain how Registry Stack could fit.',
  },
];

// The ids of a family's starters in the order its pages list them: the
// featured starter first, then the ones to open first, then the rest as
// `starters` gives them.
export const starterOrderForArea = (area: Pick<SolutionArea, 'starters' | 'featuredStarter' | 'openFirst'>): string[] => {
  const rank = (id: string): number => {
    if (id === area.featuredStarter) return 0;
    const first = area.openFirst?.indexOf(id) ?? -1;
    return first >= 0 ? first + 1 : Number.MAX_SAFE_INTEGER;
  };
  return [...area.starters].sort((a, b) => rank(a) - rank(b));
};

export const registerFamilies = solutionAreas.filter((area) => area.kind === 'register-family');

export const solutionAreaForStarter = (starterId: string): SolutionArea | undefined =>
  solutionAreas.find((area) => area.starters.includes(starterId));
