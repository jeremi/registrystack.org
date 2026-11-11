import test from 'node:test';
import assert from 'node:assert/strict';
import { registerFamilies, startersData } from '../scripts/marketplace-inputs.mjs';
import { MARKETPLACE_ORIGIN, assertMarketplaceIndexingDecision, inspectMarketplace, marketplaceCollectionHref, marketplaceMigrationEnabled, marketplacePackHref, marketplacePageMetadata, marketplaceRedirects } from '../src/lib/marketplace-routes.mjs';

const ids = startersData.starters.map((starter) => starter.id);
const keys = ['licensing', 'business-and-tax', 'people-and-social-programmes', 'land-property-and-assets', 'agriculture-food-and-environment', 'health-and-safety', 'reference-registers'];

test('migration defaults off and true requires an explicit indexing decision', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1']) assert.equal(marketplaceMigrationEnabled(value), false);
  for (const decision of [undefined, '', 'true', 'indexable']) assert.throws(() => marketplaceMigrationEnabled('true', decision), /INDEXING_DECISION/);
  for (const decision of ['require-indexable', 'accept-current-noindex']) assert.equal(marketplaceMigrationEnabled('true', decision), true);
});

test('all84 pack routes and seven collections retain exact unique destinations', () => {
  assert.equal(ids.length, 84);
  assert.equal(new Set(ids).size, 84);
  const redirects = marketplaceRedirects(ids);
  assert.equal(Object.keys(redirects).length, 85);
  assert.equal(redirects['/starters/'], `${MARKETPLACE_ORIGIN}/`);
  for (const id of ids) assert.equal(redirects[`/starters/${id}/`], `${MARKETPLACE_ORIGIN}/packs/${id}/`);
  assert.equal(new Set(Object.values(redirects)).size, 85);
  assert.deepEqual(registerFamilies.map((area) => area.key), keys);
  for (const key of keys) assert.equal(marketplaceCollectionHref(key), `${MARKETPLACE_ORIGIN}/collections/${key}/`);
  assert.throws(() => marketplaceRedirects(['same', 'same']), /Duplicate/);
});

test('route builders reject malformed keys and nonstring values', () => {
  for (const value of [undefined, null, 1, '', '../escape', 'UPPER', 'two words', 'slash/value', 'x?y', 'x#y']) {
    assert.throws(() => marketplacePackHref(value), /route key/);
    assert.throws(() => marketplaceCollectionHref(value), /route key/);
  }
});

test('each generated entry has consistent counts, references, role targets and exactly one family', () => {
  for (const starter of startersData.starters) {
    assert.ok(starter.title.trim() && starter.summary.trim() && starter.task.trim(), starter.id);
    assert.equal(registerFamilies.filter((area) => area.starters.includes(starter.id)).length, 1, `${starter.id}: family`);
    assert.equal(starter.counts.recordTypes, starter.recordTypes.length, `${starter.id}: record count`);
    assert.equal(starter.counts.actions, starter.actions.length, `${starter.id}: action count`);
    assert.equal(starter.counts.values, starter.valuesKeys.length, `${starter.id}: value count`);
    const recordIds = new Set(starter.recordTypes.map((type) => type.id));
    const actionIds = new Set(starter.actions.map((action) => action.id));
    assert.equal(recordIds.size, starter.recordTypes.length, `${starter.id}: duplicate record`);
    assert.equal(actionIds.size, starter.actions.length, `${starter.id}: duplicate action`);
    assert.equal(new Set(starter.accessProfiles.map((profile) => profile.id)).size, starter.accessProfiles.length, `${starter.id}: duplicate role`);
    for (const type of starter.recordTypes) {
      assert.equal(type.fieldCount, type.fields.length, `${starter.id}/${type.id}: field count`);
      assert.equal(new Set(type.fields.map((field) => field.id)).size, type.fields.length, `${starter.id}/${type.id}: duplicate field`);
      for (const field of type.fields) if (field.type === 'reference') assert.ok(recordIds.has(field.target), `${starter.id}: field target ${field.target}`);
      for (const reference of type.references) {
        assert.ok(recordIds.has(reference.target), `${starter.id}: reference target ${reference.target}`);
        assert.ok(type.fields.some((field) => field.id === reference.field), `${starter.id}: reference field ${reference.field}`);
      }
    }
    for (const profile of starter.accessProfiles) {
      for (const id of profile.recordTypes) assert.ok(recordIds.has(id), `${starter.id}: role record ${id}`);
      for (const id of profile.actions) assert.ok(actionIds.has(id), `${starter.id}: role action ${id}`);
    }
    for (const href of starter.sourceUrls) assert.equal(new URL(href).protocol, 'https:', `${starter.id}: source URL`);
  }
});

test('metadata recognizes robots independently of attribute order and casing', () => {
  assert.deepEqual(marketplacePageMetadata(`<META CONTENT='NOINDEX, NOFOLLOW' NAME='robots'><link href="https://example.org/" rel="canonical">`), { robots: 'NOINDEX, NOFOLLOW', canonical: 'https://example.org/' });
  assert.deepEqual(marketplacePageMetadata('<meta data-name="robots" content="noindex"><link data-href="wrong" rel="canonical" href="https://example.org/">'), { robots: '', canonical: 'https://example.org/' });
});

const fixtureFetch = ({ robots = 'User-agent: *\nAllow: /\n', noindex = false, status = 200, canonical, header } = {}) => async (href) => {
  if (href.endsWith('/robots.txt')) return new Response(robots, { status: 200 });
  return new Response(`<link rel="canonical" href="${canonical ?? href}"><meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow'}">`, { status, headers: header ? { 'x-robots-tag': header } : {} });
};

test('indexable decision checks actual response metadata and crawl policy', async () => {
  const input = { starterIds: ['one'], collectionKeys: ['licensing'] };
  const clean = await inspectMarketplace({ ...input, fetchImpl: fixtureFetch() });
  assert.equal(clean.pages.length, 3);
  assert.doesNotThrow(() => assertMarketplaceIndexingDecision(clean, 'require-indexable'));
  for (const options of [{ noindex: true }, { header: 'noindex' }, { robots: 'User-agent: *\nDisallow: /\n' }]) {
    const blocked = await inspectMarketplace({ ...input, fetchImpl: fixtureFetch(options) });
    assert.throws(() => assertMarketplaceIndexingDecision(blocked, 'require-indexable'), /indexing is not verified/);
    assert.doesNotThrow(() => assertMarketplaceIndexingDecision(blocked, 'accept-current-noindex'));
  }
});

test('nontrivial robots policies fail conservatively with a manual-review message', async () => {
  const report = await inspectMarketplace({ starterIds: ['one'], collectionKeys: [], fetchImpl: fixtureFetch({ robots: 'User-agent: SpecialBot\nDisallow: /private/\nUser-agent: *\nAllow: /\n' }) });
  assert.throws(() => assertMarketplaceIndexingDecision(report, 'require-indexable'), /nonempty robots Disallow rules require manual review/);
});

test('wrong canonical, broken destination and duplicate destinations fail preflight', async () => {
  const input = { starterIds: ['one'], collectionKeys: ['licensing'] };
  await assert.rejects(inspectMarketplace({ ...input, fetchImpl: fixtureFetch({ canonical: `${MARKETPLACE_ORIGIN}/` }) }), /canonical/);
  await assert.rejects(inspectMarketplace({ ...input, fetchImpl: fixtureFetch({ status: 404 }) }), /404/);
  await assert.rejects(inspectMarketplace({ starterIds: ['one', 'one'], collectionKeys: [], fetchImpl: fixtureFetch() }), /Duplicate/);
});
