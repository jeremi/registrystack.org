// The site is written in English, with a French version of the pages listed
// in `frenchPagePaths`. A French page lives under src/pages/fr/ at the same
// slug as its English page, prefixed with /fr. Pages not listed here are
// English only: French pages link to them with the visible label
// "(en anglais)", and they have no hreflang alternates.
export type Locale = 'en' | 'fr';

// English paths that have a French counterpart at `/fr${path}`.
export const frenchPagePaths = [
  '/',
  '/solutions/',
  '/solutions/agriculture-food-and-environment/',
  '/solutions/business-and-tax/',
  '/solutions/check-a-fact/',
  '/solutions/health-and-safety/',
  '/solutions/land-property-and-assets/',
  '/solutions/licensing/',
  '/solutions/local-government/',
  '/solutions/people-and-social-programmes/',
  '/solutions/reference-registers/',
  '/solutions/review-changes/',
  '/solutions/verifiable-credentials/',
  '/products/',
  '/products/base-registry/',
  '/products/evidence-gateway/',
  '/products/casework/',
  '/products/render/',
  '/products/messaging/',
  '/products/studio/',
  '/ai/',
  '/ai/service-design/',
  '/ai/citizen-access/',
  '/customization/',
  '/pricing/',
  '/faq/',
  '/security/',
  '/about/',
  '/contact/',
  '/digital-public-infrastructure/',
  '/data-spaces/',
  '/architecture/headless/',
] as const;

// The episodes page exists in both languages, but only while at least one
// episode is published, so it is not in `frenchPagePaths`. Nothing links to it
// while it is not built, and the French check adds it when it is built.
export const episodesPagePath = '/episodes/';

const translatedPaths: ReadonlySet<string> = new Set([...frenchPagePaths, episodesPagePath]);

export const localeForPath = (pathname: string): Locale =>
  pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en';

const withoutLocale = (pathname: string): string =>
  localeForPath(pathname) === 'fr' ? pathname.slice(3) || '/' : pathname;

export const hasFrenchPage = (pathname: string): boolean => translatedPaths.has(withoutLocale(pathname));

// The same page in `locale`, keeping the query and fragment. Links that are
// external, same-document or to English-only pages are returned unchanged.
export const localizedPath = (href: string, locale: Locale): string => {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const url = new URL(href, 'https://registrystack.org');
  const path = withoutLocale(url.pathname);
  if (!translatedPaths.has(path)) return href;
  return (locale === 'fr' ? `/fr${path}` : path) + url.search + url.hash;
};

// The English and French addresses of a page that exists in both languages,
// or null for an English-only page.
export const alternatePaths = (pathname: string): { en: string; fr: string } | null =>
  hasFrenchPage(pathname) ? { en: localizedPath(pathname, 'en'), fr: localizedPath(pathname, 'fr') } : null;

// A shared component's `t(en, fr)`: picks the wording for the page's locale.
//   const t = translator(localeForPath(Astro.url.pathname));
//   <p>{t('Shared', 'Partagé')}</p>
export const translator = (locale: Locale) => (en: string, fr: string): string => (locale === 'fr' ? fr : en);

// The hreflang a French page gives a link: "en" when the destination is an
// English-only page or an outside site in English (docs, marketplace, source),
// so assistive technology and the French checks know the link changes
// language. Fragments, mail links and pages with a French version get none.
export const englishHreflang = (href: string, locale: Locale): 'en' | undefined => {
  if (locale !== 'fr' || href.startsWith('#') || href.startsWith('mailto:')) return undefined;
  if (href.startsWith('/') && !href.startsWith('//')) {
    const path = new URL(href, 'https://registrystack.org').pathname;
    return localeForPath(path) === 'fr' || translatedPaths.has(withoutLocale(path)) ? undefined : 'en';
  }
  return 'en';
};

// The picture a page shows. A French page shows the French version of a
// picture when one exists under public/illustrations/fr/; otherwise it shows
// the English picture and says that its labels are in English.
export const illustrationSource = (
  name: string,
  locale: Locale,
  hasFrenchVersion: boolean,
): { base: string; labelsInEnglish: boolean } =>
  locale === 'fr' && hasFrenchVersion
    ? { base: `/illustrations/fr/${name}`, labelsInEnglish: false }
    : { base: `/illustrations/${name}`, labelsInEnglish: locale === 'fr' };
