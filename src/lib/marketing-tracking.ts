export const CONSENT_STORAGE_KEY = 'registrystack.marketing-tracking';

const CONSENT_VERSION = 1;
const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
const DEVICE_ID_PATTERN = /^[a-z0-9]{23}$/;
const IDENTITY_KEYS = ['mtc_id', 'mautic_device_id'] as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const UTM_VALUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

export type TrackingPreference = 'accepted' | 'rejected';

type TrackingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type TrackingNavigator = Pick<Navigator, 'doNotTrack'> & { globalPrivacyControl?: boolean };
type TrackingConsole = Pick<Console, 'error'>;
type MauticCall = [string, string, MauticPageview, { onload: () => void; onerror: () => void }];
type MauticFunction = ((...args: MauticCall) => void) & { q?: MauticCall[]; l?: number };
type MauticWindow = Window & {
  MauticTrackingObject?: string;
  mt?: MauticFunction;
  __registryMauticPageviewSent?: boolean;
};

export interface TrackingEnvironment {
  storage?: TrackingStorage;
  navigator?: TrackingNavigator;
  document?: Document;
  window?: MauticWindow;
  console?: TrackingConsole;
  now?: () => number;
}

interface StoredPreference {
  version: number;
  choice: TrackingPreference;
  expiresAt: number;
}

export interface PageviewInput {
  canonicalUrl: string;
  pageTitle: string;
  currentUrl: string;
  referrer?: string;
}

export interface MauticPageview {
  page_url: string;
  page_title: string;
  page_referrer: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

function reportFailure(environment: TrackingEnvironment, message: string): void {
  const logger = environment.console ?? globalThis.console;
  logger?.error(message);
}

function browserStorage(environment: TrackingEnvironment): TrackingStorage | undefined {
  if (environment.storage) return environment.storage;
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch (_error) {
    reportFailure(environment, 'Tracking preferences storage is unavailable. Tracking remains off.');
    return undefined;
  }
}

function browserNavigator(environment: TrackingEnvironment): TrackingNavigator | undefined {
  if (environment.navigator) return environment.navigator;
  return typeof navigator === 'undefined' ? undefined : navigator;
}

function currentTime(environment: TrackingEnvironment): number {
  return environment.now?.() ?? Date.now();
}

export function marketingTrackingUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch (_error) {
    throw new Error('PUBLIC_MAUTIC_URL must be an HTTPS Mautic URL with no path, credentials, query or fragment.');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('PUBLIC_MAUTIC_URL must be an HTTPS Mautic URL with no path, credentials, query or fragment.');
  }

  return url.origin;
}

export function trackingDeniedByBrowser(environment: TrackingEnvironment = {}): boolean {
  const currentNavigator = browserNavigator(environment);
  const dnt = currentNavigator?.doNotTrack?.toLowerCase();
  return currentNavigator?.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
}

function parseStoredPreference(raw: string | null, now: number): TrackingPreference | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<StoredPreference>;
    if (
      value.version !== CONSENT_VERSION ||
      (value.choice !== 'accepted' && value.choice !== 'rejected') ||
      typeof value.expiresAt !== 'number' ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now
    ) {
      return undefined;
    }
    return value.choice;
  } catch (_error) {
    return undefined;
  }
}

export function readTrackingPreference(
  environment: TrackingEnvironment = {},
): TrackingPreference | undefined {
  if (trackingDeniedByBrowser(environment)) return 'rejected';
  const storage = browserStorage(environment);
  if (!storage) return undefined;

  let raw: string | null;
  try {
    raw = storage.getItem(CONSENT_STORAGE_KEY);
  } catch (_error) {
    reportFailure(environment, 'Tracking preferences could not be read. Tracking remains off.');
    return undefined;
  }

  const choice = parseStoredPreference(raw, currentTime(environment));
  if (choice || !raw) return choice;

  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch (_error) {
    reportFailure(environment, 'An expired tracking preference could not be removed. Tracking remains off.');
  }
  return undefined;
}

export function saveTrackingPreference(
  choice: TrackingPreference,
  environment: TrackingEnvironment = {},
): boolean {
  if (choice === 'accepted' && trackingDeniedByBrowser(environment)) return false;
  const storage = browserStorage(environment);
  if (!storage) return false;
  const stored: StoredPreference = {
    version: CONSENT_VERSION,
    choice,
    expiresAt: currentTime(environment) + CONSENT_LIFETIME_MS,
  };

  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored));
    const persisted = parseStoredPreference(
      storage.getItem(CONSENT_STORAGE_KEY),
      currentTime(environment),
    );
    if (persisted === choice) return true;
  } catch (_error) {
    // Removal below prevents a stale acceptance from surviving a failed update.
  }

  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch (_error) {
    reportFailure(environment, 'Tracking preferences could not be saved. Tracking remains off.');
    return false;
  }
  reportFailure(environment, 'Tracking preferences could not be saved. Tracking remains off.');
  return false;
}

export function getConsentedDeviceId(
  environment: TrackingEnvironment = {},
): string | undefined {
  if (readTrackingPreference(environment) !== 'accepted') return undefined;
  const storage = browserStorage(environment);
  if (!storage) return undefined;
  try {
    const deviceId = storage.getItem('mautic_device_id') ?? '';
    return DEVICE_ID_PATTERN.test(deviceId) ? deviceId : undefined;
  } catch (_error) {
    reportFailure(environment, 'The tracking device identifier could not be read.');
    return undefined;
  }
}

