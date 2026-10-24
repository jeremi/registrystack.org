import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from '@astrojs/compiler';

import {
  TRACKING_CONSENT_STORAGE_KEY,
  TRACKING_IDENTITY_STORAGE_KEY,
  TRACKING_LOCAL_REFUSAL_STORAGE_KEY,
  TRACKING_PROTOCOL,
  TRACKING_PROTOCOL_VERSION,
} from '../src/lib/tracking-protocol.mjs';
import { createTrackingBroker } from '../src/lib/tracking-broker.mjs';

const mainOrigin = 'https://registrystack.org';
const docsOrigin = 'https://docs.registrystack.org';
const requestId = '00000000-0000-4000-8000-000000000001';
const chooseRequestId = '00000000-0000-4000-8000-000000000002';
const pageviewRequestId = '00000000-0000-4000-8000-000000000003';
const associationRequestId = '00000000-0000-4000-8000-000000000004';
const firstGeneration = '00000000-0000-4000-8000-000000000011';
const secondGeneration = '00000000-0000-4000-8000-000000000012';
const thirdGeneration = '00000000-0000-4000-8000-000000000013';
const firstAttempt = '00000000-0000-4000-8000-000000000021';
const secondAttempt = '00000000-0000-4000-8000-000000000022';
const deviceId = 'abcdefghij0123456789abc';
const now = Date.UTC(2026, 9, 24);
const bridgePageUrl = new URL('../src/pages/tracking-bridge.astro', import.meta.url);

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class SerialLocks {
  tails = new Map();

  request(name, options, callback) {
    const tail = this.tails.get(name) ?? Promise.resolve();
    const signal = options?.signal;
    let queued;
    const result = new Promise((resolve, reject) => {
      let started = false;
      const onAbort = () => {
        if (!started) reject(signal.reason ?? new Error('Lock request aborted.'));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
      queued = tail.then(async () => {
        if (signal?.aborted) {
          signal.removeEventListener('abort', onAbort);
          return;
        }
        started = true;
        signal?.removeEventListener('abort', onAbort);
        try {
          resolve(await callback());
        } catch (error) {
          reject(error);
        }
      });
    });
    this.tails.set(name, (queued ?? tail).catch(() => undefined));
    return result;
  }
}

class MessageSource {
  messages = [];

  postMessage(message, targetOrigin) {
    this.messages.push({ message, targetOrigin });
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function pageview(origin = mainOrigin) {
  return {
    page_url: `${origin}/pricing/`,
    page_title: 'Pricing | Registry Stack',
    page_referrer: '',
    utm_source: 'conference',
  };
}

function pageviewPayload(tracked = pageview(), expectedGeneration = firstGeneration) {
  return { expectedGeneration, pageview: tracked };
}

function request(type, fields = {}, id = ({
  read: requestId,
  choose: chooseRequestId,
  pageview: pageviewRequestId,
  associate: associationRequestId,
}[type] ?? requestId)) {
  return { protocol: TRACKING_PROTOCOL, version: TRACKING_PROTOCOL_VERSION, id, type, ...fields };
}

function harness(overrides = {}) {
  const storage = overrides.storage ?? new MemoryStorage();
  const source = overrides.source ?? new MessageSource();
  const listeners = new Map();
  const navigator = overrides.navigator ?? { doNotTrack: '0', globalPrivacyControl: false };
  const document = overrides.document ?? {};
  const currentWindow = {
    parent: source,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const ids = [firstGeneration, firstAttempt, secondGeneration, secondAttempt, thirdGeneration];
  const nativeCalls = [];
  const sendNativePageview = Object.hasOwn(overrides, 'sendNativePageview')
    ? overrides.sendNativePageview
    : (async ({ pageview: sent }) => {
      nativeCalls.push(sent);
      storage.setItem('mautic_device_id', deviceId);
    });
  const broker = createTrackingBroker({
    window: currentWindow,
    document,
    navigator,
    storage,
    locks: overrides.locks === undefined ? new SerialLocks() : overrides.locks,
    mauticUrl: Object.hasOwn(overrides, 'mauticUrl')
      ? overrides.mauticUrl
      : 'https://mautic.example.org',
    now: overrides.now ?? (() => now),
    randomUUID: overrides.randomUUID ?? (() => ids.shift()),
    sendNativePageview,
    onInvalidated: overrides.onInvalidated,
    bootstrapTimeoutMs: overrides.bootstrapTimeoutMs ?? 100,
    setTimer: overrides.setTimer,
    clearTimer: overrides.clearTimer,
    console: { error() {} },
  });
  const send = async (data, origin = mainOrigin, messageSource = source) => {
    await broker.handleMessage({ data, origin, source: messageSource });
    return source.messages.at(-1)?.message;
  };
  return { broker, storage, source, listeners, nativeCalls, navigator, currentWindow, send };
}

test('read is side-effect free for Mautic and rejects wrong origins or window sources', async () => {
  const { broker, source, nativeCalls, send } = harness();
  assert.deepEqual(await send(request('read')), {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: requestId,
    ok: true,
    state: { choice: null, generation: null, expiresAt: null, revision: 0 },
  });
  assert.deepEqual(nativeCalls, []);

  const before = source.messages.length;
  await broker.handleMessage({ data: request('read'), origin: 'https://evil.example', source });
  await broker.handleMessage({ data: request('read'), origin: mainOrigin, source: new MessageSource() });
  assert.equal(source.messages.length, before);
});

test('v1 consent and native identity never become shared acceptance', async () => {
  const storage = new MemoryStorage();
  storage.setItem('registrystack.marketing-tracking', JSON.stringify({
    version: 1,
    choice: 'accepted',
    expiresAt: now + 1000,
  }));
  storage.setItem('mtc_id', 'old-contact');
  storage.setItem('mautic_device_id', deviceId);
  const { send, nativeCalls } = harness({ storage });
  const response = await send(request('read'));
  assert.equal(response.state.choice, null);
  assert.notEqual(storage.getItem('registrystack.marketing-tracking'), null);
  assert.equal(storage.getItem('mtc_id'), null);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.deepEqual(nativeCalls, []);
});

test('accepted pageview bootstraps one server identity and main-only association reads it fresh', async () => {
  const { send, storage, nativeCalls } = harness();
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.deepEqual(accepted.state, {
    choice: 'accepted',
    generation: firstGeneration,
    expiresAt: now + 180 * 24 * 60 * 60 * 1000,
    revision: now,
  });

  const tracked = await send(request('pageview', pageviewPayload()));
  assert.equal(tracked.ok, true);
  assert.equal(nativeCalls.length, 1);
  assert.equal(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)).deviceId, deviceId);

  const association = await send(request('associate', { expectedGeneration: firstGeneration }));
  assert.equal(association.deviceId, deviceId);
  const docsAssociation = await send(
    request('associate', { expectedGeneration: firstGeneration }, '00000000-0000-4000-8000-000000000005'),
    docsOrigin,
  );
  assert.deepEqual(docsAssociation, {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: '00000000-0000-4000-8000-000000000005',
    ok: false,
    error: 'not-allowed',
  });
});

test('choose compares the caller revision before mutating shared consent', async () => {
  const { send } = harness();
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const rejected = await send(request('choose', {
    choice: 'rejected',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000062'));
  const staleAcceptance = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000063'));
  assert.deepEqual(staleAcceptance, {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: '00000000-0000-4000-8000-000000000063',
    ok: false,
    error: 'unavailable',
  });
  assert.deepEqual((await send(request('read', {}, '00000000-0000-4000-8000-000000000064'))).state, rejected.state);
});

test('a queued pageview cannot cross a refusal and reacceptance generation', async () => {
  const { send, nativeCalls } = harness();
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const rejected = await send(request('choose', {
    choice: 'rejected',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000065'));
  const reaccepted = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: rejected.state.revision,
  }, '00000000-0000-4000-8000-000000000066'));

  const response = await send(request('pageview', pageviewPayload(pageview(), accepted.state.generation)));
  assert.equal(reaccepted.state.choice, 'accepted');
  assert.notEqual(reaccepted.state.generation, accepted.state.generation);
  assert.equal(response.ok, false);
  assert.equal(response.error, 'unavailable');
  assert.deepEqual(nativeCalls, []);
});

test('the configured native sender loads mtc.js only for an accepted pageview', async () => {
  const scripts = [];
  const document = {
    querySelector() { return null; },
    createElement() {
      return {
        dataset: {},
        addEventListener(type, listener) { this[type] = listener; },
      };
    },
    head: {
      append(script) { scripts.push(script); },
    },
  };
  const { send, storage, currentWindow } = harness({ document, sendNativePageview: null });
  await send(request('read'));
  assert.equal(scripts.length, 0);
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));

  const pending = send(request('pageview', pageviewPayload()));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://mautic.example.org/mtc.js');
  assert.deepEqual(currentWindow.mt.q[0].slice(0, 3), ['send', 'pageview', pageview()]);

  storage.setItem('mautic_device_id', deviceId);
  currentWindow.mt.q[0][3].onload();
  assert.equal((await pending).ok, true);

  const later = send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000106',
  ));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(currentWindow.mt.q[1].slice(0, 3), [
    'send',
    'pageview',
    { ...pageview(), mautic_device_id: deviceId },
  ]);
  currentWindow.mt.q[1][3].onload();
  assert.equal((await later).ok, true);
});

test('tracking remains unavailable when the public Mautic origin is unset', async () => {
  const { send } = harness({ mauticUrl: undefined, sendNativePageview: null });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.deepEqual(await send(request('pageview', pageviewPayload())), {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: pageviewRequestId,
    ok: false,
    error: 'unavailable',
  });
});

test('a delivered pageview without a native ID remains accepted but unavailable for association', async () => {
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    sendNativePageview: async () => {},
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));

  const tracked = await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000097',
  ));
  assert.equal(tracked.ok, true);
  assert.deepEqual(tracked.state, accepted.state);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(storage.getItem('mautic_device_id'), null);

  const association = await send(request(
    'associate',
    { expectedGeneration: accepted.state.generation },
    '00000000-0000-4000-8000-000000000098',
  ));
  assert.equal(association.ok, false);
  assert.equal(association.error, 'unavailable');
  assert.equal('deviceId' in association, false);
});

