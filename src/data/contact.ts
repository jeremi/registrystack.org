// The one address a reader can write to, and the prefilled emails the site
// opens for them. Every mailto on the site is built here so the address and
// the fields stay the same from page to page.
export const contactEmail = 'contact@registrystack.org';

// A mailto link with a subject and one body field per line. The fields end in
// a space so the reader types after the label.
export const mailtoHref = (subject: string, bodyLines: string[]): string =>
  `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

// The light question a reader asks before any scoping: no budget, no timeline.
export const askQuestionHref = (about = 'Registry Stack'): string =>
  mailtoHref(`Question about ${about}`, ['Organization: ', 'Your role: ', 'The register you keep: ', 'Your question: ']);
