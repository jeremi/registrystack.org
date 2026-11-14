// Run with: node --test tests/email-signup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  emailAddressPattern,
  emailSignupAvailable,
  emailSignupEndpoint,
  emailSignupText,
  submitEmailSignup,
} from '../src/lib/email-signup.ts';

const endpoint = 'https://email-signup.example.test/form/submit?formId=3&privacy=kiosk';
const result = (data) => ({
  success: 1,
  results: { email: data['mauticform[email]'], language: data['mauticform[language]'], source_page: data['mauticform[source_page]'] },
});

const withFetch = async (handler, run) => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, data: Object.fromEntries(new URLSearchParams(String(init.body))) });
    return handler(calls.at(-1));
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
};
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('the sign-up is off when the setting is absent and validated like the contact form endpoint when set', () => {
  assert.equal(emailSignupEndpoint(undefined), undefined);
  assert.equal(emailSignupEndpoint('  '), undefined);
  assert.equal(emailSignupEndpoint(endpoint), endpoint);
  for (const bad of [
    'not a url',
    'http://email-signup.example.test/form/submit?formId=3&privacy=kiosk',
    'https://email-signup.example.test/form/submit?formId=3&privacy=consented',
    'https://email-signup.example.test/form/submit?formId=0&privacy=kiosk',
    'https://email-signup.example.test/form/other?formId=3&privacy=kiosk',
    'https://email-signup.example.test/form/submit?formId=3&privacy=kiosk&extra=1',
    'https://u:p@email-signup.example.test/form/submit?formId=3&privacy=kiosk',
  ]) {
    assert.throws(() => emailSignupEndpoint(bad), /PUBLIC_EMAIL_SIGNUP_ENDPOINT/, bad);
  }
});

test('the sign-up and its privacy wording are available only with a valid setting and a published episode', () => {
  assert.equal(emailSignupAvailable(endpoint, 1), endpoint);
  assert.equal(emailSignupAvailable(endpoint, 0), undefined);
  assert.equal(emailSignupAvailable(undefined, 3), undefined);
  assert.throws(() => emailSignupAvailable('http://nope.example.test/', 0), /PUBLIC_EMAIL_SIGNUP_ENDPOINT/);
});

