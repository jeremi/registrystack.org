export const MARKETPLACE_ORIGIN = 'https://marketplace.registrystack.org';

const routeKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const requireRouteKey = (value) => {
  if (typeof value !== 'string' || !routeKeyPattern.test(value)) {
    throw new Error(`Invalid marketplace route key: ${JSON.stringify(value)}`);
  }
  return value;
};

export const marketplacePackHref = (starterId) =>
  `${MARKETPLACE_ORIGIN}/packs/${requireRouteKey(starterId)}/`;

export const marketplaceCollectionHref = (collectionKey) =>
  `${MARKETPLACE_ORIGIN}/collections/${requireRouteKey(collectionKey)}/`;

// A true flag alone must not remove the indexable legacy routes.
export const marketplaceMigrationEnabled = (value, indexingDecision) => {
  if (value !== 'true') return false;
  if (!['require-indexable', 'accept-current-noindex'].includes(indexingDecision)) {
    throw new Error('Marketplace cutover requires MARKETPLACE_INDEXING_DECISION=require-indexable or accept-current-noindex; leave PUBLIC_MARKETPLACE_MIGRATION_ENABLED unset to retain legacy detail pages.');
  }
  return true;
};

export const marketplaceRedirects = (starterIds) => {
  const redirects = { '/starters/': `${MARKETPLACE_ORIGIN}/` };
  for (const id of starterIds) {
    const source = `/starters/${requireRouteKey(id)}/`;
    if (source in redirects) throw new Error(`Duplicate starter redirect source: ${source}`);
    redirects[source] = marketplacePackHref(id);
  }
  return redirects;
};

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : '';
};

export const marketplacePageMetadata = (html) => {
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag);
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag);
  return {
    robots: meta.filter((tag) => ['robots', 'googlebot'].includes(attribute(tag, 'name').toLowerCase())).map((tag) => attribute(tag, 'content')).join(','),
    canonical: attribute(links.find((tag) => attribute(tag, 'rel').toLowerCase().split(/\s+/).includes('canonical')) ?? '', 'href'),
  };
};

// Read-only preflight: every destination must return its own canonical page.
// Indexable mode conservatively rejects any robots Disallow rule; nontrivial
// crawl policies need a deliberate decision instead of an incomplete parser.
export const inspectMarketplace = async ({ starterIds, collectionKeys, fetchImpl = fetch }) => {
  const destinations = [`${MARKETPLACE_ORIGIN}/`, ...collectionKeys.map(marketplaceCollectionHref), ...starterIds.map(marketplacePackHref)];
  if (new Set(destinations).size !== destinations.length) throw new Error('Duplicate marketplace destination.');
  const robotsResponse = await fetchImpl(`${MARKETPLACE_ORIGIN}/robots.txt`, { signal: AbortSignal.timeout(15000) });
  if (robotsResponse.status !== 200) throw new Error(`Marketplace robots.txt returned ${robotsResponse.status}.`);
  const robots = await robotsResponse.text();
  const disallowRules = [...robots.matchAll(/^\s*Disallow\s*:\s*([^#\r\n]*)/gim)].map((match) => match[1].trim()).filter(Boolean);
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, destinations.length) }, async () => {
    while (next < destinations.length) {
      const href = destinations[next++];
      const response = await fetchImpl(href, { signal: AbortSignal.timeout(15000) });
      if (response.status !== 200) throw new Error(`${href} returned ${response.status}.`);
      if (response.url && response.url !== href) throw new Error(`${href} resolved to unexpected destination ${response.url}.`);
      const { robots: pageRobots, canonical } = marketplacePageMetadata(await response.text());
      if (canonical !== href) throw new Error(`${href} has unexpected canonical ${canonical || '(missing)'}.`);
      const directives = `${pageRobots},${response.headers.get('x-robots-tag') ?? ''}`;
      results.push({ href, status: response.status, canonical, noindex: /\b(?:noindex|none)\b/i.test(directives), nofollow: /\b(?:nofollow|none)\b/i.test(directives) });
    }
  }));
  return { checkedAt: new Date().toISOString(), robots, disallowRules, pages: results.sort((a, b) => a.href.localeCompare(b.href)) };
};

export const assertMarketplaceIndexingDecision = (report, decision) => {
  if (decision === 'accept-current-noindex') return;
  if (decision !== 'require-indexable') throw new Error('Missing explicit marketplace indexing decision.');
  const blockedPages = report.pages.filter((page) => page.noindex);
  if (report.disallowRules.length || blockedPages.length) {
    throw new Error(`Marketplace indexing is not verified: ${blockedPages.length} pages contain noindex; nonempty robots Disallow rules require manual review: ${report.disallowRules.join(', ') || '(none)'}. Leave migration off, or explicitly accept the current noindex tradeoff.`);
  }
};