test('the first native event is serialized and a pending generation is never retried', async () => {
  const first = deferred();
  let nativeCount = 0;
  const { send, storage } = harness({
    sendNativePageview: async () => {
      nativeCount += 1;
      await first.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const firstRequest = send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000031'));
  await Promise.resolve();
  const secondRequest = send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000032'));
  await Promise.resolve();
  assert.equal(nativeCount, 1);
  first.reject(new Error('uncertain native result'));
  assert.equal((await firstRequest).ok, false);
  assert.equal((await secondRequest).ok, false);
  assert.equal(nativeCount, 1);
});

test('a timed-out bootstrap promotes an existing native device without creating another identity', async () => {
  const first = deferred();
  let nativeCount = 0;
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    bootstrapTimeoutMs: 5,
    sendNativePageview: async () => {
      nativeCount += 1;
      storage.setItem('mautic_device_id', deviceId);
      if (nativeCount === 1) await first.promise;
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));

  const initial = await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000081',
  ));
  assert.equal(initial.ok, false);
  assert.equal(nativeCount, 1);

  const recovered = await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000082',
  ));
  assert.equal(recovered.ok, true);
  assert.equal(nativeCount, 2);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), {
    version: 2,
    generation: firstGeneration,
    status: 'ready',
    deviceId,
  });
});

