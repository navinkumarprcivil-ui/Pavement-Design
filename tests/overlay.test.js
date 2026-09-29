/**
 * Overlays: IRC:81-1997 (Benkelman beam) and IRC:115-2014 (FWD), checked
 * against the charts as read and against the worked example of IRC:115
 * Appendix IV.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IRC81 } from '../src/data/overlay.js';
import { analyze, surfaceDeflections } from '../src/engine/elastic.js';
import {
  overlayTraffic,
  fig9Overlay,
  seasonalFactor,
  designBbd,
  percentileBelow,
  temperatureFactor,
  toMonsoon,
  designModuli,
  designFwdOverlay,
  backcalculate,
  backcalcRanges,
  fatigueLife,
  ruttingLife,
} from '../src/engine/overlay.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

test('fast surface deflections agree with the full layered solution and the half-space', () => {
  const radii = [0, 300, 600, 900, 1200, 1500, 1800];
  const cases = [
    [{ h: 170, E: 1214.1, nu: 0.5 }, { h: 575, E: 197.4, nu: 0.4 }, { h: 0, E: 70.8, nu: 0.4 }],
    [{ h: 40, E: 3000, nu: 0.35 }, { h: 250, E: 300, nu: 0.35 }, { h: 0, E: 30, nu: 0.35 }],
  ];
  for (const layers of cases) {
    const full = analyze({
      layers,
      load: { wheelLoadN: 40000, tyrePressureMPa: 40000 / (Math.PI * 150 * 150) },
      points: radii.map((x) => ({ x, y: 0, z: 0 })),
    }).map((p) => p.surfaceDeflectionMm);
    const fast = surfaceDeflections({ layers, plate: { loadN: 40000, radiusMm: 150 }, radii });
    fast.forEach((v, i) => near(v / full[i], 1, 1e-3, `r = ${radii[i]}`));
  }
  const [centre] = surfaceDeflections({ layers: [{ h: 0, E: 100, nu: 0.35 }], plate: { loadN: 40000, radiusMm: 150 }, radii: [0] });
  near(centre, (2 * (1 - 0.35 ** 2) * (40000 / (Math.PI * 150 ** 2)) * 150) / 100, 1e-9, 'half-space centre');
});

test('IRC:81 Fig. 9 as read: each curve rises with deflection and ends at 6 mm', () => {
  const tops = {};
  for (const [msa, pts] of Object.entries(IRC81.overlayChart.curves)) {
    assert.equal(pts[0][1], 0);
    assert.equal(pts[pts.length - 1][0], 6);
    for (let k = 1; k < pts.length; k++) assert.ok(pts[k][0] > pts[k - 1][0] && pts[k][1] > pts[k - 1][1], `${msa} msa at ${k}`);
    tops[msa] = pts[pts.length - 1][1];
  }
  // More traffic, more overlay, at any deflection.
  const order = ['0.1', '0.5', '1', '2', '5', '10', '20', '100'];
  for (let i = 1; i < order.length; i++) assert.ok(tops[order[i]] > tops[order[i - 1]]);
  // Where the 100 msa curve leaves the axis and where it ends.
  near(IRC81.overlayChart.curves['100'][0][0], 0.54, 0.02, '100 msa at no overlay');
  near(tops['100'], 325, 3, '100 msa at 6 mm');
  near(tops['0.1'], 146, 3, '0.1 msa at 6 mm');
});

test('Fig. 9 between curves, on the logarithm of traffic; beyond the chart is refused', () => {
  const at10 = fig9Overlay(3, 10);
  const at20 = fig9Overlay(3, 20);
  const between = fig9Overlay(3, Math.sqrt(10 * 20));
  near(between.overlayMm, (at10.overlayMm + at20.overlayMm) / 2, 1e-9, 'geometric middle');
  assert.equal(fig9Overlay(0.5, 100).overlayMm, 0);
  assert.equal(fig9Overlay(6.5, 10).ok, false);
  assert.equal(fig9Overlay(3, 150).ok, false);
  assert.ok(fig9Overlay(3, 0.05).clampedMsa);
});

test('IRC:81 seasonal factors, Figs. 2 - 7', () => {
  near(seasonalFactor('sandy', 'low', 4), 1.32, 0.01, 'Fig. 2 at 4%');
  near(seasonalFactor('clayHigh', 'high', 4), 2.09, 0.02, 'Fig. 7 at 4%');
  near(seasonalFactor('clayLow', 'low', 22), 1.03, 0.01, 'Fig. 4 at 22%');
  near(seasonalFactor('sandy', 'low', 4.25), (seasonalFactor('sandy', 'low', 4) + seasonalFactor('sandy', 'low', 4.5)) / 2, 1e-9, 'between steps');
  assert.equal(seasonalFactor('sandy', 'low', 12), null);
  assert.equal(seasonalFactor('sandy', 'low', 3), null);
  for (const chart of IRC81.seasonal.charts) {
    for (let k = 1; k < chart.factors.length; k++) assert.ok(chart.factors[k] <= chart.factors[k - 1] + 1e-9, `${chart.figure} falls`);
  }
});

test('IRC:81 characteristic deflection: corrections, mean + 2σ on a state highway', () => {
  const points = [0.9, 1.0, 1.1, 1.0, 0.95, 1.05, 1.0, 1.02, 0.98, 1.0].map((d, i) => ({
    deflectionMm: d,
    temperatureC: 40,
    moisturePercent: 10,
  }));
  const common = { points, bituminousMm: 50, soil: 'clayLow', rainfall: 'low', designMsa: 10 };
  const post = designBbd({ ...common, season: 'monsoon', roadCategory: 'sh' });
  const corrected = points.map((p) => p.deflectionMm - 0.05);
  const mean = corrected.reduce((s, v) => s + v, 0) / 10;
  const sd = Math.sqrt(corrected.reduce((s, v) => s + (v - mean) ** 2, 0) / 9);
  near(post.Dc, mean + 2 * sd, 1e-12, 'Dc on SH');
  const odr = designBbd({ ...common, season: 'monsoon', roadCategory: 'odr' });
  near(odr.Dc, mean + sd, 1e-12, 'Dc on other roads');
  const dry = designBbd({ ...common, season: 'dry', roadCategory: 'sh' });
  const f = seasonalFactor('clayLow', 'low', 10);
  near(dry.mean, mean * f, 1e-12, 'seasonal factor');
  // Thin surfacing: no temperature correction.
  const thin = designBbd({ ...common, bituminousMm: 20, season: 'monsoon', roadCategory: 'sh' });
  near(thin.mean, 1.0, 1e-12, 'no temperature correction');
  near(post.overlayBmMm, fig9Overlay(post.Dc, 10).overlayMm, 1e-12, 'Fig. 9');
  assert.equal(post.provided.dbmBcMm, Math.ceil((post.overlayBmMm * 0.7) / 5) * 5);
});

test('design traffic: IRC:115 Eq. 10 and IRC:81 Eq. 1 with their own lane factors', () => {
  const t = { mode: 'calculate', presentCVPD: 2000, growthRatePercent: 5, yearsToCompletion: 0, designLifeYears: 10, laneId: 'two-lane', vdfMode: 'indicative' };
  const fwd = overlayTraffic('fwd', t, { roadCategory: 'nh', terrain: 'plain' });
  const g = (Math.pow(1.05, 10) - 1) / 0.05;
  near(fwd.msa, (365 * g * 2000 * 0.5 * 4.5) / 1e6, 1e-9, 'IRC:115');
  const bbd = overlayTraffic('bbd', t, { roadCategory: 'nh', terrain: 'plain' });
  near(bbd.msa, (365 * g * 2000 * 0.75 * 4.5) / 1e6, 1e-9, 'IRC:81');
  // IRC:115: never under 5% growth.
  const low = overlayTraffic('fwd', { ...t, growthRatePercent: 3 }, { terrain: 'plain' });
  near(low.msa, fwd.msa, 1e-9, '5% floor');
  assert.ok(low.warnings.some((w) => w.includes('Cl. 7.2')));
});

/** IRC:115 Appendix IV: normalised bowls, pavement temperatures and the KGPBACK moduli. */
const RADII = [0, 300, 600, 900, 1200, 1500, 1800];
const BOWLS = [
  [0.481, 0.294, 0.216, 0.163, 0.134, 0.107, 0.08, 35],
  [0.478, 0.317, 0.231, 0.186, 0.156, 0.13, 0.106, 35],
  [0.481, 0.34, 0.242, 0.201, 0.17, 0.139, 0.105, 36],
  [0.5, 0.321, 0.233, 0.198, 0.151, 0.13, 0.093, 36],
  [0.477, 0.324, 0.24, 0.19, 0.159, 0.138, 0.109, 36],
  [0.485, 0.319, 0.23, 0.194, 0.152, 0.141, 0.101, 37],
  [0.473, 0.315, 0.229, 0.191, 0.149, 0.131, 0.097, 37],
  [0.46, 0.301, 0.223, 0.188, 0.151, 0.13, 0.093, 38],
  [0.48, 0.365, 0.251, 0.19, 0.17, 0.152, 0.108, 38],
  [0.487, 0.327, 0.245, 0.187, 0.161, 0.148, 0.102, 38],
];
const KGPBACK = [
  [1214.1, 197.4, 70.8],
  [1022.7, 254.8, 57.3],
  [1458.2, 214.6, 55.0],
  [1295.5, 195.4, 60.6],
  [1240.5, 245.1, 55.4],
  [991.9, 250.1, 57.2],
  [1040.3, 252.4, 60.6],
  [1313.0, 245.5, 60.1],
  [1669.4, 200.5, 53.7],
  [1247.1, 229.4, 56.1],
];
/** The corrected moduli the example prints. */
const CORRECTED = [
  [1214.1, 171.7, 59.7],
  [1022.7, 221.0, 46.4],
  [1524.7, 186.9, 44.1],
  [1354.5, 169.9, 49.7],
  [1297.0, 213.0, 44.5],
  [1085.2, 217.1, 46.3],
  [1138.2, 219.0, 49.7],
  [1504.4, 213.3, 49.2],
  [1912.8, 174.5, 42.7],
  [1428.9, 199.7, 45.2],
];

