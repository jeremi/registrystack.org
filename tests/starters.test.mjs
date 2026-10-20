// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSentence, sourceHost, starterHoldsText, starterLead, starterRequestHref } from '../src/data/starter-words.ts';
import { starterOrderForArea } from '../src/data/solutions.ts';

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

test('starterHoldsText drops the sentence the lead already says', () => {
  // The lead is the first sentence of the task: the rest of the task remains.
  assert.equal(starterHoldsText({ summary: '', task: 'Record a licence. The example is a council.' }), 'The example is a council.');
  // The plain summary repeats the first sentence of the task word for word.
  assert.equal(starterHoldsText({ summary: 'Record a licence.', task: 'Record a licence. The example is a council.' }), 'The example is a council.');
  // A summary in its own words leaves the task whole.
  assert.equal(starterHoldsText({ summary: 'Who holds a licence.', task: 'Record a licence. More.' }), 'Record a licence. More.');
  // A one-sentence task says nothing the lead has not said.
  assert.equal(starterHoldsText({ summary: '', task: 'Record a licence.' }), '');
});

test('starterOrderForArea puts the featured starter first, then the ones to open first', () => {
  const area = { starters: ['c', 'a', 'b', 'd'], openFirst: ['b', 'a'] };
  assert.deepEqual(starterOrderForArea(area), ['b', 'a', 'c', 'd']);
  assert.deepEqual(starterOrderForArea({ starters: ['c', 'a', 'b'], featuredStarter: 'b' }), ['b', 'c', 'a']);
  assert.deepEqual(starterOrderForArea({ starters: ['c', 'a', 'b'] }), ['c', 'a', 'b']);
});