test('a timed-out queued Web Lock callback never performs native side effects', async () => {
  const locks = new SerialLocks();
  const holder = deferred();
  const acquired = deferred();
  const held = locks.request('registrystack-mautic-device-v2', {}, async () => {
    acquired.resolve();
    await holder.promise;
  });
  await acquired.promise;
  let nativeCount = 0;
  const storage = new MemoryStorage();
  const { send } = harness({
    locks,
    storage,
    bootstrapTimeoutMs: 5,
    sendNativePageview: async () => { nativeCount += 1; },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));

  const pending = send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000083',
  ));
  const atDeadline = await Promise.race([
    pending,
    new Promise(resolve => setTimeout(() => resolve('still-waiting'), 20)),
  ]);
  holder.resolve();
  await held;
  const response = await pending;

  assert.deepEqual({
    completedBeforeRelease: atDeadline !== 'still-waiting',
    nativeCount,
    identity: storage.getItem(TRACKING_IDENTITY_STORAGE_KEY),
    rawDevice: storage.getItem('mautic_device_id'),
  }, {
    completedBeforeRelease: true,
    nativeCount: 0,
    identity: null,
    rawDevice: null,
  });
  assert.equal(response.ok, false);
  assert.equal(response.error, 'unavailable');
});

test('an explicit acceptance retry rotates a stranded generation and invalidates after responding', async () => {
  const events = [];
  const source = new MessageSource();
  const originalPost = source.postMessage.bind(source);
  source.postMessage = (message, origin) => {
    originalPost(message, origin);
    if (message.id) events.push(`response:${message.id}:${message.ok}`);
  };
  const { send, storage } = harness({
    source,
    sendNativePageview: async () => { throw new Error('native bootstrap failed'); },
    onInvalidated: () => events.push('invalidated'),
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const failed = await send(request('pageview', pageviewPayload()));
  assert.equal(failed.ok, false);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), {
    version: 2,
    generation: firstGeneration,
    status: 'pending',
    attemptId: firstAttempt,
  });
  assert.equal(storage.getItem('mautic_device_id'), null);

  events.length = 0;
  const retryId = '00000000-0000-4000-8000-000000000084';
  const retried = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: accepted.state.revision,
  }, retryId));
  assert.equal(retried.ok, true);
  assert.equal(retried.state.choice, 'accepted');
  assert.equal(retried.state.generation, secondGeneration);
  assert.equal(retried.state.revision, accepted.state.revision + 1);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(events.indexOf(`response:${retryId}:true`) < events.indexOf('invalidated'));
  assert.equal(events.filter(event => event === 'invalidated').length, 1);
});