test('IRC:115 App. IV: moduli to 35 °C and the monsoon, and the 15th percentile', () => {
  const m = designModuli({
    moduli: KGPBACK.map(([b, g, s], i) => ({ bituminous: b, granular: g, subgrade: s, temperatureC: BOWLS[i][7] })),
    bituminousMm: 170,
    condition: 'good',
    coldArea: false,
    season: 'winter',
  });
  m.rows.forEach((r, i) => {
    near(r.bituminous35, CORRECTED[i][0], 0.3, `point ${i + 1} bituminous`);
    near(r.granularMonsoon, CORRECTED[i][1], 0.15, `point ${i + 1} granular`);
    near(r.subgradeMonsoon, CORRECTED[i][2], 0.15, `point ${i + 1} subgrade`);
  });
  near(m.design.bituminous, 1112, 0.5, 'design bituminous');
  near(m.design.granular, 173, 0.5, 'design granular');
  near(m.design.subgrade, 44.3, 0.05, 'design subgrade');
  near(percentileBelow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 15), 2.5, 1e-12, '0.15 n below');
  near(temperatureFactor(35), 1, 1e-12, 'λ at 35 °C');
  near(toMonsoon('summer', 100, 200).subgrade, 0.8554 * 100 - 8.461, 1e-12, 'Eq. 7');
});

