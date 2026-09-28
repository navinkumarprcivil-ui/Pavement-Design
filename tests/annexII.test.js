/**
 * Validation against the worked examples in Annex-II and the design
 * calculations in Annex-III of IRC:37-2018.
 *
 * The strains and deflections quoted there were produced by IITPAVE.
 * Reproducing them with this app's own layered-elastic solver is the strongest
 * check available that the analysis engine agrees with the software the code
 * is written around. The Annex-III cases run through the whole design engine,
 * so they also check the modulus rules, the contact stress used for a cement
 * treated base, and every performance criterion.
 *
 * Only the numeric inputs and results of the examples appear here, as the
 * fixture any test needs. No code text is reproduced.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, contactRadius } from '../src/engine/elastic.js';
import { evaluateTrial } from '../src/engine/flexibleDesign.js';

/** IRC standard axle: 80 kN on dual wheels either side. */
const STANDARD_AXLE = {
  wheelLoadN: 20000,
  tyrePressureMPa: 0.56,
  dualSpacingMm: 310,
};

/**
 * The two points the code evaluates: under one wheel, and on the axis of
 * symmetry between the dual pair. The governing strain is the larger.
 */
const dualWheelPoints = (z, layerIndex) => [
  { x: 0, y: 0, z, layerIndex, label: 'under the wheel' },
  { x: 155, y: 0, z, layerIndex, label: 'between the wheels' },
];

/** Relative difference, for comparing against values the code rounds hard. */
const within = (actual, expected, tolerance, what) =>
  assert.ok(
    Math.abs(actual - expected) / expected < tolerance,
    `${what}: got ${actual}, code gives ${expected}`
  );

test('II.1 — surface deflection of the two-layer subgrade system', () => {
  // 500 mm of select borrow soil (CBR 20) over embankment soil (CBR 8),
  // under a single 40 kN wheel.
  assert.ok(Math.abs(contactRadius(40000, 0.56) - 150.8) < 0.05);

  const [surface] = analyze({
    layers: [
      { h: 500, E: 119.7, nu: 0.35 },
      { h: 0, E: 66.6, nu: 0.35 },
    ],
    load: { wheelLoadN: 40000, tyrePressureMPa: 0.56 },
    points: [{ x: 0, y: 0, z: 0 }],
  });

  within(surface.surfaceDeflectionMm, 1.41, 0.01, 'surface deflection (mm)');
});

test('II.2 — subgrade strain under construction traffic, deficient and adequate GSB', () => {
  // A 150 mm sub-base is shown to be deficient and 250 mm adequate, over a
  // 50 MPa subgrade. Granular moduli are the code's own 0.2*h^0.45*Msupport.
  const subgradeStrain = (thicknessMm, granularModulus) => {
    const results = analyze({
      layers: [
        { h: thicknessMm, E: granularModulus, nu: 0.35 },
        { h: 0, E: 50, nu: 0.35 },
      ],
      load: STANDARD_AXLE,
      points: dualWheelPoints(thicknessMm),
    });
    return Math.max(...results.map((p) => p.verticalCompressiveStrain)) * 1e6;
  };

  within(subgradeStrain(150, 95), 4324, 0.01, 'eps_v, 150 mm GSB (microstrain)');
  within(subgradeStrain(250, 119), 2179, 0.01, 'eps_v, 250 mm GSB (microstrain)');
});

test('II.3 — both design strains of the granular base and sub-base example', () => {
  // 190 mm bituminous / 480 mm granular / subgrade at 7% effective CBR.
  const layers = [
    { h: 190, E: 3000, nu: 0.35 },
    { h: 480, E: 200, nu: 0.35 },
    { h: 0, E: 62, nu: 0.35 },
  ];

  // Tensile strain is taken at the underside of the bituminous layer, so the
  // point belongs to layer 0 rather than the granular layer beginning there.
  const underside = analyze({
    layers,
    load: STANDARD_AXLE,
    points: dualWheelPoints(190, 0),
  });
  const subgradeTop = analyze({
    layers,
    load: STANDARD_AXLE,
    points: dualWheelPoints(670),
  });

  const tensile = Math.max(...underside.map((p) => p.maxHorizontalStrain));
  const vertical = Math.max(...subgradeTop.map((p) => p.verticalCompressiveStrain));

  within(tensile, 0.000146, 0.01, 'eps_t at the bottom of the bituminous layer');
  within(vertical, 0.000243, 0.01, 'eps_v at the top of the subgrade');
});

/*
 * Annex-III: effective subgrade CBR 10%, bituminous modulus 3000 MPa (VG40) or
 * 2000 MPa (VG30), Va 3.5% and Vbe 11.5%. Strains are compared at 1.5%, and
 * allowable traffic — which goes as the fourth power of strain or more — at 5%.
 */
function annexIII({ combination, thicknesses, binderGrade = 'VG40', designTrafficMsa }) {
  const result = evaluateTrial({
    combination,
    thicknesses,
    materials: { subgradeCBR: 10, binderGrade, pavementTemperatureC: 35 },
    mix: { airVoidsPercent: 3.5, effectiveBinderPercent: 11.5 },
    designTrafficMsa,
    roadCategory: 'other',
  });
  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
  return { result, byId };
}

