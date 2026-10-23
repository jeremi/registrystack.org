import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { checkExternalLink, isVerifiedBotBlock, mapWithConcurrency } from '../scripts/check-links-http.mjs';

test('a verified bot block applies only to the exact citation and HTTP 403', () => {
  const citation = 'https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/12/digital-public-infrastructure-for-digital-governments_11fe17d9/ff525dc8-en.pdf';
  assert.equal(isVerifiedBotBlock(citation, 403), true);
  assert.equal(isVerifiedBotBlock(citation, 404), false);
  assert.equal(isVerifiedBotBlock(citation, 'fetch failed: timeout'), false);
  assert.equal(isVerifiedBotBlock('https://www.oecd.org/missing.pdf', 403), false);
});

const withServer = async (handler, run) => {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.once('close', resolve));
  }
};

test('falls back from a rejected HEAD to GET and cancels an unneeded response body', async () => {
  const methods = [];
  await withServer((request, response) => {
    methods.push(request.method);
    if (request.method === 'HEAD') {
      response.writeHead(405);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.write('body stays open until the client cancels it');
  }, async (origin) => {
    const result = await checkExternalLink(`${origin}/head-rejected`, { timeoutMs: 200 });
    assert.deepEqual(result, { ok: true, status: 200 });
    assert.deepEqual(methods, ['HEAD', 'GET']);
  });
});

test('returns the final non-success response after the GET fallback', async () => {
  const methods = [];
  await withServer((request, response) => {
    methods.push(request.method);
    response.writeHead(503);
    response.end();
  }, async (origin) => {
    const result = await checkExternalLink(`${origin}/unavailable`, { timeoutMs: 200 });
    assert.deepEqual(result, { ok: false, status: 503 });
    assert.deepEqual(methods, ['HEAD', 'GET']);
  });
});

test('times out hung HEAD and GET requests', async () => {
  const methods = [];
  await withServer((request) => {
    methods.push(request.method);
  }, async (origin) => {
    const startedAt = Date.now();
    const result = await checkExternalLink(`${origin}/hung`, { timeoutMs: 50 });
    assert.equal(result.ok, false);
    assert.match(String(result.status), /fetch failed: request timed out after 50ms/);
    assert.deepEqual(methods, ['HEAD', 'GET']);
    assert.ok(Date.now() - startedAt < 500, 'hung requests should finish within the bounded deadline');
  });
});

test('maps link checks with bounded concurrency', async () => {
  let active = 0;
  let maximumActive = 0;
  await withServer((_request, response) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    setTimeout(() => {
      response.writeHead(204);
      response.end();
      active -= 1;
    }, 30);
  }, async (origin) => {
    const links = Array.from({ length: 9 }, (_, index) => `${origin}/link-${index}`);
    const results = await mapWithConcurrency(links, 3, (href) =>
      checkExternalLink(href, { timeoutMs: 200 }));
    assert.equal(results.length, links.length);
    assert.ok(results.every((result) => result.ok));
    assert.equal(maximumActive, 3);
  });
});
