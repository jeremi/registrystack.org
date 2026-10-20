// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { contactEmail, askQuestionHref, mailtoHref } from '../src/data/contact.ts';

test('the contact address is the one the footer and legal pages print', () => {
  assert.equal(contactEmail, 'contact@registrystack.org');
});

test('mailtoHref encodes the subject and joins the body fields one per line', () => {
  const href = mailtoHref('Starter request: Professional licensing', ['Organization: ', 'Your role: ']);
  assert.equal(
    href,
    'mailto:contact@registrystack.org?subject=Starter%20request%3A%20Professional%20licensing&body=Organization%3A%20%0AYour%20role%3A%20',
  );
});

test('askQuestionHref names the subject and asks for the register, not a budget', () => {
  const href = askQuestionHref('Licensing and professional registers');
  const url = new URL(href);
  assert.equal(url.pathname, 'contact@registrystack.org');
  assert.equal(url.searchParams.get('subject'), 'Question about Licensing and professional registers');
  assert.equal(url.searchParams.get('body'), 'Organization: \nYour role: \nThe register you keep: \nYour question: ');
  assert.equal(new URL(askQuestionHref()).searchParams.get('subject'), 'Question about Registry Stack');
});
