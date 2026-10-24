import test from 'node:test';
import assert from 'node:assert/strict';
import { submitStarterRequest, starterRequestEndpoint } from '../src/lib/starter-request.ts';

const endpoint = 'https://forms.example.org/starter-request';
const input = { email: ' reader@example.org ', organization: ' Office ', role: ' Steward ', message: ' A licence register. ' };
const result = { ok: true };

test('only an explicit HTTPS submission service endpoint is accepted', () => {
  assert.equal(starterRequestEndpoint(''), undefined);
  assert.equal(starterRequestEndpoint(` ${endpoint} `), endpoint);
  for (const value of ['http://forms.example.org/starter-request', 'https://user:password@forms.example.org/starter-request', 'https://forms.example.org/form/submit?formId=7', 'https://forms.example.org/other', `${endpoint}?email=someone@example.org`, `${endpoint}#fragment`]) {
    assert.throws(() => starterRequestEndpoint(value), /form endpoint/i);
  }
});

test('sends only request fields with no cookies, referrer, redirect or tracking identity', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options };
    return Response.json(result);
  });
  await submitStarterRequest(endpoint, input);
  assert.equal(sent.url, endpoint);
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.options.credentials, 'omit');
  assert.equal(sent.options.mode, 'cors');
  assert.equal(sent.options.redirect, 'error');
  assert.equal(sent.options.referrerPolicy, 'no-referrer');
  assert.equal(sent.options.cache, 'no-store');
  assert.ok(sent.options.signal instanceof AbortSignal);
  assert.deepEqual(Object.fromEntries(sent.options.body), {
    email: 'reader@example.org',
    organization: 'Office',
    role: 'Steward',
    message: 'A licence register.',
    website: '',
  });
});

test('invalid or oversized details and a filled honeypot never reach Mautic', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network request'); });
  for (const bad of [
    { ...input, email: '' }, { ...input, email: 'missing-at.example.org' },
    { ...input, email: `${'x'.repeat(245)}@example.org` },
    { ...input, organization: 'x'.repeat(201) }, { ...input, role: 'x'.repeat(201) },
    { ...input, message: 'x'.repeat(2001) }, { ...input, website: 'https://spam.example.org' },
  ]) await assert.rejects(submitStarterRequest(endpoint, bad));
  assert.equal(fetch.mock.calls.length, 0);
});

test('a currently consented device is sent only in the request body', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options };
    return Response.json(result);
  });
  const device = 'abcdefghij0123456789abc';
  await submitStarterRequest(endpoint, input, device);
  assert.equal(sent.url, endpoint);
  assert.equal(sent.options.body.get('tracking_consent'), 'granted');
  assert.equal(sent.options.body.get('mautic_device_id'), device);
  assert.equal(sent.options.credentials, 'omit');
  assert.equal(sent.options.referrerPolicy, 'no-referrer');
});

test('missing or unusable tracking identity never prevents a request', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(options.body);
    return Response.json(result);
  });
  for (const device of [undefined, '', 'not-a-device', 'A'.repeat(23)]) {
    await submitStarterRequest(endpoint, input, device);
  }
  assert.equal(sent.length, 4);
  assert.ok(sent.every(body => !body.has('tracking_consent') && !body.has('mautic_device_id')));
});

test('only a saved matching submission is success, not an arbitrary HTTP 200', async (t) => {
  const failures = [
    () => Response.json({ ok: false }),
    () => Response.json({ success: 1 }),
    () => Response.json({ ok: 'true' }),
    () => Response.json(result, { status: 503 }),
    () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => { throw new TypeError('Failed to fetch'); },
  ];
  for (const failure of failures) {
    const mock = t.mock.method(globalThis, 'fetch', failure);
    await assert.rejects(submitStarterRequest(endpoint, input));
    assert.equal(mock.mock.calls.length, 1, 'must not retry a possibly saved request');
    mock.mock.restore();
  }
});

test('a valid response does not render server markup or follow a supplied redirect', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...result, successMessage: '<script>bad()</script>', redirect: 'https://unexpected.example.org/' }));
  assert.equal(await submitStarterRequest(endpoint, input), undefined);
  assert.equal(fetch.mock.calls.length, 1);
});
