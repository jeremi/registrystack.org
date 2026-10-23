// The solution areas the site is organized by. A register family groups the
// starters a reader would recognize as the same kind of work; cross-cutting
// areas describe capabilities that can be used across services.
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
  // A concrete example for a cross-cutting capability on the solutions overview.
  example?: string;
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
    audience: 'For licensing authorities and professional councils.',
    description: 'Connect licensing applications, decisions, licence records and renewals, with controlled checks by employers and other services.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'business-and-tax',
    slug: '/solutions/business-and-tax/',
    name: 'Business, tax and finance registers',
    pageTitle: 'Business and tax register software',
    intent: 'Record business registrations and changes, and let approved services check their status',
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
    description: 'Record business and taxpayer registrations, review changes and let approved services check registration status.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'people-and-social-programmes',
    slug: '/solutions/people-and-social-programmes/',
    name: 'People, households and social programmes',
    pageTitle: 'People, population and programme register software',
    intent: 'Maintain identity, household, enrollment and status records for public services',
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
    audience: 'For population and civil registration offices, social protection ministries, education, immigration and electoral authorities.',
    description: 'Maintain people, identity, household, enrollment and status records. Review corrections and let authorized services check specific information.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'land-property-and-assets',
    slug: '/solutions/land-property-and-assets/',
    name: 'Land, property, vehicles and places',
    pageTitle: 'Land, property and vehicle register software',
    intent: 'Record assets, their holders and rights, and the history of changes',
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
    description: 'Maintain records of parcels, buildings, vehicles, vessels and their holders or rights, with a history of changes.',
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
    description: 'Register producers, sites, food businesses, permits and natural resources. Record changes and let approved services check their status.',
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
    description: 'Maintain facility, trial, device, operator and hazard records. Record decisions and let approved services check their status.',
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
    name: 'Check information from another register',
    pageTitle: 'Check information between government services',
    intent: 'Get an answer to a specific question without receiving the full record',
    example: 'For example, a procurement system can check whether a supplier is registered. The institution that maintains the register decides which checks are allowed.',
    kind: 'cross-cutting',
    starters: [],
    description: 'Let an authorized service check information such as an age threshold or licence status without receiving the full record.',
    products: ['evidence-gateway'],
  },
  {
    key: 'review-changes',
    slug: '/solutions/review-changes/',
    name: 'Review requests and record decisions',
    pageTitle: 'Staff reviews and decisions on register changes',
    intent: 'Assign requests to staff, track due dates and record the outcome',
    example: 'For example, a licensing team can review a request to correct a licence record.',
    kind: 'cross-cutting',
    starters: [],
    description: 'Assign requests to staff, track due dates and record decisions. Only authorized staff or systems can apply the approved change.',
    products: ['casework', 'base-registry'],
  },
  {
    key: 'verifiable-credentials',
    slug: '/solutions/verifiable-credentials/',
    name: 'Issue verifiable credentials',
    pageTitle: 'Verifiable credentials from government registers',
    intent: 'Issue a digitally signed statement, such as licence status, to a compatible wallet',
    example: 'For example, a professional council can issue a credential containing licence status without including the licence history.',
    kind: 'cross-cutting',
    starters: [],
    description: 'Issue verifiable credentials from register information. Connect a compatible wallet and receiving service as part of your implementation.',
    products: ['evidence-gateway'],
  },
] as const;

// Questions every register family page asks after its own, before the
// closing band. The answers stay true for any register a family groups.
export const sharedFamilyFaq: readonly { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'What can an implementation include?',
    a: 'An implementation can include configuration, applicant and staff screens, sign-in, hosting, data migration and connections to existing systems. A written scope states what the delivery team provides, what your institution provides and how you will check that the service meets your requirements.',
    link: { href: '/pricing/', label: 'See implementation and support options' },
  },
  {
    q: 'What does it cost?',
    a: 'The core open-source Registry Stack components are Apache-2.0 licensed and carry no software licence fee. Implementation, support, hosting and other applications may have separate commercial terms. Integration, migration and operating costs depend on the service.',
    link: { href: '/pricing/', label: 'See the published prices' },
  },
  {
    q: 'Where does it run, and who runs it?',
    a: 'It can run on infrastructure your institution controls or with a provider you choose. The written scope identifies who hosts and operates the service, manages user access, keeps backups and retains audit records.',
    link: { href: '/security/', label: 'Who is responsible for what' },
  },
  {
    q: 'What do our staff use day to day?',
    a: 'Staff can use screens delivered with the implementation or an existing application connected to Registry Stack. Some starting configurations include example staff screens. We agree the tasks, staff permissions and public access the service needs before delivery.',
  },
  {
    q: 'Can another team operate the service if we change provider?',
    a: 'Yes. Another capable team can operate and adapt the Apache-2.0 core components. Your institution keeps its records and their history, whether in an existing system or in the database used by Base Registry Engine. The contract should define handover arrangements and the licence and ownership of any custom screens, integrations or configuration.',
  },
  {
    q: 'What does a first step look like?',
    a: 'Tell us about one service: who applies or asks for a change, what staff decide, which record must stay current and which systems people use today. We can identify a useful starting configuration and explain how Registry Stack could fit.',
  },
  {
    q: 'How can our technical team test a check against an existing register?',
    a: 'Start with the Evidence Gateway tutorial. It answers a yes-or-no question from sample data and verifies the result on a laptop. Your team can then assess how to connect your existing register.',
    link: { href: 'https://docs.registrystack.org/tutorials/first-evidence-assertion/', label: 'Run the information-check tutorial' },
  },
  {
    q: 'How can our technical team test building a register?',
    a: 'Start with the Base Registry Engine tutorial to create records and inspect their history. Then explore a starting configuration for the kind of register you need.',
    link: { href: 'https://docs.registrystack.org/tutorials/first-breg/', label: 'Run the registry tutorial' },
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
