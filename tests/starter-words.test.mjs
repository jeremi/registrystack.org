// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { classificationWords, fieldTypeWords, mutationWords, words } from '../src/data/starter-words.ts';

test('words turns an identifier into a label', () => {
  assert.equal(words('document-number'), 'Document number');
  assert.equal(words('subject-uri'), 'Subject URI');
  assert.equal(words('vin'), 'VIN');
  assert.equal(words('authorityName'), 'Authority name');
  assert.equal(words('canonicalBaseIri'), 'Canonical base IRI');
  assert.equal(words('apiEndpointUrl'), 'API endpoint URL');
  assert.equal(words('suspension-lift-recorder'), 'Suspension lift recorder');
});

test('fieldTypeWords says the type in plain words', () => {
  assert.equal(fieldTypeWords({ type: 'string' }), 'Text');
  assert.equal(fieldTypeWords({ type: 'text' }), 'Long text');
  assert.equal(fieldTypeWords({ type: 'date' }), 'Date');
  assert.equal(fieldTypeWords({ type: 'vocabulary-code' }), 'Code from a list');
  assert.equal(fieldTypeWords({ type: 'boolean' }), 'Yes or no');
  assert.equal(fieldTypeWords({ type: 'int64' }), 'Whole number');
  assert.equal(fieldTypeWords({ type: 'decimal' }), 'Number');
  assert.equal(fieldTypeWords({ type: 'crs84-point' }), 'Map point');
  assert.equal(fieldTypeWords({ type: 'reference', target: 'licence' }, (id) => `Licence (${id})`), 'Link to Licence (licence)');
  // An unknown type is shown as it is, never hidden.
  assert.equal(fieldTypeWords({ type: 'duration' }), 'duration');
});

test('mutationWords and classificationWords use the Studio vocabulary', () => {
  assert.equal(mutationWords('create-only'), 'Added once, never changed');
  assert.equal(mutationWords('mutable'), 'Can be changed');
  assert.equal(mutationWords(''), '');
  assert.equal(classificationWords('public'), 'Public');
  assert.equal(classificationWords('internal'), 'Staff only');
  assert.equal(classificationWords('restricted'), 'Restricted');
  assert.equal(classificationWords(''), '');
});
