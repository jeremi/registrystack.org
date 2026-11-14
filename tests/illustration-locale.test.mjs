// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { illustrationSource } from '../src/i18n.ts';

test('an English page shows the English picture and adds no language note', () => {
  assert.deepEqual(illustrationSource('same-definitions', 'en', false), {
    base: '/illustrations/same-definitions',
    labelsInEnglish: false,
  });
  assert.deepEqual(illustrationSource('same-definitions', 'en', true), {
    base: '/illustrations/same-definitions',
    labelsInEnglish: false,
  });
});

test('a French page shows the French picture when one exists', () => {
  assert.deepEqual(illustrationSource('same-definitions', 'fr', true), {
    base: '/illustrations/fr/same-definitions',
    labelsInEnglish: false,
  });
});

test('a French page without a French picture shows the English one and says its labels are in English', () => {
  assert.deepEqual(illustrationSource('service-template', 'fr', false), {
    base: '/illustrations/service-template',
    labelsInEnglish: true,
  });
});
