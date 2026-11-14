import type { Locale } from '../i18n.ts';
import { requestSourcePage, starterRequestEndpoint } from './starter-request.ts';

export interface EmailSignupInput {
  email: string;
  language: string;
  sourcePage: string | undefined;
  website?: string;
}

// Setting PUBLIC_EMAIL_SIGNUP_ENDPOINT asserts three things about the form that
// receives the sign-ups, because the page text says so: it sends a
// confirmation message before it subscribes anyone, every note carries an
// unsubscribe link, and the notes carry no open or click tracking. The value
// has the same shape as the contact form's kiosk endpoint, and its form must
// not be one of the contact forms: given their endpoints, a sign-up form with
// the same origin and formId fails the build.
export function emailSignupEndpoint(value: string | undefined, contactEndpoints: readonly (string | undefined)[] = []): string | undefined {
  let endpoint: string | undefined;
  try {
    endpoint = starterRequestEndpoint(value, 'kiosk');
  } catch {
    throw new Error('Invalid PUBLIC_EMAIL_SIGNUP_ENDPOINT: expected an HTTPS /form/submit address with formId and privacy=kiosk.');
  }
  if (!endpoint) return undefined;
  const signup = new URL(endpoint);
  for (const contact of contactEndpoints) {
    if (!contact?.trim()) continue;
    let other: URL;
    try {
      other = new URL(contact.trim());
    } catch {
      continue; // the contact pages fail the build on an invalid address
    }
    if (other.origin === signup.origin && other.searchParams.get('formId') === signup.searchParams.get('formId')) {
      throw new Error('Invalid PUBLIC_EMAIL_SIGNUP_ENDPOINT: its formId is already a contact form on the same server; use a form of its own.');
    }
  }
  return endpoint;
}

// The browser checks the address against this pattern; the code applies the
// same rule before it sends anything.
export const emailAddressPattern = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';

// The sign-up, and the privacy wording that describes it, appear together: a
// valid setting and at least one published episode (the sign-up sits on the
// episodes pages). A set but invalid value always fails the build.
export function emailSignupAvailable(
  value: string | undefined,
  publishedEpisodeCount: number,
  contactEndpoints: readonly (string | undefined)[] = [],
): string | undefined {
  const endpoint = emailSignupEndpoint(value, contactEndpoints);
  return endpoint && publishedEpisodeCount > 0 ? endpoint : undefined;
}

const english = {
  heading: 'Email updates',
  body: 'A short note about once a month: what we published and what changed in Registry Stack.',
  label: 'Email address',
  button: 'Sign up',
  privacyBefore: 'We use your email address only to send these notes. Signing up does not turn on visit tracking. Every note has an unsubscribe link. See the ',
  privacyLinkLabel: 'privacy policy',
  sending: 'Sending…',
  success: 'Almost done. Check your inbox for an email with a link to confirm your address.',
  error: 'We could not confirm your sign-up. Please try again later.',
  noScript: 'The sign-up form needs JavaScript.',
};

const french: typeof english = {
  heading: 'Nouvelles par courriel',
  body: 'Une courte note environ une fois par mois : ce que nous avons publié et ce qui a changé dans Registry Stack.',
  label: 'Adresse électronique',
  button: 'S’abonner',
  privacyBefore: 'Nous utilisons votre adresse électronique uniquement pour vous envoyer ces notes. L’abonnement n’active pas le suivi des visites. Chaque note contient un lien de désabonnement. Voir la ',
  privacyLinkLabel: 'politique de confidentialité (en anglais)',
  sending: 'Envoi en cours…',
  success: 'Presque terminé. Consultez votre boîte de réception : un message contient un lien pour confirmer votre adresse.',
  error: 'Nous n’avons pas pu confirmer votre abonnement. Réessayez plus tard.',
  noScript: 'Le formulaire d’abonnement nécessite JavaScript.',
};

export function emailSignupText(locale: Locale = 'en'): typeof english {
  return { ...(locale === 'fr' ? french : english) };
}

// Posts the sign-up the way the contact form posts a request: no cookies, no
// referrer, no redirects, a bounded wait, and a confirmation read back from
// the form's answer. It never carries a tracking identifier. A filled
// honeypot sends nothing and returns as if the sign-up had been sent.
export async function submitEmailSignup(
  endpoint: string,
  input: EmailSignupInput,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const configuredEndpoint = emailSignupEndpoint(endpoint);
  if (!configuredEndpoint) throw new Error('Email sign-up is unavailable.');
  const email = input.email.trim();
  const sourcePage = requestSourcePage(input.sourcePage);
  if (!new RegExp(`^${emailAddressPattern}$`).test(email) || email.length > 254 ||
      (input.language !== 'en' && input.language !== 'fr') || !sourcePage) {
    throw new Error('Check the sign-up details.');
  }
  if (input.website?.trim()) return;

  const url = new URL(configuredEndpoint);
  const savedFields = { email, language: input.language, source_page: sourcePage };
  const body = new URLSearchParams({
    'mauticform[email]': savedFields.email,
    'mauticform[language]': savedFields.language,
    'mauticform[source_page]': savedFields.source_page,
    'mauticform[website]': '',
    'mauticform[formId]': url.searchParams.get('formId') as string,
  });
  url.searchParams.set('ajax', '1');

  const response = await fetch(url.href, {
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
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Could not confirm the email sign-up.');
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Could not confirm the email sign-up.');
  }
  const answer = result as { success?: unknown; results?: Record<string, unknown>; validationErrors?: unknown; errorMessage?: unknown } | null;
  if (!answer || typeof answer !== 'object' || answer.success !== 1 || answer.validationErrors !== undefined ||
      answer.errorMessage !== undefined || !answer.results ||
      Object.entries(savedFields).some(([field, expected]) => answer.results?.[field] !== expected)) {
    throw new Error('Could not confirm the email sign-up.');
  }
}
