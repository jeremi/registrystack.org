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
// family without one lists its starters in catalogue order and highlights none.
export interface SolutionArea {
  key: string;
  slug: string;
  name: string;
  pageTitle: string;
  intent: string;
  kind: 'register-family' | 'cross-cutting';
  starters: readonly string[];
  featuredStarter?: string;
  products: readonly string[];
}

export const solutionAreas: readonly SolutionArea[] = [
  {
    key: 'licensing',
    slug: '/solutions/licensing/',
    name: 'Licensing and professional registers',
    pageTitle: 'Licensing register software',
    intent: 'Record who holds a licence, on what terms, and what changed',
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
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'business-and-tax',
    slug: '/solutions/business-and-tax/',
    name: 'Business, tax and finance registers',
    pageTitle: 'Business and tax register software',
    intent: 'Keep the register of businesses, taxpayers, suppliers and filings',
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
    products: ['base-registry', 'evidence-gateway', 'protected-registry-apis'],
  },
  {
    key: 'people-and-social-programmes',
    slug: '/solutions/people-and-social-programmes/',
    name: 'People, households and social programmes',
    pageTitle: 'Population and social registry software',
    intent: 'Maintain records about people and let programmes check them',
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
    products: ['base-registry', 'evidence-gateway', 'casework'],
  },
  {
    key: 'land-property-and-assets',
    slug: '/solutions/land-property-and-assets/',
    name: 'Land, property, vehicles and places',
    pageTitle: 'Land, property and vehicle register software',
    intent: 'Register parcels, buildings, vehicles, vessels and the rights over them',
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
    products: ['base-registry', 'protected-registry-apis'],
  },
  {
    key: 'agriculture-food-and-environment',
    slug: '/solutions/agriculture-food-and-environment/',
    name: 'Agriculture, animals, food and environment',
    pageTitle: 'Farm, animal and environmental register software',
    intent: 'Register farms, animals, food businesses, permits and natural resources',
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
    products: ['base-registry', 'evidence-gateway', 'protected-registry-apis'],
  },
  {
    key: 'health-and-safety',
    slug: '/solutions/health-and-safety/',
    name: 'Health, safety and regulated products',
    pageTitle: 'Health and safety register software',
    intent: 'Register facilities, trials, devices, operators and hazards',
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
    products: ['base-registry', 'evidence-gateway'],
  },
  {
    key: 'reference-registers',
    slug: '/solutions/reference-registers/',
    name: 'Public bodies, reference lists and catalogues',
    pageTitle: 'Reference register and public body directory software',
    intent: 'Publish the lists other registers and services rely on',
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
    products: ['base-registry', 'protected-registry-apis'],
  },
  {
    key: 'check-a-fact',
    slug: '/solutions/check-a-fact/',
    name: 'Check a fact between services',
    pageTitle: 'Check a fact between government services',
    intent: 'Answer a defined question from a register without handing over the record',
    kind: 'cross-cutting',
    starters: [],
    products: ['evidence-gateway', 'protected-registry-apis'],
  },
  {
    key: 'review-changes',
    slug: '/solutions/review-changes/',
    name: 'Review changes that need a person',
    pageTitle: 'Review register changes that need a person',
    intent: 'Give the officers who decide one accountable inbox',
    kind: 'cross-cutting',
    starters: [],
    products: ['casework', 'base-registry'],
  },
] as const;

export const registerFamilies = solutionAreas.filter((area) => area.kind === 'register-family');

export const solutionAreaForStarter = (starterId: string): SolutionArea | undefined =>
  solutionAreas.find((area) => area.starters.includes(starterId));