function boundedPath(url: URL): string {
  return url.pathname.length <= 1024 ? url.pathname : url.pathname.slice(0, 1024);
}

function sanitizedReferrer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.origin;
  } catch (_error) {
    return undefined;
  }
}

export function buildMauticPageview(input: PageviewInput): MauticPageview {
  const currentUrl = new URL(input.currentUrl);
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(input.canonicalUrl, currentUrl);
  } catch (_error) {
    canonicalUrl = currentUrl;
  }

  const pageview: MauticPageview = {
    page_url: `${canonicalUrl.origin}${boundedPath(canonicalUrl)}`,
    page_title: input.pageTitle.replace(/\s+/g, ' ').trim().slice(0, 200),
    page_referrer: sanitizedReferrer(input.referrer) ?? '',
  };

  for (const key of UTM_KEYS) {
    const values = currentUrl.searchParams.getAll(key);
    if (values.length === 1 && UTM_VALUE_PATTERN.test(values[0])) pageview[key] = values[0];
  }
  return pageview;
}

function defaultMauticFunction(): MauticFunction {
  const mautic = ((...args: MauticCall) => {
    (mautic.q ??= []).push(args);
  }) as MauticFunction;
  return mautic;
}

export function startMauticTracking(
  baseUrl: string,
  pageview: MauticPageview,
  environment: TrackingEnvironment = {},
): boolean {
  if (readTrackingPreference(environment) !== 'accepted') {
    clearMauticIdentity(environment);
    return false;
  }
  const currentWindow = environment.window ?? (typeof window === 'undefined' ? undefined : (window as MauticWindow));
  const currentDocument = environment.document ?? (typeof document === 'undefined' ? undefined : document);
  if (!currentWindow || !currentDocument) return false;

  const validatedBaseUrl = marketingTrackingUrl(baseUrl);
  if (!validatedBaseUrl) return false;
  currentWindow.MauticTrackingObject = 'mt';
  const mautic = (currentWindow.mt ??= defaultMauticFunction());
  mautic.l ??= currentTime(environment);

  const existingPageview = mautic.q?.some(
    (call) => call[0] === 'send' && call[1] === 'pageview',
  );
  if (!currentWindow.__registryMauticPageviewSent && !existingPageview) {
    const logger = environment.console ?? globalThis.console;
    mautic('send', 'pageview', pageview, {
      onload: () => undefined,
      onerror: () => logger?.error('Mautic page tracking failed.'),
    });
  }
  currentWindow.__registryMauticPageviewSent = true;

  if (!currentDocument.querySelector('script[data-registry-mautic]')) {
    const script = currentDocument.createElement('script');
    script.async = true;
    script.src = `${validatedBaseUrl}/mtc.js`;
    script.referrerPolicy = 'no-referrer';
    script.dataset.registryMautic = '';
    script.addEventListener('error', () =>
      (environment.console ?? globalThis.console)?.error('Mautic tracking could not be loaded.'),
    );
    currentDocument.head.append(script);
  }
  return true;
}

export function clearMauticIdentity(environment: TrackingEnvironment = {}): boolean {
  const storage = browserStorage(environment);
  const currentDocument = environment.document ?? (typeof document === 'undefined' ? undefined : document);
  let cleared = Boolean(storage && currentDocument);

  if (storage) {
    for (const key of IDENTITY_KEYS) {
      try {
        storage.removeItem(key);
      } catch (_error) {
        cleared = false;
        reportFailure(environment, 'A Mautic identity value could not be cleared.');
      }
    }
  }

  if (currentDocument) {
    for (const key of IDENTITY_KEYS) {
      for (const domain of ['', 'registrystack.org', '.registrystack.org']) {
        try {
          currentDocument.cookie = `${key}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
        } catch (_error) {
          cleared = false;
          reportFailure(environment, 'A Mautic identity cookie could not be cleared.');
        }
      }
    }
  }
  return cleared;
}

export function revokeMauticTracking(environment: TrackingEnvironment = {}): boolean {
  const currentWindow = environment.window ?? (typeof window === 'undefined' ? undefined : (window as MauticWindow));
  const currentDocument = environment.document ?? (typeof document === 'undefined' ? undefined : document);
  const cleared = clearMauticIdentity(environment);
  currentDocument?.querySelector('script[data-registry-mautic]')?.remove();
  // Mautic has no unload API. A page that loaded it must reload after saving rejection
  // because removing the script and replacing `mt` do not detach its native listeners.
  if (currentWindow) {
    currentWindow.mt = (() => undefined) as MauticFunction;
    currentWindow.__registryMauticPageviewSent = true;
  }
  return cleared;
}

export function rejectMauticTracking(
  environment: TrackingEnvironment = {},
): 'failed' | 'saved' | 'reload' {
  const currentWindow = environment.window ?? (typeof window === 'undefined' ? undefined : (window as MauticWindow));
  const currentDocument = environment.document ?? (typeof document === 'undefined' ? undefined : document);
  const needsReload =
    readTrackingPreference(environment) === 'accepted' ||
    currentWindow?.__registryMauticPageviewSent === true ||
    Boolean(currentDocument?.querySelector('script[data-registry-mautic]'));
  const saved = saveTrackingPreference('rejected', environment);
  if (needsReload) revokeMauticTracking(environment);
  else clearMauticIdentity(environment);
  if (!saved) return 'failed';
  return needsReload ? 'reload' : 'saved';
}
