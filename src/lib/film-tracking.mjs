import { trackingFailureReason } from './shared-tracking-client.mjs';

// Films live in public/films/ as <name>-<height>.mp4. A film's name is the
// same in Umami events and in Mautic page hits. Only a standard video height
// counts as a suffix, so a name such as launch-2026 keeps its number.
const FILM_PATH = /^\/films\/([a-z0-9]+(?:-[a-z0-9]+)*?)(?:-(?:360|480|540|720|1080|1440|2160))?\.mp4$/;

export function filmFromSource(src, origin) {
  if (!src) return null;
  let url;
  try {
    url = new URL(src, origin);
  } catch {
    return null;
  }
  const film = url.origin === origin ? FILM_PATH.exec(url.pathname)?.[1] : undefined;
  return film ? { film, path: url.pathname } : null;
}

// Mautic has no custom events in its tracker, so a film start is a page hit
// on the film file that played. It carries no query, fragment or referrer.
export function filmStartPageview({ origin, film, path }) {
  return {
    page_url: `${origin}${path}`,
    page_title: `Film started: ${film}`,
    page_referrer: '',
  };
}

/**
 * Returns a handler for a video's play event. Each film counts once per page
 * load: pausing and resuming is not a new start. Umami, which is cookie-free,
 * counts every start; Mautic records it only for a visitor who accepted
 * tracking, so a film started before acceptance is recorded on its first play
 * after it. A Mautic hit is optional: if it fails, consent stays in place.
 * `mautic` returns the shared tracking client, or undefined where Mautic is
 * not configured.
 */
export function createFilmStartRecorder({ location, umami, mautic, warn = console.warn }) {
  const countedInUmami = new Set();
  const sentToMautic = new Set();
  return (video) => {
    const played = video.currentSrc || video.querySelector('source[src]')?.src || video.src;
    const source = filmFromSource(played, location.origin);
    if (!source) return;
    const { film } = source;
    if (!countedInUmami.has(film)) {
      countedInUmami.add(film);
      umami()?.track?.('film_play', { film, source_path: location.pathname });
    }
    const client = mautic();
    if (sentToMautic.has(film) || client?.state.choice !== 'accepted') return;
    sentToMautic.add(film);
    client.pageview(filmStartPageview({ origin: location.origin, ...source }), { optional: true }).catch((error) => {
      warn(`Film start for ${film} was not recorded in Mautic: ${trackingFailureReason(error)}`);
    });
  };
}
