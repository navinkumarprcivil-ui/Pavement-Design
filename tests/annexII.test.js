/**
 * Validation against the worked examples in Annex-II of IRC:37-2018.
 *
 * The strains and deflections quoted in those examples were produced by
 * IITPAVE. Reproducing them with this app's own layered-elastic solver is the
 * strongest check available that the analysis engine agrees with the software
 * the code is written around.
 *
 * Only the numeric inputs and results of the examples appear here, as the
 * fixture any test needs. No code text is reproduced.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, contactRadius } from '../src/engine/elastic.js';

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
