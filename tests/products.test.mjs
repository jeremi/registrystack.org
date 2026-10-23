// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { products, companionServices } from '../src/data/products.ts';

test('the companion services are the released parts around the three products, each pointing at its docs', () => {
  assert.deepEqual(companionServices.map((service) => service.name), [
    'Registry Render', 'Registry Messaging', 'Registry Scheduling', 'Registry Manifest',
  ]);
  for (const service of companionServices) {
    assert.match(service.href, /^https:\/\/docs\.registrystack\.org\//, `${service.name} links to its docs`);
    assert.ok(service.job.length > 0 && service.job.length < 120, `${service.name} has a short job sentence`);
    assert.ok(!products.some((product) => product.key === service.key), `${service.name} is not also a product`);
  }
});
