// Pictures and films from the Registry Stack explainer series. Pictures live
// in public/illustrations/ at 800, 1600 and 2400 pixels wide; films live in
// public/films/ with a poster and English and French captions. Each page that shows one
// passes its own caption.

export const illustrations = {
  'same-parts-many-services': { width: 2400, height: 960 },
  'same-definitions': { width: 2400, height: 1191 },
  'requests-and-signed-answers': { width: 2400, height: 1335 },
  'service-template': { width: 2400, height: 1050 },
  'ai-drafted-change': { width: 2400, height: 923 },
} as const;

export const films = {
  'registry-stack-film': { length: '2 minutes 30 seconds' },
  'registry-stack-studio-film': { length: '1 minute 25 seconds' },
} as const;

// The French reading of each film's length, for the French pages.
export const filmLengthsFr: Record<keyof typeof films, string> = {
  'registry-stack-film': '2 minutes 30 secondes',
  'registry-stack-studio-film': '1 minute 25 secondes',
};
