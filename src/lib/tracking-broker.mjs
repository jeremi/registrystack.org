import {
  TRACKING_ALLOWED_ORIGINS,
  TRACKING_ASSOCIATION_ORIGIN,
  TRACKING_CONSENT_LIFETIME_MS,
  TRACKING_CONSENT_STORAGE_KEY,
  TRACKING_IDENTITY_STORAGE_KEY,
  TRACKING_LOCAL_REFUSAL_STORAGE_KEY,
  TRACKING_PROTOCOL,
  TRACKING_PROTOCOL_VERSION,
  parseTrackingRequest,
  trackingRequestId,
} from './tracking-protocol.mjs';

const CONSENT_RECORD_VERSION = 3;
const IDENTITY_RECORD_VERSION = 2;
const NATIVE_IDENTITY_KEYS = ['mtc_id', 'mautic_device_id'];
const DEVICE_ID_PATTERN = /^[a-z0-9]{23}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BOOTSTRAP_LOCK_NAME = 'registrystack-mautic-device-v2';
const MARKETPLACE_ORIGIN = 'https://marketplace.registrystack.org';
const MARKETPLACE_ENROLLMENT_RECORD_VERSION = 1;
export const MARKETPLACE_ENROLLMENT_STORAGE_KEY = 'registrystack.marketplace-tracking-enrollment.v1';
export const BOOTSTRAP_OWNER_STORAGE_KEY = 'registrystack.shared-mautic-bootstrap-owner.v1';
const BROKER_ALLOWED_ORIGINS = Object.freeze([...TRACKING_ALLOWED_ORIGINS, MARKETPLACE_ORIGIN]);
const MAX_SEEN_REQUEST_IDS = 1000;
const INTERNAL_UTM = {
  utm_source: 'registry_docs',
  utm_medium: 'docs',
  utm_campaign: 'cross_site',
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function initialState() {
  return { choice: null, generation: null, expiresAt: null, revision: 0 };
}

function publicState(record) {
  return {
    choice: record.choice,
    generation: record.generation,
    expiresAt: record.expiresAt,
    revision: record.revision,
  };
}

function parseConsentRecord(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!exactKeys(value, ['version', 'choice', 'generation', 'expiresAt', 'revision'])) return null;
    if (![2, CONSENT_RECORD_VERSION].includes(value.version) || !Number.isSafeInteger(value.revision) || value.revision <= 0) {
      return null;
    }
    if (!isUuid(value.generation)) return null;
    if (value.choice === null) {
      return value.expiresAt === null ? value : null;
    }
    if (
      (value.choice !== 'accepted' && value.choice !== 'rejected') ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= value.revision
    ) return null;
    return value;
  } catch (_error) {
    return null;
  }
}

function parseIdentityRecord(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!isRecord(value) || value.version !== IDENTITY_RECORD_VERSION || !isUuid(value.generation)) return null;
    if (
      value.status === 'ready' &&
      exactKeys(value, ['version', 'generation', 'status', 'deviceId']) &&
      typeof value.deviceId === 'string' &&
      DEVICE_ID_PATTERN.test(value.deviceId)
    ) return value;
    if (
      value.status === 'pending' &&
      exactKeys(value, ['version', 'generation', 'status', 'attemptId']) &&
      isUuid(value.attemptId)
    ) return value;
    return null;
  } catch (_error) {
    return null;
  }
}

function parseMarketplaceEnrollmentRecord(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !exactKeys(value, ['version', 'generation']) ||
      value.version !== MARKETPLACE_ENROLLMENT_RECORD_VERSION ||
      !isUuid(value.generation)
    ) return null;
    return value;
  } catch (_error) {
    return null;
  }
}

function validatedMauticUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) return null;
    return url.origin;
  } catch (_error) {
    return null;
  }
}

