// Plain words for the identifiers and codes in the starters catalogue, so a
// starter page reads the way Registry Studio does: field names and types in
// words on the surface, the identifiers themselves in technical details.

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
