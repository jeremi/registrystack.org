// The published starters catalogue. src/data/starters.json is written by
// scripts/sync-starters.mjs from an export of the breg-registry-starters
// repository; edit the starters there, not here. src/upstream/starters.json
// records which revision the data came from.
import catalogue from './starters.json';
import { solutionAreaForStarter, starterOrderForArea, type SolutionArea } from './solutions';

// The plain one-line lead shown on cards, starter pages and family lists,
// and the email that requests a starter.
export { starterHoldsText, starterLead, starterRequestHref } from './starter-words';

export interface StarterField {
  id: string;
  type: string;
  required: boolean;
  classification: string;
  // The record type a reference field links to.
  target?: string;
}

export interface StarterRecordType {
  id: string;
  label: string;
  description: string;
  mutationMode: string;
  classification: string;
  fieldCount: number;
  fields: StarterField[];
  references: { field: string; target: string }[];
}

export interface StarterAction {
  id: string;
  label: string;
  description: string;
}

export interface StarterAccessProfile {
  id: string;
  requiredScopes: string[];
  requiredPurposes: string[];
  actions: string[];
  recordTypes: string[];
}

export interface Starter {
  id: string;
  title: string;
  task: string;
  summary: string;
  catalogueRows: string[];
  sourceUrls: string[];
  counts: { recordTypes: number; actions: number; values: number };
  includes: {
    staffUi: boolean;
    evidenceCompanion: boolean;
    clients: boolean;
    statistics: boolean;
    modules: boolean;
  };
  recordTypes: StarterRecordType[];
  actions: StarterAction[];
  accessProfiles: StarterAccessProfile[];
  valuesKeys: string[];
  download: { path: string; sha256: string; bytes: number };
}

export interface StarterSource {
  catalogueVersion: number;
  breg: { repository: string; revision: string; version: string };
  publicschema: { repository: string; revision: string; version: string; license: string };
}

export const starters: readonly Starter[] = catalogue.starters;
export const startersSource: StarterSource = catalogue.source;
export const starterCount = starters.length;

export const starterById = (id: string): Starter | undefined => starters.find((starter) => starter.id === id);

// Starters in the order the solution area lists them, the featured starter
// and the ones to open first ahead of the rest, so the family page and the
// catalogue agree.
export const startersForArea = (area: SolutionArea): Starter[] =>
  starterOrderForArea(area)
    .flatMap((id) => {
      const starter = starterById(id);
      return starter ? [starter] : [];
    });

// The starter a family suggests first, when it names one.
export const featuredStarterForArea = (area: SolutionArea): Starter | undefined =>
  area.featuredStarter ? starterById(area.featuredStarter) : undefined;

export const areaForStarter = solutionAreaForStarter;
