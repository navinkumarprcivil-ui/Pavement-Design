import test from 'node:test';
import assert from 'node:assert/strict';

import {
  radiusOfRelativeStiffness,
  designFlexuralStrength,
  nightTemperatureDifferential,
  bottomUpStress,
  topDownStress,
  allowableRepetitions,
  designRepetitions,
  categoryDamage,
} from '../src/engine/rigidFatigue.js';

// IRC:58-2015 Appendix-VII, option i: tied concrete shoulders, doweled joints.
const slab = { thicknessM: 0.28, kMPaPerM: 285 };
const day = 16.8;
const night = nightTemperatureDifferential(day);
const flexural = designFlexuralStrength(4.5);

const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('design inputs follow the appendix', () => {
  close(flexural, 4.95, 1e-9, '90-day flexural strength');
  close(night, 13.4, 1e-9, 'night-time differential');
  // The option ii value is printed as 0.75358 m. Option i is printed as
  // 0.78758 m, but the formula gives 0.666 m, which is what reproduces its stresses.
  close(radiusOfRelativeStiffness({ thicknessM: 0.33, kMPaPerM: 285 }), 0.75358, 5e-5, 'l at 330 mm');
  close(radiusOfRelativeStiffness(slab), 0.6662, 5e-4, 'l at 280 mm');
});

test('design repetitions follow the appendix', () => {
  const reps = designRepetitions({
    twoWayCVPD: 6000,
    growthRatePercent: 7.5,
    designPeriodYears: 30,
    axlesPerVehicle: 2.35,
    directionalSplit: 0.5,
    nightShare: 0.6,
    shortWheelBaseShare: 0.55,
  });
  close(reps.vehicles, 226444692, 1, 'commercial vehicles');
  close(reps.laneAxles, 66518128, 1, 'design lane axles');
  close(reps.bottomUp, 13303626, 1, 'bottom-up repetitions');
  close(reps.topDown, 10975491, 1, 'top-down repetitions');
});

test('bottom-up stresses reproduce Table VII.2', () => {
  const at = (axle, loadKN) => bottomUpStress({ ...slab, axle, tiedShoulder: true, loadKN, deltaTC: day });
  close(at('single', 190), 2.503, 0.0015, '190 kN single');
  close(at('single', 80), 1.614, 0.0015, '80 kN single');
  close(at('tandem', 390), 2.118, 0.0015, '390 kN tandem');
});

test('top-down stresses reproduce Table VII.3', () => {
  const at = (axle, loadKN) => topDownStress({ ...slab, axle, doweled: true, loadKN, deltaTC: night });
  close(at('single', 190), 2.399, 0.0015, '190 kN single');
  close(at('tandem', 390), 2.427, 0.0015, '390 kN tandem');
  close(at('tridem', 545), 2.353, 0.0015, '545 kN tridem');
});

test('fatigue follows the stress ratio', () => {
  assert.equal(allowableRepetitions(0.44), Infinity);
  close(allowableRepetitions(2.503 / 4.95) / 588331, 1, 0.01, 'SR 0.506');
  close(allowableRepetitions(2.399 / 4.95) / 1768731, 1, 0.01, 'SR 0.485');
  assert.ok(allowableRepetitions(0.6) < allowableRepetitions(0.55));
});

test('damage of one load class reproduces Table VII.2', () => {
  // Heaviest rear single axle class: 18.15% of 1,995,544 rear single axles.
  const { rows, damage } = categoryDamage(
    1995544,
    [{ loadKN: 190, percent: 18.15 }],
    (P) => bottomUpStress({ ...slab, axle: 'single', tiedShoulder: true, loadKN: P, deltaTC: day }),
    flexural
  );
  close(rows[0].expected, 362191, 1, 'expected repetitions');
  close(damage, 0.616, 0.003, 'fatigue damage');
});

test('untied, undoweled slabs use their own equations', () => {
  const opt = { thicknessM: 0.33, kMPaPerM: 285 };
  const untied = bottomUpStress({ ...opt, axle: 'single', tiedShoulder: false, loadKN: 190, deltaTC: day });
  const tied = bottomUpStress({ ...opt, axle: 'single', tiedShoulder: true, loadKN: 190, deltaTC: day });
  assert.ok(untied > tied);
  const undoweled = topDownStress({ ...opt, axle: 'single', doweled: false, loadKN: 190, deltaTC: night });
  const doweled = topDownStress({ ...opt, axle: 'single', doweled: true, loadKN: 190, deltaTC: night });
  assert.ok(undoweled > doweled);
});
