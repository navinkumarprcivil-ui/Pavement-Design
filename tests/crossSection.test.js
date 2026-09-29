/**
 * The cross-section and the bill of quantities measured off it: layer widths
 * (IRC:37 Cl. 7.2.1, IRC:58 Cl. 6.5.2), the debonding sheet (IRC:58 Cl. 5.7.5),
 * the widened lane (Cl. 6.6.1), SP:72 shoulders (Cl. 9.2) and SP:62 joints.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossSection } from '../src/engine/crossSection.js';
import { billOfQuantities, barTonnes } from '../src/engine/quantities.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

const flexibleSlots = [
  { slotId: 'BC', materialId: 'BC', label: 'BC', thicknessMm: 40, behaviour: 'bituminous' },
  { slotId: 'DBM', materialId: 'DBM', label: 'DBM', thicknessMm: 100, behaviour: 'bituminous' },
  { slotId: 'BASE', materialId: 'WMM', label: 'WMM', thicknessMm: 250, behaviour: 'granular' },
  { slotId: 'SUB_BASE', materialId: 'GSB', label: 'GSB', thicknessMm: 200, behaviour: 'granular' },
  { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
];

test('flexible: the GSB runs to the formation, the rest under the paved width', () => {
  const model = crossSection({ type: 'flexible', slots: flexibleSlots, geometry: { carriagewayWidthM: 7, pavedShoulderM: 1.5, earthenShoulderM: 2 } });
  assert.equal(model.pavedM, 10);
  assert.equal(model.formationM, 14);
  assert.deepEqual(model.layers.map((l) => l.widthM), [10, 10, 10, 14]);
  assert.equal(model.layers[3].ref.clause, 'Cl. 7.2.1');

  const bill = billOfQuantities(model, { BC: 10000, 'Prime coat': 50 }, 1);
  const bc = bill.items.find((i) => i.key === 'BC');
  near(bc.quantity, 0.04 * 10 * 1000, 1e-9, 'BC m³');
  near(bc.amount, 400 * 10000, 1e-6, 'BC amount');
  near(bill.items.find((i) => i.key === 'GSB').quantity, 0.2 * 14 * 1000, 1e-9, 'GSB to the formation');
  near(bill.items.find((i) => i.key === 'Prime coat').quantity, 10000, 1e-9, 'prime coat on the WMM');
  near(bill.items.find((i) => i.key === 'Tack coat').quantity, 10000, 1e-9, 'one tack coat between BC and DBM');
  assert.equal(bill.anyRateMissing, true);
  near(bill.costPerKm, 400 * 10000 + 10000 * 50, 1e-6, 'per km');
});

test('flexible without earthen shoulders keeps every layer to the paved width', () => {
  const model = crossSection({ type: 'flexible', slots: flexibleSlots, geometry: { carriagewayWidthM: 7 } });
  assert.ok(model.layers.every((l) => l.widthM === 7));
});

const rigidSlots = [
  { slotId: 'PQC', materialId: 'PQC', label: 'PQC', thicknessMm: 300, behaviour: 'concrete' },
  { slotId: 'SUB_BASE', materialId: 'DLC', label: 'DLC', thicknessMm: 150, behaviour: 'cemented' },
  { slotId: 'DRAIN', materialId: 'Drainage layer', label: 'Drainage layer', thicknessMm: 150, behaviour: 'granular' },
  { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
];

const rigidInput = (over = {}) => ({
  shoulder: 'tied',
  widenedM: 0.6,
  laneWidthM: 3.5,
  jointSpacingM: 4.5,
  drainage: true,
  separation: true,
  dowels: { diameterMm: 38, lengthMm: 500, spacingMm: 300 },
  tieBars: { diameterMm: 12, lengthMm: 640, spacingMm: 540 },
  ...over,
});

test('rigid: tied shoulders, joints, the debonding sheet and the drainage layer', () => {
  const model = crossSection({
    type: 'rigid',
    slots: rigidSlots,
    geometry: { carriagewayWidthM: 7, pavedShoulderM: 1.5, earthenShoulderM: 1 },
    rigid: rigidInput(),
  });
  assert.equal(model.pavedM, 10);
  assert.equal(model.formationM, 12);
  assert.deepEqual(model.joints.map((j) => j.x), [1.5, 5, 8.5]);
  assert.equal(model.membrane.ref.clause, 'Cl. 5.7.5');
  assert.equal(model.layers.find((l) => l.slotId === 'DRAIN').widthM, 12);
  assert.equal(model.layers.find((l) => l.slotId === 'SUB_BASE').widthM, 10);

  const bill = billOfQuantities(model, {}, 1);
  const get = (key) => bill.items.find((i) => i.key === key);
  near(get('Separation membrane').quantity, 10000, 1e-9, 'membrane m²');
  // 222 joints of 23 dowels over the 7 m slab.
  near(get('Dowel bars').quantity, barTonnes(222 * 23, 38, 500), 1e-12, 'dowels');
  near(barTonnes(1, 38, 500), 0.004452, 1e-6, 'one 38 × 500 dowel');
  near(get('Tie bars').quantity, barTonnes(3 * 1851, 12, 640), 1e-12, 'tie bars');
  near(get('Joint sealing').quantity, 222 * 10 + 3 * 1000, 1e-9, 'joints');
  assert.equal(get('Prime coat'), undefined);
});

test('rigid: a widened lane adds its width; no sheet on a bonded or granular base', () => {
  const model = crossSection({
    type: 'rigid',
    slots: rigidSlots,
    geometry: { carriagewayWidthM: 7, pavedShoulderM: 1.5 },
    rigid: rigidInput({ shoulder: 'widened', separation: false }),
  });
  assert.equal(model.shoulderM, 0);
  assert.equal(model.pavedM, 8.2);
  assert.equal(model.widenedRef.clause, 'Cl. 6.6.1');
  assert.equal(model.membrane, null);
  assert.deepEqual(model.joints.map((j) => j.x), [4.1]);
  // No drainage layer designed: the GSB stays under the paved width.
  const dry = crossSection({ type: 'rigid', slots: rigidSlots, geometry: { carriagewayWidthM: 7, earthenShoulderM: 1 }, rigid: rigidInput({ drainage: false }) });
  assert.ok(dry.layers.every((l) => l.widthM === dry.pavedM));
  assert.equal(dry.notes.length, 0);
});

test('SP:72: 100 mm shoulders of sub-base material over the earthen shoulders', () => {
  const slots = [
    { slotId: 'L0', materialId: 'SD', label: 'Surface dressing', thicknessMm: 20, behaviour: 'bituminous' },
    { slotId: 'L1', materialId: 'WBM', label: 'WBM', thicknessMm: 150, behaviour: 'granular' },
    { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
  ];
  const model = crossSection({ type: 'rural', slots, geometry: { carriagewayWidthM: 3.75, earthenShoulderM: 1.25 } });
  assert.equal(model.shoulderLayer.thicknessMm, 100);
  assert.equal(model.shoulderLayer.ref.clause, 'Cl. 9.2');
  const bill = billOfQuantities(model, {}, 1);
  near(bill.items.find((i) => i.key === 'Shoulder').quantity, 0.1 * 2.5 * 1000, 1e-9, 'shoulder m³');
  near(bill.items.find((i) => i.key === 'Prime coat').quantity, 3750, 1e-9, 'prime coat');
});

test('SP:62: a mid-width joint only on a slab wider than 4.5 m', () => {
  const slots = [
    { slotId: 'PQC', materialId: 'PQC', label: 'PQC', thicknessMm: 200, behaviour: 'concrete' },
    { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
  ];
  const narrow = crossSection({ type: 'ruralRigid', slots, geometry: { carriagewayWidthM: 3.75 }, lvRigid: { jointSpacingM: 3.75 } });
  assert.equal(narrow.joints.length, 0);
  const wide = crossSection({ type: 'ruralRigid', slots, geometry: { carriagewayWidthM: 5.5 }, lvRigid: { jointSpacingM: 3.75 } });
  assert.deepEqual(wide.joints.map((j) => j.x), [2.75]);
  const bill = billOfQuantities(wide, {}, 1);
  near(bill.items.find((i) => i.key === 'Joint sealing').quantity, 266 * 5.5 + 1000, 1e-9, 'joints');
  assert.equal(bill.items.find((i) => i.key === 'Tie bars'), undefined);
});
