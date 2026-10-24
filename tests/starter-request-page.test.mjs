// Run with: node --test tests/starter-request-page.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from '@astrojs/compiler';

const root = new URL('../', import.meta.url);
const pageUrl = new URL('src/pages/starters/[id].astro', root);
const formUrl = new URL('src/components/StarterRequestForm.astro', root);
const privacyUrl = new URL('src/pages/privacy.astro', root);

test('professional licensing wires the inline request form without changing other starter fallbacks', async () => {
  const page = await readFile(pageUrl, 'utf8');
  const form = await readFile(formUrl, 'utf8');

  await Promise.all([
    transform(page, { filename: pageUrl.pathname }),
    transform(form, { filename: formUrl.pathname }),
  ]);

  assert.match(
    page,
    /starter\.id === 'professional-licensing' && Boolean\(starterRequestEndpoint\)/,
  );
  assert.match(page, /requestFormEnabled \? '#starter-request-form' : requestHref/);
  assert.match(page, /parseStarterRequestEndpoint\(import\.meta\.env\.PUBLIC_STARTER_REQUEST_ENDPOINT, 'kiosk'\)/);
  assert.match(page, /parseStarterRequestEndpoint\(import\.meta\.env\.PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT, 'consented'\)/);
  assert.match(page, /starterRequestTrackedEndpoint && !starterRequestEndpoint/);
  assert.match(page, /kioskUrl\.origin !== trackedUrl\.origin/);
  assert.match(page, /searchParams\.get\('formId'\) === trackedUrl\.searchParams\.get\('formId'\)/);
  assert.match(page, /requestFormEnabled && starterRequestEndpoint && \(\s*<StarterRequestForm/);
  assert.match(page, /trackedEndpoint=\{starterRequestTrackedEndpoint\}/);
  assert.equal(
    page.match(/href=\{requestActionHref\}[^>]*data-journey="starter-request"/g)?.length,
    2,
  );

  for (const field of ['email', 'organization', 'role', 'message']) {
    assert.match(form, new RegExp(`name=["']${field}["']`));
  }
  assert.match(form, /name="email"[^>]*required/);
  assert.match(form, /name="email"[^>]*maxlength="254"/);
  assert.match(form, /name="organization"[^>]*maxlength="200"/);
  assert.match(form, /name="role"[^>]*maxlength="200"/);
  assert.match(form, /name="message"[^>]*maxlength="2000"/);
  assert.match(form, /name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
  assert.match(form, /<fieldset[^>]*disabled/);

  const formMarkup = form.match(/<form\b[\s\S]*?<\/form>/)?.[0];
  assert.ok(formMarkup, 'the request form is present');
  assert.doesNotMatch(formMarkup, /\s(?:action|method)=/);
  assert.match(form.slice(form.indexOf('</form>')), /href=\{requestHref\}/);

  assert.match(form, /submitStarterRequest\(endpoint,/);
  assert.match(form, /data-tracked-endpoint=\{trackedEndpoint\}/);
  assert.match(form, /getConsentedDeviceId\(\) : undefined, trackedEndpoint/);
  assert.match(form, /Request received\. Our team will review it\./);
  assert.match(form, /We could not confirm your request\./);
  assert.doesNotMatch(form, /\.reset\(\)/);
});

test('privacy policy explains starter request handling while preserving Umami disclosure', async () => {
  const privacy = await readFile(privacyUrl, 'utf8');
  await transform(privacy, { filename: privacyUrl.pathname });

  assert.match(privacy, /self-hosted Mautic/i);
  assert.match(privacy, /email[^<]*organization[^<]*role[^<]*request details/i);
  assert.match(privacy, /starter[^<]*time[^<]*source/i);
  assert.match(privacy, /network address[^<]*temporary\s+rate-limit counters/i);
  assert.match(privacy, /Mautic is configured to anonymize IP addresses/i);
  assert.doesNotMatch(privacy, /does not forward your network address/i);
  assert.match(privacy, /not\s+linked to your website visit history/i);
  assert.match(privacy, /accept tracking/i);
  assert.match(privacy, /withdraw[^<]*consent/i);
  assert.match(privacy, /six months/i);
  assert.doesNotMatch(privacy, /does not build behavioral profiles|does not set any cookies of its/i);
  assert.match(privacy, /no automatic\s+marketing signup/i);
  assert.match(privacy, /Umami/);
  assert.doesNotMatch(privacy, /\b(?:relay|DNT|kiosk mode)\b/i);
});
