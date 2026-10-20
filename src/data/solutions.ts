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
  // The offices the family is for, shown on its card ("For licensing boards, ...").
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
    audience: 'For licensing boards, professional councils and local licensing teams.',
    description: 'One register of the licences your office issues. Other services check a licence without seeing the file, and corrections wait in one queue. Open source.',
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
    audience: 'For company registrars, tax administrations, customs and financial supervisors.',
    description: 'Keep the register of businesses, taxpayers, suppliers and filings, let other services check an entry, and review changes in one queue. Open source.',
    products: ['base-registry', 'evidence-gateway'],
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
    openFirst: ['population-register', 'social-registry'],
    audience: 'For population registries, social protection ministries and civil registration offices.',
    description: 'Maintain records about people and let programmes check a fact without receiving the file. Open-source register software.',
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
    audience: 'For cadastres, land registries, vehicle and vessel registries.',
    description: 'Register parcels, buildings, vehicles, vessels and the rights over them, and let services check an entry without receiving the file. Open source.',
    products: ['base-registry'],
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
    audience: 'For agriculture ministries, veterinary and food safety authorities and environment agencies.',
    description: 'Register farms, animals, food businesses, permits and natural resources, and let services check a fact without seeing the record. Open source.',
    products: ['base-registry', 'evidence-gateway'],
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
    audience: 'For health facility registrars, medicines and device regulators and radiation protection authorities.',
    description: 'Register facilities, trials, devices, operators and hazards, and let inspectors and services check an entry without seeing the file. Open source.',
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
    audience: 'For statistics offices, national mapping and gazetteer authorities, and any office that keeps a code list.',
    description: 'Publish the code lists, place names and public body directories that other registers rely on, from one register your office controls. Open source.',
    products: ['base-registry'],
  },
  {
    key: 'check-a-fact',
    slug: '/solutions/check-a-fact/',
    name: 'Check a fact between services',
    pageTitle: 'Check a fact between government services',
    intent: 'Answer a defined question from a register without handing over the record',
    kind: 'cross-cutting',
    starters: [],
    description: 'Let another service check a fact in your register, such as an age or a licence status, and get a signed answer without the record. Open source.',
    products: ['evidence-gateway'],
  },
  {
    key: 'review-changes',
    slug: '/solutions/review-changes/',
    name: 'Review changes that need a person',
    pageTitle: 'Review register changes that need a person',
    intent: 'Give the officers who decide one accountable inbox',
    kind: 'cross-cutting',
    starters: [],
    description: 'Put each register change that needs a decision in front of the officer who decides, with a queue, a due date and a record of who decided.',
    products: ['casework', 'base-registry'],
  },
] as const;

// Questions every register family page asks after its own, before the
// closing band. The answers stay true for any register a family groups.
export const sharedFamilyFaq: readonly { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: 'What do we receive, and what do we build?',
    a: 'You receive the software, the starter closest to your register, and the documentation. The software holds the records and their rules, answers the services you connect, and keeps the history. Your team provides the screens staff use, any search page for the public, sign-in for staff and services, and the hosting. A starter’s page says whether it includes a model of staff screens.',
    link: { href: '/starters/', label: 'See what a starter includes' },
  },
  {
    q: 'What does it cost?',
    a: 'There is no software licence fee; Registry Stack is Apache-2.0 open source. Your costs are hosting and people: someone in the office who decides the rules and roles, a developer who adapts the starter and builds or connects the screens, and an operator who runs the server and the database, keeps backups and holds the signing keys. If you want help, Aubex offers implementation pilots and annual support contracts at published prices, with scope and fee agreed before work starts.',
    link: { href: '/pricing/', label: 'See the published prices' },
  },
  {
    q: 'Where does it run, and who runs it?',
    a: 'On infrastructure your organization controls, or an IT firm you contract. Your operator hosts the database, manages access and keeps the audit records; the software does not send your records or logs to Aubex.',
    link: { href: '/security/', label: 'Who is responsible for what' },
  },
  {
    q: 'What do our staff use day to day?',
    a: 'Registry Stack holds the register and its rules. The screens your staff use come from your own application or from an IT firm you contract. Where a starter includes a model of staff screens for the App Kit, its page says so.',
  },
  {
    q: 'What happens to our records if we stop?',
    a: 'If you let services check facts from a register you already run, your records never left it. If you keep the register in Base Registry Engine, they stay in your PostgreSQL database, in a documented structure, with their history. The source code is public under Apache-2.0, so your team or another firm can keep running and changing it without Aubex, and a starter you have received is yours to keep under the same licence. Nothing is locked to a vendor account.',
  },
  {
    q: 'What does a first step look like?',
    a: 'If you keep your register where it is, your technical team runs the Evidence Gateway tutorial and agrees with one other service the first question it will ask. If you are building or moving a register, your team runs the registry tutorial on a laptop and requests the starter closest to your register. A pilot engagement scopes the rest.',
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