function defaultNativePageviewSender({ window, document, mauticUrl }) {
  const waiters = new Set();
  let scriptFailed = false;

  function ensureTracker() {
    if (scriptFailed) throw new Error('Mautic tracking is unavailable.');
    if (!window || !document?.createElement || !document?.head?.append) {
      throw new Error('Mautic tracking is unavailable.');
    }
    window.MauticTrackingObject = 'mt';
    if (!window.mt) {
      const queued = (...args) => (queued.q ??= []).push(args);
      queued.q = [];
      queued.l = Date.now();
      window.mt = queued;
    }
    if (!document.querySelector?.('script[data-registry-mautic-bridge]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `${mauticUrl}/mtc.js`;
      script.referrerPolicy = 'no-referrer';
      script.dataset.registryMauticBridge = '';
      script.addEventListener('error', () => {
        scriptFailed = true;
        for (const reject of waiters) reject(new Error('Mautic tracking is unavailable.'));
        waiters.clear();
      });
      document.head.append(script);
    }
    return window.mt;
  }

  return ({ pageview, deviceId }) => new Promise((resolve, reject) => {
    let tracker;
    try {
      tracker = ensureTracker();
    } catch (error) {
      reject(error);
      return;
    }
    waiters.add(reject);
    tracker('send', 'pageview', {
      ...pageview, ...(deviceId ? { mautic_device_id: deviceId } : {}),
    }, {
      onload: () => {
        waiters.delete(reject);
        resolve();
      },
      onerror: () => {
        waiters.delete(reject);
        reject(new Error('Mautic tracking is unavailable.'));
      },
    });
  });
}

function sanitizedPageview(pageview, senderOrigin, allowedOrigins) {
  let pageUrl;
  try {
    pageUrl = new URL(pageview.page_url);
  } catch (_error) {
    return null;
  }
  if (pageUrl.origin !== senderOrigin) return null;

  const sanitized = { ...pageview };
  const internalReferrer = allowedOrigins.includes(pageview.page_referrer);
  const knownInternalUtm = Object.entries(INTERNAL_UTM).every(([key, value]) => pageview[key] === value);
  if (internalReferrer || knownInternalUtm) {
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export function createTrackingBroker({
  window: currentWindow = globalThis.window,
  document: currentDocument = globalThis.document,
  navigator: currentNavigator = globalThis.navigator,
  storage = currentWindow?.localStorage,
  locks = currentNavigator?.locks,
  allowedOrigins = BROKER_ALLOWED_ORIGINS,
  associationOrigin = TRACKING_ASSOCIATION_ORIGIN,
  mauticUrl = undefined,
  now = () => Date.now(),
  randomUUID = () => globalThis.crypto.randomUUID(),
  sendNativePageview = undefined,
  onInvalidated = /** @type {(() => void) | undefined} */ (undefined),
  bootstrapTimeoutMs = 4000,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  console: logger = globalThis.console,
} = {}) {
  const enrolledOrigins = Object.freeze([...allowedOrigins]);
  const mauticOrigin = validatedMauticUrl(mauticUrl);
  const nativePageview = sendNativePageview ?? (
    mauticOrigin ? defaultNativePageviewSender({
      window: currentWindow,
      document: currentDocument,
      mauticUrl: mauticOrigin,
    }) : null
  );
  const connectedParents = new Map();
  const seenRequestIds = new Set();
  const bootstrapWaiters = new Set();
  let stopped = false;
  let lastPublishedState = initialState();
  let nativeRuntimeInvalidationPending = false;
  let nativeRuntimeInvalidationTimer;

  function reportFailure(message) {
    logger?.error?.(message);
  }

  function safeGet(key) {
    try {
      return storage?.getItem(key) ?? null;
    } catch (_error) {
      reportFailure('Shared tracking storage is unavailable. Tracking remains off.');
      return null;
    }
  }

  function safeRemove(key) {
    try {
      storage?.removeItem(key);
      return Boolean(storage);
    } catch (_error) {
      reportFailure('Shared tracking storage could not be cleared. Tracking remains off.');
      return false;
    }
  }

  function safeSet(key, value) {
    if (!storage) return false;
    try {
      const serialized = JSON.stringify(value);
      storage.setItem(key, serialized);
      return storage.getItem(key) === serialized;
    } catch (_error) {
      reportFailure('Shared tracking storage could not be saved. Tracking remains off.');
      return false;
    }
  }

  function bootstrapOwner() {
    const raw = safeGet(BOOTSTRAP_OWNER_STORAGE_KEY);
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      if (exactKeys(record, ['version', 'generation', 'origin']) && record.version === 1 &&
          isUuid(record.generation) && enrolledOrigins.includes(record.origin)) return record;
    } catch (_error) { /* Malformed browser state never grants bootstrap ownership. */ }
    safeRemove(BOOTSTRAP_OWNER_STORAGE_KEY);
    return null;
  }

  function marketplaceEnrollment() {
    const raw = safeGet(MARKETPLACE_ENROLLMENT_STORAGE_KEY);
    const record = parseMarketplaceEnrollmentRecord(raw);
    if (!record && raw) safeRemove(MARKETPLACE_ENROLLMENT_STORAGE_KEY);
    return record;
  }

  function saveMarketplaceEnrollment(generation) {
    return safeSet(MARKETPLACE_ENROLLMENT_STORAGE_KEY, {
      version: MARKETPLACE_ENROLLMENT_RECORD_VERSION,
      generation,
    });
  }

  function marketplaceEnrolled(state) {
    return state.choice === 'accepted' && marketplaceEnrollment()?.generation === state.generation;
  }

  function stateForOrigin(state, origin) {
    if (origin !== MARKETPLACE_ORIGIN || state.choice === 'rejected' || marketplaceEnrolled(state)) {
      return state;
    }
    return {
      choice: null,
      generation: state.generation,
      expiresAt: null,
      revision: state.revision,
    };
  }

  function clearNativeIdentifiers() {
    for (const key of NATIVE_IDENTITY_KEYS) {
      safeRemove(key);
      try {
        if (currentDocument) {
          currentDocument.cookie = `${key}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax`;
        }
      } catch (_error) {
        reportFailure('Native tracking cookies could not be cleared. Tracking remains off.');
      }
    }
  }

  function clearNativeIdentity() {
    safeRemove(TRACKING_IDENTITY_STORAGE_KEY);
    clearNativeIdentifiers();
  }

  function browserDeniesTracking() {
    const dnt = currentNavigator?.doNotTrack?.toLowerCase?.();
    return currentNavigator?.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
  }

  function localRefusalRequested() {
    return safeGet(TRACKING_LOCAL_REFUSAL_STORAGE_KEY) === 'rejected';
  }

  function nextRevision(previous) {
    return Math.max(Math.trunc(now()), previous.revision + 1, 1);
  }

  function notifyBootstrapWaiters() {
    for (const check of [...bootstrapWaiters]) check();
  }

  function notifyChanged(state) {
    lastPublishedState = state;
    for (const [source, origin] of connectedParents) {
      try {
        source.postMessage({
          protocol: TRACKING_PROTOCOL,
          version: TRACKING_PROTOCOL_VERSION,
          type: 'changed',
          state: stateForOrigin(state, origin),
        }, origin);
      } catch (_error) {
        connectedParents.delete(source);
      }
    }
    notifyBootstrapWaiters();
  }

  function markNativeRuntimeInvalid() {
    if (typeof onInvalidated === 'function') nativeRuntimeInvalidationPending = true;
  }

  function flushNativeRuntimeInvalidation() {
    if (!nativeRuntimeInvalidationPending || nativeRuntimeInvalidationTimer !== undefined) return;
    nativeRuntimeInvalidationPending = false;
    nativeRuntimeInvalidationTimer = setTimer(() => {
      nativeRuntimeInvalidationTimer = undefined;
      if (stopped) return;
      try {
        onInvalidated();
      } catch (_error) {
        reportFailure('Native tracking runtime could not be invalidated. Tracking remains off.');
      }
    }, 0);
  }

  function writeTombstone(previous) {
    const record = {
      version: 2,
      choice: null,
      generation: randomUUID(),
      expiresAt: null,
      revision: nextRevision(previous),
    };
    const persisted = safeSet(TRACKING_CONSENT_STORAGE_KEY, record);
    safeRemove(MARKETPLACE_ENROLLMENT_STORAGE_KEY);
    safeRemove(BOOTSTRAP_OWNER_STORAGE_KEY);
    clearNativeIdentity();
    if (previous.choice === 'accepted') markNativeRuntimeInvalid();
    if (!persisted) return initialState();
    const state = publicState(record);
    notifyChanged(state);
    return state;
  }

  function storedState({ expire = true } = {}) {
    const raw = safeGet(TRACKING_CONSENT_STORAGE_KEY);
    const record = parseConsentRecord(raw);
    if (!record) {
      if (raw) safeRemove(TRACKING_CONSENT_STORAGE_KEY);
      if (lastPublishedState.revision > 0) return writeTombstone(lastPublishedState);
      clearNativeIdentity();
      return initialState();
    }
    const state = publicState(record);
    if (
      lastPublishedState.revision > 0 &&
      (
        state.revision < lastPublishedState.revision ||
        (state.revision === lastPublishedState.revision && JSON.stringify(state) !== JSON.stringify(lastPublishedState))
      )
    ) return writeTombstone(lastPublishedState);
    if (record.choice !== null && record.expiresAt <= now()) {
      return expire ? writeTombstone(state) : initialState();
    }
    if (record.version === 2 && record.choice === 'accepted') {
      const identity = identityRecord();
      const rawDevice = safeGet('mautic_device_id');
      // Legacy consent has no bootstrap owner. Only a confirmed matching device
      // can resume safely; otherwise ask again rather than race first identity
      // creation across properties whose browser locks may be isolated.
      if (identity?.status !== 'ready' || identity.generation !== record.generation ||
          identity.deviceId !== rawDevice) return writeTombstone(state);
    }
    return state;
  }

  function effectiveState() {
    const previous = lastPublishedState;
    let state = storedState();
    if (state.choice !== 'rejected' && (browserDeniesTracking() || localRefusalRequested())) {
      state = saveChoice('rejected', state) ?? initialState();
    }
    if (
      previous.choice === 'accepted' &&
      (state.choice !== 'accepted' || state.generation !== previous.generation)
    ) {
      // Another bridge may already have started the current generation. Its
      // shared record outlives this realm, which is about to be invalidated.
      if (state.choice !== 'accepted' || identityRecord()?.generation !== state.generation) {
        clearNativeIdentity();
      }
      markNativeRuntimeInvalid();
    }
    return state;
  }

  function saveChoice(choice, previous = storedState(), ownerOrigin) {
    if (choice === 'accepted' && !enrolledOrigins.includes(ownerOrigin)) return null;
    const revision = nextRevision(previous);
    const record = {
      version: choice === 'accepted' ? CONSENT_RECORD_VERSION : 2,
      choice,
      generation: randomUUID(),
      expiresAt: revision + TRACKING_CONSENT_LIFETIME_MS,
      revision,
    };
    if (!safeSet(TRACKING_CONSENT_STORAGE_KEY, record)) {
      safeRemove(BOOTSTRAP_OWNER_STORAGE_KEY);
      clearNativeIdentity();
      return null;
    }
    safeRemove(MARKETPLACE_ENROLLMENT_STORAGE_KEY);
    safeRemove(BOOTSTRAP_OWNER_STORAGE_KEY);
    clearNativeIdentity();
    if (previous.choice === 'accepted') markNativeRuntimeInvalid();
    // This marker activates first-bootstrap authority only after the new
    // consent and all clearing writes. Peers must never race that clearing.
    if (choice === 'accepted' && !safeSet(BOOTSTRAP_OWNER_STORAGE_KEY, {
      version: 1, generation: record.generation, origin: ownerOrigin,
    })) return null;
    const state = publicState(record);
    notifyChanged(state);
    return state;
  }

  function identityRecord() {
    return parseIdentityRecord(safeGet(TRACKING_IDENTITY_STORAGE_KEY));
  }

  function readyDevice(state) {
    if (state.choice !== 'accepted' || browserDeniesTracking()) return null;
    const identity = identityRecord();
    const rawDevice = safeGet('mautic_device_id');
    if (
      identity?.status === 'ready' &&
      identity.generation === state.generation &&
      identity.deviceId === rawDevice
    ) return identity.deviceId;
    if (identity?.status === 'ready' || (rawDevice && identity?.status !== 'pending')) clearNativeIdentity();
    return null;
  }

  function discardStaleNativeResult(state, generation, attemptId) {
    const identity = identityRecord();
    if (state.choice === 'accepted' && identity &&
        identity.generation === state.generation &&
        (identity.generation !== generation || (attemptId && identity.attemptId !== attemptId))) {
      if (identity.status === 'ready') {
        // A stale SDK response can overwrite raw storage after the current
        // attempt completed. Its validated shared record remains authoritative.
        try {
          clearNativeIdentifiers();
          storage.setItem('mautic_device_id', identity.deviceId);
          if (storage.getItem('mautic_device_id') !== identity.deviceId) throw new Error('Storage unavailable.');
          if (currentDocument) {
            currentDocument.cookie = `mautic_device_id=${identity.deviceId}; Path=/; SameSite=Lax; Secure`;
          }
        } catch (_error) {
          reportFailure('Native tracking identity could not be restored. Tracking remains off.');
          clearNativeIdentity();
        }
      } else {
        // Remove the stale raw ID, preserving the newer pending attempt that
        // will receive its own response.
        clearNativeIdentifiers();
      }
      return;
    }
    if (readyDevice(state)) return;
    clearNativeIdentity();
  }

  async function finalizeBootstrap(generation, attemptId) {
    const state = effectiveState();
    const identity = identityRecord();
    const rawDevice = safeGet('mautic_device_id');
    // A peer may have promoted the same server-issued device after its SDK
    // persisted the ID but before this callback finished.
    if (state.choice === 'accepted' && state.generation === generation &&
        identity?.status === 'ready' && identity.generation === generation &&
        identity.deviceId === rawDevice) return true;
    if (
      state.choice === 'accepted' &&
      state.generation === generation &&
      identity?.status === 'pending' &&
      identity.generation === generation &&
      identity.attemptId === attemptId &&
      typeof rawDevice === 'string' &&
      DEVICE_ID_PATTERN.test(rawDevice)
    ) {
      const ready = safeSet(TRACKING_IDENTITY_STORAGE_KEY, {
        version: IDENTITY_RECORD_VERSION,
        generation,
        status: 'ready',
        deviceId: rawDevice,
      });
      notifyBootstrapWaiters();
      return ready;
    }

    discardStaleNativeResult(state, generation, attemptId);
    return false;
  }

  function finalizeReadyPageview(generation, delivered) {
    const latest = effectiveState();
    const identity = identityRecord();
    const rawDevice = safeGet('mautic_device_id');
    const remainsReady = (
      latest.choice === 'accepted' &&
      latest.generation === generation &&
      identity?.status === 'ready' &&
      identity.generation === generation &&
      identity.deviceId === rawDevice
    );
    if (!remainsReady) discardStaleNativeResult(latest, generation);
    return delivered && remainsReady;
  }

  function bootstrapObservation(generation, requestingOrigin) {
    const state = effectiveState();
    if (state.choice !== 'accepted' || state.generation !== generation) return 'denied';
    if (readyDevice(state)) return 'ready'; // Existing devices need no owner migration.
    const owner = bootstrapOwner();
    if (owner?.generation !== generation) return 'waiting';
    const identity = identityRecord();
    if (identity?.generation === generation && identity.status === 'pending') {
      return owner.origin === requestingOrigin &&
        DEVICE_ID_PATTERN.test(safeGet('mautic_device_id') ?? '') ? 'ready' : 'waiting';
    }
    return owner.origin === requestingOrigin ? 'ready' : 'waiting';
  }

  function observeBootstrap(generation, signal, requestingOrigin) {
    return new Promise(resolve => {
      let settled = false;
      const finish = ready => {
        if (settled) return;
        settled = true;
        bootstrapWaiters.delete(check);
        signal.removeEventListener('abort', cancel);
        resolve(ready);
      };
      const cancel = () => finish(false);
      const check = () => {
        if (stopped || signal.aborted) return finish(false);
        const observed = bootstrapObservation(generation, requestingOrigin);
        if (observed !== 'waiting') finish(observed === 'ready');
      };
      bootstrapWaiters.add(check);
      signal.addEventListener('abort', cancel, { once: true });
      check();
    });
  }

  async function observeExistingBootstrap(generation) {
    const cancellation = new AbortController();
    const timer = setTimer(() => cancellation.abort(), bootstrapTimeoutMs);
    try { return await observeBootstrap(generation, cancellation.signal); }
    finally { clearTimer(timer); }
  }

  async function bootstrapPageview(pageview, generation) {
    if (!locks?.request || !nativePageview) return false;
    const cancellation = new AbortController();
    let expired = false;
    let timer;
    // One deadline covers waiting for another bridge as well as native I/O.
    // Aborting a queued lock prevents a timed-out event from being sent later.
    const timeout = new Promise(resolve => {
      timer = setTimer(() => {
        expired = true;
        cancellation.abort();
        resolve(false);
      }, bootstrapTimeoutMs);
    });
    try {
      const origin = new URL(pageview.page_url).origin;
      // Wait outside the lock: in browsers that share it across properties,
      // a non-owner must not hold the owner out while awaiting its result.
      const observed = bootstrapObservation(generation, origin);
      if (observed === 'denied' || (observed === 'waiting' &&
          !await observeBootstrap(generation, cancellation.signal, origin))) return false;
      const locked = locks.request(BOOTSTRAP_LOCK_NAME, {
        mode: 'exclusive', signal: cancellation.signal,
      }, async () => {
        if (expired || stopped) return false;
        const current = effectiveState();
        if (current.choice !== 'accepted' || current.generation !== generation) return false;

        const existing = identityRecord();
        if (existing?.generation === generation && existing.status === 'pending') {
          const owner = bootstrapOwner();
          if (owner?.generation !== generation || owner.origin !== origin) return false;
          // Only the designated owner, under its lock, may promote a persisted
          // native ID. Other properties wait for the validated ready record.
          // The native SDK can persist its server-issued ID before its callback
          // completes. Reuse that attempt instead of stranding it or bootstrapping
          // a second identity. A missing ID still requires explicit recovery.
          if (!DEVICE_ID_PATTERN.test(safeGet('mautic_device_id') ?? '') ||
              !await finalizeBootstrap(generation, existing.attemptId)) return false;
        }
        const active = effectiveState();
        if (expired || stopped || active.choice !== 'accepted' || active.generation !== generation ||
            (origin === MARKETPLACE_ORIGIN && !marketplaceEnrolled(active))) return false;
        const deviceId = readyDevice(active);
        if (deviceId) {
          const nativeResult = Promise.resolve().then(() => nativePageview({ pageview, generation, deviceId }));
          const guarded = nativeResult.then(
            () => finalizeReadyPageview(generation, true),
            () => finalizeReadyPageview(generation, false),
          );
          return Promise.race([guarded, timeout]);
        }

        const owner = bootstrapOwner();
        if (owner?.generation !== generation || owner.origin !== origin) return false;
        clearNativeIdentity();
        const attemptId = randomUUID();
        if (!safeSet(TRACKING_IDENTITY_STORAGE_KEY, {
          version: IDENTITY_RECORD_VERSION,
          generation,
          status: 'pending',
          attemptId,
        })) return false;

        const nativeResult = Promise.resolve().then(() => nativePageview({ pageview, generation }));
        const finalized = nativeResult.then(
          async () => {
            const latest = effectiveState();
            const identity = identityRecord();
            // Mautic deliberately omits identities for excluded visitors,
            // including logged-in administrators. Delivery still succeeded;
            // consent is saved and any form remains unlinked.
            const excluded = latest.choice === 'accepted' && latest.generation === generation &&
              identity?.status === 'pending' && identity.generation === generation &&
              identity.attemptId === attemptId && safeGet('mautic_device_id') === null;
            const ready = await finalizeBootstrap(generation, attemptId);
            return ready || excluded;
          },
          () => false,
        );
        return Promise.race([finalized, timeout]);
      });
      return await Promise.race([locked, timeout]);
    } catch (_error) {
      return false;
    } finally {
      clearTimer(timer);
    }
  }

  function success(id, state, origin, deviceId) {
    return {
      protocol: TRACKING_PROTOCOL,
      version: TRACKING_PROTOCOL_VERSION,
      id,
      ok: true,
      state: stateForOrigin(state, origin),
      ...(deviceId ? { deviceId } : {}),
    };
  }

  function failure(id, error) {
    return { protocol: TRACKING_PROTOCOL, version: TRACKING_PROTOCOL_VERSION, id, ok: false, error };
  }

  function respond(source, origin, response) {
    source.postMessage(response, origin);
  }

  async function handleRequest(request, origin) {
    if (request.type === 'read') return success(request.id, effectiveState(), origin);
    if (request.type === 'choose') {
      if (request.choice === 'accepted' && browserDeniesTracking()) {
        return failure(request.id, 'not-allowed');
      }
      let current = effectiveState();
      if (request.expectedRevision !== current.revision) {
        if (request.choice === 'rejected' && current.choice === 'rejected') {
          return success(request.id, current, origin);
        }
        return failure(request.id, 'unavailable');
      }
      let recoverIncomplete = false;
      if (request.choice === 'accepted' && current.choice === 'accepted' && !readyDevice(current)) {
        const generation = current.generation;
        const completed = await observeExistingBootstrap(generation);
        current = effectiveState();
        // An explicit recovery never carries stale authority across a newer
        // refusal, privacy signal, expiry or another consent generation.
        if (stopped || browserDeniesTracking() || current.choice !== 'accepted' ||
            current.generation !== generation || current.revision !== request.expectedRevision) {
          return failure(request.id, 'unavailable');
        }
        recoverIncomplete = !completed;
      }
      if (origin === MARKETPLACE_ORIGIN && request.choice === 'accepted') {
        let accepted = current;
        if (current.choice !== 'accepted' || recoverIncomplete) {
          accepted = saveChoice('accepted', current, origin);
          if (!accepted) return failure(request.id, 'unavailable');
        }
        if (!saveMarketplaceEnrollment(accepted.generation)) {
          return failure(request.id, 'unavailable');
        }
        notifyChanged(accepted);
        return success(request.id, accepted, origin);
      }
      if (current.choice === request.choice && !recoverIncomplete) return success(request.id, current, origin);
      const saved = saveChoice(request.choice, current, origin);
      return saved ? success(request.id, saved, origin) : failure(request.id, 'unavailable');
    }
    if (request.type === 'associate') {
      if (origin !== associationOrigin) return failure(request.id, 'not-allowed');
      const state = effectiveState();
      if (state.choice !== 'accepted' || state.generation !== request.expectedGeneration) {
        return failure(request.id, 'unavailable');
      }
      const device = readyDevice(state);
      return device ? success(request.id, state, origin, device) : failure(request.id, 'unavailable');
    }
    if (request.type === 'pageview') {
      const pageview = sanitizedPageview(request.pageview, origin, enrolledOrigins);
      const state = effectiveState();
      if (!pageview || state.choice !== 'accepted' ||
          (origin === MARKETPLACE_ORIGIN && !marketplaceEnrolled(state))) {
        return failure(request.id, 'not-allowed');
      }
      if (state.generation !== request.expectedGeneration) return failure(request.id, 'unavailable');
      const tracked = await bootstrapPageview(pageview, state.generation);
      return tracked ? success(request.id, effectiveState(), origin) : failure(request.id, 'unavailable');
    }
    return failure(request.id, 'invalid-request');
  }

  async function handleMessage(event) {
    if (
      stopped ||
      !enrolledOrigins.includes(event?.origin) ||
      !event?.source ||
      event.source !== currentWindow?.parent ||
      typeof event.source.postMessage !== 'function'
    ) return;
    const id = trackingRequestId(event.data);
    if (!id) return;
    connectedParents.set(event.source, event.origin);
    const request = parseTrackingRequest(event.data);
    if (!request) {
      respond(event.source, event.origin, failure(id, 'invalid-request'));
      return;
    }
    if (seenRequestIds.has(request.id)) {
      respond(event.source, event.origin, failure(request.id, 'unavailable'));
      flushNativeRuntimeInvalidation();
      return;
    }
    if (seenRequestIds.size >= MAX_SEEN_REQUEST_IDS) {
      seenRequestIds.delete(seenRequestIds.values().next().value);
    }
    seenRequestIds.add(request.id);
    const response = await handleRequest(request, event.origin);
    respond(event.source, event.origin, response);
    flushNativeRuntimeInvalidation();
  }

  function refresh() {
    const state = effectiveState();
    if (JSON.stringify(state) !== JSON.stringify(lastPublishedState)) notifyChanged(state);
    notifyBootstrapWaiters();
    return state;
  }

  function handleStorage(event) {
    if (event?.key === MARKETPLACE_ENROLLMENT_STORAGE_KEY) {
      notifyChanged(effectiveState());
      flushNativeRuntimeInvalidation();
      return;
    }
    if (
      event?.key === TRACKING_CONSENT_STORAGE_KEY ||
      event?.key === BOOTSTRAP_OWNER_STORAGE_KEY ||
      event?.key === TRACKING_IDENTITY_STORAGE_KEY ||
      event?.key === TRACKING_LOCAL_REFUSAL_STORAGE_KEY ||
      NATIVE_IDENTITY_KEYS.includes(event?.key)
    ) {
      refresh();
      flushNativeRuntimeInvalidation();
    }
  }

  function handleResume() {
    if (!currentDocument || currentDocument.visibilityState !== 'hidden') {
      refresh();
      flushNativeRuntimeInvalidation();
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    notifyBootstrapWaiters();
    clearTimer(nativeRuntimeInvalidationTimer);
    currentWindow?.removeEventListener?.('message', handleMessage);
    currentWindow?.removeEventListener?.('storage', handleStorage);
    currentWindow?.removeEventListener?.('pageshow', handleResume);
    currentDocument?.removeEventListener?.('visibilitychange', handleResume);
    connectedParents.clear();
    seenRequestIds.clear();
  }

  const startupState = storedState();
  readyDevice(startupState);
  lastPublishedState = startupState;
  currentWindow?.addEventListener?.('message', handleMessage);
  currentWindow?.addEventListener?.('storage', handleStorage);
  currentWindow?.addEventListener?.('pageshow', handleResume);
  currentDocument?.addEventListener?.('visibilitychange', handleResume);

  return { stop, handleMessage, refresh };
}
