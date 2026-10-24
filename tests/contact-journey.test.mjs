import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('contact links retain only their source path and keep bounded enquiry click analytics', async () => {
  const base = await readFile(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const script = [...base.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes('const journeyTargets'));
  assert.ok(script);
  const location = new URL('https://registrystack.org/pricing/?email=private@example.invalid#private');
  class Anchor {
    constructor(href, text, journey) {
      this.href = new URL(href, location).href;
      this.textContent = text;
      this.dataset = journey ? { journey } : {};
    }
    setAttribute(name, value) { if (name === 'href') this.href = new URL(value, location).href; }
    closest() { return this; }
  }
  const anchors = [
    new Anchor('/contact/?type=proposal', 'Request a proposal', 'implementation-support-inquiry'),
    new Anchor('/contact/?type=privacy&context=Delete+my+data', 'Privacy request'),
    new Anchor('#starter-request-form', 'Request the starter', 'starter-request'),
    new Anchor('/faq/', 'FAQ'),
    new Anchor('https://other.example.org/contact/', 'External contact'),
  ];
  const events = [];
  const listeners = new Map();
  runInNewContext(script, {
    URL, Element: Anchor,
    window: { location, umami: { track: (name, data) => events.push({ name, data }) } },
    document: {
      querySelectorAll: selector => selector === 'a[href]' ? anchors : [],
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
  });
  for (const anchor of anchors.slice(0, 2)) {
    const target = new URL(anchor.href);
    assert.equal(target.searchParams.get('source'), '/pricing/');
    assert.equal(target.searchParams.has('email'), false);
    assert.equal(target.hash, '');
  }
  for (const anchor of anchors) listeners.get('click')({ target: anchor });
  assert.equal(events.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(events.map(({ name, data }) => ({
    name, target: data.target_site, path: data.target_path,
    source: data.source_path, journey: data.journey,
  })))), [
    { name: 'marketing_link_click', target: 'contact', path: '/contact/', source: '/pricing/', journey: 'implementation-support-inquiry' },
    { name: 'marketing_link_click', target: 'contact', path: '/contact/', source: '/pricing/', journey: 'contact' },
    { name: 'marketing_link_click', target: 'contact', path: '/pricing/', source: '/pricing/', journey: 'starter-request' },
  ]);
  assert.equal(JSON.stringify(events).includes('private'), false);
  assert.equal(JSON.stringify(events).includes('Delete'), false);
});
