export interface StarterRequestInput {
  email: string;
  organization: string;
  role: string;
  message: string;
  website?: string;
}

type StarterRequestMode = 'kiosk' | 'consented';

export function starterRequestEndpoint(
  value: string | undefined,
  mode: StarterRequestMode = 'kiosk',
): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Invalid starter form endpoint.');
  }
  const formIds = url.searchParams.getAll('formId');
  const privacy = url.searchParams.getAll('privacy');
  const formId = formIds[0] ?? '';
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.pathname !== '/form/submit' || [...url.searchParams].length !== 2 ||
      formIds.length !== 1 || privacy.length !== 1 || privacy[0] !== mode ||
      !/^[1-9]\d*$/.test(formId) || !Number.isSafeInteger(Number(formId))) {
    throw new Error('Invalid starter form endpoint.');
  }
  return url.href;
}

function endpointFormId(endpoint: string): string {
  return new URL(endpoint).searchParams.get('formId') as string;
}

function nativeSubmissionUrl(endpoint: string): string {
  const url = new URL(endpoint);
  url.searchParams.set('ajax', '1');
  return url.href;
}

export async function submitStarterRequest(
  kioskEndpoint: string,
  input: StarterRequestInput,
  consentedDeviceId?: string,
  trackedEndpoint?: string,
): Promise<void> {
  const configuredKioskEndpoint = starterRequestEndpoint(kioskEndpoint);
  if (!configuredKioskEndpoint) throw new Error('Starter request form is unavailable.');
  const configuredTrackedEndpoint = starterRequestEndpoint(trackedEndpoint, 'consented');
  if (configuredTrackedEndpoint) {
    const kioskUrl = new URL(configuredKioskEndpoint);
    const trackedUrl = new URL(configuredTrackedEndpoint);
    if (trackedUrl.origin !== kioskUrl.origin ||
        endpointFormId(configuredTrackedEndpoint) === endpointFormId(configuredKioskEndpoint)) {
      throw new Error('Invalid starter form configuration.');
    }
  }

  const email = input.email.trim();
  const organization = input.organization.trim();
  const role = input.role.trim();
  const message = input.message.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      organization.length > 200 || role.length > 200 || message.length > 2000 || input.website?.trim()) {
    throw new Error('Check the request details.');
  }

  const hasConsentedDevice = Boolean(consentedDeviceId && /^[a-z0-9]{23}$/.test(consentedDeviceId));
  const endpoint = hasConsentedDevice && configuredTrackedEndpoint
    ? configuredTrackedEndpoint
    : configuredKioskEndpoint;
  const requestToken = crypto.randomUUID();
  const savedFields = {
    email,
    organization,
    role,
    message,
    starter_id: 'professional-licensing',
    source_page: '/starters/professional-licensing/',
    request_token: requestToken,
  };
  const body = new URLSearchParams({
    'mauticform[email]': savedFields.email,
    'mauticform[organization]': savedFields.organization,
    'mauticform[role]': savedFields.role,
    'mauticform[message]': savedFields.message,
    'mauticform[starter_id]': savedFields.starter_id,
    'mauticform[source_page]': savedFields.source_page,
    'mauticform[request_token]': savedFields.request_token,
    'mauticform[website]': '',
    'mauticform[formId]': endpointFormId(endpoint),
  });
  if (hasConsentedDevice && configuredTrackedEndpoint) {
    body.set('mautic_device_id', consentedDeviceId as string);
  }

  const response = await fetch(nativeSubmissionUrl(endpoint), {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not confirm the starter request.');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Could not confirm the starter request.');
  }
  if (!result || typeof result !== 'object') throw new Error('Could not confirm the starter request.');
  const nativeResult = result as {
    success?: unknown;
    results?: Record<string, unknown>;
    validationErrors?: unknown;
    errorMessage?: unknown;
  };
  if (nativeResult.success !== 1 || nativeResult.validationErrors !== undefined ||
      nativeResult.errorMessage !== undefined || !nativeResult.results ||
      Object.entries(savedFields).some(([field, expected]) => nativeResult.results?.[field] !== expected)) {
    throw new Error('Could not confirm the starter request.');
  }
}
