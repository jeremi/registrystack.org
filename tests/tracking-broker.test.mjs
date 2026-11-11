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
import {
  MARKETPLACE_ENROLLMENT_STORAGE_KEY,
  BOOTSTRAP_OWNER_STORAGE_KEY,
  createTrackingBroker,
} from '../src/lib/tracking-broker.mjs';

const mainOrigin = 'https://registrystack.org';
const docsOrigin = 'https://docs.registrystack.org';
const marketplaceOrigin = 'https://marketplace.registrystack.org';
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

test('retired version-1 consent and native identity never become shared acceptance', async () => {
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
  const marketplaceAssociation = await send(
    request('associate', { expectedGeneration: firstGeneration }, '00000000-0000-4000-8000-000000000006'),
    marketplaceOrigin,
  );
  assert.deepEqual(marketplaceAssociation, {
    protocol: TRACKING_PROTOCOL,
    version: TRACKING_PROTOCOL_VERSION,
    id: '00000000-0000-4000-8000-000000000006',
    ok: false,
    error: 'not-allowed',
  });
});

test('website acceptance does not enroll marketplace, whose explicit acceptance retains the generation', async () => {
  const { send, nativeCalls, storage } = harness();
  const websiteAccepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const read = await send(
    request('read', {}, '00000000-0000-4000-8000-000000000071'),
    marketplaceOrigin,
  );
  assert.deepEqual(read.state, {
    choice: null,
    generation: websiteAccepted.state.generation,
    expiresAt: null,
    revision: websiteAccepted.state.revision,
  });
  const refusedBeforeEnrollment = await send(
    request('pageview', pageviewPayload({
      page_url: `${marketplaceOrigin}/packs/professional-licensing/`,
      page_title: 'Professional licensing starter',
      page_referrer: mainOrigin,
    }), '00000000-0000-4000-8000-000000000072'),
    marketplaceOrigin,
  );
  assert.equal(refusedBeforeEnrollment.ok, false);
  assert.equal(refusedBeforeEnrollment.error, 'not-allowed');
  assert.deepEqual(nativeCalls, []);

  // The website is the explicit bootstrap owner. Complete its first pageview
  // before asserting that marketplace enrollment reuses that ready generation.
  const ownerView = await send(request('pageview', pageviewPayload(),
    '00000000-0000-4000-8000-000000000076'));
  assert.equal(ownerView.ok, true);

  const accepted = await send(
    request('choose', {
      choice: 'accepted',
      expectedRevision: websiteAccepted.state.revision,
    }, '00000000-0000-4000-8000-000000000073'),
    marketplaceOrigin,
  );
  assert.deepEqual(accepted.state, websiteAccepted.state);
  assert.deepEqual(JSON.parse(storage.getItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY)), {
    version: 1,
    generation: websiteAccepted.state.generation,
  });
  const tracked = await send(
    request('pageview', pageviewPayload({
      page_url: `${marketplaceOrigin}/packs/professional-licensing/`,
      page_title: 'Professional licensing starter',
      page_referrer: mainOrigin,
    }), '00000000-0000-4000-8000-000000000074'),
    marketplaceOrigin,
  );
  assert.equal(tracked.ok, true);
  assert.deepEqual(nativeCalls, [pageview(), {
    page_url: `${marketplaceOrigin}/packs/professional-licensing/`,
    page_title: 'Professional licensing starter',
    page_referrer: mainOrigin,
  }]);

  const wrongOrigin = await send(
    request(
      'pageview',
      pageviewPayload({
        page_url: `${docsOrigin}/private/`,
        page_title: 'Wrong origin',
        page_referrer: '',
      }),
      '00000000-0000-4000-8000-000000000075',
    ),
    marketplaceOrigin,
  );
  assert.equal(wrongOrigin.ok, false);
  assert.equal(wrongOrigin.error, 'not-allowed');
});

