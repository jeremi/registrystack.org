import type { MarkdownInstance } from 'astro';
import { emailSignupAvailable } from '../lib/email-signup';
import { selectEpisodes, type EpisodeFile } from '../lib/episodes';
import { episodeFixturesEnabled } from '../lib/test-fixtures';

// One episode is two Markdown files, one per language:
// src/content/episodes/en/001-<slug>.md and src/content/episodes/fr/001-<slug>.md.
// A plain glob, not a content collection, so that an empty folder produces
// no build warning. The sample episodes load only in the test build.
export type Episode = EpisodeFile & { Content: MarkdownInstance<Record<string, unknown>>['Content'] };

const episodeFiles = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('/src/content/episodes/**/*.md');
const fixtureFiles = import.meta.glob<MarkdownInstance<Record<string, unknown>>>('/tests/fixtures/episodes/**/*.md');

async function loadEpisodes(): Promise<Episode[]> {
  const sources = episodeFixturesEnabled ? fixtureFiles : episodeFiles;
  return Promise.all(Object.entries(sources).map(async ([path, load]) => {
    const { frontmatter, Content } = await load();
    const { number, date, status, title, filmUrl } = frontmatter as Record<string, unknown>;
    return {
      id: path.replace(/^.*\/episodes\//, '').replace(/\.md$/, ''),
      data: {
        number: number as number | undefined,
        date: date === undefined ? undefined : new Date(date as string | Date),
        status: status as 'published' | 'draft' | undefined,
        title: title as string | undefined,
        filmUrl: filmUrl as string | undefined,
      },
      Content,
    };
  }));
}

// The published episodes of each language, newest first. Both lists are empty
// until an episode is published in both languages; the episodes pages exist
// only then.
export const publishedEpisodes = async () => selectEpisodes<Episode>(await loadEpisodes());

export const hasPublishedEpisodes = async (): Promise<boolean> =>
  (await publishedEpisodes()).en.length > 0;

// The sign-up endpoint when the sign-up, and the privacy wording that
// describes it, are on.
export async function emailSignupEndpointForSite(): Promise<string | undefined> {
  return emailSignupAvailable(
    import.meta.env.PUBLIC_EMAIL_SIGNUP_ENDPOINT,
    (await publishedEpisodes()).en.length,
    [import.meta.env.PUBLIC_STARTER_REQUEST_ENDPOINT, import.meta.env.PUBLIC_STARTER_REQUEST_TRACKED_ENDPOINT],
  );
}
