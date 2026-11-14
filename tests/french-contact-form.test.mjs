// Run with: node --test tests/french-contact-form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from '@astrojs/compiler';
import {
  contactRequestPresentation,
  contactRequestTypes,
  contactFormText,
} from '../src/lib/starter-request.ts';

const root = new URL('../', import.meta.url);
const englishPrivacy = {
  shared: 'We use these details to review your message and reply. You can send it without accepting visit tracking. If you have accepted tracking, we may link your visits to this message. There is no marketing signup.',
  starter: 'We use these details to review your request and reply. You can request access without accepting tracking. If you accept tracking, we may link your visits to this request. There is no marketing signup.',
  privacy: 'We use these details to handle your privacy request and reply. We do not use this request to link your current browser to your message. There is no marketing signup.',
};

test('English presentation is unchanged when no locale is passed', () => {
  for (const type of contactRequestTypes) {
    assert.deepEqual(contactRequestPresentation(type), contactRequestPresentation(type, 'en'));
  }
  assert.equal(contactRequestPresentation('question').privacyCopy, englishPrivacy.shared);
  assert.equal(contactRequestPresentation('service').privacyCopy, englishPrivacy.shared);
  assert.equal(contactRequestPresentation('proposal').privacyCopy, englishPrivacy.shared);
  assert.equal(contactRequestPresentation('terms').privacyCopy, englishPrivacy.shared);
  assert.equal(contactRequestPresentation('starter').privacyCopy, englishPrivacy.starter);
  assert.equal(contactRequestPresentation('privacy').privacyCopy, englishPrivacy.privacy);
  assert.equal(contactRequestPresentation('question').heading, 'Ask a question');
  assert.equal(contactRequestPresentation('service').submitLabel, 'Send message');
});

test('every request type has French copy for every key the English has', () => {
  for (const type of contactRequestTypes) {
    const en = contactRequestPresentation(type, 'en');
    const fr = contactRequestPresentation(type, 'fr');
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), type);
    for (const [key, value] of Object.entries(fr)) {
      assert.ok(value.trim().length > 0, `${type}.${key} is empty`);
      assert.notEqual(value, en[key], `${type}.${key} is still English`);
      assert.doesNotMatch(value, /[—–]/, `${type}.${key} has a dash`);
      assert.doesNotMatch(value, /'/, `${type}.${key} has a straight apostrophe`);
    }
  }
});

test('French privacy copy keeps the English promises, no more and no less', () => {
  const fr = (type) => contactRequestPresentation(type, 'fr').privacyCopy;
  for (const type of ['question', 'service', 'proposal', 'terms']) {
    assert.equal(fr(type), fr('question'));
  }
  assert.match(fr('question'), /sans accepter le suivi des visites/);
  assert.match(fr('question'), /Si vous avez accepté le suivi, nous pouvons relier vos visites à ce message/);
  assert.match(fr('starter'), /sans accepter le suivi/);
  assert.match(fr('starter'), /Si vous acceptez le suivi, nous pouvons relier vos visites à cette demande/);
  assert.match(fr('privacy'), /n’utilisons pas cette demande pour relier votre navigateur actuel à votre message/);
  assert.doesNotMatch(fr('privacy'), /suivi/);
  for (const type of contactRequestTypes) assert.match(fr(type), /liste d’envoi commercial/);
});

test('form text has French twins for every key and keeps the English wording by default', () => {
  const en = contactFormText();
  const fr = contactFormText('fr');
  assert.deepEqual(contactFormText('en'), en);
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  assert.equal(en.email, 'Email address');
  assert.equal(fr.email, 'Adresse électronique');
  assert.equal(fr.organization, 'Organisation');
  assert.equal(fr.role, 'Fonction');
  assert.equal(en.sending, 'Sending your request…');
  assert.match(en.error, /^We could not confirm your request\./);
  for (const key of Object.keys(en)) assert.notEqual(fr[key], en[key], key);
  assert.equal(fr.privacyLinkLabel, 'politique de confidentialité (en anglais)');
});

test('the form component and the French contact page wire the locale without touching submitted values', async () => {
  const form = await readFile(new URL('src/components/StarterRequestForm.astro', root), 'utf8');
  const page = await readFile(new URL('src/pages/fr/contact.astro', root), 'utf8');
  await Promise.all([
    transform(form, { filename: 'StarterRequestForm.astro' }),
    transform(page, { filename: 'fr/contact.astro' }),
  ]);
  for (const field of ['email', 'organization', 'role', 'message', 'website']) {
    assert.match(form, new RegExp(`name="${field}"`));
  }
  assert.match(form, /data-locale=\{locale\}/);
  // The English error sentence stays literal in the component (an existing
  // contract test reads it there), so it must equal the library's copy.
  assert.ok(form.includes(`'${contactFormText().error}'`));
  assert.match(page, /requestType="question"/);
  assert.match(page, /requestFromUrl/);
  assert.match(page, /PUBLIC_STARTER_REQUEST_ENDPOINT/);
  assert.match(form, /hreflang=\{locale === 'fr' \? 'en' : undefined\}/);
});