test('marketplace rejection is global and main reacceptance requires fresh marketplace enrollment', async () => {
  const { send, storage, nativeCalls } = harness();
  const accepted = await send(
    request('choose', { choice: 'accepted', expectedRevision: 0 }),
    marketplaceOrigin,
  );
  await send(request('pageview', pageviewPayload({
    page_url: `${marketplaceOrigin}/`,
    page_title: 'Registry Stack Marketplace',
    page_referrer: '',
  }, accepted.state.generation)), marketplaceOrigin);
  assert.equal(nativeCalls.length, 1);

  const rejected = await send(request('choose', {
    choice: 'rejected',
    expectedRevision: accepted.state.revision,
  }, '00000000-0000-4000-8000-000000000076'), marketplaceOrigin);
  assert.equal(rejected.state.choice, 'rejected');
  assert.equal((await send(request('read', {}, '00000000-0000-4000-8000-000000000077'), docsOrigin)).state.choice, 'rejected');
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);

  const mainAccepted = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: rejected.state.revision,
  }, '00000000-0000-4000-8000-000000000078'));
  const marketplaceRead = await send(
    request('read', {}, '00000000-0000-4000-8000-000000000079'),
    marketplaceOrigin,
  );
  assert.equal(mainAccepted.state.choice, 'accepted');
  assert.equal(marketplaceRead.state.choice, null);
  assert.equal(marketplaceRead.state.generation, mainAccepted.state.generation);
  assert.equal((await send(request('pageview', pageviewPayload({
    page_url: `${marketplaceOrigin}/`,
    page_title: 'Registry Stack Marketplace',
    page_referrer: '',
  }, mainAccepted.state.generation), '00000000-0000-4000-8000-000000000080'), marketplaceOrigin)).ok, false);
  assert.equal(nativeCalls.length, 1);
});

test('marketplace enrollment persistence fails closed without undoing valid website consent', async () => {
  class EnrollmentFailureStorage extends MemoryStorage {
    setItem(key, value) {
      if (key === MARKETPLACE_ENROLLMENT_STORAGE_KEY) throw new Error('Enrollment storage unavailable.');
      super.setItem(key, value);
    }
  }
  const storage = new EnrollmentFailureStorage();
  const { send, nativeCalls } = harness({ storage });
  const websiteAccepted = await send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
  const marketplaceAccepted = await send(request('choose', {
    choice: 'accepted',
    expectedRevision: websiteAccepted.state.revision,
  }, '00000000-0000-4000-8000-000000000081'), marketplaceOrigin);
  assert.equal(marketplaceAccepted.ok, false);
  assert.equal(marketplaceAccepted.error, 'unavailable');
  assert.equal((await send(request('read', {}, '00000000-0000-4000-8000-000000000082'))).state.choice, 'accepted');
  assert.equal((await send(
    request('read', {}, '00000000-0000-4000-8000-000000000083'),
    marketplaceOrigin,
  )).state.choice, null);
  assert.deepEqual(nativeCalls, []);
});

test('marketplace enrollment storage events update its projection without changing global revision', async () => {
  const storage = new MemoryStorage();
  storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
    version: 3,
    choice: 'accepted',
    generation: firstGeneration,
    expiresAt: now + 1000,
    revision: now - 1000,
  }));
  const source = new MessageSource();
  const { send, listeners } = harness({ storage, source });
  const initial = await send(request('read'), marketplaceOrigin);
  assert.equal(initial.state.choice, null);
  storage.setItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY, JSON.stringify({
    version: 1,
    generation: firstGeneration,
  }));
  listeners.get('storage')({ key: MARKETPLACE_ENROLLMENT_STORAGE_KEY });
  const changed = source.messages.filter(({ message }) => message.type === 'changed').at(-1).message;
  assert.deepEqual(changed.state, {
    choice: 'accepted',
    generation: firstGeneration,
    expiresAt: now + 1000,
    revision: now - 1000,
  });
});

