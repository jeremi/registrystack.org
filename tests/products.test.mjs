// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { products, companionServices } from '../src/data/products.ts';

test('the companion services state their availability and point at maintained docs', () => {
  assert.deepEqual(
    companionServices.map(({ key, name, status }) => ({ key, name, status })),
    [
      { key: 'render', name: 'Registry Render', status: 'released' },
      { key: 'messaging', name: 'Registry Messaging', status: 'released' },
      { key: 'scheduling', name: 'Registry Scheduling', status: 'development' },
      { key: 'manifest', name: 'Registry Manifest', status: 'released' },
    ],
  );
  assert.equal(new Set(companionServices.map((service) => service.key)).size, companionServices.length);
  for (const service of companionServices) {
    assert.match(service.href, /^https:\/\/docs\.registrystack\.org\//, `${service.name} links to its docs`);
    assert.ok(service.job.length > 0 && service.job.length < 120, `${service.name} has a short job sentence`);
    assert.ok(!products.some((product) => product.key === service.key), `${service.name} is not also a product`);
  }
});
