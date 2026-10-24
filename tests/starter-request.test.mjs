import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contactRequestPresentation,
  requestSourcePage,
  submitStarterRequest,
  starterRequestEndpoint,
} from '../src/lib/starter-request.ts';

test('a withdrawn consent signal cancels a pending request without an automatic retry', async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls += 1;
    assert.ok(options.signal instanceof AbortSignal);
    controller.abort();
    options.signal.throwIfAborted();
    throw new Error('A withdrawn request must not continue.');
  });
  await assert.rejects(submitStarterRequest(
    'https://metrics.example.org/form/submit?formId=1&privacy=kiosk',
    { email: 'synthetic@example.invalid', organization: '', role: '', message: '',
      sourcePage: '/starters/professional-licensing/', starterId: 'professional-licensing',
      requestType: 'starter', requestContext: 'Professional licensing' },
    'a'.repeat(23),
    'https://metrics.example.org/form/submit?formId=2&privacy=consented',
    { signal: controller.signal },
  ), { name: 'AbortError' });
  assert.equal(calls, 1);
});

const kioskEndpoint = 'https://forms.example.org/form/submit?formId=1&privacy=kiosk';
const trackedEndpoint = 'https://forms.example.org/form/submit?formId=2&privacy=consented';
const input = {
  email: ' reader@example.org ',
  organization: ' Office ',
  role: ' Steward ',
  message: ' A licence register. ',
  starterId: 'professional-licensing',
  sourcePage: '/starters/professional-licensing/',
  requestType: 'starter',
  requestContext: ' Professional licensing ',
};

function nativeSuccess(body, overrides = {}) {
  return Response.json({
    success: 1,
    results: {
      email: body.get('mauticform[email]'),
      organization: body.get('mauticform[organization]'),
      role: body.get('mauticform[role]'),
      message: body.get('mauticform[message]'),
      starter_id: body.get('mauticform[starter_id]'),
      source_page: body.get('mauticform[source_page]'),
      request_token: body.get('mauticform[request_token]'),
      request_type: body.get('mauticform[request_type]'),
      request_context: body.get('mauticform[request_context]'),
      ...overrides,
    },
  });
}

test('accepts only an exact HTTPS native form endpoint for its mode', () => {
  assert.equal(starterRequestEndpoint('', 'kiosk'), undefined);
  assert.equal(starterRequestEndpoint(` ${kioskEndpoint} `), kioskEndpoint);
  assert.equal(starterRequestEndpoint(trackedEndpoint, 'consented'), trackedEndpoint);
  for (const value of [
    'http://forms.example.org/form/submit?formId=1&privacy=kiosk',
    'https://user:password@forms.example.org/form/submit?formId=1&privacy=kiosk',
    'https://forms.example.org/form/submit?formId=0&privacy=kiosk',
    'https://forms.example.org/form/submit?formId=1.5&privacy=kiosk',
    'https://forms.example.org/form/submit?formId=1&privacy=consented',
    'https://forms.example.org/form/submit?formId=1&privacy=kiosk&extra=1',
    'https://forms.example.org/form/submit?formId=1&formId=2&privacy=kiosk',
    'https://forms.example.org/form/submit?formId=1&privacy=kiosk&privacy=kiosk',
    'https://forms.example.org/form/submit?privacy=kiosk',
    'https://forms.example.org/other?formId=1&privacy=kiosk',
    `${kioskEndpoint}#fragment`,
  ]) assert.throws(() => starterRequestEndpoint(value), /form endpoint/i, value);
});

test('posts native Mautic fields with fixed provenance and no browser credentials or referrer', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options };
    return nativeSuccess(options.body);
  });
  await submitStarterRequest(kioskEndpoint, input);
  assert.equal(sent.url, `${kioskEndpoint}&ajax=1`);
  assert.equal(sent.options.method, 'POST');
  assert.equal(sent.options.credentials, 'omit');
  assert.equal(sent.options.mode, 'cors');
  assert.equal(sent.options.redirect, 'error');
  assert.equal(sent.options.referrerPolicy, 'no-referrer');
  assert.equal(sent.options.cache, 'no-store');
  assert.ok(sent.options.signal instanceof AbortSignal);
  assert.deepEqual(sent.options.headers, {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  });
  assert.deepEqual(Object.fromEntries(sent.options.body), {
    'mauticform[email]': 'reader@example.org',
    'mauticform[organization]': 'Office',
    'mauticform[role]': 'Steward',
    'mauticform[message]': 'A licence register.',
    'mauticform[starter_id]': 'professional-licensing',
    'mauticform[source_page]': '/starters/professional-licensing/',
    'mauticform[request_token]': sent.options.body.get('mauticform[request_token]'),
    'mauticform[request_type]': 'starter',
    'mauticform[request_context]': 'Professional licensing',
    'mauticform[website]': '',
    'mauticform[formId]': '1',
  });
  assert.match(sent.options.body.get('mauticform[request_token]'), /^[0-9a-f-]{36}$/);
});

test('uses consented form only for a configured same-origin distinct form and valid device', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, body: options.body });
    return nativeSuccess(options.body);
  });
  const device = 'abcdefghij0123456789abc';
  await submitStarterRequest(kioskEndpoint, input, device, trackedEndpoint);
  assert.equal(sent[0].url, `${trackedEndpoint}&ajax=1`);
  assert.equal(sent[0].body.get('mauticform[formId]'), '2');
  assert.equal(sent[0].body.get('mautic_device_id'), device);
  assert.equal(sent[0].body.has('tracking_consent'), false);
});

