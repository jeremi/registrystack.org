import assert from 'node:assert/strict';
import http from 'node:http';
import { after, describe, test } from 'node:test';

import { createStarterRequestServer } from '../server/starter-request.mjs';

const websiteOrigin = 'https://www.example.test';
const deviceId = 'abc123def456ghi789jkl01';
const openServers = new Set();

after(async () => {
  await Promise.all([...openServers].map((server) => closeServer(server)));
});

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  openServers.add(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function closeServer(server) {
  if (!openServers.delete(server)) return;
  await new Promise((resolve) => server.close(resolve));
}

async function makeRelay(options = {}) {
  const server = createStarterRequestServer({
    mauticBaseUrl: 'http://127.0.0.1:9',
    mauticFormId: 7,
    websiteOrigin,
    perIpLimit: 100,
    globalLimit: 100,
    ...options,
  });
  return { server, baseUrl: await listen(server) };
}

function formBody(overrides = {}) {
  return new URLSearchParams({
    email: 'reader@example.org',
    organization: 'Licensing office',
    role: 'Registrar',
    message: 'We need to modernize professional licensing.',
    website: '',
    ...overrides,
  });
}

function echoedMauticResults(init) {
  const body = new URLSearchParams(init.body);
  return {
    email: body.get('mauticform[email]'),
    organization: body.get('mauticform[organization]'),
    role: body.get('mauticform[role]'),
    message: body.get('mauticform[message]'),
    starter_id: body.get('mauticform[starter_id]'),
    source_page: body.get('mauticform[source_page]'),
    request_token: body.get('mauticform[request_token]'),
  };
}

function echoedMauticResponse(init) {
  return Response.json({ success: 1, results: echoedMauticResults(init) });
}

async function post(baseUrl, body = formBody(), options = {}) {
  return fetch(`${baseUrl}/starter-request`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Origin: websiteOrigin,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...options.headers,
    },
    body,
  });
}

