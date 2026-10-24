import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRACKING_ALLOWED_ORIGINS,
  TRACKING_ASSOCIATION_ORIGIN,
  TRACKING_LOCAL_REFUSAL_STORAGE_KEY,
  TRACKING_PROTOCOL,
  TRACKING_PROTOCOL_VERSION,
  SHARED_TRACKING_BRIDGE_URL,
  createTrackingRequest,
  parseTrackingChanged,
  parseTrackingReady,
  parseTrackingRequest,
  parseTrackingResponse,
  trackingRequestId,
} from '../src/lib/tracking-protocol.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const generation = '00000000-0000-4000-8000-000000000002';
const envelope = { protocol: TRACKING_PROTOCOL, version: TRACKING_PROTOCOL_VERSION, id };
const state = {
  choice: 'accepted',
  generation,
  expiresAt: Date.UTC(2027, 3, 22),
  revision: Date.UTC(2026, 9, 24),
};

test('readiness contains no consent, identity, request, or surplus data', () => {
  const ready = { protocol: TRACKING_PROTOCOL, version: TRACKING_PROTOCOL_VERSION, type: 'ready' };
  assert.deepEqual(parseTrackingReady(ready), ready);
  for (const invalid of [
    null,
    { ...ready, version: 1 },
    { ...ready, protocol: 'other' },
    { ...ready, type: 'changed' },
    { ...ready, id },
    { ...ready, state },
    { ...ready, deviceId: 'a'.repeat(23) },
  ]) assert.equal(parseTrackingReady(invalid), null);
});

test('publishes the two exact enrolled origins and main-only association origin', () => {
  assert.deepEqual(TRACKING_ALLOWED_ORIGINS, [
    'https://registrystack.org',
    'https://docs.registrystack.org',
  ]);
  assert.equal(TRACKING_ASSOCIATION_ORIGIN, 'https://registrystack.org');
  assert.equal(SHARED_TRACKING_BRIDGE_URL, 'https://registrystack.org/tracking-bridge/');
  assert.equal(TRACKING_LOCAL_REFUSAL_STORAGE_KEY, 'registrystack.tracking-local-refusal.v2');
  assert.equal(Object.isFrozen(TRACKING_ALLOWED_ORIGINS), true);
});

test('creates strict version 2 requests with caller-supplied payloads', () => {
  assert.deepEqual(createTrackingRequest('read', {}, () => id), { ...envelope, type: 'read' });
  assert.deepEqual(
    createTrackingRequest('choose', { choice: 'accepted', expectedRevision: 0 }, () => id),
    { ...envelope, type: 'choose', choice: 'accepted', expectedRevision: 0 },
  );
  assert.deepEqual(
    createTrackingRequest('associate', { expectedGeneration: generation }, () => id),
    { ...envelope, type: 'associate', expectedGeneration: generation },
  );
});

test('accepts bounded canonical pageview requests and rejects surplus or private data', () => {
  const request = {
    ...envelope,
    type: 'pageview',
    expectedGeneration: generation,
    pageview: {
      page_url: 'https://docs.registrystack.org/start/',
      page_title: 'Start with Registry Stack',
      page_referrer: 'https://example.org',
      utm_source: 'conference',
      utm_medium: 'referral',
    },
  };
  assert.deepEqual(parseTrackingRequest(request), request);

  for (const invalid of [
    { ...request, extra: true },
    { ...request, id: 'not-a-uuid' },
    { ...request, expectedGeneration: undefined },
    { ...request, expectedGeneration: 'old' },
    { ...request, pageview: { ...request.pageview, private: 'person@example.org' } },
    { ...request, pageview: { ...request.pageview, page_url: 'https://docs.registrystack.org/start/?email=person@example.org' } },
    { ...request, pageview: { ...request.pageview, page_title: 'x'.repeat(201) } },
    { ...request, pageview: { ...request.pageview, page_referrer: 'https://example.org/path' } },
    { ...request, pageview: { ...request.pageview, utm_source: 'person@example.org' } },
  ]) assert.equal(parseTrackingRequest(invalid), null);
});

test('rejects malformed choice and association requests while preserving safe error correlation', () => {
  assert.deepEqual(parseTrackingRequest({ ...envelope, type: 'choose', choice: 'rejected', expectedRevision: 10 }), {
    ...envelope,
    type: 'choose',
    choice: 'rejected',
    expectedRevision: 10,
  });
  assert.equal(parseTrackingRequest({ ...envelope, type: 'choose', choice: 'accepted' }), null);
  assert.equal(parseTrackingRequest({ ...envelope, type: 'choose', choice: 'accepted', expectedRevision: -1 }), null);
  assert.equal(parseTrackingRequest({ ...envelope, type: 'choose', choice: 'later' }), null);
  assert.equal(parseTrackingRequest({ ...envelope, type: 'associate', expectedGeneration: 'old' }), null);
  assert.equal(trackingRequestId({ ...envelope, type: 'unknown' }), id);
  assert.equal(trackingRequestId({ ...envelope, id: 'unsafe', type: 'read' }), null);
});

test('parses exact success, error, and changed messages without accepting identity leakage', () => {
  const success = { ...envelope, ok: true, state, deviceId: 'abcdefghij0123456789abc' };
  const failure = { ...envelope, ok: false, error: 'unavailable' };
  const changed = { protocol: TRACKING_PROTOCOL, version: TRACKING_PROTOCOL_VERSION, type: 'changed', state };
  assert.deepEqual(parseTrackingResponse(success), success);
  assert.deepEqual(parseTrackingResponse(failure), failure);
  assert.deepEqual(parseTrackingChanged(changed), changed);

  assert.equal(parseTrackingResponse({ ...success, debug: 'device=secret' }), null);
  assert.equal(parseTrackingResponse({ ...failure, deviceId: 'abcdefghij0123456789abc' }), null);
  assert.equal(parseTrackingChanged({ ...changed, id }), null);
  assert.equal(parseTrackingChanged({ ...changed, state: { ...state, deviceId: 'abcdefghij0123456789abc' } }), null);
});
