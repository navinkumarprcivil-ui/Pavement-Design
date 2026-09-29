/**
 * IRC:58-2015 drainage layer: Eq. 9 and the example of Appendix-VI, VI-VIII.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainageLayer, drainageMaterial } from '../src/engine/drainage.js';
import { defaultRigidState, runRigid, rigidFoundation, missingDrainage } from '../src/ui/rigidProject.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

const EXAMPLE = {
  pavementM: 7,
  concreteShoulderM: 1.5,
  unpavedShoulderM: 1,
  longitudinalJoints: 3,
  jointSpacingM: 4.5,
  gradePercent: 3,
  crossFallPercent: 2.5,
  sideSlope: 2,
  depthMm: 450,
  layerMm: 150,
};

test('VI-VIII: 150 mm drainage layer below 300 mm PQC and 150 mm DLC', () => {
  const r = drainageLayer(EXAMPLE);
  near(r.widthM, 10.4, 1e-9, 'B');
  near(r.alongM, 12.48, 1e-9, 'AC');
  near(r.pathM, 16.24, 0.01, 'AD');
  near(r.dropM, 0.634, 0.001, 'drop');
  near(r.slope, 0.039, 0.0005, 'I');
  near(r.qi, 0.115, 0.0005, 'qi');
  near(r.flow, 1.868, 0.005, 'Q');
  // The example rounds I to 0.039 and qi to 0.115 on the way and prints 319.
  near(r.requiredK, 319, 1, 'K');
  near((16.24 * 0.115) / 0.039 / 0.15, 319, 0.5, 'K with the example rounding');
  assert.equal(r.checks.thickness, true);
  assert.equal(r.checks.permeability, null);
});

test('VI-VIII: 300 mm needs about 160 m/day, but not less than 300 m/day is specified', () => {
  const r = drainageLayer({ ...EXAMPLE, layerMm: 300 });
  near(r.requiredK, 160, 1, 'K');
  assert.equal(r.specifiedK, 300);
});

test('a tested permeability is checked, and gives the thickness it needs', () => {
  const low = drainageLayer({ ...EXAMPLE, permeability: 250 });
  assert.equal(low.checks.permeability, false);
  assert.equal(low.thicknessForK, 200);
  const high = drainageLayer({ ...EXAMPLE, permeability: 3000 });
  assert.equal(high.checks.permeability, true);
  assert.equal(high.thicknessForK, 100, 'never under the 100 mm minimum');
  assert.equal(drainageLayer({ ...EXAMPLE, layerMm: 75 }).checks.thickness, false);
});

test('no gradient: the path runs straight down the camber', () => {
  const r = drainageLayer({ ...EXAMPLE, gradePercent: 0 });
  near(r.pathM, r.widthM, 1e-9, 'path');
  near(r.slope, 0.025, 1e-12, 'I');
});

test('drainage material: Cu 2 – 8, stabilise under 4, D10 over 2 mm, abrasion under 40%', () => {
  assert.equal(drainageMaterial({ d10Mm: 3, d60Mm: 15, abrasionPercent: 30, stabiliser: 'none' }).warnings.length, 0);
  assert.equal(drainageMaterial({ d10Mm: 5, d60Mm: 15, stabiliser: 'none' }).warnings.length, 1);
  assert.equal(drainageMaterial({ d10Mm: 5, d60Mm: 15, stabiliser: 'cement', stabiliserPercent: 2 }).warnings.length, 0);
  assert.equal(drainageMaterial({ d10Mm: 1, d60Mm: 20, stabiliser: 'none' }).warnings.length, 2);
  assert.equal(drainageMaterial({ abrasionPercent: 40, stabiliser: 'none' }).warnings.length, 1);
  assert.equal(drainageMaterial({ stabiliser: 'emulsion', stabiliserPercent: 2 }).warnings.length, 1);
  assert.equal(drainageMaterial({ stabiliser: 'bitumen', stabiliserPercent: 1.5 }).warnings.length, 0);
});

const withSpectrum = () => {
  const rigid = defaultRigidState();
  rigid.spectrum = {
    single: [{ loadKN: 190, percent: 100 }],
    tandem: [{ loadKN: 390, percent: 100 }],
    tridem: [{ loadKN: 545, percent: 100 }],
  };
  return rigid;
};

test('a rigid design carries the drainage layer below the DLC', () => {
  const rigid = withSpectrum();
  rigid.drainage.provided = true;
  assert.equal(runRigid(rigid, 'design').ok, false, 'geometry needed first');
  assert.equal(missingDrainage(rigid), 'carriageway width draining one way');
  Object.assign(rigid.drainage, {
    pavementM: 7,
    concreteShoulderM: 1.5,
    unpavedShoulderM: 1,
    longitudinalJoints: 3,
    gradePercent: 3,
    crossFallPercent: 2.5,
    sideSlope: 2,
    layerMm: 150,
    permeability: 350,
  });
  rigid.slab.thicknessMm = 290;
  const r = runRigid(rigid, 'check');
  assert.ok(r.ok);
  assert.equal(r.drainage.depthMm, 290 + 150);
  assert.equal(r.drainage.checks.permeability, true);
  assert.deepEqual(r.slots.map((s) => s.label), ['PQC', 'DLC', 'Drainage layer', 'GSB, separation', 'Subgrade']);
});

test('bonded: the drainage and separation layers together are the 200 – 250 mm of granular', () => {
  const rigid = withSpectrum();
  rigid.foundation.bonded = true;
  rigid.foundation.gsbMm = 100;
  rigid.drainage.provided = true;
  rigid.drainage.layerMm = 150;
  const f = rigidFoundation(rigid);
  assert.ok(!f.warnings.some((w) => w.includes('Cl. 6.7.2')), f.warnings.join('; '));
  rigid.drainage.provided = false;
  assert.ok(rigidFoundation(rigid).warnings.some((w) => w.includes('Cl. 6.7.2')));
});

test('a granular sub-base is itself the drainage layer', () => {
  const rigid = withSpectrum();
  Object.assign(rigid.foundation, { subBase: 'granular', subBaseMm: 250 });
  Object.assign(rigid.drainage, {
    provided: true,
    pavementM: 7,
    concreteShoulderM: 1.5,
    unpavedShoulderM: 1,
    longitudinalJoints: 3,
    gradePercent: 3,
    crossFallPercent: 2.5,
    sideSlope: 2,
  });
  const r = runRigid(rigid, 'check');
  assert.ok(r.ok, r.message);
  assert.equal(r.drainage.layerMm, 250);
  assert.equal(r.drainage.depthMm, rigid.slab.thicknessMm);
  assert.equal(r.slots[1].label, 'GSB, drainage');
});

test('rainfall over 1000 mm without a drainage layer, and joints over 4.5 m, are flagged', () => {
  const rigid = withSpectrum();
  rigid.drainage.rainfallMm = 1500;
  rigid.slab.jointSpacingM = 5;
  const r = runRigid(rigid, 'check');
  assert.ok(r.warnings.some((w) => w.includes('Cl. 6.5.2')));
  assert.ok(r.warnings.some((w) => w.includes('Cl. 7.1.3')));
});
