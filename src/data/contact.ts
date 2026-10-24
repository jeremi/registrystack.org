import { requestContext, type ContactRequestType } from '../lib/starter-request.ts';

// The one address a reader can write to. Mail links are a recovery path when
// the form is unavailable, JavaScript is off, or a submission cannot be
// confirmed.
export const contactEmail = 'contact@registrystack.org';

// A mailto link with a subject and one body field per line. The fields end in
// a space so the reader types after the label.
export const mailtoHref = (subject: string, bodyLines: string[]): string =>
  `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

export const contactHref = (type?: ContactRequestType, context?: string): string => {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  const boundedContext = requestContext(context);
  if (boundedContext) params.set('context', boundedContext);
  const query = params.toString();
  return query ? `/contact/?${query}` : '/contact/';
};

export const askQuestionHref = (about = 'Registry Stack'): string =>
  contactHref('question', about);

// A needs-first inquiry for readers who want to discuss a service before
// choosing a product, starter, or delivery route.
export const describeServiceHref = (about = 'Registry Stack'): string =>
  contactHref('service', about);

export const proposalHref = (): string => contactHref('proposal');

export const contactRecoveryHref = (type: ContactRequestType, context = ''): string => {
  const boundedContext = requestContext(context) ?? '';
  const suffix = boundedContext ? `: ${boundedContext}` : '';
  const subject = type === 'starter'
    ? `Starter request${suffix}`
    : type === 'service'
      ? `Service inquiry${suffix}`
      : type === 'proposal'
        ? 'Proposal request for Registry Stack'
        : type === 'privacy'
          ? 'Privacy request'
          : type === 'terms'
            ? 'Question about Registry Stack terms'
            : `Question${boundedContext ? ` about ${boundedContext}` : ' about Registry Stack'}`;
  return mailtoHref(subject, [
    'Organization: ',
    'Your role: ',
    type === 'starter' ? 'The register you keep: ' : 'Message: ',
  ]);
};

export const contactNeutralRecoveryHref = (): string => mailtoHref('Contact Registry Stack', [
  'Request type (question, service, proposal, starter, privacy, or terms): ',
  'Relevant starter (if any): ',
  'Source page: ',
  'Organization: ',
  'Your role: ',
  'Message: ',
]);