test('a stale bootstrap callback cannot erase a newer pending generation', async () => {
  const stale = deferred();
  const staleReturned = deferred();
  const current = deferred();
  const currentStarted = deferred();
  const storage = new MemoryStorage();
  let nativeCount = 0;
  const { send } = harness({
    storage,
    bootstrapTimeoutMs: 30,
    onInvalidated() {},
    sendNativePageview: async () => {
      nativeCount += 1;
      if (nativeCount === 1) {
        await stale.promise;
        storage.setItem('mautic_device_id', deviceId);
        staleReturned.resolve();
        return;
      }
      currentStarted.resolve();
      await current.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000090',
  ))).ok, false);

  const retried = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000091'));
  const currentPageview = send(request(
    'pageview',
    pageviewPayload(pageview(), retried.state.generation),
    '00000000-0000-4000-8000-000000000092',
  ));
  await currentStarted.promise;
  const currentPending = JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY));

  stale.resolve();
  await staleReturned.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), currentPending);
  assert.equal(storage.getItem('mautic_device_id'), null);

  current.resolve();
  assert.equal((await currentPageview).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), {
    version: 2,
    generation: retried.state.generation,
    status: 'ready',
    deviceId,
  });
});

test('a stale bootstrap callback cannot replace a newer ready identity', async () => {
  const stale = deferred();
  const staleReturned = deferred();
  const storage = new MemoryStorage();
  const replacementDeviceId = 'zyxwvutsrq9876543210abc';
  const staleContactId = '41';
  const replacementContactId = '42';
  let nativeCount = 0;
  const { send } = harness({
    storage,
    bootstrapTimeoutMs: 30,
    onInvalidated() {},
    sendNativePageview: async () => {
      nativeCount += 1;
      if (nativeCount === 1) {
        await stale.promise;
        storage.setItem('mtc_id', staleContactId);
        storage.setItem('mautic_device_id', deviceId);
        staleReturned.resolve();
        return;
      }
      storage.setItem('mtc_id', replacementContactId);
      storage.setItem('mautic_device_id', replacementDeviceId);
    },
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000103',
  ))).ok, false);

  const retried = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000104'));
  assert.equal((await send(request(
    'pageview',
    pageviewPayload(pageview(), retried.state.generation),
    '00000000-0000-4000-8000-000000000105',
  ))).ok, true);
  const currentReady = JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY));
  assert.equal(currentReady.deviceId, replacementDeviceId);
  assert.equal(storage.getItem('mtc_id'), replacementContactId);

  stale.resolve();
  await staleReturned.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), currentReady);
  assert.equal(storage.getItem('mautic_device_id'), replacementDeviceId);
  assert.equal(storage.getItem('mtc_id'), null);
});

