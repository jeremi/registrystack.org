// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSentence, sourceHost, starterLead, starterRequestHref } from '../src/data/starter-words.ts';

test('firstSentence stops at the first sentence end', () => {
  assert.equal(firstSentence('Record a licence. The example is a council.'), 'Record a licence.');
  assert.equal(firstSentence('One sentence only.'), 'One sentence only.');
  // An abbreviation followed by a lowercase word does not end the sentence.
  assert.equal(firstSentence('Keep e.g. permits and fees. Then more.'), 'Keep e.g. permits and fees.');
});

test('starterLead prefers the plain summary', () => {
  assert.equal(starterLead({ summary: 'A plain sentence.', task: 'Record a licence. More.' }), 'A plain sentence.');
});

test('starterLead falls back to the first sentence of the task', () => {
  assert.equal(starterLead({ summary: '', task: 'Record a licence. More.' }), 'Record a licence.');
  assert.equal(starterLead({ summary: '   ', task: 'Record a licence. More.' }), 'Record a licence.');
  assert.equal(starterLead({ task: 'Record a licence. More.' }), 'Record a licence.');
});

test('sourceHost names a source by its host without www', () => {
  assert.equal(sourceHost('https://www.sra.org.uk/consumers/register/'), 'sra.org.uk');
  assert.equal(sourceHost('https://architects-register.org.uk/'), 'architects-register.org.uk');
  assert.equal(sourceHost('https://datacatalogue.gov.ie/dataset/registered-teachers'), 'datacatalogue.gov.ie');
});

test('starterRequestHref opens a starter request with the title in the subject and body', () => {
  const href = starterRequestHref('Professional licensing');
  assert.ok(href.startsWith('mailto:contact@registrystack.org?subject=Starter%20request%3A%20Professional%20licensing&body='));
  const body = decodeURIComponent(href.split('&body=')[1]);
  assert.deepEqual(body.split('\n'), [
    'Starter: Professional licensing',
    'Organization: ',
    'Your role: ',
    'The register you keep (what it records, who changes it): ',
    'Anything you already know is missing (optional): ',
  ]);
});
