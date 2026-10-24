export interface StarterRequestInput {
  email: string;
  organization: string;
  role: string;
  message: string;
  website?: string;
  starterId?: string;
  sourcePage?: string;
  requestType?: ContactRequestType;
  requestContext?: string;
}

type StarterRequestMode = 'kiosk' | 'consented';
export type ContactRequestType = 'question' | 'service' | 'proposal' | 'starter' | 'privacy' | 'terms';

export const contactRequestTypes: readonly ContactRequestType[] = [
  'question',
  'service',
  'proposal',
  'starter',
  'privacy',
  'terms',
];

export function isContactRequestType(value: string | undefined): value is ContactRequestType {
  return contactRequestTypes.includes(value as ContactRequestType);
}

export function contactRequestPresentation(type: ContactRequestType): {
  eyebrow: string;
  heading: string;
  intro: string;
  messageLabel: string;
  submitLabel: string;
  successMessage: string;
  privacyCopy: string;
} {
  const sharedPrivacy = 'We use these details to review your message and reply. You can send it without accepting visit tracking. If you have accepted tracking, we may link your visits to this message. There is no marketing signup.';
  switch (type) {
    case 'starter':
      return {
        eyebrow: 'Free of charge',
        heading: 'Request access to this starter',
        intro: 'Leave your contact details to request access to the configuration. You can also add context so our team can understand what you are planning.',
        messageLabel: 'What are you trying to do?',
        submitLabel: 'Request access',
        successMessage: 'Access request received. Our team will review it.',
        privacyCopy: 'We use these details to review your request and reply. You can request access without accepting tracking. If you accept tracking, we may link your visits to this request. There is no marketing signup.',
      };
    case 'service':
      return { eyebrow: 'Service enquiry', heading: 'Discuss your service', intro: 'Describe the service, its users, and what should improve. Our team will review your message and reply.', messageLabel: 'Your service and what you need', submitLabel: 'Send message', successMessage: 'Message received. Our team will review it and reply.', privacyCopy: sharedPrivacy };
    case 'proposal':
      return { eyebrow: 'Implementation', heading: 'Request a proposal', intro: 'Describe the service and implementation support you want us to price. We will reply to clarify the scope.', messageLabel: 'What should the proposal cover?', submitLabel: 'Request a proposal', successMessage: 'Request received. Our team will review it and reply.', privacyCopy: sharedPrivacy };
    case 'privacy':
      return { eyebrow: 'Privacy', heading: 'Send a privacy request', intro: 'Tell us what personal data request you want us to review and how we can identify the relevant correspondence or visit history.', messageLabel: 'Your privacy request', submitLabel: 'Send privacy request', successMessage: 'Privacy request received. Our team will review it and reply.', privacyCopy: 'We use these details to handle your privacy request and reply. We do not use this request to link your current browser to your message. There is no marketing signup.' };
    case 'terms':
      return { eyebrow: 'Website terms', heading: 'Ask about the terms', intro: 'Tell us which part of the website terms you are asking about. Our team will review your message and reply.', messageLabel: 'Your question', submitLabel: 'Send question', successMessage: 'Question received. Our team will review it and reply.', privacyCopy: sharedPrivacy };
    case 'question':
      return { eyebrow: 'Contact Registry Stack', heading: 'Ask a question', intro: 'Tell us what you need. Our team will review your message and reply.', messageLabel: 'Your question', submitLabel: 'Send question', successMessage: 'Question received. Our team will review it and reply.', privacyCopy: sharedPrivacy };
  }
}

export function requestContext(value: string | undefined): string | undefined {
  const context = value?.trim() ?? '';
  return context.length <= 200 && !/[\u0000-\u001f\u007f]/.test(context) ? context : undefined;
}

export function requestSourcePage(value: string | undefined): string | undefined {
  const path = value?.trim() ?? '';
  if (!path || path.length > 500 || path.includes('\\')) return undefined;
  try {
    const url = new URL(path, 'https://registrystack.org');
    if (url.origin !== 'https://registrystack.org' || url.search || url.hash || url.pathname !== path) {
      return undefined;
    }
    return url.pathname;
  } catch {
    return undefined;
  }
}

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
  const starterId = input.starterId?.trim() ?? '';
  const sourcePage = requestSourcePage(input.sourcePage);
  const type = input.requestType ?? 'question';
  const context = requestContext(input.requestContext);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      organization.length > 200 || role.length > 200 || message.length > 2000 || input.website?.trim() ||
      (starterId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(starterId)) || starterId.length > 120 ||
      !sourcePage || !isContactRequestType(type) || context === undefined ||
      (type !== 'starter' && !message)) {
    throw new Error('Check the request details.');
  }

  const hasConsentedDevice = Boolean(consentedDeviceId && /^[a-z0-9]{23}$/.test(consentedDeviceId));
  const endpoint = type !== 'privacy' && hasConsentedDevice && configuredTrackedEndpoint
    ? configuredTrackedEndpoint
    : configuredKioskEndpoint;
  const requestToken = crypto.randomUUID();
  const savedFields = {
    email,
    organization,
    role,
    message,
    starter_id: starterId,
    source_page: sourcePage,
    request_token: requestToken,
    request_type: type,
    request_context: context,
  };
  const body = new URLSearchParams({
    'mauticform[email]': savedFields.email,
    'mauticform[organization]': savedFields.organization,
    'mauticform[role]': savedFields.role,
    'mauticform[message]': savedFields.message,
    'mauticform[starter_id]': savedFields.starter_id,
    'mauticform[source_page]': savedFields.source_page,
    'mauticform[request_token]': savedFields.request_token,
    'mauticform[request_type]': savedFields.request_type,
    'mauticform[request_context]': savedFields.request_context,
    'mauticform[website]': '',
    'mauticform[formId]': endpointFormId(endpoint),
  });
  if (type !== 'privacy' && hasConsentedDevice && configuredTrackedEndpoint) {
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
