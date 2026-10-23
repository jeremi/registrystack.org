// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contactEmail,
  askQuestionHref,
  describeServiceHref,
  mailtoHref,
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

test('askQuestionHref allows a service need without asking for a budget', () => {
  const href = askQuestionHref('Licensing and professional registers');
  const url = new URL(href);
  assert.equal(url.pathname, 'contact@registrystack.org');
  assert.equal(url.searchParams.get('subject'), 'Question about Licensing and professional registers');
  assert.equal(url.searchParams.get('body'), 'Organization: \nYour role: \nThe service or need: \nYour question: ');
  assert.equal(url.searchParams.get('body').includes('Budget'), false);
  assert.equal(new URL(askQuestionHref()).searchParams.get('subject'), 'Question about Registry Stack');
});

test('describeServiceHref starts with the service need and desired result', () => {
  const url = new URL(describeServiceHref('professional licensing'));
  assert.equal(url.pathname, 'contact@registrystack.org');
  assert.equal(url.searchParams.get('subject'), 'Service inquiry: professional licensing');
  assert.equal(
    url.searchParams.get('body'),
    'Organization: \nYour role: \nThe service you need: \nWho will use it: \nWhat should improve: ',
  );
  assert.equal(url.searchParams.get('body').includes('Budget'), false);
  assert.equal(new URL(describeServiceHref()).searchParams.get('subject'), 'Service inquiry: Registry Stack');
});
