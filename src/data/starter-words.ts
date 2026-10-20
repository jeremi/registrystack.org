// Plain words for the identifiers and codes in the starters catalogue, so a
// starter page reads the way Registry Studio does: field names and types in
// words on the surface, the identifiers themselves in technical details.
import { mailtoHref } from './contact.ts';

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

// The first sentence of a paragraph: up to the first '.', '!' or '?' that is
// followed by a capital letter, so 'e.g. permits' does not end it.
export const firstSentence = (text: string): string => text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];

// The plain one-line lead for a starter: its summary, or the first sentence
// of its technical task when the summary is empty.
export const starterLead = (starter: { summary?: string; task: string }): string =>
  starter.summary?.trim() ? starter.summary : firstSentence(starter.task);

// A public register a starter was modeled on, named by its host.
export const sourceHost = (href: string): string => new URL(href).hostname.replace(/^www\./, '');

// The email that requests a starter: the subject names it, and the body asks
// for the register the office keeps, which is how we learn what a starter
// lacks. An empty title leaves the reader to name the starter.
export const starterRequestHref = (title: string): string =>
  mailtoHref(`Starter request: ${title}`, [
    `Starter: ${title}`,
    'Organization: ',
    'Your role: ',
    'The register you keep (what it records, who changes it): ',
    'Anything you already know is missing (optional): ',
  ]);