test('stale or malformed marketplace enrollment cannot authorize a pageview', async () => {
  for (const enrollment of [
    { version: 1, generation: secondGeneration },
    { version: 1, generation: firstGeneration, extra: true },
    { version: 2, generation: firstGeneration },
  ]) {
    const storage = new MemoryStorage();
    storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
      version: 3,
      choice: 'accepted',
      generation: firstGeneration,
      expiresAt: now + 1000,
      revision: now - 1000,
    }));
    storage.setItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY, JSON.stringify(enrollment));
    const { send, nativeCalls } = harness({ storage });
    const read = await send(request('read'), marketplaceOrigin);
    assert.equal(read.state.choice, null);
    const tracked = await send(request('pageview', pageviewPayload({
      page_url: `${marketplaceOrigin}/`,
      page_title: 'Registry Stack Marketplace',
      page_referrer: '',
    })), marketplaceOrigin);
    assert.equal(tracked.ok, false);
    assert.equal(tracked.error, 'not-allowed');
    assert.deepEqual(nativeCalls, []);
  }
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

test('unconfirmed legacy accepted consent renews the choice without native effects', async t => {
  for (const variant of ['no-id','pending','wrong-generation','bad-raw','raw-only']) await t.test(variant,async()=>{
    const storage=new MemoryStorage();
    const legacy={version:2,choice:'accepted',generation:firstGeneration,expiresAt:now+60_000,revision:now-1000};
    storage.setItem(TRACKING_CONSENT_STORAGE_KEY,JSON.stringify(legacy));
    if(variant==='pending') storage.setItem(TRACKING_IDENTITY_STORAGE_KEY,JSON.stringify({version:2,generation:firstGeneration,status:'pending',attemptId:firstAttempt}));
    if(variant==='wrong-generation'||variant==='bad-raw') storage.setItem(TRACKING_IDENTITY_STORAGE_KEY,JSON.stringify({version:2,generation:variant==='wrong-generation'?secondGeneration:firstGeneration,status:'ready',deviceId}));
    if(variant!=='no-id') storage.setItem('mautic_device_id',variant==='bad-raw'?'not-a-device':deviceId);
    storage.setItem('mtc_id','old-contact');
    storage.setItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY,JSON.stringify({version:1,generation:firstGeneration}));
    storage.setItem(BOOTSTRAP_OWNER_STORAGE_KEY,JSON.stringify({version:1,generation:firstGeneration,origin:mainOrigin}));
    const ids=[secondGeneration,thirdGeneration,firstAttempt];
    const f=harness({storage,randomUUID:()=>ids.shift()});
    const read=await f.send(request('read'));
    assert.equal(read.version,2,'the message protocol does not change');
    assert.equal(read.state.choice,null);
    assert.equal(read.state.generation,secondGeneration);
    assert.ok(read.state.revision>legacy.revision);
    assert.equal(read.state.expiresAt,null);
    assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).version,2);
    for(const key of [TRACKING_IDENTITY_STORAGE_KEY,BOOTSTRAP_OWNER_STORAGE_KEY,MARKETPLACE_ENROLLMENT_STORAGE_KEY,'mtc_id','mautic_device_id']) assert.equal(storage.getItem(key),null);
    assert.equal(f.nativeCalls.length,0);
    const accepted=await f.send(request('choose',{choice:'accepted',expectedRevision:read.state.revision}));
    assert.equal(accepted.state.generation,thirdGeneration);
    assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).version,3);
    assert.equal((await f.send(request('pageview',pageviewPayload(pageview(),accepted.state.generation)))).ok,true);
    assert.equal(f.nativeCalls.length,1);
    f.broker.stop();
  });
});

