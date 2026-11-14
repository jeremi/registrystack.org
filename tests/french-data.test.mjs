// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as en from '../src/data/products.ts';
import * as fr from '../src/data/fr/products.ts';
import * as enSolutions from '../src/data/solutions.ts';
import * as frSolutions from '../src/data/fr/solutions.ts';
import * as enTeam from '../src/data/team.ts';
import * as frTeam from '../src/data/fr/team.ts';
import {
  askQuestionHref,
  contactHref,
  contactNeutralRecoveryHref,
  contactRecoveryHref,
  describeServiceHref,
  proposalHref,
} from '../src/data/contact.ts';

// Fields that identify a record or point somewhere stay identical; every other
// string is reader-facing text and must be French.
const sharedFields = new Set(['key', 'slug', 'href', 'tutorialHref', 'name', 'shortName', 'status', 'kind', 'featuredStarter']);

const assertTranslated = (english, french, label, shared = sharedFields) => {
  assert.deepEqual(Object.keys(french).sort(), Object.keys(english).sort(), `${label} has the same fields`);
  for (const [field, value] of Object.entries(english)) {
    const translated = french[field];
    if (typeof value === 'string') {
      assert.equal(typeof translated, 'string', `${label}.${field} is text`);
      assert.ok(translated.trim().length > 0, `${label}.${field} is not empty`);
      assert.doesNotMatch(translated, /—/, `${label}.${field} has no em dash`);
      if (shared.has(field)) {
        assert.equal(translated, value, `${label}.${field} stays as in English`);
      } else {
        assert.notEqual(translated, value, `${label}.${field} is translated`);
        assert.doesNotMatch(translated, /'/, `${label}.${field} uses the typographic apostrophe`);
      }
    } else {
      assert.deepEqual(translated, value, `${label}.${field} stays as in English`);
    }
  }
};

test('French products keep the English keys, names, order and links, with every text translated', () => {
  assert.deepEqual(fr.products.map((product) => product.key), en.products.map((product) => product.key));
  en.products.forEach((product, index) => assertTranslated(product, fr.products[index], product.key));
  for (const product of fr.products) {
    assert.ok(product.description.length < 155, `${product.key} French description fits a search snippet`);
  }
  assert.deepEqual(fr.companionServices.map((service) => service.key), en.companionServices.map((service) => service.key));
  en.companionServices.forEach((service, index) => assertTranslated(service, fr.companionServices[index], service.key));
});

test('French solution areas keep the English keys, slugs, starters and products, with every text translated', () => {
  assert.deepEqual(frSolutions.solutionAreas.map((area) => area.slug), enSolutions.solutionAreas.map((area) => area.slug));
  enSolutions.solutionAreas.forEach((area, index) => {
    // The area name is reader-facing in French, unlike a product name.
    const shared = new Set([...sharedFields].filter((field) => field !== 'name'));
    assertTranslated(area, frSolutions.solutionAreas[index], area.key, shared);
  });
  for (const area of frSolutions.solutionAreas) {
    if (area.description) assert.ok(area.description.length < 160, `${area.key} French description fits a search snippet`);
  }
  assert.deepEqual(frSolutions.registerFamilies.map((area) => area.key), enSolutions.registerFamilies.map((area) => area.key));
  assert.equal(frSolutions.solutionAreaForStarter('farmer-registry')?.key, 'agriculture-food-and-environment');
  assert.equal(frSolutions.starterOrderForArea, enSolutions.starterOrderForArea);
});

test('the French shared FAQ asks the same questions with the same links', () => {
  assert.equal(frSolutions.sharedFamilyFaq.length, enSolutions.sharedFamilyFaq.length);
  enSolutions.sharedFamilyFaq.forEach((item, index) => {
    const french = frSolutions.sharedFamilyFaq[index];
    assert.equal(french.link?.href, item.link?.href);
    for (const text of [french.q, french.a, french.link?.label ?? '']) {
      assert.ok(text.trim().length > 0);
      assert.doesNotMatch(text, /—/);
    }
    assert.notEqual(french.q, item.q);
    assert.notEqual(french.a, item.a);
    assert.notEqual(french.link?.label, item.link?.label);
  });
});

test('the French team record states the same figures', () => {
  for (const name of ['teamRecordShort', 'teamRecordFull']) {
    assert.ok(frTeam[name].startsWith('Avant Aubex'), name);
    assert.equal(frTeam[name].match(/\d+/g)?.join(','), enTeam[name].match(/\d+/g)?.join(','), `${name} keeps its figures`);
  }
  assert.match(frTeam.teamRecordShort, /dix ans/);
  assert.match(frTeam.teamRecordFull, /100 millions/);
});

test('French contact routes lead to the French form and keep the bounded context', () => {
  assert.equal(contactHref(undefined, undefined, 'fr'), '/fr/contact/');
  assert.equal(askQuestionHref('Registre de santé', 'fr'), '/fr/contact/?type=question&context=Registre+de+sant%C3%A9');
  assert.equal(askQuestionHref(undefined, 'fr'), '/fr/contact/?type=question&context=Registry+Stack');
  assert.equal(describeServiceHref('autorisations d’exercice', 'fr'),
    `/fr/contact/?type=service&context=${encodeURIComponent('autorisations d’exercice').replaceAll('%20', '+')}`);
  assert.equal(proposalHref('fr'), '/fr/contact/?type=proposal');
  assert.equal(contactHref('question', 'sujet\nemail@example.org', 'fr'), '/fr/contact/?type=question');
  // English stays the default.
  assert.equal(askQuestionHref(), '/contact/?type=question&context=Registry+Stack');
});

test('French recovery email is written in French and keeps the request intent', () => {
  const service = new URL(contactRecoveryHref('service', 'autorisations d’exercice', 'fr'));
  assert.equal(service.searchParams.get('subject'), 'Votre service : autorisations d’exercice');
  assert.equal(service.searchParams.get('body'), ['Organisation : ', 'Votre fonction : ', 'Message : '].join('\n'));
  const question = new URL(contactRecoveryHref('question', '', 'fr'));
  assert.equal(question.searchParams.get('subject'), 'Question sur Registry Stack');
  const starter = new URL(contactRecoveryHref('starter', 'Registre des agriculteurs', 'fr'));
  assert.match(starter.searchParams.get('body'), /Le registre dont vous avez besoin : $/);
  for (const type of ['question', 'service', 'proposal', 'starter', 'privacy', 'terms']) {
    const subject = new URL(contactRecoveryHref(type, 'x', 'fr')).searchParams.get('subject');
    const englishSubject = new URL(contactRecoveryHref(type, 'x')).searchParams.get('subject');
    assert.notEqual(subject, englishSubject, `${type} subject is French`);
  }
  const neutral = new URL(contactNeutralRecoveryHref('fr'));
  assert.equal(neutral.searchParams.get('subject'), 'Contacter Registry Stack');
  assert.equal(neutral.searchParams.get('body').split('\n').length, 6);
});
