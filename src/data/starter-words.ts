// Plain words for the identifiers and codes in the starters catalogue, so a
// starter page reads the way Registry Studio does: field names and types in
// words on the surface, the identifiers themselves in technical details.
import { contactHref } from './contact.ts';

// Tokens that are initialisms in the starters' field ids and values keys.
const INITIALISMS = new Set(['uri', 'iri', 'url', 'id', 'api', 'vin', 'imo', 'iban', 'bic', 'vat', 'isin', 'lei']);

// 'document-number', 'authorityName' and 'canonicalBaseIri' become
// 'Document number', 'Authority name' and 'Canonical base IRI'.
export const words = (identifier: string): string => {
  const tokens = identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split('-')
    .filter((token) => token.length > 0)
    .map((token) => (INITIALISMS.has(token) ? token.toUpperCase() : token));
  const text = tokens.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const FIELD_TYPES: Record<string, string> = {
  string: 'Text',
  text: 'Long text',
  date: 'Date',
  'vocabulary-code': 'Code from a list',
  boolean: 'Yes or no',
  int64: 'Whole number',
  decimal: 'Number',
  'crs84-point': 'Map point',
};

// The type of a field in words. A reference names what it links to, through
// `label`, which turns the target's id into its label. A type this list does
// not know is shown as the catalogue states it.
export const fieldTypeWords = (
  field: { type: string; target?: string },
  label: (id: string) => string = (id) => id,
): string => {
  if (field.type === 'reference') return `Link to ${label(field.target ?? '')}`;
  return FIELD_TYPES[field.type] ?? field.type;
};

const MUTATION_MODES: Record<string, string> = {
  'create-only': 'Added once, never changed',
  mutable: 'Can be changed',
};

export const mutationWords = (mode: string): string => MUTATION_MODES[mode] ?? mode;

const CLASSIFICATIONS: Record<string, string> = {
  public: 'Public',
  internal: 'Staff only',
  restricted: 'Restricted',
};

export const classificationWords = (classification: string): string =>
  CLASSIFICATIONS[classification] ?? classification;

const ACTION_DESCRIPTIONS: Record<string, string> = {
  'Record an external authority decision as an immediate registry effect.':
    'Record a decision already made by the responsible authority.',
  'Atomically record an external assessment and certification.':
    'Record the external assessment and certification together.',
  'Atomically record an animal, microchip, assignment and first keeper responsibility.':
    'Record the animal, microchip, assignment, and first keeper responsibility together.',
  'Apply a keeper change immediately and record both responsibility-period boundaries atomically.':
    'Record the keeper change and both responsibility-period boundaries together.',
  'Record an externally approved licence and its initial term atomically.':
    'Record the externally approved licence and its initial term together.',
  'Append an externally approved revocation and close future renewal recording atomically.':
    'Record the externally approved revocation and close future renewal recording together.',
  'Atomically record a person, an already-decided citizenship recognition, and an opaque sector identifier assignment.':
    'Record the person, decided citizenship recognition, and sector identifier assignment together.',
};

// Catalogue descriptions keep the exact technical wording from the generated
// source. The public page uses familiar words for transaction effects.
export const actionDescriptionWords = (description: string): string =>
  ACTION_DESCRIPTIONS[description] ?? description;

// The first sentence of a paragraph: up to the first '.', '!' or '?' that is
// followed by a capital letter, so 'e.g. permits' does not end it.
export const firstSentence = (text: string): string => text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];

// The plain one-line lead for a starter: its summary, or the first sentence
// of its technical task when the summary is empty.
export const starterLead = (starter: { summary?: string; task: string }): string =>
  starter.summary?.trim() ? starter.summary : firstSentence(starter.task);

// The technical task paragraph shown under "What it holds", without the
// sentence the lead already says, so a page does not open twice with the
// same line. Empty when the task says nothing more than the lead.
export const starterHoldsText = (starter: { summary?: string; task: string }): string => {
  const lead = starterLead(starter);
  return starter.task.startsWith(lead) ? starter.task.slice(lead.length).trim() : starter.task;
};

// A public register a starter was modeled on, named by its host.
export const sourceHost = (href: string): string => new URL(href).hostname.replace(/^www\./, '');

export const starterRequestHref = (title: string): string =>
  contactHref('starter', title);
