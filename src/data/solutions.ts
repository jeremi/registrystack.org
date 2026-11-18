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
    intent: 'Connect licence applications to decisions, records and renewals',
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
    description: 'You can connect licence applications, decisions, records and renewals. Employers and other services can run the checks you control.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'business-and-tax',
    slug: '/solutions/business-and-tax/',
    name: 'Business, tax and finance registers',
    pageTitle: 'Business and tax register software',
    intent: 'Record business registrations and changes so approved services can check a business’s status',
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
    audience: 'For company registrars, tax administrations, customs authorities and financial supervisors.',
    description: 'You can record business and taxpayer registrations. Staff review changes. Approved services can check registration status.',
    products: ['base-registry', 'evidence-gateway'],
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
    audience: 'For agriculture ministries, veterinary authorities, food safety authorities and environment agencies.',
    description: 'You can register producers, sites, food businesses, permits and natural resources. You can record changes. Approved services can check status.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'people-and-social-programmes',
    slug: '/solutions/people-and-social-programmes/',
    name: 'People, households and social programmes',
    pageTitle: 'People, population and programme register software',
    intent: 'Keep identity, household, enrolment and status records for public services',
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
    audience: 'For population and civil registration offices, social protection ministries, and education, immigration and electoral authorities.',
    description: 'You can keep population registers, social registries and enrolment records. Staff review corrections. Authorised services can check specific information.',
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'land-property-and-assets',
    slug: '/solutions/land-property-and-assets/',
    name: 'Land, property, vehicles and places',
    pageTitle: 'Land, property and vehicle register software',
    intent: 'Record assets with their holders and rights, and the history of changes',
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
    audience: 'For cadastres and for land, vehicle and vessel registries.',
    description: 'You can record parcels, buildings, vehicles and vessels. You can record who holds them or has rights over them. The register keeps the history of changes.',
    products: ['base-registry'],
  },
  {
    key: 'health-and-safety',
    slug: '/solutions/health-and-safety/',
    name: 'Health, safety and regulated products',
    pageTitle: 'Health and safety register software',
    intent: 'Keep facility, operator, product and hazard records',
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
    audience: 'For health facility registrars, medicines regulators, device regulators and radiation protection authorities.',
    description: 'You can keep facility, trial, device, operator and hazard records. You can record decisions. Approved services can check status.',
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'reference-registers',
    slug: '/solutions/reference-registers/',
    name: 'Public bodies, reference lists and catalogues',
    pageTitle: 'Reference register and public body directory software',
    intent: 'Keep shared classifications, directories and reference data',
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
    description: 'You can keep the code lists, place names and public-body directories that other registers and services rely on.',
    products: ['base-registry'],
  },
  {
    key: 'check-a-fact',
    slug: '/solutions/check-a-fact/',
    name: 'Check information from another register',
    pageTitle: 'Check information between government services',
    intent: 'Give a service the answer to a specific question, not the full record',
    example: 'For example, a procurement system can check whether a supplier is registered. The institution that keeps the register decides which checks to allow.',
    kind: 'cross-cutting',
    starters: [],
    description: 'You can let an authorised service check a fact without receiving the full record. For example, it can check an age threshold or a licence status.',
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
    description: 'You can assign requests to staff, track due dates and record decisions. Only authorised staff or systems can apply an approved change.',
    products: ['casework', 'base-registry'],
  },
  {
    key: 'verifiable-credentials',
    slug: '/solutions/verifiable-credentials/',
    name: 'Issue verifiable credentials',
    pageTitle: 'Verifiable credentials from government registers',
    intent: 'Issue a digitally signed statement, such as licence status, to a compatible wallet',
    example: 'For example, a professional council can issue a credential that contains licence status but not the licence history.',
    kind: 'cross-cutting',
    starters: [],
    description: 'You can issue verifiable credentials from register information. A compatible wallet and a receiving service are connected as part of the implementation.',
    products: ['evidence-gateway'],
  },
] as const;

// Shared adoption handoff after domain questions; detailed terms live on the FAQ.
export const sharedFamilyFaq: readonly { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'How do we plan an implementation?',
    a: 'Start with one service. Agree its records, staff tasks, screens, system connections and data migration. A written scope names who delivers, hosts and runs it. It covers access, backups and handover.',
    link: { href: '/faq/', label: 'Read about ownership, delivery and operation' },
  },
  {
    q: 'How can our technical team evaluate the software?',
    a: 'The component tutorials let your team test core behaviour with sample data. Your service still needs its own rules, connected applications and end-to-end tests.',
    link: { href: '/#developers', label: 'Evaluate the software' },
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