test('a stale ready-pageview callback cannot erase a newer pending generation', async () => {
  const stale = deferred();
  const staleReturned = deferred();
  const current = deferred();
  const currentStarted = deferred();
  const storage = new MemoryStorage();
  const replacementDeviceId = 'zyxwvutsrq9876543210abc';
  let nativeCount = 0;
  const { send } = harness({
    storage,
    bootstrapTimeoutMs: 30,
    onInvalidated() {},
    sendNativePageview: async () => {
      nativeCount += 1;
      if (nativeCount === 1) {
        storage.setItem('mautic_device_id', deviceId);
        return;
      }
      if (nativeCount === 2) {
        await stale.promise;
        storage.setItem('mautic_device_id', deviceId);
        staleReturned.resolve();
        return;
      }
      currentStarted.resolve();
      await current.promise;
      storage.setItem('mautic_device_id', replacementDeviceId);
    },
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await send(request('pageview', pageviewPayload()))).ok, true);
  assert.equal((await send(request(
    'pageview',
    pageviewPayload(),
    '00000000-0000-4000-8000-000000000093',
  ))).ok, false);

  const rejected = await send(request('choose', {
    choice: 'rejected',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000094'));
  const reaccepted = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: rejected.state.revision,
  }, '00000000-0000-4000-8000-000000000095'));
  const currentPageview = send(request(
    'pageview',
    pageviewPayload(pageview(), reaccepted.state.generation),
    '00000000-0000-4000-8000-000000000096',
  ));
  await currentStarted.promise;
  const currentPending = JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY));

  stale.resolve();
  await staleReturned.promise;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), currentPending);
  assert.equal(storage.getItem('mautic_device_id'), null);

  current.resolve();
  assert.equal((await currentPageview).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), {
    version: 2,
    generation: reaccepted.state.generation,
    status: 'ready',
    deviceId: replacementDeviceId,
  });
});

test('a stale acceptance retry cannot override a newer rejection', async () => {
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    sendNativePageview: async () => { throw new Error('native bootstrap failed'); },
  });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await send(request('pageview', pageviewPayload()))).ok, false);
  const rejected = await send(request('choose', {
    choice: 'rejected',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000085'));

  const staleRetry = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000086'));
  assert.equal(staleRetry.ok, false);
  assert.equal(staleRetry.error, 'unavailable');
  const current = await send(request('read', {}, '00000000-0000-4000-8000-000000000087'));
  assert.deepEqual(current.state, rejected.state);
  assert.equal(current.state.choice, 'rejected');
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(storage.getItem('mautic_device_id'), null);
});

test('DNT and GPC prevent a stranded accepted generation from being retried', async () => {
  for (const privacySignal of ['doNotTrack', 'globalPrivacyControl']) {
    const navigator = { doNotTrack: '0', globalPrivacyControl: false };
    const storage = new MemoryStorage();
    const { send } = harness({
      navigator,
      storage,
      sendNativePageview: async () => { throw new Error('native bootstrap failed'); },
    });
    const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
    assert.equal((await send(request('pageview', pageviewPayload()))).ok, false);
    if (privacySignal === 'doNotTrack') navigator.doNotTrack = '1';
    else navigator.globalPrivacyControl = true;

    const retry = await send(request('choose', {
      choice: 'accepted',
      expectedRevision: accepted.state.revision,
    }, '00000000-0000-4000-8000-000000000088'));
    assert.equal(retry.ok, false);
    assert.equal(retry.error, 'not-allowed');
    const persisted = JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY));
    assert.equal(persisted.choice, 'accepted');
    assert.equal(persisted.generation, firstGeneration);

    const current = await send(request('read', {}, '00000000-0000-4000-8000-000000000089'));
    assert.equal(current.state.choice, 'rejected');
    assert.notEqual(current.state.generation, firstGeneration);
    assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
    assert.equal(storage.getItem('mautic_device_id'), null);
  }
});

