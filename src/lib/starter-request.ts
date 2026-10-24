export interface StarterRequestInput {
  email: string;
  organization: string;
  role: string;
  message: string;
  website?: string;
}

// This points to the submission service, never directly to a Mautic form.
export function starterRequestEndpoint(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Invalid starter form endpoint.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      url.pathname !== '/starter-request' || url.search) {
    throw new Error('Invalid starter form endpoint.');
  }
  return url.href;
}

export async function submitStarterRequest(endpoint: string, input: StarterRequestInput, consentedDeviceId?: string): Promise<void> {
  const configuredEndpoint = starterRequestEndpoint(endpoint);
  if (!configuredEndpoint) throw new Error('Starter request form is unavailable.');
  const email = input.email.trim();
  const organization = input.organization.trim();
  const role = input.role.trim();
  const message = input.message.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      organization.length > 200 || role.length > 200 || message.length > 2000 || input.website?.trim()) {
    throw new Error('Check the request details.');
  }
  const body = new URLSearchParams({
    email, organization, role, message, website: '',
  });
  // Consent is checked by the caller at submission time. An unavailable tracker
  // must never prevent a request, so an absent or malformed identity is omitted.
  if (consentedDeviceId && /^[a-z0-9]{23}$/.test(consentedDeviceId)) {
    body.set('tracking_consent', 'granted');
    body.set('mautic_device_id', consentedDeviceId);
  }
  // The service selects the private Mautic form. Browser cookies, network
  // address and referrer are never forwarded with a starter request.
  const response = await fetch(configuredEndpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not confirm the starter request.');
  }
  const result = await response.json();
  // The service verifies the matching saved Mautic result before confirming.
  if (result?.ok !== true) {
    throw new Error('Could not confirm the starter request.');
  }
}
