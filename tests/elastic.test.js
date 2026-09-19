import test from 'node:test';
import assert from 'node:assert/strict';

import { besselJ0, besselJ1, besselJ1Zeros } from '../src/lib/bessel.js';
import { analyze, contactRadius } from '../src/engine/elastic.js';

function close(actual, expected, tol, message) {
  const diff = Math.abs(actual - expected);
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(
    diff / scale < tol,
    `${message}: expected ${expected}, got ${actual} (rel. diff ${(diff / scale).toExponential(2)})`
  );
}

test('Bessel J0 matches reference values', () => {
  close(besselJ0(0), 1, 1e-8, 'J0(0)');
  close(besselJ0(1), 0.7651976865579666, 1e-8, 'J0(1)');
  close(besselJ0(5), -0.1775967713143383, 1e-7, 'J0(5)');
  close(besselJ0(10), -0.2459357644513483, 1e-7, 'J0(10)');
});

test('Bessel J1 matches reference values', () => {
  close(besselJ1(0), 0, 1e-8, 'J1(0)');
  close(besselJ1(1), 0.4400505857449335, 1e-8, 'J1(1)');
  close(besselJ1(5), -0.3275791375914652, 1e-7, 'J1(5)');
  close(besselJ1(10), 0.0434727461688615, 1e-7, 'J1(10)');
});

test('J1 zeros are located accurately', () => {
  // Accuracy here is bounded by the Bessel approximation itself (~1e-8),
  // which is far finer than the integration breakpoints need.
  const zeros = besselJ1Zeros(4);
  close(zeros[0], 3.8317059702075123, 1e-7, 'first zero');
  close(zeros[1], 7.015586669815619, 1e-7, 'second zero');
  close(zeros[2], 10.173468135062722, 1e-7, 'third zero');
  close(zeros[3], 13.323691936314223, 1e-7, 'fourth zero');
  for (const z of zeros) {
    assert.ok(Math.abs(besselJ1(z)) < 1e-8, `J1(${z}) should vanish`);
  }
});

/**
 * Boussinesq closed form for a uniformly loaded circular area on a homogeneous
 * elastic half-space, evaluated on the load axis. Tension positive.
 */
function boussinesqOnAxis(q, a, z, nu) {
  const root = Math.sqrt(a * a + z * z);
  const cube = Math.pow(a * a + z * z, 1.5);
  const sigmaZ = -q * (1 - (z * z * z) / cube);
  const sigmaR =
    -(q / 2) * (1 + 2 * nu - (2 * (1 + nu) * z) / root + (z * z * z) / cube);
  return { sigmaZ, sigmaR };
}

test('homogeneous structure reproduces Boussinesq stresses on the load axis', () => {
  const E = 100;
  const nu = 0.35;
  const q = 0.56;
  const wheelLoadN = 20000;
  const a = contactRadius(wheelLoadN, q);

  const depths = [50, 100, 200, 400, 800];
  const layers = [
    { h: 150, E, nu },
    { h: 250, E, nu },
    { h: 0, E, nu },
  ];

  const results = analyze({
    layers,
    load: { wheelLoadN, tyrePressureMPa: q },
    points: depths.map((z) => ({ x: 0, y: 0, z })),
  });

  results.forEach((r, i) => {
    const expected = boussinesqOnAxis(q, a, depths[i], nu);
    close(r.sigmaZZ, expected.sigmaZ, 2e-3, `sigma_z at z=${depths[i]}`);
    close(r.sigmaXX, expected.sigmaR, 5e-3, `sigma_r at z=${depths[i]}`);
    close(r.sigmaYY, expected.sigmaR, 5e-3, `sigma_theta at z=${depths[i]}`);
  });
});

test('homogeneous surface deflection matches 2qa(1-nu^2)/E', () => {
  const E = 100;
  const nu = 0.35;
  const q = 0.56;
  const wheelLoadN = 20000;
  const a = contactRadius(wheelLoadN, q);

  const [result] = analyze({
    layers: [
      { h: 300, E, nu },
      { h: 0, E, nu },
    ],
    load: { wheelLoadN, tyrePressureMPa: q },
    points: [{ x: 0, y: 0, z: 0 }],
    options: { maxSegments: 4000, tolerance: 1e-12 },
  });

  const expected = (2 * q * a * (1 - nu * nu)) / E;
  close(result.surfaceDeflectionMm, expected, 5e-3, 'centre deflection');
});

test('stiff surfacing reduces subgrade strain relative to an all-subgrade section', () => {
  const load = { wheelLoadN: 20000, tyrePressureMPa: 0.56, dualSpacingMm: 310 };
  const points = [{ x: 0, y: 0, z: 650 }];

  const weak = analyze({
    layers: [
      { h: 150, E: 50, nu: 0.35 },
      { h: 500, E: 50, nu: 0.35 },
      { h: 0, E: 50, nu: 0.35 },
    ],
    load,
    points,
  });

  const strong = analyze({
    layers: [
      { h: 150, E: 3000, nu: 0.35 },
      { h: 500, E: 300, nu: 0.35 },
      { h: 0, E: 50, nu: 0.35 },
    ],
    load,
    points,
  });

  assert.ok(
    strong[0].verticalCompressiveStrain < weak[0].verticalCompressiveStrain,
    'a stiff bound layer must shed vertical strain onto the subgrade'
  );
  assert.ok(
    strong[0].verticalCompressiveStrain > 0,
    'subgrade strain must be compressive'
  );
});

test('bottom of a stiff bituminous layer is in horizontal tension', () => {
  const [bottomOfBitumen] = analyze({
    layers: [
      { h: 150, E: 3000, nu: 0.35 },
      { h: 250, E: 350, nu: 0.35 },
      { h: 200, E: 150, nu: 0.35 },
      { h: 0, E: 50, nu: 0.35 },
    ],
    load: { wheelLoadN: 20000, tyrePressureMPa: 0.56, dualSpacingMm: 310 },
    points: [{ x: 0, y: 0, z: 150, layerIndex: 0, label: 'bottom of bitumen' }],
  });

  assert.ok(
    bottomOfBitumen.maxHorizontalStrain > 0,
    'expected tensile strain under the wheel at the underside of the bound layer'
  );
  // Sanity band for a section of this stiffness: tens to a few hundred microstrain.
  const microstrain = bottomOfBitumen.maxHorizontalStrain * 1e6;
  assert.ok(
    microstrain > 20 && microstrain < 600,
    `tensile strain ${microstrain.toFixed(1)} microstrain is outside a plausible range`
  );
});

test('dual wheels produce more subgrade strain than a single wheel', () => {
  const layers = [
    { h: 150, E: 3000, nu: 0.35 },
    { h: 250, E: 350, nu: 0.35 },
    { h: 200, E: 150, nu: 0.35 },
    { h: 0, E: 50, nu: 0.35 },
  ];
  const points = [{ x: 0, y: 0, z: 600 }];

  const single = analyze({
    layers,
    load: { wheelLoadN: 20000, tyrePressureMPa: 0.56 },
    points,
  });
  const dual = analyze({
    layers,
    load: { wheelLoadN: 20000, tyrePressureMPa: 0.56, dualSpacingMm: 310 },
    points,
  });

  assert.ok(
    dual[0].verticalCompressiveStrain > single[0].verticalCompressiveStrain,
    'the second wheel must add to the subgrade strain at depth'
  );
});