test('later native pageviews release the Web Lock after the bounded timeout', async () => {
  let calls = 0;
  const never = deferred();
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    bootstrapTimeoutMs: 5,
    sendNativePageview: async () => {
      calls += 1;
      if (calls === 2) await never.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await send(request('pageview', pageviewPayload()))).ok, true);
  assert.equal((await send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000071'))).ok, false);
  assert.equal((await send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000072'))).ok, true);
  assert.equal(calls, 3);
});

test('a late later-pageview callback cannot restore identity after withdrawal', async () => {
  let calls = 0;
  const later = deferred();
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    sendNativePageview: async () => {
      calls += 1;
      if (calls === 2) {
        await later.promise;
        storage.setItem('mautic_device_id', deviceId);
        throw new Error('late native failure');
      }
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  const pending = send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000073'));
  await Promise.resolve();
  await send(request('choose', { choice: 'rejected', expectedRevision: now }, '00000000-0000-4000-8000-000000000074'));
  later.resolve();
  assert.equal((await pending).ok, false);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
});

test('withdrawal does not wait for an in-flight bootstrap and a late callback cannot resurrect identity', async () => {
  const native = deferred();
  const storage = new MemoryStorage();
  const { send } = harness({
    storage,
    sendNativePageview: async () => {
      await native.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const pending = send(request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000041'));
  await Promise.resolve();

  const rejected = await send(request('choose', { choice: 'rejected', expectedRevision: now }, '00000000-0000-4000-8000-000000000042'));
  assert.equal(rejected.state.choice, 'rejected');
  assert.equal(rejected.state.generation, secondGeneration);
  assert.equal(rejected.state.revision, now + 1);
  native.resolve();
  assert.equal((await pending).ok, false);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
});

test('withdrawal clears native host cookies as well as root-origin storage', async () => {
  const cookieWrites = [];
  const document = {
    set cookie(value) { cookieWrites.push(value); },
  };
  const { send } = harness({ document });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  await send(request('choose', { choice: 'rejected', expectedRevision: now }, '00000000-0000-4000-8000-000000000043'));
  assert.ok(cookieWrites.some((value) => value.startsWith('mtc_id=') && value.includes('Max-Age=0')));
  assert.ok(cookieWrites.some((value) => value.startsWith('mautic_device_id=') && value.includes('Max-Age=0')));
});

test('withdrawal schedules native runtime invalidation after its response is sent', async () => {
  const events = [];
  const source = new MessageSource();
  const originalPost = source.postMessage.bind(source);
  source.postMessage = (message, origin) => {
    originalPost(message, origin);
    if (message.id) events.push(`response:${message.ok}`);
  };
  const { send } = harness({ source, onInvalidated: () => events.push('invalidated') });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  await send(request('choose', { choice: 'rejected', expectedRevision: now }, '00000000-0000-4000-8000-000000000075'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(events.indexOf('response:true') < events.indexOf('invalidated'));
  assert.equal(events.filter(event => event === 'invalidated').length, 1);
});

test('a browser privacy signal rotates accepted consent to rejection before another effect', async () => {
  const navigator = { doNotTrack: '0', globalPrivacyControl: false };
  const { send, storage } = harness({ navigator });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  navigator.globalPrivacyControl = true;
  const response = await send(request('read', {}, '00000000-0000-4000-8000-000000000044'));
  assert.equal(response.state.choice, 'rejected');
  assert.equal(response.state.revision, accepted.state.revision + 1);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
});

test('a root-origin fallback refusal is persisted when the broker next reads it', async () => {
  const storage = new MemoryStorage();
  storage.setItem(TRACKING_LOCAL_REFUSAL_STORAGE_KEY, 'rejected');
  storage.setItem('mautic_device_id', deviceId);
  const { send } = harness({ storage });
  const response = await send(request('read'));
  assert.equal(response.state.choice, 'rejected');
  assert.equal(response.state.revision, now);
  assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).choice, 'rejected');
  assert.equal(storage.getItem('mautic_device_id'), null);
});

test('failed expiry tombstone persistence still clears pending and raw native identity', () => {
  const storage = new MemoryStorage();
  storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
    version: 2,
    choice: 'accepted',
    generation: firstGeneration,
    expiresAt: now - 1,
    revision: now - 2,
  }));
  storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({
    version: 2,
    generation: firstGeneration,
    status: 'pending',
    attemptId: firstAttempt,
  }));
  storage.setItem('mtc_id', 'old-contact');
  storage.setItem('mautic_device_id', deviceId);
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === TRACKING_CONSENT_STORAGE_KEY) throw new Error('quota exceeded');
    setItem(key, value);
  };

  harness({ storage });
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(storage.getItem('mtc_id'), null);
  assert.equal(storage.getItem('mautic_device_id'), null);
});

test('a read invalidates an older native runtime even before its storage event runs', async () => {
  let invalidations = 0;
  const { send, storage } = harness({ onInvalidated: () => { invalidations += 1; } });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
    version: 2,
    choice: 'rejected',
    generation: secondGeneration,
    expiresAt: now + 180 * 24 * 60 * 60 * 1000,
    revision: now + 1,
  }));

  const response = await send(request('read', {}, '00000000-0000-4000-8000-000000000077'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(response.state.choice, 'rejected');
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(invalidations, 1);
});

test('an older broker invalidates its realm without clearing a newer broker identity', async () => {
  const storage = new MemoryStorage();
  const locks = new SerialLocks();
  let olderInvalidations = 0;
  const older = harness({
    storage,
    locks,
    onInvalidated: () => { olderInvalidations += 1; },
  });
  const firstAccepted = await older.send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  assert.equal((await older.send(request('pageview', pageviewPayload()))).ok, true);

  const newerIds = [secondGeneration, thirdGeneration, secondAttempt];
  const replacementDeviceId = 'zyxwvutsrq9876543210abc';
  const newer = harness({
    storage,
    locks,
    randomUUID: () => newerIds.shift(),
    onInvalidated() {},
    sendNativePageview: async () => {
      storage.setItem('mautic_device_id', replacementDeviceId);
    },
  });
  const rejected = await newer.send(request('choose', {
    choice: 'rejected',
    expectedRevision: firstAccepted.state.revision,
  }, '00000000-0000-4000-8000-000000000099'));
  const current = await newer.send(request('choose', {
    choice: 'accepted',
    expectedRevision: rejected.state.revision,
  }, '00000000-0000-4000-8000-000000000100'));
  assert.equal((await newer.send(request(
    'pageview',
    pageviewPayload(pageview(), current.state.generation),
    '00000000-0000-4000-8000-000000000101',
  ))).ok, true);
  const currentIdentity = JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY));

  const reconciled = await older.send(request(
    'read',
    {},
    '00000000-0000-4000-8000-000000000102',
  ));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(reconciled.state, current.state);
  assert.equal(olderInvalidations, 1);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)), currentIdentity);
  assert.equal(storage.getItem('mautic_device_id'), replacementDeviceId);
});

