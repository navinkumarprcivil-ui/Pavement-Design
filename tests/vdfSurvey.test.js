/**
 * IRC:37-2018 Cl. 4.4.3 - 4.4.4: the vehicle damage factor from an axle load
 * survey, Eq. 4.1 - 4.4, and the sample Table 4.1 asks for.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vdfFromAxles, surveySample } from '../src/engine/traffic.js';

test('Eq. 4.1 - 4.4: each axle at its own standard load is one standard axle', () => {
  const r = vdfFromAxles({
    vehicles: 4,
    singleSingle: [{ loadKN: 65, count: 1 }],
    singleDual: [{ loadKN: 80, count: 1 }],
    tandem: [{ loadKN: 148, count: 1 }],
    tridem: [{ loadKN: 224, count: 1 }],
  });
  assert.ok(r.ready);
  assert.ok(Math.abs(r.equivalent - 4) < 1e-12);
  assert.ok(Math.abs(r.value - 1) < 1e-12);
});

test('Eq. 4.2: the fourth power of the load ratio', () => {
  const r = vdfFromAxles({ vehicles: 10, singleDual: [{ loadKN: 160, count: 5 }, { loadKN: 40, count: 16 }] });
  // 5 x 2^4 + 16 x 0.5^4 = 80 + 1 = 81 standard axles over 10 vehicles.
  assert.ok(Math.abs(r.value - 8.1) < 1e-12);
  assert.equal(r.types.find((t) => t.id === 'singleDual').axles, 21);
  assert.equal(r.steps.at(-1).result, 'VDF = 8.10');
  assert.match(r.steps[0].ref.clause, /4\.4\.3/);
});

test('An incomplete survey gives no VDF', () => {
  assert.equal(vdfFromAxles({ vehicles: 0, singleDual: [{ loadKN: 80, count: 3 }] }).ready, false);
  assert.equal(vdfFromAxles({ vehicles: 5, singleDual: [{ loadKN: null, count: 3 }] }).value, null);
});

test('Table 4.1: 20% below 3000 CVPD, 15% (at least 600) to 6000, then 10% (at least 900)', () => {
  assert.equal(surveySample(1000).vehicles, 200);
  assert.equal(surveySample(2999).percent, 20);
  assert.equal(surveySample(3000).vehicles, 600);
  assert.equal(surveySample(5000).vehicles, 750);
  assert.equal(surveySample(6000).percent, 15);
  assert.equal(surveySample(6001).vehicles, 900);
  assert.equal(surveySample(12000).vehicles, 1200);
});
