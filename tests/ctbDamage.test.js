/**
 * Cumulative fatigue damage of a cement treated base, checked against the
 * worked example in Annex-II of IRC:37-2018. Only the example's numeric inputs
 * and results appear here, as the fixture the test needs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ctbFatigueLife,
  modulusOfRupture,
  axleRepetitions,
  cumulativeDamage,
} from '../src/engine/ctbDamage.js';
import { evaluateTrial, designSection } from '../src/engine/flexibleDesign.js';

/** BC+DBM, aggregate interlayer, CTB, CTSB on the subgrade. */
const ANNEX_LAYERS = [
  { h: 100, E: 3000, nu: 0.35 },
  { h: 100, E: 450, nu: 0.35 },
  { h: 120, E: 5000, nu: 0.25 },
  { h: 250, E: 600, nu: 0.25 },
  { h: 0, E: 62, nu: 0.35 },
];

const SINGLE = [
  [190, 70000], [180, 90000], [170, 92000], [160, 300000], [150, 280000], [140, 650000],
  [130, 600000], [120, 1340000], [110, 1300000], [100, 1500000], [90, 1350000], [85, 3700000],
];

/** Tandem axle repetitions; the example tabulates them already doubled. */
const TANDEM = [
  [400, 200000], [380, 230000], [360, 240000], [340, 235000], [320, 225000], [300, 475000],
  [280, 450000], [260, 1435000], [240, 1250000], [220, 1185000], [200, 1000000], [180, 800000],
  [170, 3200000],
];

const annexDamage = (axle, rows) =>
  cumulativeDamage({
    layers: ANNEX_LAYERS,
    ctbIndex: 2,
    depthMm: 320,
    modulusOfRuptureMPa: 1.4,
    classes: rows.map(([loadKN, repetitions]) => ({ axle, loadKN, repetitions })),
  });

test('fatigue life of the CTB follows the stress ratio', () => {
  // The example's own pairs of stress ratio and life.
  for (const [ratio, life] of [[0.5, 5.26e5], [0.4, 8.58e6], [0.3, 1.4e8]]) {
    const computed = ctbFatigueLife(ratio);
    assert.ok(Math.abs(computed - life) / life < 0.01, `SR ${ratio}: ${computed.toExponential(3)}`);
  }
});

test('modulus of rupture is a fifth of the UCS, capped by material', () => {
  assert.equal(modulusOfRupture(7, 'aggregate').value, 1.4);
  assert.ok(Math.abs(modulusOfRupture(5, 'aggregate').value - 1.0) < 1e-9);
  assert.equal(modulusOfRupture(9, 'aggregate').value, 1.4);
  assert.equal(modulusOfRupture(7, 'limeFlyash').value, 1.05);
  assert.equal(modulusOfRupture(7, 'soilCement').value, 0.7);
});

test('CTB stress under the 190 kN single axle matches the example', () => {
  const [row] = annexDamage('single', [[190, 70000]]).rows;
  // 0.6995 MPa, tangential, on the axis between the dual wheels.
  assert.ok(Math.abs(row.stressMPa - 0.6995) < 0.005, `σt = ${row.stressMPa.toFixed(4)}`);
});

test('single and tandem axle damage match the example', () => {
  const single = annexDamage('single', SINGLE);
  const tandem = annexDamage('tandem', TANDEM);
  // The example rounds each stress to 0.01 MPa, so a few per cent apart. Its
  // tandem total of 3.79 carries a stress ratio of 0.53 for 0.73 / 1.4 on the
  // first row; its own stresses divided through give 3.42, compared here.
  assert.ok(Math.abs(single.total - 0.48) / 0.48 < 0.06, `single ${single.total.toFixed(3)}`);
  assert.ok(Math.abs(tandem.total - 3.42) / 3.42 < 0.05, `tandem ${tandem.total.toFixed(3)}`);
  assert.equal(tandem.safe, false);
  // A 400 kN tandem is two passes of a 200 kN single axle.
  assert.equal(tandem.rows[0].singleKN, 200);
  assert.equal(tandem.rows[0].singleRepetitions, 400000);
});

test('repetitions come from the vehicles, axle mix and spectrum', () => {
  const classes = axleRepetitions({
    vehicles: 1e6,
    axlesPerVehicle: 2,
    axleMix: { single: 50, tandem: 25, tridem: 0 },
    spectrum: {
      single: [{ loadKN: 100, percent: 40 }, { loadKN: 90, percent: null }],
      tandem: [{ loadKN: 200, percent: 100 }],
      tridem: [{ loadKN: 300, percent: 100 }],
    },
  });
  assert.deepEqual(classes, [
    { axle: 'single', loadKN: 100, repetitions: 400000 },
    { axle: 'tandem', loadKN: 200, repetitions: 500000 },
    { axle: 'tridem', loadKN: 300, repetitions: 0 },
  ]);
});

const ctbInput = {
  combination: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
  thicknesses: { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 120, SUB_BASE: 250 },
  materials: { subgradeCBR: 8, binderGrade: 'VG40', pavementTemperatureC: 35 },
  mix: { airVoidsPercent: 3.5, effectiveBinderPercent: 11.5 },
  designTrafficMsa: 50,
};

const spectrum = {
  modulusOfRuptureMPa: 1.4,
  classes: [
    ...SINGLE.map(([loadKN, repetitions]) => ({ axle: 'single', loadKN, repetitions })),
    ...TANDEM.map(([loadKN, repetitions]) => ({ axle: 'tandem', loadKN, repetitions })),
  ],
};

test('without a spectrum the damage is reported as not checked', () => {
  const result = evaluateTrial(ctbInput);
  assert.ok(!result.checks.some((c) => c.id === 'cemented-damage'));
  assert.equal(result.notChecked.length, 1);
});

test('with a spectrum the damage is a check that governs the verdict', () => {
  const result = evaluateTrial({ ...ctbInput, ctbDamage: spectrum });
  const damage = result.checks.find((c) => c.id === 'cemented-damage');
  assert.ok(damage, 'expected the damage check');
  assert.equal(result.notChecked.length, 0);
  assert.ok(damage.damage > 1, `CFD ${damage.damage}`);
  assert.equal(result.safe, false);
});

test('the designed CTB is thick enough for its cumulative damage', () => {
  const outcome = designSection({ ...ctbInput, ctbDamage: spectrum });
  assert.ok(outcome.found, outcome.message);
  const damage = outcome.trial.checks.find((c) => c.id === 'cemented-damage');
  assert.ok(damage.safe, `CFD ${damage.damage}`);

  const plain = designSection(ctbInput);
  assert.ok(outcome.thicknesses.BASE >= plain.thicknesses.BASE);
});