async function rawPost(baseUrl, body, headers = {}) {
  const data = body.toString();
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(`${baseUrl}/starter-request`), {
      method: 'POST',
      headers: {
        Origin: websiteOrigin,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.once('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    request.end(data);
  });
}

describe('starter request relay', () => {
  test('submits a correlated request without forwarding browser identity', async () => {
    let captured;
    const upstream = http.createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const fields = new URLSearchParams(raw);
      captured = { method: request.method, url: request.url, headers: request.headers, fields };
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': 'mautic_device_id=upstream-only; Path=/; HttpOnly',
      });
      response.end(JSON.stringify({
        success: 1,
        results: {
          email: fields.get('mauticform[email]'),
          organization: fields.get('mauticform[organization]'),
          role: fields.get('mauticform[role]'),
          message: fields.get('mauticform[message]'),
          starter_id: fields.get('mauticform[starter_id]'),
          source_page: fields.get('mauticform[source_page]'),
          request_token: fields.get('mauticform[request_token]'),
        },
      }));
    });
    const mauticBaseUrl = await listen(upstream);
    const { server, baseUrl } = await makeRelay({ mauticBaseUrl });

    const response = await post(baseUrl, formBody(), {
      headers: {
        Cookie: 'browser_session=do-not-forward',
        Referer: `${websiteOrigin}/private-path`,
        'User-Agent': 'Identifying Browser/1.0',
        'X-Forwarded-For': '203.0.113.91',
        'X-Private-Header': 'do-not-forward',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), websiteOrigin);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'");
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('vary'), /Origin/i);

    assert.equal(captured.method, 'POST');
    assert.equal(captured.url, '/form/submit?ajax=1');
    assert.equal(captured.headers.accept, 'application/json');
    assert.equal(captured.headers['content-type'], 'application/x-www-form-urlencoded;charset=UTF-8');
    assert.equal(captured.headers.dnt, '1');
    assert.equal(captured.headers['user-agent'], 'RegistryStack-Starter-Request/1.0');
    for (const header of ['cookie', 'referer', 'x-forwarded-for', 'x-private-header']) {
      assert.equal(captured.headers[header], undefined);
    }
    assert.deepEqual(Object.fromEntries(captured.fields), {
      'mauticform[email]': 'reader@example.org',
      'mauticform[organization]': 'Licensing office',
      'mauticform[role]': 'Registrar',
      'mauticform[message]': 'We need to modernize professional licensing.',
      'mauticform[starter_id]': 'professional-licensing',
      'mauticform[source_page]': '/starters/professional-licensing/',
      'mauticform[request_token]': captured.fields.get('mauticform[request_token]'),
      'mauticform[website]': '',
      'mauticform[formId]': '7',
    });
    assert.match(captured.fields.get('mauticform[request_token]'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    await closeServer(server);
    await closeServer(upstream);
  });

  test('uses the tracked form only for an explicitly consented valid identity', async () => {
    const calls = [];
    const { server, baseUrl } = await makeRelay({
      mauticTrackedFormId: 8,
      fetch: async (_url, init) => {
        calls.push(init);
        return echoedMauticResponse(init);
      },
    });
    const response = await post(baseUrl, formBody({
      tracking_consent: 'granted',
      mautic_device_id: deviceId,
    }), {
      headers: {
        Cookie: 'mtc_id=must-not-forward',
        Referer: `${websiteOrigin}/starters/professional-licensing/`,
        'User-Agent': 'Identifying Browser/1.0',
        'X-Forwarded-For': '203.0.113.91',
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 1);
    const body = new URLSearchParams(calls[0].body);
    assert.equal(body.get('mauticform[formId]'), '8');
    assert.equal(body.get('mautic_device_id'), deviceId);
    assert.equal(body.get('mauticform[mautic_device_id]'), null);
    assert.equal(calls[0].headers.DNT, undefined);
    assert.equal(calls[0].headers['User-Agent'], 'Identifying Browser/1.0');
    for (const header of ['Cookie', 'Referer', 'Sec-GPC', 'X-Forwarded-For']) {
      assert.equal(calls[0].headers[header], undefined);
    }
    assert.equal(response.headers.get('set-cookie'), null);

    await closeServer(server);
  });

  test('falls back to the kiosk form when a consented request lacks a bounded browser user agent', async (t) => {
    const cases = [
      ['missing', {}],
      ['blank', { 'User-Agent': '' }],
      ['oversized', { 'User-Agent': 'x'.repeat(513) }],
    ];
    for (const [name, headers] of cases) {
      await t.test(name, async () => {
        let upstream;
        const { server, baseUrl } = await makeRelay({
          mauticTrackedFormId: 8,
          fetch: async (_url, init) => {
            upstream = init;
            return echoedMauticResponse(init);
          },
        });
        const response = await rawPost(baseUrl, formBody({
          tracking_consent: 'granted',
          mautic_device_id: deviceId,
        }), headers);
        assert.equal(response.status, 200);
        assert.deepEqual(JSON.parse(response.body), { ok: true });
        const upstreamBody = new URLSearchParams(upstream.body);
        assert.equal(upstreamBody.get('mauticform[formId]'), '7');
        assert.equal(upstreamBody.get('mautic_device_id'), null);
        assert.equal(upstream.headers.DNT, '1');
        assert.equal(upstream.headers['User-Agent'], 'RegistryStack-Starter-Request/1.0');
        await closeServer(server);
      });
    }
  });

  test('uses the kiosk form when consented attribution is unavailable or denied by a privacy header', async (t) => {
    const cases = [
      ['no consented identity', { mauticTrackedFormId: 8 }, formBody(), {}],
      ['tracked form not configured', {}, formBody({ tracking_consent: 'granted', mautic_device_id: deviceId }), {}],
      ['DNT', { mauticTrackedFormId: 8 }, formBody({ tracking_consent: 'granted', mautic_device_id: deviceId }), { DNT: '1' }],
      ['GPC', { mauticTrackedFormId: 8 }, formBody({ tracking_consent: 'granted', mautic_device_id: deviceId }), { 'Sec-GPC': '1' }],
    ];
    for (const [name, config, body, headers] of cases) {
      await t.test(name, async () => {
        let upstream;
        const { server, baseUrl } = await makeRelay({
          ...config,
          fetch: async (_url, init) => {
            upstream = init;
            return echoedMauticResponse(init);
          },
        });
        const response = await post(baseUrl, body, { headers });
        assert.equal(response.status, 200);
        const upstreamBody = new URLSearchParams(upstream.body);
        assert.equal(upstreamBody.get('mauticform[formId]'), '7');
        assert.equal(upstreamBody.get('mautic_device_id'), null);
        assert.equal(upstream.headers.DNT, '1');
        assert.equal(upstream.headers['Sec-GPC'], undefined);
        await closeServer(server);
      });
    }
  });

  test('rejects malformed or duplicated attribution fields before contacting Mautic', async () => {
    const { server, baseUrl } = await makeRelay({
      mauticTrackedFormId: 8,
      fetch: async () => assert.fail('upstream called'),
    });
    const valid = formBody({ tracking_consent: 'granted', mautic_device_id: deviceId });
    const cases = [
      formBody({ tracking_consent: 'granted' }),
      formBody({ mautic_device_id: deviceId }),
      formBody({ tracking_consent: 'denied', mautic_device_id: deviceId }),
      formBody({ tracking_consent: 'granted', mautic_device_id: deviceId.toUpperCase() }),
      formBody({ tracking_consent: 'granted', mautic_device_id: deviceId.slice(1) }),
      new URLSearchParams([...valid, ['tracking_consent', 'granted']]),
      new URLSearchParams([...valid, ['mautic_device_id', deviceId]]),
    ];
    for (const body of cases) {
      const response = await post(baseUrl, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false });
    }
    await closeServer(server);
  });

  test('does not expose or log the consented device identifier', async () => {
    const entries = [];
    const methods = ['error', 'log', 'warn'];
    const originals = Object.fromEntries(methods.map((method) => [method, console[method]]));
    for (const method of methods) console[method] = (...values) => entries.push([method, ...values]);
    let server;
    try {
      const relay = await makeRelay({
        mauticTrackedFormId: 8,
        fetch: async (_url, init) => echoedMauticResponse(init),
      });
      server = relay.server;
      const response = await post(relay.baseUrl, formBody({
        tracking_consent: 'granted',
        mautic_device_id: deviceId,
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.text()).includes(deviceId), false);
      assert.equal(JSON.stringify(entries).includes(deviceId), false);
    } finally {
      for (const method of methods) console[method] = originals[method];
      if (server) await closeServer(server);
    }
  });

  test('exposes only the health check and origin-bound POST surface', async () => {
    const { server, baseUrl } = await makeRelay({ fetch: async () => assert.fail('upstream called') });

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    assert.equal(health.headers.get('cache-control'), 'no-store');

    const preflight = await fetch(`${baseUrl}/starter-request`, {
      method: 'OPTIONS',
      headers: {
        Origin: websiteOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), websiteOrigin);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
    assert.equal(preflight.headers.get('access-control-allow-headers'), 'Content-Type');

    for (const request of [
      () => post(baseUrl, formBody(), { headers: { Origin: 'https://attacker.example' } }),
      () => fetch(`${baseUrl}/starter-request`, { method: 'POST', body: formBody() }),
      () => fetch(`${baseUrl}/starter-request`, { method: 'GET', headers: { Origin: websiteOrigin } }),
      () => fetch(`${baseUrl}/unknown`),
      () => fetch(`${baseUrl}/starter-request`, {
        method: 'OPTIONS',
        headers: {
          Origin: websiteOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      }),
    ]) {
      const response = await request();
      assert.ok([403, 404, 405].includes(response.status), `unexpected status ${response.status}`);
      if (response.status !== 404 && response.status !== 405) assert.deepEqual(await response.json(), { ok: false });
    }

    await closeServer(server);
  });

  test('rejects malformed fields, duplicates, unknown fields, and honeypot submissions', async () => {
    const { server, baseUrl } = await makeRelay({ fetch: async () => assert.fail('upstream called') });
    const cases = [
      new URLSearchParams({ organization: 'Missing email' }),
      formBody({ email: 'not-an-email' }),
      formBody({ email: `${'a'.repeat(245)}@example.org` }),
      formBody({ organization: 'x'.repeat(201) }),
      formBody({ role: 'x'.repeat(201) }),
      formBody({ message: 'x'.repeat(2001) }),
      formBody({ website: 'robot.example' }),
      new URLSearchParams([...formBody(), ['email', 'second@example.org']]),
      new URLSearchParams([...formBody(), ['starter_id', 'other']]),
    ];
    for (const body of cases) {
      const response = await post(baseUrl, body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ok: false });
    }
    const wrongType = await post(baseUrl, 'email=reader%40example.org', {
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(wrongType.status, 415);
    const malformedEncoding = await post(baseUrl, 'email=reader%ZZexample.org&website=');
    assert.equal(malformedEncoding.status, 400);

    await closeServer(server);
  });

  test('limits declared and chunked request bodies before parsing', async () => {
    const { server, baseUrl } = await makeRelay({ requestLimitBytes: 128, fetch: async () => assert.fail('upstream called') });
    const declared = await post(baseUrl, formBody({ message: 'x'.repeat(500) }));
    assert.equal(declared.status, 413);

    const url = new URL(`${baseUrl}/starter-request`);
    const chunkedStatus = await new Promise((resolve, reject) => {
      const request = http.request(url, {
        method: 'POST',
        headers: { Origin: websiteOrigin, 'Content-Type': 'application/x-www-form-urlencoded' },
      }, (response) => {
        response.resume();
        response.once('end', () => resolve(response.statusCode));
      });
      request.once('error', reject);
      request.write('email=reader%40example.org&message=');
      request.write('x'.repeat(500));
      request.end('&website=');
    });
    assert.equal(chunkedStatus, 413);

    await closeServer(server);
  });

  test('accepts maximum-length Unicode fields within the default byte limit', async () => {
    const { server, baseUrl } = await makeRelay({
      fetch: async (_url, init) => echoedMauticResponse(init),
    });
    const response = await post(baseUrl, formBody({
      organization: '界'.repeat(200),
      role: '界'.repeat(200),
      message: '界'.repeat(2000),
    }));
    assert.equal(response.status, 200);
    await closeServer(server);
  });

  test('rate limits by socket address and ignores forwarded IP claims', async () => {
    const { server, baseUrl } = await makeRelay({
      perIpLimit: 1,
      globalLimit: 100,
      fetch: async (_url, init) => echoedMauticResponse(init),
    });
    assert.equal((await post(baseUrl, formBody(), { headers: { 'X-Forwarded-For': '198.51.100.1' } })).status, 200);
    const limited = await post(baseUrl, formBody(), { headers: { 'X-Forwarded-For': '198.51.100.2' } });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { ok: false });
    assert.equal(limited.headers.get('retry-after'), '900');

    await closeServer(server);
  });

  test('enforces the bounded global request limit', async () => {
    const { server, baseUrl } = await makeRelay({
      perIpLimit: 100,
      globalLimit: 1,
      fetch: async (_url, init) => echoedMauticResponse(init),
    });
    assert.equal((await post(baseUrl)).status, 200);
    assert.equal((await post(baseUrl)).status, 429);
    await closeServer(server);
  });

  test('sanitizes upstream timeouts, network failures, redirects, oversized and invalid responses', async (t) => {
    const cases = [
      ['timeout', async (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })), 504],
      ['delayed body timeout', async (_url, init) => new Response(new ReadableStream({
        start(controller) {
          init.signal.addEventListener('abort', () => controller.error(init.signal.reason), { once: true });
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }), 504],
      ['network', async () => { throw new Error('private upstream detail'); }, 502],
      ['redirect', async () => new Response('', { status: 302, headers: { Location: 'https://elsewhere.example/' } }), 502],
      ['non-json', async () => new Response('<html>secret</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }), 502],
      ['malformed JSON', async () => new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } }), 502],
      ['oversized', async () => new Response(JSON.stringify({ padding: 'x'.repeat(65 * 1024) }), { status: 200, headers: { 'Content-Type': 'application/json' } }), 502],
      ['upstream error', async () => new Response('database detail', { status: 500 }), 502],
    ];
    for (const [name, fetchImpl, status] of cases) {
      await t.test(name, async () => {
        const { server, baseUrl } = await makeRelay({ fetch: fetchImpl, timeoutMs: 20 });
        const response = await post(baseUrl);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { ok: false });
        await closeServer(server);
      });
    }
  });

  test('requires exact Mautic success correlation without validation errors', async (t) => {
    const variants = [
      { success: '1', results: {} },
      { success: 1, results: { email: 'other@example.org', starter_id: 'professional-licensing', source_page: '/starters/professional-licensing/', request_token: 'wrong' } },
      { success: 1, results: { email: 'reader@example.org', starter_id: 'other', source_page: '/starters/professional-licensing/', request_token: 'wrong' } },
      { success: 1, results: { email: 'reader@example.org', starter_id: 'professional-licensing', source_page: '/other/', request_token: 'wrong' } },
      { success: 1, validationErrors: { email: ['Bad'] }, results: {} },
      { success: 1, errorMessage: 'Rejected', results: {} },
      { success: 1, validationErrors: [], results: {} },
      { success: 1, errorMessage: '', results: {} },
    ];
    for (const [index, payload] of variants.entries()) {
      await t.test(`variant ${index + 1}`, async () => {
        const { server, baseUrl } = await makeRelay({ fetch: async () => Response.json(payload) });
        const response = await post(baseUrl);
        assert.equal(response.status, 502);
        assert.deepEqual(await response.json(), { ok: false });
        await closeServer(server);
      });
    }
  });

  test('rejects missing or altered saved request fields', async (t) => {
    for (const field of ['organization', 'role', 'message']) {
      for (const mode of ['missing', 'altered']) {
        await t.test(`${mode} ${field}`, async () => {
          const { server, baseUrl } = await makeRelay({
            fetch: async (_url, init) => {
              const results = echoedMauticResults(init);
              if (mode === 'missing') delete results[field];
              else results[field] = `${results[field]} changed`;
              return Response.json({ success: 1, results });
            },
          });
          const response = await post(baseUrl);
          assert.equal(response.status, 502);
          assert.deepEqual(await response.json(), { ok: false });
          await closeServer(server);
        });
      }
    }
  });

  test('rejects unsafe startup configuration', () => {
    const base = { mauticBaseUrl: 'https://forms.example.org', mauticFormId: 7, websiteOrigin };
    for (const overrides of [
      { websiteOrigin: 'http://www.example.test' },
      { websiteOrigin: 'https://www.example.test/path' },
      { websiteOrigin: 'https://a.example https://b.example' },
      { mauticBaseUrl: 'http://forms.example.org' },
      { mauticBaseUrl: 'http://[2606:4700:4700::1111]' },
      { mauticBaseUrl: 'https://user:password@forms.example.org' },
      { mauticBaseUrl: 'https://forms.example.org/?query=yes' },
      { mauticBaseUrl: 'https://forms.example.org/#fragment' },
      { mauticFormId: 0 },
      { mauticFormId: '1.5' },
      { mauticTrackedFormId: 0 },
      { mauticTrackedFormId: '1.5' },
      { mauticTrackedFormId: 7 },
    ]) {
      assert.throws(() => createStarterRequestServer({ ...base, ...overrides }));
    }
    for (const mauticBaseUrl of ['http://mautic:8080', 'http://10.1.2.3', 'http://192.168.1.20', 'http://[fd00::1]']) {
      assert.doesNotThrow(() => createStarterRequestServer({ ...base, mauticBaseUrl }));
    }
    assert.doesNotThrow(() => createStarterRequestServer({
      ...base,
      websiteOrigin: 'http://127.0.0.1:4321',
      allowLoopbackWebsiteOrigin: true,
    }));
    assert.doesNotThrow(() => createStarterRequestServer({ ...base, mauticTrackedFormId: 8 }));
    assert.doesNotThrow(() => createStarterRequestServer({ ...base, mauticTrackedFormId: '' }));
  });
});
