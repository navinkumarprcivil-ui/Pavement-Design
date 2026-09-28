import test from 'node:test';
import assert from 'node:assert/strict';

import {
  subgradeKFromCBR,
  foundationK,
  dayTemperatureDifferential,
  dowelBars,
  rigidTraffic,
  evaluateSlab,
  designSlab,
} from '../src/engine/rigidDesign.js';
import { parseSpectrum, runRigid, defaultRigidState } from '../src/ui/rigidProject.js';

const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('foundation k follows Tables 2 – 4 as Appendix-VII reads them', () => {
  close(subgradeKFromCBR(8).value, 50.3, 0.05, 'CBR 8%');
  close(foundationK({ subBase: 'dlc', subgradeCBR: 8, subBaseMm: 150 }).k, 285, 0.5, '150 mm DLC');
  close(foundationK({ subBase: 'granular', subgradeCBR: 8, subBaseMm: 250 }).k, 72, 1, '250 mm GSB');
  assert.equal(foundationK({ subBase: 'dlc', subgradeCBR: 20, subBaseMm: 150 }).k, 300, 'capped at 300');
  assert.ok(foundationK({ subBase: 'cementTreated', subgradeCBR: 50, subBaseMm: 150 }).warnings.length, 'outside Table 3');
});

test('temperature differential takes the next thicker column of Table 1', () => {
  const zone = { mode: 'zone', zone: 'III' };
  assert.equal(dayTemperatureDifferential(zone, 280), 16.8);
  assert.equal(dayTemperatureDifferential(zone, 200), 16.4);
  assert.equal(dayTemperatureDifferential(zone, 420), 16.8);
  assert.equal(dayTemperatureDifferential({ mode: 'site', dayC: 18 }, 280), 18);
});

test('dowel bars follow Table 5', () => {
  assert.deepEqual(dowelBars(290), { diameterMm: 38, lengthMm: 500, spacingMm: 300 });
  assert.deepEqual(dowelBars(250), { diameterMm: 32, lengthMm: 450, spacingMm: 300 });
  assert.equal(dowelBars(180), null);
});

const trafficInput = {
  twoWayCVPD: 6000,
  growthRatePercent: 7.5,
  yearsToCompletion: 0,
  designPeriodYears: 30,
  carriageway: 'divided',
  directionalSplitPercent: 50,
  nightSharePercent: 60,
  shortWheelBasePercent: 55,
  axlesPerVehicle: 2.35,
  axleMix: { single: 15, tandem: 25, tridem: 15 },
};

test('design lane repetitions follow Cl. 5.5.2.3', () => {
  const divided = rigidTraffic(trafficInput);
  close(divided.categories.bottomUp.single, 1995544, 1, 'bottom-up single');
  close(divided.categories.topDown.tandem, 2743873, 1, 'top-down tandem');
  const twoLane = rigidTraffic({ ...trafficInput, carriageway: 'two-lane' });
  close(twoLane.laneAxles, divided.laneAxles * 2, 1, 'two-lane takes 25% of both directions');
  const slow = rigidTraffic({ ...trafficInput, growthRatePercent: 3 });
  assert.equal(slow.growthRatePercent, 5, 'growth floor');
  assert.ok(rigidTraffic({ ...trafficInput, twoWayCVPD: 400 }).warnings.some((w) => w.includes('SP:62')));
});

// One heavy class per axle type, enough to drive the search.
const spectrum = {
  single: [{ loadKN: 190, percent: 100 }],
  tandem: [{ loadKN: 390, percent: 100 }],
  tridem: [{ loadKN: 545, percent: 100 }],
};
const slab = { shoulder: 'tied', doweled: true, flexural28MPa: 4.5, ninetyDay: true, E: 30000, mu: 0.15 };
const input = {
  kMPaPerM: 285,
  traffic: rigidTraffic(trafficInput),
  spectrum,
  slab,
  temperature: { mode: 'zone', zone: 'III' },
};

test('the designed slab is the thinnest with CFD at most 1', () => {
  const outcome = designSlab(input);
  assert.ok(outcome.found);
  assert.ok(outcome.trial.cfd <= 1);
  assert.ok(evaluateSlab({ ...input, thicknessMm: outcome.thicknessMm - 10 }).cfd > 1);
});

test('shoulders and dowels reduce the slab', () => {
  const tied = designSlab(input).thicknessMm;
  const bare = designSlab({ ...input, slab: { ...slab, shoulder: 'none', doweled: false } }).thicknessMm;
  assert.ok(bare > tied);
  const widened = designSlab({ ...input, slab: { ...slab, shoulder: 'widened' } }).thicknessMm;
  assert.equal(widened, tied);
});

test('pasted spectra read loads, ranges and shares', () => {
  assert.deepEqual(parseSpectrum('185-195\t18.15\n190 17.4\n\nnote'), [
    { loadKN: 190, percent: 18.15 },
    { loadKN: 190, percent: 17.4 },
  ]);
});

test('a design is refused until the spectrum is entered', () => {
  const rigid = defaultRigidState();
  const outcome = runRigid(rigid, 'design');
  assert.equal(outcome.ok, false);
  rigid.spectrum = structuredClone(spectrum);
  const designed = runRigid(rigid, 'design');
  assert.ok(designed.ok && designed.safe);
  assert.equal(designed.adoptedMm, designed.evaluation.thicknessMm + 10);
});
