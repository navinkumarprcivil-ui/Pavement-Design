/**
 * IRC:37-2018 limits and choices beyond the performance equations: the
 * binders and mixes of Table 9.1, BM and low strength CTSB moduli, the
 * effective subgrade over a stronger foundation, long-life and frost.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSubgrade, buildLayerStack, bottomMixModulus, subgradeModulus } from '../src/engine/materials.js';
import { ctbReliabilityFactor } from '../src/engine/criteria.js';
import { evaluateTrial, designSection } from '../src/engine/flexibleDesign.js';
import {
  BITUMINOUS_OPTIONS,
  bituminousAllowed,
  bindersAllowed,
  describeCombination,
  findOption,
} from '../src/data/layerCatalog.js';

const option = (id) => findOption(BITUMINOUS_OPTIONS, id);

test('Cl. 6.4.1: a borrow over a stronger foundation keeps its own CBR', () => {
  const e = effectiveSubgrade({ borrowCBR: 8, embankmentCBR: 50 });
  assert.equal(e.borrowGoverns, true);
  assert.ok(Math.abs(e.value - subgradeModulus(8)) < 1e-9, `${e.value}`);
  assert.equal(effectiveSubgrade({ borrowCBR: 20, embankmentCBR: 8 }).borrowGoverns, false);
});

test('Cl. 3.6.3.1 / 12.3: RF is 1 from exactly 10 msa', () => {
  assert.equal(ctbReliabilityFactor(9.99, 'mdr'), 2);
  assert.equal(ctbReliabilityFactor(10, 'mdr'), 1);
  assert.equal(ctbReliabilityFactor(5, 'nh'), 1);
});

test('Table 9.1: SDBC and BM only below 20 msa and off national highways', () => {
  assert.equal(bituminousAllowed(option('SDBC_DBM'), 10, 'mdr'), true);
  assert.equal(bituminousAllowed(option('SDBC_DBM'), 10, 'nh'), false);
  assert.equal(bituminousAllowed(option('SDBC_DBM'), 25, 'sh'), false);
  assert.equal(bituminousAllowed(option('BC_BM'), 15, 'sh'), true);
  assert.equal(bituminousAllowed(option('BC_BM'), 20, 'sh'), false);
  assert.equal(bituminousAllowed(option('BC_DBM'), 400, 'expressway'), true);
});

test('Table 9.1: VG40 for the DBM from 20 msa and on national highways; VG10 only where snow bound', () => {
  assert.deepEqual(bindersAllowed('DBM', 10, 'nh', false), ['VG40']);
  assert.deepEqual(bindersAllowed('DBM', 25, 'mdr', false), ['VG40']);
  assert.deepEqual(bindersAllowed('DBM', 10, 'mdr', false), ['VG40', 'VG30']);
  assert.deepEqual(bindersAllowed('DBM', 10, 'mdr', true), ['VG40', 'VG30', 'VG10']);
  assert.deepEqual(bindersAllowed('BM', 10, 'mdr', false), ['VG30']);
});

test('Table 9.2: BM at 500 / 700 MPa sets the whole bituminous layer', () => {
  assert.equal(bottomMixModulus('BM', 'VG30', 25), 700);
  assert.equal(bottomMixModulus('BM', 'VG10', 35), 500);
  const { slots } = describeCombination({ bituminousId: 'BC_BM', baseId: 'WMM', subBaseId: 'GSB' });
  const stack = buildLayerStack(
    slots.map((s) => ({ ...s, thicknessMm: s.defaultMm ?? 0 })),
    { subgradeCBR: 8, binderGrade: 'VG30', pavementTemperatureC: 35 }
  );
  assert.deepEqual(stack.layers.filter((l) => l.behaviour === 'bituminous').map((l) => l.E), [700, 700]);
});

test('Cl. 7.3.2 and 8.1: a CTSB of 0.75 - 1.5 MPa at 400 MPa, natural gravel over a CTSB at 300 MPa', () => {
  const { slots } = describeCombination({ bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'CTSB' });
  const sized = slots.map((s) => ({ ...s, thicknessMm: s.defaultMm ?? 0 }));
  const stack = buildLayerStack(sized, { subgradeCBR: 8, binderGrade: 'VG30', pavementTemperatureC: 35, ctsbStrength: 'low', granularOverCtsb: 'gravel' });
  assert.equal(stack.layers.find((l) => l.slotId === 'SUB_BASE').E, 400);
  assert.equal(stack.layers.find((l) => l.slotId === 'BASE').E, 300);
});

const annexIII1 = {
  combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB' },
  thicknesses: { BC: 40, DBM: 105, BASE: 250, SUB_BASE: 200 },
  materials: { subgradeCBR: 10, binderGrade: 'VG40', pavementTemperatureC: 35 },
  mix: { airVoidsPercent: 3.5, effectiveBinderPercent: 11.5 },
  designTrafficMsa: 50,
  roadCategory: 'nh',
};

test('Cl. 10: long-life holds the strains to 80 and 200 µε in the plains', () => {
  const plain = evaluateTrial(annexIII1);
  assert.ok(!plain.checks.some((c) => c.kind === 'endurance'));
  const long = evaluateTrial({ ...annexIII1, longLife: true });
  const bit = long.checks.find((c) => c.id === 'long-life-bituminous');
  const sub = long.checks.find((c) => c.id === 'long-life-subgrade');
  assert.equal(bit.allowableMicro, 80);
  assert.equal(sub.allowableMicro, 200);
  // Annex-III.1 carries about 175 and 278 µε: far from long-life.
  assert.equal(bit.safe, false);
  assert.equal(sub.safe, false);
  assert.equal(long.safe, false);
  const snow = evaluateTrial({ ...annexIII1, longLife: true, materials: { ...annexIII1.materials, snowBound: true } });
  assert.equal(snow.checks.find((c) => c.id === 'long-life-bituminous').allowableMicro, 70);
});

test('Cl. 13.2: where frost acts the design makes the section up to 450 mm', () => {
  const input = {
    ...annexIII1,
    thicknesses: { BC: 40, DBM: 50, BASE: 150, SUB_BASE: 150 },
    materials: { ...annexIII1.materials, subgradeCBR: 15, snowBound: true },
    designTrafficMsa: 3,
    roadCategory: 'mdr',
  };
  const found = designSection(input);
  assert.ok(found.found);
  const total = Object.values(found.thicknesses).reduce((sum, mm) => sum + mm, 0);
  assert.ok(total >= 450, `${total}`);
  assert.equal(found.trial.thicknessWarnings.some((w) => w.includes('Cl. 13.2')), false);
  const thin = evaluateTrial({ ...input, thicknesses: { BC: 40, DBM: 50, BASE: 150, SUB_BASE: 150 } });
  assert.ok(thin.thicknessWarnings.some((w) => w.includes('Cl. 13.2')));
});

test('Cl. 6.4.1 (i): the 500 mm subgrade in two sub-layers over the embankment', () => {
  const one = effectiveSubgrade({ borrowCBR: 20, embankmentCBR: 8, borrowMm: 500 });
  const two = effectiveSubgrade({ borrowCBR: 20, lowerCBR: 10, lowerMm: 250, borrowMm: 250, embankmentCBR: 8 });
  assert.equal(two.twoSubLayers, true);
  assert.ok(two.deflection > one.deflection, 'a weaker lower half deflects more');
  assert.ok(two.equivalent < one.equivalent);
  const same = effectiveSubgrade({ borrowCBR: 20, lowerCBR: 20, lowerMm: 250, borrowMm: 250, embankmentCBR: 8 });
  assert.ok(Math.abs(same.computed - one.computed) < 1e-6, 'two equal halves are one layer');
});
