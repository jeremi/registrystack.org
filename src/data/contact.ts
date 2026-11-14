import { requestContext, type ContactRequestType } from '../lib/starter-request.ts';
import type { Locale } from '../i18n.ts';

// The one address a reader can write to. Mail links are a recovery path when
// the form is unavailable, JavaScript is off, or a submission cannot be
// confirmed.
export const contactEmail = 'contact@registrystack.org';

// A mailto link with a subject and one body field per line. The fields end in
// a space so the reader types after the label.
export const mailtoHref = (subject: string, bodyLines: string[]): string =>
  `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

// French pages pass `locale` 'fr' so the reader stays on the French form.
export const contactHref = (type?: ContactRequestType, context?: string, locale: Locale = 'en'): string => {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  const boundedContext = requestContext(context);
  if (boundedContext) params.set('context', boundedContext);
  const query = params.toString();
  const path = locale === 'fr' ? '/fr/contact/' : '/contact/';
  return query ? `${path}?${query}` : path;
};

export const askQuestionHref = (about = 'Registry Stack', locale: Locale = 'en'): string =>
  contactHref('question', about, locale);

// A needs-first inquiry for readers who want to discuss a service before
// choosing a product, starter, or delivery route.
export const describeServiceHref = (about = 'Registry Stack', locale: Locale = 'en'): string =>
  contactHref('service', about, locale);

export const proposalHref = (locale: Locale = 'en'): string => contactHref('proposal', undefined, locale);

const recoverySubject = (type: ContactRequestType, boundedContext: string, locale: Locale): string => {
  if (locale === 'fr') {
    const suffix = boundedContext ? ` : ${boundedContext}` : '';
    return type === 'starter'
      ? `Demande d’accès à une configuration de départ${suffix}`
      : type === 'service'
        ? `Votre service${suffix}`
        : type === 'proposal'
          ? 'Demande de proposition pour Registry Stack'
          : type === 'privacy'
            ? 'Demande relative aux données personnelles'
            : type === 'terms'
              ? 'Question sur les conditions de Registry Stack'
              : `Question${boundedContext ? ` sur ${boundedContext}` : ' sur Registry Stack'}`;
  }
  const suffix = boundedContext ? `: ${boundedContext}` : '';
  return type === 'starter'
    ? `Starter access request${suffix}`
    : type === 'service'
      ? `Service inquiry${suffix}`
      : type === 'proposal'
        ? 'Proposal request for Registry Stack'
        : type === 'privacy'
          ? 'Privacy request'
          : type === 'terms'
            ? 'Question about Registry Stack terms'
            : `Question${boundedContext ? ` about ${boundedContext}` : ' about Registry Stack'}`;
};

export const contactRecoveryHref = (type: ContactRequestType, context = '', locale: Locale = 'en'): string => {
  const boundedContext = requestContext(context) ?? '';
  const subject = recoverySubject(type, boundedContext, locale);
  return mailtoHref(subject, locale === 'fr'
    ? [
        'Organisation : ',
        'Votre fonction : ',
        type === 'starter' ? 'Le registre dont vous avez besoin : ' : 'Message : ',
      ]
    : [
        'Organization: ',
        'Your role: ',
        type === 'starter' ? 'The register you need: ' : 'Message: ',
      ]);
};

export const contactNeutralRecoveryHref = (locale: Locale = 'en'): string => locale === 'fr'
  ? mailtoHref('Contacter Registry Stack', [
      'Type de demande (question, service, proposition, configuration de départ, données personnelles ou conditions) : ',
      'Configuration de départ concernée (le cas échéant) : ',
      'Page d’origine : ',
      'Organisation : ',
      'Votre fonction : ',
      'Message : ',
    ])
  : mailtoHref('Contact Registry Stack', [
      'Request type (question, service, proposal, starter, privacy, or terms): ',
      'Relevant starter (if any): ',
      'Source page: ',
      'Organization: ',
      'Your role: ',
      'Message: ',
    ]);
