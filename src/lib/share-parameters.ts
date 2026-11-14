// Share links copied from a video host often carry an identifier tied to the
// person who shared them. True when the address has one of those parameters.
export const hasShareParameter = (url: URL): boolean =>
  [...url.searchParams.keys()].some((name) => {
    const lower = name.toLowerCase();
    return lower === 'si' || lower === 'feature' || lower.startsWith('utm_');
  });