test('IRC:115 App. IV: strains under the wheel centre, lives by Eqs. 16 and 17', () => {
  const under = (layers, z, index) =>
    analyze({
      layers,
      load: { wheelLoadN: 20000, tyrePressureMPa: 0.56, dualSpacingMm: 310 },
      points: [{ x: 0, y: 0, z, layerIndex: index }],
    })[0].epsYY * 1e6;
  const existing = [{ h: 170, E: 1112, nu: 0.5 }, { h: 575, E: 173, nu: 0.4 }, { h: 0, E: 44.3, nu: 0.4 }];
  near(under(existing, 170, 0), 284.5, 1.5, 'existing, printed 284.5');
  near(under([{ h: 95, E: 1695, nu: 0.5 }, ...existing], 265, 1), 159.8, 1.5, 'with 95 mm, printed 159.8');
  // The lives the example prints from its strains.
  near(fatigueLife(284.5e-6, 1112) / 1e6, 11.07, 0.05, 'fatigue, existing');
  near(fatigueLife(159.8e-6, 1112) / 1e6, 104.4, 0.5, 'fatigue with the overlay');
  near(ruttingLife(208.3e-6) / 1e6, 690.5, 3, 'rutting with the overlay');
});

test('IRC:115 App. IV design: the larger strain of under and between the wheels governs', () => {
  const input = {
    moduli: { bituminous: 1112, granular: 173, subgrade: 44.3 },
    bituminousMm: 170,
    granularMm: 575,
    nu: { bituminous: 0.5, granular: 0.4, subgrade: 0.4 },
    overlayModulusMPa: 1695,
    designMsa: 100,
  };
  const d = designFwdOverlay(input);
  assert.ok(d.ok && d.needed);
  assert.ok(d.existing.fatigueMsa < 100);
  assert.equal(d.overlayMm, 110);
  assert.ok(d.withOverlay.safe);
  const trial = designFwdOverlay({ ...input, trialMm: 95 });
  assert.equal(trial.withOverlay.safe, false);
  // Strains read from IITPAVE govern once entered.
  const iitpave = designFwdOverlay({ ...input, trialMm: 95, measured: { overlaid: { tensile: 159.8, vertical: 208.3 } } });
  assert.ok(iitpave.withOverlay.fromIitpave && iitpave.withOverlay.safe);
});

