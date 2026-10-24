import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMauticPageview,
  createSharedTrackingClient,
  getSharedTrackingClient,
  trackingDeniedByBrowser,
} from '../src/lib/shared-tracking-client.mjs';

const bridgeUrl = 'https://registrystack.org/tracking-bridge/';
const unknown = { choice: null, generation: null, expiresAt: null, revision: 0 };
const generation = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const accepted = { choice: 'accepted', generation, expiresAt: Date.now() + 60_000, revision: 10 };
const rejected = { choice: 'rejected', generation: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', expiresAt: Date.now() + 60_000, revision: 11 };
const envelope = { protocol: 'registrystack-tracking', version: 2 };

function fixture(options = {}) {
  const { factory = createSharedTrackingClient, ...clientOptions } = options;
  const listeners = new Map();
  const sent = [];
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  let frame;
  const window = {
    location: { origin: 'https://docs.registrystack.org' },
    localStorage: storage,
    navigator: { doNotTrack: '0' },
    crypto: { randomUUID: () => crypto.randomUUID() },
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    setTimeout,
    clearTimeout,
  };
  const document = {
    createElement: tag => {
      assert.equal(tag, 'iframe');
      const frameListeners = new Map();
      frame = {
        contentWindow: { postMessage: (data, origin) => sent.push({ data, origin }) },
        setAttribute() {},
        addEventListener: (type, listener) => frameListeners.set(type, listener),
        fireLoad: () => frameListeners.get('load')?.(),
        remove() { this.removed = true; },
      };
      return frame;
    },
    body: { append: element => queueMicrotask(() => element.fireLoad()) },
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
  };
  const failures = [];
  const changes = [];
  const client = factory({
    bridgeUrl, window, document, navigator: window.navigator,
    timeoutMs: 100, onFailure: error => failures.push(error),
    onStateChange: state => changes.push(state), ...clientOptions,
  });
  const message = (data, overrides = {}) => listeners.get('message')?.({
    origin: 'https://registrystack.org', source: frame.contentWindow, data, ...overrides,
  });
  const reply = (state, extra = {}) => {
    const request = sent.at(-1).data;
    message({ ...envelope, id: request.id, ok: true, state, ...extra });
  };
  return { client, get frame() { return frame; }, sent, message, reply, failures, changes, values,
    storageEvent: event => listeners.get('storage')?.(event) };
}

async function nextRequest(run) {
  const promise = run();
  await new Promise(resolve => setImmediate(resolve));
  return { promise };
}

test('reads shared consent through one fixed iframe without a parent tracking script', async () => {
  const f = fixture();
  const { promise } = await nextRequest(() => f.client.read());
  assert.equal(f.frame.src, bridgeUrl);
  assert.equal(f.frame.hidden, true);
  assert.equal(f.frame.referrerPolicy, 'no-referrer');
  assert.equal(f.sent[0].origin, 'https://registrystack.org');
  assert.equal(f.sent[0].data.type, 'read');
  f.reply(unknown);
  assert.deepEqual(await promise, unknown);
  assert.equal(f.values.size, 0);
  f.client.close();
});

test('ignores messages from another origin or frame and never accepts surplus response fields', async () => {
  const f = fixture();
  const { promise } = await nextRequest(() => f.client.read());
  const response = { ...envelope, id: f.sent[0].data.id, ok: true, state: accepted };
  f.message(response, { origin: 'https://attacker.example' });
  f.message(response, { source: {} });
  assert.deepEqual(f.client.state, unknown);
  f.reply(unknown);
  assert.deepEqual(await promise, unknown);
  const invalid = await nextRequest(() => f.client.read());
  f.reply(accepted, { extra: 'refuse me' });
  await assert.rejects(invalid.promise, /tracking/i);
  f.client.close();
});

test('a withdrawal push supersedes an older accepted response', async () => {
  const f = fixture();
  const first = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await first.promise;
  const pending = await nextRequest(() => f.client.associate(generation));
  const id = f.sent.at(-1).data.id;
  f.message({ ...envelope, type: 'changed', state: rejected });
  f.message({ ...envelope, id, ok: true, state: accepted, deviceId: 'a'.repeat(23) });
  await assert.rejects(pending.promise, /tracking/i);
  assert.deepEqual(f.client.state, rejected);
  assert.equal(f.values.has('mautic_device_id'), false);
  f.client.close();
});

test('withdrawal discards the native realm and cancels old pageviews without suspending the new state', async () => {
  const f = fixture();
  const initial = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await initial.promise;
  const oldFrame = f.frame;
  const oldView = await nextRequest(() => f.client.pageview({
    page_url: 'https://docs.registrystack.org/', page_title: 'Docs', page_referrer: '',
  }));
  assert.equal(f.sent.at(-1).data.expectedGeneration, generation);
  f.message({ ...envelope, type: 'changed', state: rejected });
  await assert.rejects(oldView.promise, /tracking/i);
  assert.equal(oldFrame.removed, true);
  assert.deepEqual(f.client.state, rejected);
  assert.equal(f.failures.length, 0);
  const reconsent = await nextRequest(() => f.client.choose('accepted'));
  assert.notEqual(f.frame, oldFrame);
  const renewed = { ...accepted, generation: 'ffffffff-ffff-4fff-8fff-ffffffffffff', revision: 12 };
  f.reply(renewed);
  assert.deepEqual(await reconsent.promise, renewed);
  f.client.close();
});

test('an authoritative newer push acknowledges its matching choice before the old frame is discarded', async () => {
  const f = fixture();
  const initial = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await initial.promise;
  const refusal = await nextRequest(() => f.client.choose('rejected'));
  const oldFrame = f.frame;
  f.message({ ...envelope, type: 'changed', state: rejected });
  assert.deepEqual(await refusal.promise, rejected);
  assert.equal(oldFrame.removed, true);
  assert.equal(f.failures.length, 0);
  f.client.close();
});

test('device disclosure is returned once and is never persisted or retained on client state', async () => {
  const f = fixture();
  const initial = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await initial.promise;
  const pending = await nextRequest(() => f.client.associate(generation));
  assert.equal(f.sent.at(-1).data.expectedGeneration, generation);
  f.reply(accepted, { deviceId: 'a'.repeat(23) });
  assert.equal((await pending.promise).deviceId, 'a'.repeat(23));
  assert.equal('deviceId' in f.client.state, false);
  assert.equal(f.values.has('mautic_device_id'), false);
  f.client.close();
});

test('an unavailable broker fails closed and never silently authorizes tracking', async () => {
  const f = fixture({ timeoutMs: 5 });
  await assert.rejects(f.client.read(), /tracking/i);
  assert.notEqual(f.client.state.choice, 'accepted');
  assert.equal(f.failures.length, 1);
  f.client.close();
});

test('the shared singleton retains failure and state listeners registered after the form creates it', async () => {
  const f = fixture({ factory: getSharedTrackingClient, timeoutMs: 5 });
  const failures = [];
  const states = [];
  assert.equal(getSharedTrackingClient({
    onFailure: error => failures.push(error),
    onStateChange: state => states.push(state),
  }), f.client);
  const initial = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await initial.promise;
  assert.equal(states.at(-1)?.choice, 'accepted');
  await assert.rejects(f.client.read(), /tracking/i);
  assert.equal(failures.length, 1);
  f.client.close();
});

test('browser privacy signals override shared acceptance', async () => {
  for (const navigator of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
    assert.equal(trackingDeniedByBrowser({ navigator }), true);
    const f = fixture({ navigator });
    const pending = await nextRequest(() => f.client.read());
    assert.equal(f.sent[0].data.type, 'read');
    f.reply(rejected);
    assert.equal((await pending.promise).choice, 'rejected');
    await assert.rejects(f.client.choose('accepted'), /tracking/i);
    assert.equal(f.sent.length, 1, 'The essential bridge must persist revocation of earlier shared consent.');
    f.client.close();
  }
});

test('a choice carries the revision observed when the choice was made', async () => {
  const f = fixture();
  const initial = await nextRequest(() => f.client.read());
  f.reply(unknown);
  await initial.promise;
  const choice = await nextRequest(() => f.client.choose('accepted'));
  assert.equal(f.sent.at(-1).data.expectedRevision, 0);
  f.reply(accepted);
  assert.equal((await choice.promise).choice, 'accepted');
  f.client.close();
});

test('a same-origin outage refusal gates an already-open tab and is relayed to the shared bridge', async () => {
  const f = fixture();
  const initial = await nextRequest(() => f.client.read());
  f.reply(accepted);
  await initial.promise;
  f.storageEvent({ key: 'registrystack.tracking-local-refusal.v2', newValue: 'rejected' });
  assert.equal(f.client.state.choice, 'rejected');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.sent.at(-1).data.type, 'choose');
  assert.equal(f.sent.at(-1).data.choice, 'rejected');
  f.reply(rejected);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.client.state.choice, 'rejected');
  f.client.close();
});

test('page data preserves external acquisition and removes identity, search, and internal handoff parameters', () => {
  const page = buildMauticPageview({
    canonicalUrl: 'https://docs.registrystack.org/tutorials/first-registry/?search=private#record',
    currentUrl: 'https://docs.registrystack.org/tutorials/first-registry/?utm_source=partner&utm_medium=referral&utm_campaign=pilot&email=private@example.org',
    pageTitle: '  Your first registry  ', referrer: 'https://partner.example/private?q=secret',
  });
  assert.deepEqual(page, {
    page_url: 'https://docs.registrystack.org/tutorials/first-registry/', page_title: 'Your first registry',
    page_referrer: 'https://partner.example', utm_source: 'partner', utm_medium: 'referral', utm_campaign: 'pilot',
  });
  const internal = buildMauticPageview({
    canonicalUrl: 'https://docs.registrystack.org/', pageTitle: 'Docs',
    currentUrl: 'https://docs.registrystack.org/?utm_source=registrystack&utm_medium=site&utm_campaign=cross_site&utm_content=home',
    referrer: 'https://registrystack.org/pricing/',
  });
  assert.deepEqual(internal, { page_url: 'https://docs.registrystack.org/', page_title: 'Docs', page_referrer: 'https://registrystack.org' });
});
