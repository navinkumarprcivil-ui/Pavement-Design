/**
 * IRC:SP:72-2015 — design traffic, categories and the catalogues, checked
 * against the code's illustrative example (Appendix D). Only the example's
 * numbers appear here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sp72Traffic,
  categorise,
  subgradeClass,
  designSP72,
  harvestAADT,
  growthFactor,
  gravelToSubBase,
  appendixAEsal,
} from '../src/engine/ruralSP72.js';

const within = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) / expected < tolerance, `${what}: ${actual} vs ${expected}`);

test('10 years at 6%: the multiplier 365 x growth factor is 4811', () => {
  within(365 * growthFactor(6, 10), 4811, 0.0005, 'multiplier');
});

test('Appendix D — harvesting seasons give an AADT of 474 from a peak count of 761', () => {
  const aadt = harvestAADT(761, { countSeason: 'peak', rise: 1, seasonDays: 75, seasons: 2 });
  within(aadt, 474, 0.002, 'AADT');
  within(aadt * 1.06 ** 2, 532, 0.002, 'AADT at opening');
});

test('Appendix D — 6 HCV and 38 MCV, half laden, give 16.35 ESAL a day and 78,660 in 10 years', () => {
  const t = sp72Traffic({
    mode: 'counts',
    hcv: 6,
    mcv: 38,
    ladenPercent: 50,
    vdfMode: 'indicative',
    harvest: { enabled: false },
    yearsToOpening: 0,
    growthPercent: 6,
    designLifeYears: 10,
    laneId: 'single',
  });
  within(t.esalPerDay, 16.35, 0.001, 'ESAL per day');
  within(t.esal, 78660, 0.001, 'cumulative ESAL');
  assert.equal(categorise(t.esal).category.id, 'T3');
});

test('Appendix D — T3 on CBR 5 is a 275 mm gravel base, or 100 + 100 cement treated', () => {
  assert.equal(subgradeClass(5).id, 'S3');
  const gravel = designSP72({ esal: 78660, subgradeCBR: 5, baseType: 'granular', rainfall: 'under1000', surfaceGravelMm: 50, gravelCBR80Available: true, newRoad: true });
  assert.equal(gravel.gravelRoad, true);
  assert.equal(gravel.totalThicknessMm, 275);
  const cemented = designSP72({ esal: 78660, subgradeCBR: 5, baseType: 'cemented', rainfall: 'under1000', newRoad: true });
  assert.deepEqual(
    cemented.slots.filter((s) => s.thicknessMm > 0).map((s) => [s.materialId, s.thicknessMm]),
    [['CTB', 100], ['CTSB', 100]]
  );
});

test('Table 4 — 275 mm gravel base keeps 100 mm and takes 300 mm of CBR 25 sub-base', () => {
  assert.deepEqual(gravelToSubBase(275, 25), { baseMm: 100, subBaseMm: 300 });
  const d = designSP72({ esal: 78660, subgradeCBR: 5, baseType: 'granular', rainfall: 'under1000', gravelSubBaseCBR: 25, gravelCBR80Available: true, newRoad: true });
  assert.equal(d.totalThicknessMm, 400);
});

test('categories: the upper limit belongs to the lower category', () => {
  assert.equal(categorise(30000).category.id, 'T1');
  assert.equal(categorise(30001).category.id, 'T2');
  assert.equal(categorise(2000000).category.id, 'T9');
  assert.equal(categorise(2000001).withinScope, false);
});

test('rainfall over 1500 mm puts a surface treatment on a T2 gravel road', () => {
  const d = designSP72({ esal: 50000, subgradeCBR: 8, baseType: 'granular', rainfall: 'over1500', newRoad: true });
  assert.equal(d.blackTopped, true);
  assert.equal(d.slots[0].materialId, 'SD');
});

test('frost raises a black-topped section to 300 mm sub-base and 150 mm base', () => {
  const d = designSP72({ esal: 150000, subgradeCBR: 8, baseType: 'granular', rainfall: 'under1000', frost: true, newRoad: true });
  assert.ok(d.totalThicknessMm >= 450);
});

test('Appendix A — 100 CVPD reads 1,92,961 ESAL', () => {
  assert.equal(appendixAEsal(100).value, 192961);
});