test('expiry invalidates consent and identity and notifies the connected parent', async () => {
  let currentTime = now;
  const { send, storage, source, broker } = harness({ now: () => currentTime });
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload()));
  currentTime = accepted.state.expiresAt + 1;
  const response = await send(request('read', {}, '00000000-0000-4000-8000-000000000051'));
  assert.deepEqual(response.state, {
    choice: null,
    generation: secondGeneration,
    expiresAt: null,
    revision: currentTime,
  });
  assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).choice, null);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.ok(source.messages.some(({ message }) => message.type === 'changed' && message.state.choice === null));
  broker.stop();
});

test('clearing shared storage while the broker is open leaves a higher-revision tombstone', async () => {
  const { send, storage, source, listeners } = harness();
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  storage.removeItem(TRACKING_CONSENT_STORAGE_KEY);
  listeners.get('storage')({ key: TRACKING_CONSENT_STORAGE_KEY });
  const changed = source.messages.filter(({ message }) => message.type === 'changed').at(-1).message;
  assert.equal(changed.state.choice, null);
  assert.equal(changed.state.revision, accepted.state.revision + 1);
  assert.match(changed.state.generation, /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)), {
    version: 2,
    ...changed.state,
  });
});

test('an older accepted storage record cannot supersede a newer rejection', async () => {
  const { send, storage, source, listeners, nativeCalls } = harness();
  const accepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const rejected = await send(request('choose', { choice: 'rejected', expectedRevision: accepted.state.revision }, '00000000-0000-4000-8000-000000000061'));
  storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({ version: 2, ...accepted.state }));
  storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({
    version: 2,
    generation: accepted.state.generation,
    status: 'ready',
    deviceId,
  }));
  storage.setItem('mautic_device_id', deviceId);

  listeners.get('storage')({ key: TRACKING_CONSENT_STORAGE_KEY });
  const changed = source.messages.filter(({ message }) => message.type === 'changed').at(-1).message;
  assert.equal(changed.state.choice, null);
  assert.ok(changed.state.revision > rejected.state.revision);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(storage.getItem('mautic_device_id'), null);
  assert.equal((await send(request('pageview', pageviewPayload()))).ok, false);
  assert.deepEqual(nativeCalls, []);
});

