import { randomUUID } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STARTER_ID = 'professional-licensing';
const SOURCE_PAGE = '/starters/professional-licensing/';
const USER_AGENT = 'RegistryStack-Starter-Request/1.0';
const ALLOWED_FIELDS = new Set(['email', 'organization', 'role', 'message', 'website']);

class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function positiveInteger(value, name, defaultValue) {
  const candidate = value ?? defaultValue;
  const parsed = typeof candidate === 'string' && /^\d+$/.test(candidate) ? Number(candidate) : candidate;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${name}.`);
  return parsed;
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' ||
    hostname.endsWith('.localhost');
}

function isInternalHttpHost(hostname) {
  if (isLoopback(hostname) || !hostname.includes('.') || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return true;
  }
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function parseMauticBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new Error('Invalid MAUTIC_BASE_URL.');
  }
  const secure = url.protocol === 'https:';
  const internalHttp = url.protocol === 'http:' && isInternalHttpHost(url.hostname);
  if ((!secure && !internalHttp) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid MAUTIC_BASE_URL.');
  }
  return url;
}

function parseWebsiteOrigin(value, allowLoopback) {
  const configured = String(value ?? '').trim();
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('Invalid WEBSITE_ORIGIN.');
  }
  const permittedProtocol = url.protocol === 'https:' ||
    (allowLoopback && url.protocol === 'http:' && isLoopback(url.hostname));
  if (!permittedProtocol || url.username || url.password || configured !== url.origin) {
    throw new Error('Invalid WEBSITE_ORIGIN.');
  }
  return url.origin;
}

function baseHeaders(request, websiteOrigin) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (request.headers.origin === websiteOrigin) headers['Access-Control-Allow-Origin'] = websiteOrigin;
  return headers;
}

function sendJson(request, response, websiteOrigin, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  response.writeHead(status, {
    ...baseHeaders(request, websiteOrigin),
    ...extraHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  response.end(data);
}

function validateFormEncoding(raw) {
  for (const pair of raw.split('&')) {
    for (const part of pair.split('=', 2)) {
      try {
        decodeURIComponent(part.replaceAll('+', ' '));
      } catch {
        throw new RequestError(400, 'invalid_form');
      }
    }
  }
}

function parseForm(raw) {
  validateFormEncoding(raw);
  const params = new URLSearchParams(raw);
  for (const key of params.keys()) {
    if (!ALLOWED_FIELDS.has(key) || params.getAll(key).length !== 1) {
      throw new RequestError(400, 'invalid_form');
    }
  }

  const email = (params.get('email') ?? '').trim();
  const organization = (params.get('organization') ?? '').trim();
  const role = (params.get('role') ?? '').trim();
  const message = (params.get('message') ?? '').trim();
  const website = (params.get('website') ?? '').trim();
  const saneEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  if (!email || email.length > 254 || !saneEmail.test(email) ||
      organization.length > 200 || role.length > 200 || message.length > 2000 || website) {
    throw new RequestError(400, 'invalid_form');
  }
  return { email, organization, role, message };
}

async function readRequestBody(request, limitBytes) {
  const declaredLength = request.headers['content-length'];
  if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > limitBytes)) {
    request.resume();
    throw new RequestError(413, 'request_too_large');
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        chunks.length = 0;
        settled = true;
        request.resume();
        reject(new RequestError(413, 'request_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    request.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size).toString('utf8'));
    });
    request.once('aborted', () => fail(new RequestError(400, 'aborted_request')));
    request.once('error', () => fail(new RequestError(400, 'request_error')));
  });
}

async function readResponseBody(response, limitBytes) {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > limitBytes) {
    await response.body?.cancel();
    throw new Error('Oversized upstream response.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limitBytes) {
      await reader.cancel();
      throw new Error('Oversized upstream response.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size).toString('utf8');
}

async function submitToMautic(config, fields) {
  const requestToken = randomUUID();
  const body = new URLSearchParams({
    'mauticform[email]': fields.email,
    'mauticform[organization]': fields.organization,
    'mauticform[role]': fields.role,
    'mauticform[message]': fields.message,
    'mauticform[starter_id]': STARTER_ID,
    'mauticform[source_page]': SOURCE_PAGE,
    'mauticform[request_token]': requestToken,
    'mauticform[website]': '',
    'mauticform[formId]': String(config.mauticFormId),
  });
  const target = new URL('/form/submit?ajax=1', config.mauticBaseUrl);
  const abortController = new AbortController();
  let timedOut = false;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
      reject(new Error('Upstream timeout.'));
    }, config.timeoutMs);
  });

  try {
    const exchange = async () => {
      const upstream = await config.fetch(target, {
        method: 'POST',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          DNT: '1',
          'User-Agent': USER_AGENT,
        },
        body,
        signal: abortController.signal,
      });
      if (upstream.status < 200 || upstream.status >= 300) throw new RequestError(502, 'upstream_failure');
      const contentType = upstream.headers.get('content-type') ?? '';
      if (!/(?:^|\s|;)application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) {
        await upstream.body?.cancel();
        throw new RequestError(502, 'upstream_failure');
      }
      try {
        return JSON.parse(await readResponseBody(upstream, config.responseLimitBytes));
      } catch {
        throw new RequestError(502, 'upstream_failure');
      }
    };
    const payload = await Promise.race([exchange(), timeout]);
    if (payload?.success !== 1 || !payload.results ||
        payload.results.request_token !== requestToken ||
        payload.results.starter_id !== STARTER_ID ||
        payload.results.source_page !== SOURCE_PAGE ||
        payload.results.email !== fields.email ||
        payload.results.organization !== fields.organization ||
        payload.results.role !== fields.role ||
        payload.results.message !== fields.message ||
        Object.hasOwn(payload, 'validationErrors') || Object.hasOwn(payload, 'errorMessage')) {
      throw new RequestError(502, 'upstream_failure');
    }
  } catch (error) {
    if (timedOut) throw new RequestError(504, 'upstream_timeout');
    if (error instanceof RequestError) throw error;
    throw new RequestError(502, 'upstream_failure');
  } finally {
    clearTimeout(timer);
  }
}

function createRateLimiter({ perIpLimit, globalLimit, rateWindowMs, maxTrackedIps, now }) {
  let windowStart = now();
  let globalCount = 0;
  const perIp = new Map();

  return (address) => {
    const current = now();
    if (current - windowStart >= rateWindowMs) {
      windowStart = current;
      globalCount = 0;
      perIp.clear();
    }
    const key = address || 'unknown';
    const count = perIp.get(key) ?? 0;
    const retryAfter = Math.max(1, Math.ceil((rateWindowMs - (current - windowStart)) / 1000));
    if (globalCount >= globalLimit || count >= perIpLimit || (!perIp.has(key) && perIp.size >= maxTrackedIps)) {
      return { allowed: false, retryAfter };
    }
    globalCount += 1;
    perIp.set(key, count + 1);
    return { allowed: true, retryAfter };
  };
}

export function createStarterRequestServer(options = {}) {
  const config = {
    mauticBaseUrl: parseMauticBaseUrl(options.mauticBaseUrl),
    mauticFormId: positiveInteger(options.mauticFormId, 'MAUTIC_FORM_ID'),
    websiteOrigin: parseWebsiteOrigin(options.websiteOrigin, options.allowLoopbackWebsiteOrigin === true),
    fetch: options.fetch ?? globalThis.fetch,
    requestLimitBytes: positiveInteger(options.requestLimitBytes, 'requestLimitBytes', 32 * 1024),
    responseLimitBytes: positiveInteger(options.responseLimitBytes, 'responseLimitBytes', 64 * 1024),
    timeoutMs: positiveInteger(options.timeoutMs, 'timeoutMs', 15_000),
    perIpLimit: positiveInteger(options.perIpLimit, 'perIpLimit', 100),
    globalLimit: positiveInteger(options.globalLimit, 'globalLimit', 300),
    rateWindowMs: positiveInteger(options.rateWindowMs, 'rateWindowMs', 15 * 60 * 1000),
    maxTrackedIps: positiveInteger(options.maxTrackedIps, 'maxTrackedIps', 10_000),
  };
  if (typeof config.fetch !== 'function') throw new Error('A fetch implementation is required.');
  const checkRateLimit = createRateLimiter({ ...config, now: options.now ?? Date.now });

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://relay.invalid');
      if (requestUrl.search || requestUrl.hash) throw new RequestError(404, 'not_found');

      if (requestUrl.pathname === '/healthz') {
        if (request.method !== 'GET') {
          sendJson(request, response, config.websiteOrigin, 405, { ok: false }, { Allow: 'GET' });
          return;
        }
        sendJson(request, response, config.websiteOrigin, 200, { ok: true });
        return;
      }

      if (requestUrl.pathname !== '/starter-request') throw new RequestError(404, 'not_found');

      if (request.method === 'OPTIONS') {
        const requestedMethod = request.headers['access-control-request-method'];
        const requestedHeaders = (request.headers['access-control-request-headers'] ?? '')
          .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
        if (request.headers.origin !== config.websiteOrigin || requestedMethod !== 'POST' ||
            requestedHeaders.some((header) => header !== 'content-type')) {
          throw new RequestError(403, 'forbidden');
        }
        response.writeHead(204, {
          ...baseHeaders(request, config.websiteOrigin),
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        response.end();
        return;
      }

      if (request.method !== 'POST') {
        sendJson(request, response, config.websiteOrigin, 405, { ok: false }, { Allow: 'POST, OPTIONS' });
        return;
      }
      if (request.headers.origin !== config.websiteOrigin) throw new RequestError(403, 'forbidden');

      const rate = checkRateLimit(request.socket.remoteAddress);
      if (!rate.allowed) {
        sendJson(request, response, config.websiteOrigin, 429, { ok: false }, { 'Retry-After': String(rate.retryAfter) });
        return;
      }

      const contentType = (request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/x-www-form-urlencoded') throw new RequestError(415, 'unsupported_media_type');
      const contentEncoding = (request.headers['content-encoding'] ?? 'identity').trim().toLowerCase();
      if (contentEncoding !== 'identity') throw new RequestError(415, 'unsupported_media_type');
      const fields = parseForm(await readRequestBody(request, config.requestLimitBytes));
      await submitToMautic(config, fields);
      sendJson(request, response, config.websiteOrigin, 200, { ok: true });
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      if (!response.headersSent) sendJson(request, response, config.websiteOrigin, status, { ok: false });
      else response.end();
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const server = createStarterRequestServer({
      mauticBaseUrl: process.env.MAUTIC_BASE_URL,
      mauticFormId: process.env.MAUTIC_FORM_ID,
      websiteOrigin: process.env.WEBSITE_ORIGIN,
      perIpLimit: process.env.PER_IP_RATE_LIMIT,
      globalLimit: process.env.GLOBAL_RATE_LIMIT,
    });
    const port = positiveInteger(process.env.PORT, 'PORT', 3000);
    server.on('error', () => {
      console.error('Starter request service failed to start.');
      process.exitCode = 1;
    });
    server.listen(port, '0.0.0.0');
  } catch {
    console.error('Starter request service configuration is invalid.');
    process.exitCode = 1;
  }
}
