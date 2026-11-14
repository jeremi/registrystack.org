import type { Locale } from '../i18n.ts';
import { hasShareParameter } from './share-parameters.ts';

// One episode is two Markdown files, one per language, under
// src/content/episodes/en/ and src/content/episodes/fr/, with the same number.
export interface EpisodeFile {
  id: string;
  data: {
    number?: number;
    date?: Date;
    status?: 'published' | 'draft';
    title?: string;
    filmUrl?: string;
  };
}

const locales: readonly Locale[] = ['en', 'fr'];

const describe = (file: EpisodeFile) => `Episode file ${file.id}`;

function assertPublishable(file: EpisodeFile): void {
  const { number, date, title, filmUrl } = file.data;
  if (!Number.isInteger(number) || (number as number) < 1) {
    throw new Error(`${describe(file)}: number must be a positive integer.`);
  }
  if (!title?.trim()) throw new Error(`${describe(file)}: a published episode needs a title.`);
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw new Error(`${describe(file)}: a published episode needs a valid date.`);
  }
  let film: URL | undefined;
  try {
    film = filmUrl ? new URL(filmUrl) : undefined;
  } catch {
    film = undefined;
  }
  if (!film || film.protocol !== 'https:' || film.username || film.password) {
    throw new Error(`${describe(file)}: a published episode needs an HTTPS film address (filmUrl) without credentials.`);
  }
  if (hasShareParameter(film)) {
    throw new Error(`${describe(file)}: remove the share or tracking parameter (si, feature, utm_*) from the film address (filmUrl).`);
  }
}

// The published episodes of each language, newest first. A draft is left out
// and may be incomplete. A published episode must have a published file in
// both languages with the same date; anything else fails with a message
// naming the file.
export function selectEpisodes<T extends EpisodeFile>(files: readonly T[]): Record<Locale, T[]> {
  const published: Record<Locale, Map<number, T>> = { en: new Map(), fr: new Map() };
  for (const file of files) {
    const language = file.id.split('/')[0] as Locale;
    if (!file.id.includes('/') || !locales.includes(language)) {
      throw new Error(`${describe(file)}: episode files belong under en/ or fr/.`);
    }
    const status = file.data.status ?? 'draft';
    if (status !== 'published' && status !== 'draft') {
      throw new Error(`${describe(file)}: status must be published or draft.`);
    }
    if (status === 'draft') continue;
    assertPublishable(file);
    const number = file.data.number as number;
    if (published[language].has(number)) {
      throw new Error(`Episode ${number} has more than one published ${language} file.`);
    }
    published[language].set(number, file);
  }
  const numbers = new Set([...published.en.keys(), ...published.fr.keys()]);
  for (const number of numbers) {
    for (const language of locales) {
      if (!published[language].has(number)) {
        throw new Error(`Episode ${number} is published in one language but has no published ${language} version.`);
      }
    }
    const dates = locales.map((language) => (published[language].get(number) as T).data.date as Date);
    if (dates[0].valueOf() !== dates[1].valueOf()) {
      throw new Error(`Episode ${number}: the en and fr versions must have the same date.`);
    }
  }
  const newestFirst = (a: T, b: T) =>
    (b.data.date as Date).valueOf() - (a.data.date as Date).valueOf() ||
    (b.data.number as number) - (a.data.number as number);
  return { en: [...published.en.values()].sort(newestFirst), fr: [...published.fr.values()].sort(newestFirst) };
}

// French writes the first of the month as "1er".
export const formatEpisodeDate = (date: Date, locale: Locale): string => {
  const formatted = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return locale === 'fr' ? formatted.replace(/^1 /, '1er ') : formatted;
};

export const episodeLinkText = (number: number, locale: Locale): string =>
  locale === 'fr'
    ? `Regarder l’épisode ${number} sur la chaîne vidéo`
    : `Watch episode ${number} on the video channel`;

export function episodesPageText(locale: Locale): { title: string; heading: string; lead: string } {
  return locale === 'fr'
    ? {
        title: 'Épisodes | Registry Stack',
        heading: 'Épisodes',
        lead: 'La version écrite, en bref, de chacun de nos films sur la création de services publics avec Registry Stack. Les plus récents d’abord.',
      }
    : {
        title: 'Episodes | Registry Stack',
        heading: 'Episodes',
        lead: 'The short written version of each of our films about building public services with Registry Stack. Newest first.',
      };
}