const expectCheck = (check, strainMicro, allowableMsa, what) => {
  within(check.strainMicro, strainMicro, 0.015, `${what} strain (microstrain)`);
  within(check.allowableMsa, allowableMsa, 0.05, `${what} allowable traffic (msa)`);
};

test('III.1 — granular base and sub-base, 50 msa', () => {
  const { result, byId } = annexIII({
    combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB' },
    thicknesses: { BC: 40, DBM: 105, BASE: 250, SUB_BASE: 200 },
    designTrafficMsa: 50,
  });
  within(result.layers.find((l) => l.slotId === 'BASE').E, 240, 0.01, 'granular modulus');
  expectCheck(byId['bituminous-fatigue'], 175, 53, 'bituminous fatigue');
  expectCheck(byId['subgrade-rutting'], 278, 187, 'subgrade rutting');
});

test('III.2 — CTSB, CTB and aggregate interlayer, 30 msa', () => {
  const { byId } = annexIII({
    combination: {
      bituminousId: 'BC_DBM',
      baseId: 'CTB',
      subBaseId: 'CTSB',
      crackReliefId: 'AGG_INTERLAYER',
    },
    thicknesses: { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 100, SUB_BASE: 200 },
    designTrafficMsa: 30,
  });
  expectCheck(byId['bituminous-fatigue'], 132, 160, 'bituminous fatigue');
  expectCheck(byId['subgrade-rutting'], 252, 293, 'subgrade rutting');
  // Analysed at 0.80 MPa; at the standard 0.56 MPa it would read 3% low.
  expectCheck(byId['cemented-fatigue'], 59.2, 438, 'CTB fatigue');
});

test('III.2 — the same section at 5 msa, VG30 and RF = 2', () => {
  const { result, byId } = annexIII({
    combination: {
      bituminousId: 'BC_ONLY',
      baseId: 'CTB',
      subBaseId: 'CTSB',
      crackReliefId: 'AGG_INTERLAYER',
    },
    thicknesses: { BC: 40, CRACK_RELIEF: 100, BASE: 100, SUB_BASE: 200 },
    binderGrade: 'VG30',
    designTrafficMsa: 5,
  });
  assert.equal(result.reliability, 80);
  assert.equal(byId['cemented-fatigue'].reliabilityFactor, 2);
  expectCheck(byId['bituminous-fatigue'], 118, 1096, 'bituminous fatigue');
  expectCheck(byId['subgrade-rutting'], 333, 242, 'subgrade rutting');
  expectCheck(byId['cemented-fatigue'], 81.9, 18, 'CTB fatigue');
});

test('III.3 — SAMI over a CTB leaves the bituminous layer in compression', () => {
  const { result, byId } = annexIII({
    combination: {
      bituminousId: 'BC_DBM',
      baseId: 'CTB',
      subBaseId: 'CTSB',
      crackReliefId: 'SAMI',
    },
    thicknesses: { BC: 40, DBM: 60, BASE: 130, SUB_BASE: 200 },
    designTrafficMsa: 30,
  });
  assert.equal(result.layers.length, 5, 'SAMI is not a structural layer');
  assert.equal(byId['bituminous-fatigue'].allowableMsa, Infinity);
  expectCheck(byId['subgrade-rutting'], 251, 298, 'subgrade rutting');
  expectCheck(byId['cemented-fatigue'], 72.6, 38, 'CTB fatigue');
});

test('III.5 — GSB, CTB and aggregate interlayer, 50 msa', () => {
  const { result, byId } = annexIII({
    combination: {
      bituminousId: 'BC_DBM',
      baseId: 'CTB',
      subBaseId: 'GSB',
      crackReliefId: 'AGG_INTERLAYER',
    },
    thicknesses: { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 160, SUB_BASE: 200 },
    designTrafficMsa: 50,
  });
  within(result.layers.find((l) => l.slotId === 'SUB_BASE').E, 167, 0.01, 'GSB modulus');
  expectCheck(byId['bituminous-fatigue'], 128, 179, 'bituminous fatigue');
  expectCheck(byId['subgrade-rutting'], 196, 910, 'subgrade rutting');
  expectCheck(byId['cemented-fatigue'], 69.5, 65, 'CTB fatigue');
});

test('III.6 — WMM on a CTSB takes 350 MPa, 50 msa', () => {
  const { result, byId } = annexIII({
    combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'CTSB' },
    thicknesses: { BC: 40, DBM: 70, BASE: 150, SUB_BASE: 200 },
    designTrafficMsa: 50,
  });
  assert.equal(result.layers.find((l) => l.slotId === 'BASE').E, 350);
  expectCheck(byId['bituminous-fatigue'], 173, 56, 'bituminous fatigue');
  expectCheck(byId['subgrade-rutting'], 345, 70, 'subgrade rutting');
});

test('II.2 — construction traffic floor gives the 2433 microstrain limit', () => {
  const { byId } = annexIII({
    combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB' },
    thicknesses: { BC: 40, DBM: 105, BASE: 250, SUB_BASE: 200 },
    designTrafficMsa: 50,
  });
  within(byId['construction-traffic'].allowableMicro, 2433, 0.001, 'allowable strain');
});