test('storage failures, unavailable locks, and malformed requests fail closed without identifiers', async () => {
  const { send, nativeCalls } = harness({ locks: null });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const pageResponse = await send(request('pageview', pageviewPayload()));
  assert.equal(pageResponse.ok, false);
  assert.equal(pageResponse.error, 'unavailable');
  assert.deepEqual(nativeCalls, []);

  const malformed = await send({ ...request('choose', { choice: 'accepted', expectedRevision: 0 }), extra: true });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error, 'invalid-request');
  assert.equal(JSON.stringify(malformed).includes('device'), false);
});

test('replayed request IDs cannot repeat native pageviews', async () => {
  const { send, nativeCalls } = harness();
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const repeated = request('pageview', pageviewPayload(), '00000000-0000-4000-8000-000000000076');
  assert.equal((await send(repeated)).ok, true);
  assert.deepEqual(await send(repeated), {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: repeated.id,
    ok: false,
    error: 'unavailable',
  });
  assert.equal(nativeCalls.length, 1);
});

test('internal handoffs cannot overwrite external acquisition labels', async () => {
  const sent = [];
  const { send, storage } = harness({
    sendNativePageview: async ({ pageview: tracked }) => {
      sent.push(tracked);
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  await send(request('pageview', pageviewPayload({
    ...pageview(mainOrigin),
    page_referrer: docsOrigin,
    utm_source: 'registry_docs',
    utm_medium: 'docs',
    utm_campaign: 'cross_site',
  })));
  assert.equal('utm_source' in sent[0], false);
  assert.equal(sent[0].page_referrer, docsOrigin);
});

test('the bridge page is isolated from site layouts, indexing, referrers, and analytics', async () => {
  const source = await readFile(bridgePageUrl, 'utf8');
  await transform(source, { filename: bridgePageUrl.pathname });
  assert.match(source, /name="robots" content="noindex,nofollow"/);
  assert.match(source, /name="referrer" content="no-referrer"/);
  assert.match(source, /createTrackingBroker\(\{\s*mauticUrl,\s*onInvalidated/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.doesNotMatch(source, /Base|Umami|analytics|TrackingPreferences/);
});