test('back-calculation recovers known moduli and fits App. IV as well as KGPBACK', () => {
  const plate = { loadN: 40000, radiusMm: 150 };
  const nu = [0.5, 0.4, 0.4];
  const truth = [1500, 250, 60];
  const measured = surfaceDeflections({
    layers: [{ h: 150, E: truth[0], nu: 0.5 }, { h: 450, E: truth[1], nu: 0.4 }, { h: 0, E: truth[2], nu: 0.4 }],
    plate,
    radii: RADII,
  });
  const ranges = backcalcRanges({ radii: RADII, normalised: measured, loadN: 40000, nu: 0.4, condition: 'good' });
  const fit = backcalculate({ radii: RADII, measured, thicknesses: [150, 450], nu, plate, ranges });
  fit.E.forEach((E, i) => near(E / truth[i], 1, 0.01, `modulus ${i + 1}`));

  const first = BOWLS[0].slice(0, 7);
  const r1 = backcalcRanges({ radii: RADII, normalised: first, loadN: 40000, nu: 0.4, condition: 'good' });
  const app = backcalculate({ radii: RADII, measured: first, thicknesses: [170, 575], nu, plate, ranges: r1 });
  const fixed = (E) => ({ bituminous: [E[0], E[0]], granular: [E[1], E[1]], subgrade: [E[2], E[2]] });
  const kgp = backcalculate({ radii: RADII, measured: first, thicknesses: [170, 575], nu, plate, ranges: fixed(KGPBACK[0]) });
  assert.ok(app.objective <= kgp.objective + 1e-9);
  near(app.E[2], 70.8, 1.5, 'subgrade of point 1');
});