test('coherent legacy ready identity and saved legacy refusals do not renew their expiry or revision',async t=>{
  for(const choice of ['accepted','rejected',null]) await t.test(String(choice),async()=>{
    const storage=new MemoryStorage();
    const legacy={version:2,choice,generation:firstGeneration,expiresAt:choice===null?null:now+60_000,revision:now-1000};
    const serialized=JSON.stringify(legacy);
    storage.setItem(TRACKING_CONSENT_STORAGE_KEY,serialized);
    if(choice==='accepted'){
      storage.setItem(TRACKING_IDENTITY_STORAGE_KEY,JSON.stringify({version:2,generation:firstGeneration,status:'ready',deviceId}));
      storage.setItem('mautic_device_id',deviceId);
    }
    const f=harness({storage});
    const read=await f.send(request('read'));
    assert.deepEqual(read.state,{choice,generation:firstGeneration,expiresAt:legacy.expiresAt,revision:legacy.revision});
    assert.equal(storage.getItem(TRACKING_CONSENT_STORAGE_KEY),serialized);
    if(choice==='accepted'){
      assert.equal((await f.send(request('pageview',pageviewPayload()))).ok,true);
      assert.equal(storage.getItem('mautic_device_id'),deviceId);
      assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY),null);
      assert.equal(storage.getItem(TRACKING_CONSENT_STORAGE_KEY),serialized);
    }else assert.equal(f.nativeCalls.length,0);
    f.broker.stop();
  });
});

test('new refusals retain the version2 persisted contract and unchanged repeated choices',async()=>{
  const storage=new MemoryStorage();
  const f=harness({storage});
  const rejected=await f.send(request('choose',{choice:'rejected',expectedRevision:0}));
  const serialized=storage.getItem(TRACKING_CONSENT_STORAGE_KEY);
  assert.deepEqual(JSON.parse(serialized),{version:2,...rejected.state});
  assert.equal(rejected.state.choice,'rejected');
  const observer=harness({storage});
  assert.deepEqual((await observer.send(request('read'))).state,rejected.state);
  assert.deepEqual((await observer.send(request('choose',{choice:'rejected',expectedRevision:rejected.state.revision}))).state,rejected.state);
  assert.equal(storage.getItem(TRACKING_CONSENT_STORAGE_KEY),serialized);
  assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY),null);
  assert.equal(f.nativeCalls.length+observer.nativeCalls.length,0);
  f.broker.stop();observer.broker.stop();
});

test('a current accepted publication gap waits for its owner without migrating consent',async()=>{
  const storage=new MemoryStorage();
  const current={version:3,choice:'accepted',generation:firstGeneration,expiresAt:now+60_000,revision:now-1000};
  const serialized=JSON.stringify(current);
  storage.setItem(TRACKING_CONSENT_STORAGE_KEY,serialized);
  const f=harness({storage});
  const waiting=f.send(request('pageview',pageviewPayload()));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.nativeCalls.length,0);
  assert.equal(storage.getItem(TRACKING_CONSENT_STORAGE_KEY),serialized);
  storage.setItem(BOOTSTRAP_OWNER_STORAGE_KEY,JSON.stringify({version:1,generation:firstGeneration,origin:mainOrigin}));
  f.listeners.get('storage')({key:BOOTSTRAP_OWNER_STORAGE_KEY});
  assert.equal((await waiting).ok,true);
  assert.equal(f.nativeCalls.length,1);
  assert.equal(storage.getItem(TRACKING_CONSENT_STORAGE_KEY),serialized);
  f.broker.stop();
});

