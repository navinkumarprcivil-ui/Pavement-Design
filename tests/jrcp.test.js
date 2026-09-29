/**
 * IRC:58 Cl. 9, jointed reinforced concrete slabs: steel by Eq. 18, the
 * limits of Cl. 9.1 and 9.3, and how a reinforced slab changes the joint
 * warnings, the drawing and the bill of quantities.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slabReinforcement } from '../src/engine/rigidDetails.js';
import { defaultRigidState, runRigid } from '../src/ui/rigidProject.js';
import { crossSection } from '../src/engine/crossSection.js';
import { billOfQuantities } from '../src/engine/quantities.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

test('Eq. 18: As = Ld f W / (2 Sst) each way', () => {
  const r = slabReinforcement({ slabMm: 300, jointSpacingM: 12, freeWidthM: 7, yieldMPa: 500, workingPercent: 50, barMm: 10 });
  // W = 0.3 × 24 kN/m³ = 7200 N/m²; Sst = 250 MPa.
  near(r.W, 7200, 1e-9, 'W');
  near(r.sst, 250, 1e-9, 'Sst');
  near(r.longitudinal.As, (12 * 1.5 * 7200) / 500, 1e-9, 'longitudinal As');
  near(r.transverse.As, (7 * 1.5 * 7200) / 500, 1e-9, 'transverse As');
  assert.equal(r.longitudinal.spacingMm, 300);
  assert.equal(r.transverse.spacingMm, 510);
  assert.ok(r.longitudinal.provided >= r.longitudinal.As);
  assert.ok(r.transverse.provided >= r.transverse.As);
  assert.equal(r.warnings.length, 0);
});

test('Cl. 9.1 and 9.3: joints over 5.0 m, Sst 50 - 60% of the yield', () => {
  const r = slabReinforcement({ slabMm: 300, jointSpacingM: 4.5, freeWidthM: 7, yieldMPa: 500, workingPercent: 70, barMm: 10 });
  assert.ok(r.warnings.some((w) => w.includes('Cl. 9.1')));
  assert.ok(r.warnings.some((w) => w.includes('Cl. 9.3')));
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

test('a reinforced slab: its steel, and the joint warnings it changes', () => {
  const rigid = withSpectrum();
  rigid.slab.jointSpacingM = 12;
  const plain = runRigid(rigid, 'design');
  assert.ok(plain.warnings.some((w) => w.includes('Cl. 7.1.3 / 9.1')));
  assert.ok(plain.warnings.some((w) => w.includes('reinforce it')));

  rigid.slab.reinforced = true;
  assert.equal(runRigid(rigid, 'design').message, 'Enter the distance between free longitudinal joints');
  rigid.slab.freeWidthM = 7;
  const r = runRigid(rigid, 'design');
  assert.ok(r.ok);
  assert.ok(r.reinforcement.longitudinal.As > 0);
  assert.ok(!r.warnings.some((w) => w.includes('Cl. 7.1.3')));
  assert.ok(!r.warnings.some((w) => w.includes('reinforce it')));
  assert.ok(r.warnings.some((w) => w.includes('Cl. 6.2.6')));
  assert.ok(r.name.startsWith('JRCP'));
});

test('the mesh in the bill of quantities', () => {
  const model = crossSection({
    type: 'rigid',
    slots: [{ slotId: 'PQC', materialId: 'PQC', label: 'PQC', thicknessMm: 300, behaviour: 'concrete' }],
    geometry: { carriagewayWidthM: 7 },
    rigid: {
      shoulder: 'none',
      laneWidthM: 3.5,
      jointSpacingM: 12,
      dowels: null,
      tieBars: { diameterMm: 12, lengthMm: 640, spacingMm: 540 },
      mesh: { barMm: 10, longitudinalMm: 300, transverseMm: 510, depthMm: [50, 60] },
    },
  });
  const bill = billOfQuantities(model, {}, 1);
  const bar = (Math.PI * 0.01 ** 2) / 4;
  near(bill.items.find((i) => i.key === 'Slab reinforcement').quantity, ((bar / 0.3 + bar / 0.51) * 7000 * 7850) / 1000, 1e-9, 'mesh tonnes');
});
