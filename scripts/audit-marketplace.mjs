#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { registerFamilies, startersData } from './marketplace-inputs.mjs';
import { assertMarketplaceIndexingDecision, inspectMarketplace } from '../src/lib/marketplace-routes.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--output', '--decision'].includes(process.argv[i]) || !process.argv[i + 1]) {
    throw new Error('Usage: node scripts/audit-marketplace.mjs [--output PATH] [--decision require-indexable|accept-current-noindex]');
  }
  args.set(process.argv[i], process.argv[i + 1]);
}
const report = await inspectMarketplace({ starterIds: startersData.starters.map((starter) => starter.id), collectionKeys: registerFamilies.map((area) => area.key) });
if (args.has('--output')) await writeFile(args.get('--output'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Inspected ${report.pages.length} exact marketplace destinations: all HTTP 200 and matching canonical. ${report.pages.filter((page) => page.noindex).length} noindex; robots Disallow: ${report.disallowRules.join(', ') || '(none)'}.`);
if (args.has('--decision')) assertMarketplaceIndexingDecision(report, args.get('--decision'));