test('a non-owner property cannot bootstrap an empty shared identity before its owner', async t => {
  for (const shared of [false, true]) await t.test(shared ? 'shared lock' : 'independent locks', async () => {
  const sharedLocks = shared ? new SerialLocks() : null;
  const storage = new MemoryStorage();
  const started = deferred();
  const native = deferred();
  const peerCalls = [];
  const owner = harness({
    storage, locks: sharedLocks ?? new SerialLocks(),
    sendNativePageview: async () => {
      started.resolve();
      await native.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  const peer = harness({
    storage, locks: sharedLocks ?? new SerialLocks(),
    sendNativePageview: async call => {
      peerCalls.push(call);
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  try {
    const accepted = await owner.send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
    const waiting = peer.send(request('pageview', pageviewPayload(pageview(docsOrigin))), docsOrigin);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(peerCalls.length, 0, 'a property with an independent lock scope must not create the first identity');
    const first = owner.send(request('pageview', pageviewPayload()));
    await started.promise;
    native.resolve();
    assert.equal((await first).ok, true);
    peer.listeners.get('storage')({ key: TRACKING_IDENTITY_STORAGE_KEY });
    assert.equal((await waiting).ok, true);
    assert.equal(peerCalls.length, 1);
    assert.equal(peerCalls[0].deviceId, deviceId);
    assert.equal(peerCalls[0].generation, accepted.state.generation);
  } finally {
    native.resolve();
    owner.broker.stop();
    peer.broker.stop();
  }
  });
});

test('independent lock scopes wait for a live peer bootstrap and reuse its device', async () => {
  const storage = new MemoryStorage();
  const started = deferred();
  const native = deferred();
  const peerCalls = [];
  const owner = harness({
    storage, locks: new SerialLocks(),
    sendNativePageview: async () => {
      started.resolve();
      await native.promise;
      storage.setItem('mautic_device_id', deviceId);
    },
  });
  const peer = harness({
    storage, locks: new SerialLocks(),
    sendNativePageview: async call => { peerCalls.push(call); },
  });
  try {
    await owner.send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
    const first = owner.send(request('pageview', pageviewPayload()));
    await started.promise;
    let peerSettled = false;
    const waiting = peer.send(request('pageview', pageviewPayload(pageview(docsOrigin))), docsOrigin)
      .then(response => { peerSettled = true; return response; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(peerSettled, false, 'a live peer bootstrap must not be treated as stranded');
    assert.equal(peerCalls.length, 0, 'the peer must not start another native bootstrap');

    native.resolve();
    assert.equal((await first).ok, true);
    peer.listeners.get('storage')({ key: TRACKING_IDENTITY_STORAGE_KEY });
    assert.equal((await waiting).ok, true);
    assert.equal(peerCalls.length, 1);
    assert.equal(peerCalls[0].deviceId, deviceId);
    assert.equal(peerCalls[0].generation, firstGeneration);
  } finally {
    native.resolve();
    owner.broker.stop();
    peer.broker.stop();
  }
});

test('peer bootstrap waits cancel without native effects or retained observers', async t => {
  for (const mode of ['withdrawal', 'new-generation', 'stop', 'deadline']) {
    await t.test(mode, async () => {
      const storage = new MemoryStorage();
      const owner = harness({ storage });
      await owner.send(request('choose', { choice: 'accepted', expectedRevision: 0 }));
      storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({
        version: 2, generation: firstGeneration, status: 'pending', attemptId: firstAttempt,
      }));
      const timers = new Set();
      let nativeCount = 0;
      const peer = harness({
        storage, locks: new SerialLocks(),
        setTimer(fn) { const timer = { fn }; timers.add(timer); return timer; },
        clearTimer(timer) { timers.delete(timer); },
        sendNativePageview: async () => { nativeCount += 1; },
      });
      try {
        let settled = false;
        const waiting = peer.send(request('pageview', pageviewPayload(pageview(docsOrigin))), docsOrigin)
          .then(response => { settled = true; return response; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(settled, false);
        if (mode === 'withdrawal') {
          await owner.send(request('choose', { choice: 'rejected', expectedRevision: now },
            '00000000-0000-4000-8000-000000000091'));
          peer.listeners.get('storage')({ key: TRACKING_CONSENT_STORAGE_KEY });
        } else if (mode === 'new-generation') {
          storage.setItem(TRACKING_CONSENT_STORAGE_KEY, JSON.stringify({
            version: 3, choice: 'accepted', generation: secondGeneration,
            expiresAt: now + 60_000, revision: now + 1,
          }));
          peer.listeners.get('storage')({ key: TRACKING_CONSENT_STORAGE_KEY });
        } else if (mode === 'stop') {
          peer.broker.stop();
        } else {
          assert.equal(timers.size, 1);
          [...timers][0].fn();
        }
        assert.equal((await waiting).ok, false);
        assert.equal(timers.size, 0, 'the existing bootstrap deadline must be cleared');
        storage.setItem('mautic_device_id', deviceId);
        storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({
          version: 2, generation: firstGeneration, status: 'ready', deviceId,
        }));
        peer.listeners.get('storage')?.({ key: TRACKING_IDENTITY_STORAGE_KEY });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(nativeCount, 0, 'a late peer notification must not resume a canceled operation');
      } finally {
        owner.broker.stop();
        peer.broker.stop();
      }
    });
  }
});

test('explicit acceptance publishes a strict owner for each allowed property', async t => {
  for (const origin of [mainOrigin, docsOrigin, marketplaceOrigin]) await t.test(origin, async () => {
    const f = harness();
    const accepted = await f.send(request('choose', { choice: 'accepted', expectedRevision: 0 }), origin);
    assert.deepEqual(JSON.parse(f.storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY)), {
      version: 1, generation: accepted.state.generation, origin,
    });
    assert.equal((await f.send(request('pageview', pageviewPayload(pageview(origin))), origin)).ok, true);
    assert.equal(f.nativeCalls.length, 1);
    f.broker.stop();
  });
});

test('owner publication follows consent and clearing, and owner persistence failure fails closed', async () => {
  class CheckedStorage extends MemoryStorage {
    failOwner = false;
    published = 0;
    setItem(key, value) {
      if (key === BOOTSTRAP_OWNER_STORAGE_KEY) {
        const owner = JSON.parse(value);
        assert.equal(JSON.parse(this.getItem(TRACKING_CONSENT_STORAGE_KEY)).generation, owner.generation);
        assert.equal(this.getItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY), null);
        assert.equal(this.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
        assert.equal(this.getItem('mautic_device_id'), null);
        if (this.failOwner) throw new Error('Owner storage blocked');
        this.published += 1;
      }
      super.setItem(key, value);
    }
  }
  const storage = new CheckedStorage();
  const f = harness({ storage });
  storage.setItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY, 'old enrollment');
  storage.setItem('mautic_device_id', deviceId);
  assert.equal((await f.send(request('choose', { choice: 'accepted', expectedRevision: 0 }))).ok, true);
  assert.equal(storage.published, 1);
  const rejected = await f.send(request('choose', { choice: 'rejected', expectedRevision: now },
    '00000000-0000-4000-8000-000000000087'));
  assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY), null);
  storage.failOwner = true;
  const failed = await f.send(request('choose', { choice: 'accepted', expectedRevision: rejected.state.revision },
    '00000000-0000-4000-8000-000000000088'));
  assert.equal(failed.ok, false);
  assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(f.nativeCalls.length, 0);
  f.broker.stop();
});

test('explicit acceptance observes a live owner instead of rotating its generation', async t => {
  for (const origin of [mainOrigin, docsOrigin, marketplaceOrigin]) await t.test(origin, async () => {
    const storage = new MemoryStorage();
    const started = deferred();
    const native = deferred();
    const owner = harness({storage, sendNativePageview: async () => {
      started.resolve(); await native.promise; storage.setItem('mautic_device_id', deviceId);
    }});
    const peer = harness({storage, locks: new SerialLocks()});
    try {
      const accepted = await owner.send(request('choose', {choice:'accepted', expectedRevision:0}));
      const first = owner.send(request('pageview', pageviewPayload()));
      await started.promise;
      let settled = false;
      const choosing = peer.send(request('choose', {choice:'accepted', expectedRevision:accepted.state.revision}), origin)
        .then(result => {settled=true; return result;});
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(settled, false);
      assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).generation, accepted.state.generation);
      native.resolve();
      assert.equal((await first).ok, true);
      peer.listeners.get('storage')({key:TRACKING_IDENTITY_STORAGE_KEY});
      const result = await choosing;
      assert.equal(result.ok, true);
      assert.deepEqual(result.state, accepted.state);
      assert.equal(JSON.parse(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY)).origin, mainOrigin);
      if (origin === marketplaceOrigin) assert.equal(JSON.parse(storage.getItem(MARKETPLACE_ENROLLMENT_STORAGE_KEY)).generation, accepted.state.generation);
      assert.equal(peer.nativeCalls.length, 0);
    } finally {native.resolve();owner.broker.stop();peer.broker.stop();}
  });
});

test('a consent choice waiting on a peer cannot override a later withdrawal', async () => {
  const storage = new MemoryStorage();
  const owner = harness({storage});
  const accepted = await owner.send(request('choose', {choice:'accepted', expectedRevision:0}));
  storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({version:2,generation:firstGeneration,status:'pending',attemptId:firstAttempt}));
  const peer = harness({storage});
  const choosing = peer.send(request('choose', {choice:'accepted',expectedRevision:accepted.state.revision}), docsOrigin);
  await new Promise(resolve => setImmediate(resolve));
  const rejected = await owner.send(request('choose', {choice:'rejected',expectedRevision:accepted.state.revision},
    '00000000-0000-4000-8000-000000000089'));
  peer.listeners.get('storage')({key:TRACKING_CONSENT_STORAGE_KEY});
  assert.equal((await choosing).ok, false);
  assert.equal(JSON.parse(storage.getItem(TRACKING_CONSENT_STORAGE_KEY)).generation, rejected.state.generation);
  assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY), null);
  assert.equal(peer.nativeCalls.length, 0);
  owner.broker.stop();peer.broker.stop();
});

