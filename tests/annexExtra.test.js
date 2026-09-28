/**
 * The effective subgrade (Annex-II.1) and the treated RAP base (Annex-II.5) of
 * IRC:37-2018, and strains read from IITPAVE standing in for computed ones.
 * Only the examples' numeric inputs and results appear here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSubgrade } from '../src/engine/materials.js';
import { evaluateTrial } from '../src/engine/flexibleDesign.js';
import { cumulativeDamage, stressKey } from '../src/engine/ctbDamage.js';

const within = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) / expected < tolerance, `${what}: ${actual} vs ${expected}`);

test('II.1 — 500 mm of CBR 20% borrow over CBR 8% embankment', () => {
  const e = effectiveSubgrade({ borrowCBR: 20, embankmentCBR: 8 });
  within(e.borrowMR, 119.7, 0.002, 'borrow modulus');
  within(e.embankmentMR, 66.6, 0.002, 'embankment modulus');
  within(e.deflection, 1.41, 0.005, 'surface deflection');
  within(e.equivalent, 105.1, 0.005, 'equivalent modulus');
  assert.equal(e.value, 100, 'capped at 100 MPa');
  within(e.cbr, 15.1, 0.005, 'effective CBR');
});

const rapInput = {
  combination: { bituminousId: 'BC_DBM', baseId: 'RAP', subBaseId: 'CTSB', crackReliefId: null },
  thicknesses: { BC: 40, DBM: 60, BASE: 180, SUB_BASE: 250 },
  materials: { subgradeCBR: 7, binderGrade: 'VG40', pavementTemperatureC: 35, overrides: { SUBGRADE: 62 } },
  mix: { airVoidsPercent: 3, effectiveBinderPercent: 11.5 },
  designTrafficMsa: 131,
};

test('II.5 — bituminous layer over a treated RAP base on a CTSB', () => {
  const result = evaluateTrial(rapInput);
  const rap = result.layers.find((l) => l.slotId === 'BASE');
  assert.equal(rap.E, 800);
  assert.equal(rap.nu, 0.35);
  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  within(byId['bituminous-fatigue'].strainMicro, 104.2, 0.01, 'bituminous strain');
  within(byId['bituminous-fatigue'].allowableMicro, 150, 0.01, 'allowable tensile strain');
  within(byId['subgrade-rutting'].allowableMicro, 301, 0.01, 'allowable vertical strain');
  assert.ok(result.safe);
});

test('a mix modulus from the mix design replaces the table value, up to it (Cl. 9.2)', () => {
  const result = evaluateTrial({ ...rapInput, materials: { ...rapInput.materials, bituminousModulusMPa: 2500 } });
  assert.ok(result.layers.filter((l) => l.behaviour === 'bituminous').every((l) => l.E === 2500));
  const capped = evaluateTrial({ ...rapInput, materials: { ...rapInput.materials, bituminousModulusMPa: 4200 } });
  assert.ok(capped.layers.filter((l) => l.behaviour === 'bituminous').every((l) => l.E === 3000), 'VG40 at 35 deg C');
});

test('strains read from IITPAVE replace the computed ones', () => {
  const result = evaluateTrial({ ...rapInput, measured: { bituminous: 160e-6, subgrade: 200e-6 } });
  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  within(byId['bituminous-fatigue'].strainMicro, 160, 1e-9, 'entered tensile strain');
  assert.equal(byId['bituminous-fatigue'].source, 'IITPAVE');
  assert.equal(byId['bituminous-fatigue'].safe, false);
  within(byId['subgrade-rutting'].strainMicro, 200, 1e-9, 'entered vertical strain');
});

test('a CTB stress read from IITPAVE replaces the computed one', () => {
  const layers = [
    { h: 100, E: 3000, nu: 0.35 },
    { h: 100, E: 450, nu: 0.35 },
    { h: 120, E: 5000, nu: 0.25 },
    { h: 250, E: 600, nu: 0.25 },
    { h: 0, E: 62, nu: 0.35 },
  ];
  const damage = cumulativeDamage({
    layers,
    ctbIndex: 2,
    depthMm: 320,
    modulusOfRuptureMPa: 1.4,
    classes: [{ axle: 'tandem', loadKN: 400, repetitions: 200000 }],
    stresses: { [stressKey(200)]: 0.73 },
  });
  assert.equal(damage.rows[0].stressMPa, 0.73);
  assert.equal(damage.rows[0].source, 'IITPAVE');
});
