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

export async function submitStarterRequest(endpoint: string, input: StarterRequestInput): Promise<void> {
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
  // Only the submission service contacts Mautic. It enforces DNT and strips
  // browser identity. Omit cookies on this hop as well; never load an embed
  // or navigate the browser to a Mautic form endpoint.
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