test('a non-owner cannot promote a stale raw reply over a newer pending owner', async () => {
  const storage = new MemoryStorage();
  const ownerLocks = new SerialLocks();
  const oldStarted = deferred();
  const oldRaw = deferred();
  const oldWritten = deferred();
  const oldFinish = deferred();
  const activeStarted = deferred();
  const activeFinish = deferred();
  const oldTimers = new Set();
  const newDevice = 'zyxwvutsrq9876543210abc';
  const peerCalls = [];
  const older = harness({storage,locks:ownerLocks,
    setTimer(fn) {const timer={fn};oldTimers.add(timer);return timer;},
    clearTimer(timer) {oldTimers.delete(timer);},
    sendNativePageview: async () => {
      oldStarted.resolve(); await oldRaw.promise;
      storage.setItem('mautic_device_id', deviceId);
      oldWritten.resolve(); await oldFinish.promise;
    },
  });
  const ids = [secondGeneration, thirdGeneration, secondAttempt];
  const active = harness({storage,locks:ownerLocks,randomUUID:()=>ids.shift(),
    sendNativePageview: async () => {
      activeStarted.resolve();await activeFinish.promise;storage.setItem('mautic_device_id',newDevice);
    },
  });
  const peer = harness({storage,locks:new SerialLocks(),sendNativePageview:async call=>{peerCalls.push(call);}});
  try {
    const initial = await older.send(request('choose',{choice:'accepted',expectedRevision:0}));
    const oldRequest = older.send(request('pageview',pageviewPayload()));
    await oldStarted.promise;
    [...oldTimers][0].fn();
    assert.equal((await oldRequest).ok,false);
    const rejected = await active.send(request('choose',{choice:'rejected',expectedRevision:initial.state.revision}));
    const accepted = await active.send(request('choose',{choice:'accepted',expectedRevision:rejected.state.revision},
      '00000000-0000-4000-8000-000000000093'));
    const currentRequest = active.send(request('pageview',pageviewPayload(pageview(),accepted.state.generation)));
    await activeStarted.promise;
    const waiting = peer.send(request('pageview',pageviewPayload(pageview(docsOrigin),accepted.state.generation)),docsOrigin);
    oldRaw.resolve();await oldWritten.promise;
    peer.listeners.get('storage')({key:'mautic_device_id'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(peerCalls.length,0,'a raw key is not a validated current-generation identity for a non-owner');
    assert.equal(JSON.parse(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY)).status,'pending');
    oldFinish.resolve();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(storage.getItem('mautic_device_id'),null);
    activeFinish.resolve();
    assert.equal((await currentRequest).ok,true);
    peer.listeners.get('storage')({key:TRACKING_IDENTITY_STORAGE_KEY});
    assert.equal((await waiting).ok,true);
    assert.equal(peerCalls.length,1);
    assert.equal(peerCalls[0].deviceId,newDevice);
  } finally {
    oldRaw.resolve();oldFinish.resolve();activeFinish.resolve();
    older.broker.stop();active.broker.stop();peer.broker.stop();
  }
});

test('only explicit bounded recovery transfers an incomplete bootstrap owner', async t => {
  for (const mode of ['pending', 'idle', 'missing-owner']) await t.test(mode, async () => {
  const storage = new MemoryStorage();
  const owner = harness({storage});
  const accepted = await owner.send(request('choose', {choice:'accepted',expectedRevision:0}));
  if (mode === 'pending') storage.setItem(TRACKING_IDENTITY_STORAGE_KEY, JSON.stringify({version:2,generation:firstGeneration,status:'pending',attemptId:firstAttempt}));
  if (mode === 'missing-owner') storage.removeItem(BOOTSTRAP_OWNER_STORAGE_KEY);
  const timers = new Set();
  const ids = [secondGeneration, secondAttempt];
  const peer = harness({storage, randomUUID:()=>ids.shift(),
    setTimer(fn) {const timer={fn};timers.add(timer);return timer;},
    clearTimer(timer) {timers.delete(timer);},
  });
  const choosing = peer.send(request('choose', {choice:'accepted',expectedRevision:accepted.state.revision}), docsOrigin);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.parse(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY))?.origin, mode === 'missing-owner' ? undefined : mainOrigin);
  assert.equal(peer.nativeCalls.length, 0);
  assert.equal(timers.size, 1);
  [...timers][0].fn();
  const recovered = await choosing;
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.generation, secondGeneration);
  assert.equal(JSON.parse(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY)).origin, docsOrigin);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  assert.equal(peer.nativeCalls.length, 0, 'explicit consent recovery does not itself retry native I/O');
  assert.equal(timers.size, 0);
  owner.broker.stop();peer.broker.stop();
  });
});

test('owner state expires with consent while a legacy ready identity remains reusable', async () => {
  const storage = new MemoryStorage();
  let clock = now;
  const f = harness({storage, now:()=>clock});
  const accepted = await f.send(request('choose', {choice:'accepted',expectedRevision:0}));
  assert.equal((await f.send(request('pageview', pageviewPayload()))).ok, true);
  storage.removeItem(BOOTSTRAP_OWNER_STORAGE_KEY);
  assert.equal((await f.send(request('pageview', pageviewPayload(pageview(docsOrigin)),
    '00000000-0000-4000-8000-000000000090'), docsOrigin)).ok, true);
  assert.equal(storage.getItem('mautic_device_id'), deviceId);
  storage.setItem(BOOTSTRAP_OWNER_STORAGE_KEY, JSON.stringify({version:1,generation:accepted.state.generation,origin:mainOrigin}));
  clock = accepted.state.expiresAt + 1;
  await f.send(request('read', {}, '00000000-0000-4000-8000-000000000092'));
  assert.equal(storage.getItem(BOOTSTRAP_OWNER_STORAGE_KEY), null);
  assert.equal(storage.getItem(TRACKING_IDENTITY_STORAGE_KEY), null);
  f.broker.stop();
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
    version: 3,
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
