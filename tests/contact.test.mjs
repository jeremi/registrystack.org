// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contactEmail,
  askQuestionHref,
  contactHref,
  contactNeutralRecoveryHref,
  contactRecoveryHref,
  describeServiceHref,
  mailtoHref,
  proposalHref,
} from '../src/data/contact.ts';

test('the contact address is the one the footer and legal pages print', () => {
  assert.equal(contactEmail, 'contact@registrystack.org');
});

test('mailtoHref encodes the subject and joins the body fields one per line', () => {
  const href = mailtoHref('Starter request: Professional licensing', ['Organization: ', 'Your role: ']);
  const url = new URL(href);
  assert.equal(url.searchParams.get('subject'), 'Starter request: Professional licensing');
  assert.equal(url.searchParams.get('body'), 'Organization: \nYour role: ');
  assert.equal(url.searchParams.get('body').includes('\\n'), false);
});

test('contact helpers route to the form with bounded public context', () => {
  const href = askQuestionHref('Licensing and professional registers');
  assert.equal(href, '/contact/?type=question&context=Licensing+and+professional+registers');
  assert.equal(askQuestionHref(), '/contact/?type=question&context=Registry+Stack');
  assert.equal(describeServiceHref('professional licensing'), '/contact/?type=service&context=professional+licensing');
  assert.equal(describeServiceHref(), '/contact/?type=service&context=Registry+Stack');
  assert.equal(proposalHref(), '/contact/?type=proposal');
  assert.equal(contactHref(), '/contact/');
  assert.equal(contactHref('privacy', 'Delete my visit history'), '/contact/?type=privacy&context=Delete+my+visit+history');
  assert.equal(contactHref('question', ' x '.repeat(100)), '/contact/?type=question');
  assert.equal(contactHref('question', 'public subject\nemail@example.org'), '/contact/?type=question');
  for (const route of [href, askQuestionHref(), describeServiceHref(), proposalHref()]) {
    const url = new URL(route, 'https://registrystack.org');
    assert.equal(url.searchParams.has('email'), false);
    assert.equal(url.searchParams.has('message'), false);
    assert.equal(url.hash, '');
  }
});

test('recovery email preserves the effective request intent and public context', () => {
  const privacy = new URL(contactRecoveryHref('privacy', 'Delete my visit history'));
  assert.equal(privacy.searchParams.get('subject'), 'Privacy request');
  const service = new URL(contactRecoveryHref('service', 'Licensing review'));
  assert.equal(service.searchParams.get('subject'), 'Service inquiry: Licensing review');
  assert.equal(service.searchParams.has('email'), false);
});

test('neutral recovery asks for enough context when scripts or the form are unavailable', () => {
  const recovery = new URL(contactNeutralRecoveryHref());
  assert.equal(recovery.searchParams.get('subject'), 'Contact Registry Stack');
  assert.equal(recovery.searchParams.get('body'), [
    'Request type (question, service, proposal, starter, privacy, or terms): ',
    'Relevant starter (if any): ',
    'Source page: ',
    'Organization: ',
    'Your role: ',
    'Message: ',
  ].join('\n'));
});
