#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerFamilies, startersData } from './marketplace-inputs.mjs';
import { marketplaceCollectionHref, marketplaceMigrationEnabled, marketplaceRedirects } from '../src/lib/marketplace-routes.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const requestedMode = args.get('--mode');
const mode = requestedMode === 'current'
  ? (marketplaceMigrationEnabled(process.env.PUBLIC_MARKETPLACE_MIGRATION_ENABLED, process.env.MARKETPLACE_INDEXING_DECISION) ? 'migration' : 'default')
  : requestedMode;
const dist = args.get('--dist');
if (!['default', 'migration'].includes(mode) || !dist) throw new Error('Usage: node scripts/check-marketplace-redirects.mjs --mode current|default|migration --dist PATH');
const ids = startersData.starters.map((starter) => starter.id);
const redirects = marketplaceRedirects(ids);
const read = (file) => readFile(path.join(dist, file), 'utf8');
const decode = (html) => html.replace(/&amp;/g, '&').replace(/&#(?:39|x27);/gi, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const plain = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

for (const [source, destination] of Object.entries(redirects)) {
  const html = await read(`${source.slice(1)}index.html`);
  if (mode === 'migration') {
    assert.match(html, /http-equiv="refresh"/i, source);
    assert.ok(html.includes(`content="0;url=${destination}"`), `${source}: exact refresh`);
    assert.ok(html.includes(`href="${destination}"`), `${source}: fallback link`);
  } else {
    assert.doesNotMatch(html, /http-equiv="refresh"/i, source);
    assert.ok(html.includes(`rel="canonical" href="https://registrystack.org${source}"`), `${source}: self canonical`);
    assert.doesNotMatch(html, /name="robots" content="noindex/i, `${source}: retain indexing`);
    if (source === '/starters/') {
      assert.ok(html.includes('id="starters-title"'));
      assert.doesNotMatch(html, /class="starter-card/);
      for (const area of registerFamilies) {
        assert.ok(html.includes(`id="${area.key}"`), `catalogue bookmark ${area.key}`);
        assert.ok(html.includes(`href="${marketplaceCollectionHref(area.key)}"`), `catalogue collection ${area.key}`);
      }
    } else {
      const starter = startersData.starters.find((entry) => source === `/starters/${entry.id}/`);
      const text = plain(html);
      const heading = decode(html.match(/<h1[^>]*id="starter-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
      assert.equal(heading, starter.title, `${source}: unique title`);
      assert.ok(text.includes(starter.summary), `${source}: individual summary`);
      assert.equal((html.match(/class="starter-record"/g) ?? []).length, starter.recordTypes.length, `${source}: rendered record count`);
      assert.equal((html.match(/class="starter-field-name"/g) ?? []).length, starter.recordTypes.reduce((n, type) => n + type.fields.length, 0), `${source}: rendered field count`);
      assert.equal((html.match(/class="starter-role"/g) ?? []).length, starter.accessProfiles.length, `${source}: rendered role count`);
      for (const type of starter.recordTypes) assert.ok(html.includes(`id="record-${type.id}"`), `${source}: record anchor ${type.id}`);
      for (const href of starter.sourceUrls) assert.ok(html.includes(`href="${href.replaceAll('&', '&amp;')}"`), `${source}: source reference ${href}`);
      assert.ok(html.includes(`${startersData.source.breg.version} model snapshot`), `${source}: archive version`);
      assert.ok(html.includes('free access available on request'), `${source}: access terms`);
      assert.ok(html.includes(`href="${redirects[source]}" data-journey="marketplace-current-configuration"`), `${source}: current marketplace handoff`);
      assert.doesNotMatch(html, /data-starter-request-form/, `${source}: no requests from archived model`);
      const withoutTechnicalDetails = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
      const renderedActions = withoutTechnicalDetails.match(/<dl class="starter-actions"[^>]*>([\s\S]*?)<\/dl>/)?.[1] ?? '';
      assert.equal((renderedActions.match(/<dt(?:\s|>)/g) ?? []).length, starter.actions.length, `${source}: rendered action count`);
      for (const action of starter.actions) assert.ok(text.includes(action.label), `${source}: action label ${action.id}`);
      assert.ok(text.includes('does not mean their operators use or endorse'), `${source}: model provenance boundary`);
    }
  }
}

for (const area of registerFamilies) {
  const html = await read(`${area.slug.slice(1)}index.html`);
  assert.ok(html.includes(`href="${marketplaceCollectionHref(area.key)}"`), `${area.slug}: matching collection`);
  assert.doesNotMatch(html, /class="starter-card/, `${area.slug}: no full pack list`);
}
const sitemap = await read('sitemap-0.xml');
for (const source of Object.keys(redirects)) assert.equal(sitemap.includes(`https://registrystack.org${source}<`), mode === 'default', `${source}: sitemap`);
console.log(`Verified ${mode}: all 85 legacy routes, seven collections${mode === 'default' ? ', all 84 individual titles/summaries/record-field-role counts/source links' : ', exact refresh/fallback destinations and sitemap removal'}.`);
if (mode === 'migration') {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-marketplace-journey.mjs', import.meta.url)), dist], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Marketplace browser journey check exited ${result.status}.`);
}