test('a sign-up posts exactly the five agreed fields and reads the confirmation', async () => {
  await withFetch((call) => jsonResponse(result(call.data)), async (calls) => {
    await submitEmailSignup(endpoint, { email: ' visitor@example.invalid ', language: 'fr', sourcePage: '/fr/episodes/', website: '' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${endpoint}&ajax=1`);
    assert.deepEqual(calls[0].data, {
      'mauticform[email]': 'visitor@example.invalid',
      'mauticform[language]': 'fr',
      'mauticform[source_page]': '/fr/episodes/',
      'mauticform[website]': '',
      'mauticform[formId]': '3',
    });
    assert.equal(calls[0].init.credentials, 'omit');
    assert.equal(calls[0].init.referrerPolicy, 'no-referrer');
    assert.equal(calls[0].init.redirect, 'error');
  });
});

test('a sign-up carries no tracking identifier', async () => {
  await withFetch((call) => jsonResponse(result(call.data)), async (calls) => {
    await submitEmailSignup(endpoint, { email: 'a@example.invalid', language: 'en', sourcePage: '/episodes/', website: '' });
    assert.deepEqual(Object.keys(calls[0].data).filter((key) => !key.startsWith('mauticform[')), []);
    assert.equal(Object.keys(calls[0].data).length, 5);
  });
  const lib = await readFile(new URL('../src/lib/email-signup.ts', import.meta.url), 'utf8');
  const component = await readFile(new URL('../src/components/EmailSignup.astro', import.meta.url), 'utf8');
  for (const source of [lib, component]) {
    assert.doesNotMatch(source, /marketing-tracking|shared-tracking-client|getConsentedTrackingAssociation|mautic_device_id|TRACKED_ENDPOINT/);
  }
});

test('the source page is a path with no query and no fragment', async () => {
  await withFetch(() => assert.fail('nothing is sent'), async () => {
    for (const sourcePage of ['/episodes/?utm=1', '/episodes/#top', 'https://example.org/episodes/', '', undefined]) {
      await assert.rejects(
        submitEmailSignup(endpoint, { email: 'a@example.invalid', language: 'en', sourcePage, website: '' }),
        /Check the sign-up details/,
      );
    }
  });
});

test('an invalid email address or language is refused before anything is sent', async () => {
  await withFetch(() => assert.fail('nothing is sent'), async () => {
    for (const input of [
      { email: 'no-at-sign', language: 'en' },
      { email: 'a@b', language: 'en' },
      { email: `${'a'.repeat(250)}@example.invalid`, language: 'en' },
      { email: 'a@example.invalid', language: 'de' },
    ]) {
      await assert.rejects(submitEmailSignup(endpoint, { sourcePage: '/episodes/', website: '', ...input }), /Check the sign-up details/);
    }
  });
});

test('a filled honeypot sends nothing and looks like success', async () => {
  await withFetch(() => assert.fail('nothing is sent'), async (calls) => {
    await submitEmailSignup(endpoint, { email: 'bot@example.invalid', language: 'en', sourcePage: '/episodes/', website: 'http://spam.example' });
    assert.equal(calls.length, 0);
  });
});

test('a failed sign-up is reported, never swallowed', async () => {
  const input = { email: 'a@example.invalid', language: 'en', sourcePage: '/episodes/', website: '' };
  await withFetch(() => new Response('bad', { status: 500 }), async () => {
    await assert.rejects(submitEmailSignup(endpoint, input), /confirm/i);
  });
  await withFetch(() => jsonResponse({ success: 0 }), async () => {
    await assert.rejects(submitEmailSignup(endpoint, input), /confirm/i);
  });
  await withFetch(() => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }), async () => {
    await assert.rejects(submitEmailSignup(endpoint, input), /confirm/i);
  });
  await withFetch(() => jsonResponse({ success: 1, results: { email: 'other@example.invalid', language: 'en', source_page: '/episodes/' } }), async () => {
    await assert.rejects(submitEmailSignup(endpoint, input), /confirm/i);
  });
});

test('the text matches the agreed wording in both languages', () => {
  const en = emailSignupText('en');
  assert.equal(en.heading, 'Email updates');
  assert.equal(en.body, 'A short note about once a month: what we published and what changed in Registry Stack.');
  assert.equal(en.label, 'Email address');
  assert.equal(en.button, 'Sign up');
  assert.equal(`${en.privacyBefore}${en.privacyLinkLabel}.`, 'We use your email address only to send these notes. Signing up does not turn on visit tracking. Every note has an unsubscribe link. See the privacy policy.');
  assert.equal(en.success, 'Almost done. Check your inbox for an email with a link to confirm your address.');
  assert.equal(en.sending, 'Sending…');
  assert.equal(en.noScript, 'The sign-up form needs JavaScript.');
  assert.equal(en.error, 'We could not confirm your sign-up. Please try again later.');

  const fr = emailSignupText('fr');
  assert.equal(fr.heading, 'Nouvelles par courriel');
  assert.equal(fr.body, 'Une courte note environ une fois par mois : ce que nous avons publié et ce qui a changé dans Registry Stack.');
  assert.equal(fr.label, 'Adresse électronique');
  assert.equal(fr.button, 'S’abonner');
  assert.equal(`${fr.privacyBefore}${fr.privacyLinkLabel}.`, 'Nous utilisons votre adresse électronique uniquement pour vous envoyer ces notes. L’abonnement n’active pas le suivi des visites. Chaque note contient un lien de désabonnement. Voir la politique de confidentialité (en anglais).');
  assert.equal(fr.success, 'Presque terminé. Consultez votre boîte de réception : un message contient un lien pour confirmer votre adresse.');
  assert.equal(fr.sending, 'Envoi en cours…');
  assert.equal(fr.noScript, 'Le formulaire d’abonnement nécessite JavaScript.');
  assert.equal(fr.error, 'Nous n’avons pas pu confirmer votre abonnement. Réessayez plus tard.');
});

test('the sign-up form id must differ from the contact forms on the same origin', () => {
  const contact = 'https://email-signup.example.test/form/submit?formId=1&privacy=kiosk';
  const tracked = 'https://email-signup.example.test/form/submit?formId=2&privacy=consented';
  assert.equal(emailSignupEndpoint(endpoint, [contact, tracked]), endpoint);
  assert.equal(emailSignupEndpoint(endpoint, [undefined, '']), endpoint);
  assert.equal(emailSignupEndpoint(undefined, [endpoint]), undefined);
  assert.throws(() => emailSignupEndpoint(endpoint, ['https://email-signup.example.test/form/submit?formId=3&privacy=kiosk']), /PUBLIC_EMAIL_SIGNUP_ENDPOINT.*form/i);
  assert.throws(() => emailSignupEndpoint(endpoint, [undefined, 'https://email-signup.example.test/form/submit?formId=3&privacy=consented']), /PUBLIC_EMAIL_SIGNUP_ENDPOINT.*form/i);
  assert.equal(emailSignupEndpoint(endpoint, ['https://other.example.test/form/submit?formId=3&privacy=kiosk']), endpoint, 'another origin is another Mautic');
});

test('the address pattern given to the browser matches the rule the code applies', () => {
  const rule = new RegExp(`^${emailAddressPattern}$`);
  for (const good of ['a@b.co', 'first.last@example.org']) assert.equal(rule.test(good), true, good);
  for (const bad of ['name@intranet', 'a b@example.org', '@example.org', 'a@@b.co', '']) assert.equal(rule.test(bad), false, bad);
});

test('the form component hides itself without scripts, labels the input, and posts', async () => {
  const component = await readFile(new URL('../src/components/EmailSignup.astro', import.meta.url), 'utf8');
  assert.match(component, /<form[^>]*method="post"/);
  assert.match(component, /<input name="email"[^>]*aria-describedby="email-signup-privacy"/);
  assert.doesNotMatch(component, /<form[^>]*aria-describedby/);
  assert.match(component, /<input name="email"[^>]*pattern=\{emailAddressPattern\}/);
  assert.match(component, /data-email-signup-sending/);
  assert.match(component, /data-email-signup-no-script/);
  assert.match(component, /html:not\(\.js\)/);
});