test('missing tracked configuration or unusable identity safely falls back to kiosk', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, body: options.body });
    return nativeSuccess(options.body);
  });
  for (const [device, tracked] of [
    [undefined, trackedEndpoint], ['', trackedEndpoint], ['not-a-device', trackedEndpoint],
    ['A'.repeat(23), trackedEndpoint], ['abcdefghij0123456789abc', undefined],
  ]) await submitStarterRequest(kioskEndpoint, input, device, tracked);
  assert.equal(sent.length, 5);
  assert.ok(sent.every(request => request.url === `${kioskEndpoint}&ajax=1`));
  assert.ok(sent.every(request => request.body.get('mauticform[formId]') === '1' && !request.body.has('mautic_device_id')));
});

test('rejects inconsistent native form configuration before validation or network access', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network request'); });
  for (const tracked of [
    'https://other.example.org/form/submit?formId=2&privacy=consented',
    'https://forms.example.org/form/submit?formId=1&privacy=consented',
    'https://forms.example.org/form/submit?formId=2&privacy=kiosk',
  ]) await assert.rejects(submitStarterRequest(kioskEndpoint, { ...input, email: '' }, 'abcdefghij0123456789abc', tracked), /form endpoint|configuration/i);
  assert.equal(fetch.mock.calls.length, 0);
});

test('invalid or oversized details and a filled honeypot never reach Mautic', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network request'); });
  for (const bad of [
    { ...input, email: '' }, { ...input, email: 'missing-at.example.org' },
    { ...input, email: `${'x'.repeat(245)}@example.org` },
    { ...input, organization: 'x'.repeat(201) }, { ...input, role: 'x'.repeat(201) },
    { ...input, message: 'x'.repeat(2001) }, { ...input, website: 'https://spam.example.org' },
    { ...input, starterId: 'NOT A SLUG' }, { ...input, sourcePage: 'https://other.example.org/' },
    { ...input, sourcePage: '/contact/?email=never@example.org' },
    { ...input, requestType: 'sales' }, { ...input, requestContext: 'x'.repeat(201) },
    { ...input, requestType: 'question', message: '' },
  ]) await assert.rejects(submitStarterRequest(kioskEndpoint, bad));
  assert.equal(fetch.mock.calls.length, 0);
});

test('starter messages are optional and generic request messages are required', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(options.body);
    return nativeSuccess(options.body);
  });
  await submitStarterRequest(kioskEndpoint, { ...input, message: '' });
  await submitStarterRequest(kioskEndpoint, {
    ...input,
    message: 'Please explain the implementation scope.',
    starterId: '',
    sourcePage: '/contact/',
    requestType: 'question',
    requestContext: 'Implementation scope',
  });
  assert.equal(sent[0].get('mauticform[message]'), '');
  assert.equal(sent[1].get('mauticform[starter_id]'), '');
});

test('privacy requests always use the kiosk form', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, body: options.body };
    return nativeSuccess(options.body);
  });
  await submitStarterRequest(kioskEndpoint, {
    ...input,
    starterId: '',
    sourcePage: '/contact/',
    requestType: 'privacy',
    requestContext: 'Delete my data',
  }, 'abcdefghij0123456789abc', trackedEndpoint);
  assert.equal(sent.url, `${kioskEndpoint}&ajax=1`);
  assert.equal(sent.body.has('mautic_device_id'), false);
});

test('source pages are path-only and never forward sensitive queries', () => {
  assert.equal(requestSourcePage('/solutions/licensing/'), '/solutions/licensing/');
  assert.equal(requestSourcePage('/contact/?email=secret@example.org'), undefined);
  assert.equal(requestSourcePage('//other.example.org/path'), undefined);
  assert.equal(requestSourcePage('/safe/#private'), undefined);
});

test('request presentation matches privacy, proposal, and starter behavior', () => {
  assert.match(contactRequestPresentation('privacy').privacyCopy, /do not use this request to link your current browser/i);
  assert.equal(contactRequestPresentation('privacy').submitLabel, 'Send privacy request');
  assert.equal(contactRequestPresentation('proposal').heading, 'Request a proposal');
  assert.equal(contactRequestPresentation('proposal').submitLabel, 'Request a proposal');
  assert.equal(contactRequestPresentation('starter').messageLabel, 'What are you trying to do?');
});

test('requires exact saved native results and never retries a possibly saved request', async (t) => {
  const failures = [
    () => Response.json({ success: 0, results: {} }),
    () => Response.json({ success: '1', results: {} }),
    body => nativeSuccess(body, { email: 'other@example.org' }),
    body => nativeSuccess(body, { organization: undefined }),
    body => nativeSuccess(body, { request_token: 'different' }),
    () => Response.json({ success: 1, results: {}, validationErrors: ['bad'] }),
    () => Response.json({ success: 1, results: {}, errorMessage: 'bad' }),
    body => new Response(JSON.stringify({ success: 1, results: { email: body.get('mauticform[email]') } }), { status: 503, headers: { 'content-type': 'application/json' } }),
    () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => { throw new TypeError('Failed to fetch'); },
  ];
  for (const failure of failures) {
    const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => failure(options.body));
    await assert.rejects(submitStarterRequest(kioskEndpoint, input));
    assert.equal(mock.mock.calls.length, 1, 'must not retry a possibly saved request');
    mock.mock.restore();
  }
});

test('ignores native success markup and redirects after exact result verification', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const response = nativeSuccess(options.body);
    const payload = await response.json();
    return Response.json({ ...payload, successMessage: '<script>bad()</script>', redirect: 'https://unexpected.example.org/' });
  });
  assert.equal(await submitStarterRequest(kioskEndpoint, input), undefined);
  assert.equal(fetch.mock.calls.length, 1);
});
