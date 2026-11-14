import { hasShareParameter } from '../lib/share-parameters.ts';
import { episodeFixturesEnabled, fixturePrivacyDate, fixtureVideoChannelUrl } from '../lib/test-fixtures.ts';

// The address of the video channel. Leave it undefined until the channel
// exists: while it is undefined the footer shows no channel link. The channel
// is linked, never embedded.
export const videoChannelUrl: string | undefined = undefined;

// An HTTPS address without credentials or share parameters, or undefined when
// none is set. Any other value fails the build.
export function validateVideoChannelUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid video channel address: not a URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid video channel address: use an HTTPS address without credentials.');
  }
  if (hasShareParameter(url)) {
    throw new Error('Invalid video channel address: remove the share or tracking parameter (si, feature, utm_*).');
  }
  return url.href;
}

export const configuredVideoChannelUrl = (): string | undefined =>
  validateVideoChannelUrl(episodeFixturesEnabled ? fixtureVideoChannelUrl : videoChannelUrl);

// The date the privacy page shows as its effective date once the channel link,
// an episode or the email sign-up is on, because each adds wording to that
// page. Written as on the page, for example 'January 12, 2027'.
export const channelsPrivacyDate: string | undefined = undefined;

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isPageDate(value: string): boolean {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) return false;
  const month = months.indexOf(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return month >= 0 && date.getUTCMonth() === month && date.getUTCDate() === day;
}

// The date to show when an addition is on, or undefined when none is, in which
// case the page keeps its own date. Fails the build when an addition is on and
// the date is missing or not in the page's form.
export function privacyEffectiveDate(additionsOn: boolean, configured: string | undefined): string | undefined {
  if (!additionsOn) return undefined;
  if (configured === undefined || !isPageDate(configured)) {
    throw new Error("Invalid privacy date: set channelsPrivacyDate in src/data/channels.ts as 'Month D, YYYY' when the channel link, an episode or the email sign-up is on.");
  }
  return configured;
}

export const configuredPrivacyDate = (): string | undefined =>
  episodeFixturesEnabled ? fixturePrivacyDate : channelsPrivacyDate;
