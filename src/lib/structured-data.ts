// Schema.org JSON-LD for the site layout. Kept here so the markup can be
// tested without building the site.
import { authorFor } from '../data/authors.ts';

const SITE_URL = 'https://registrystack.org';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
// Google expects a square logo; the 1200x630 social card is not one.
export const SITE_LOGO_URL = `${SITE_URL}/icon-512.png`;

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Registry Stack',
    legalName: 'Aubex Consulting LLC',
    url: SITE_URL,
    logo: SITE_LOGO_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '28 Geary St, Ste 650 #189',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94108',
      addressCountry: 'US',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@registrystack.org',
      contactType: 'customer support',
    },
    sameAs: ['https://github.com/registrystack'],
  };
}

// Google reads the site name it shows in results from a WebSite node on the
// home page.
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Registry Stack',
    url: `${SITE_URL}/`,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

interface ArticleInput {
  headline: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
}

export function articleLd({ headline, description, url, image, publishedAt, updatedAt, author }: ArticleInput) {
  const byline = authorFor(author);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline,
    description,
    datePublished: publishedAt,
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    author: {
      '@type': byline.kind === 'person' ? 'Person' : 'Organization',
      name: byline.name,
      url: byline.url,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Registry Stack',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: SITE_LOGO_URL },
    },
    mainEntityOfPage: url,
    image,
  };
}
