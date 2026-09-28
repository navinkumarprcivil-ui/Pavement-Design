/**
 * Construction traffic, checked against the Annex-II examples of IRC:37-2018.
 * Only the examples' numeric inputs and results appear here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { dumperVDF, subBaseConstructionTraffic, allowableCtbStress, sevenDayFlexural } from '../src/engine/construction.js';
import { evaluateTrial, designSection } from '../src/engine/flexibleDesign.js';

const dumper = { rearTandemKN: 240, frontKN: 80 };

test('a dumper is about 12.41 standard axles', () => {
  assert.ok(Math.abs(dumperVDF(dumper) - 12.41) < 0.02, dumperVDF(dumper).toFixed(3));
});

test('the sub-base carries the dumper traffic or 10,000 axles, whichever is more', () => {
  const few = subBaseConstructionTraffic({ ...dumper, subBaseTrips: 200 });
  assert.ok(Math.abs(few.computed - 2483) < 5, few.computed.toFixed(0));
  assert.equal(few.repetitions, 10000);

  const many = subBaseConstructionTraffic({ ...dumper, subBaseTrips: 1000 });
  assert.ok(many.repetitions > 12000);
});

test('allowable CTB stress for 140 passes at 1.0 MPa is 0.795 MPa', () => {
  assert.ok(Math.abs(allowableCtbStress(140, 1.0) - 0.795) < 0.001);
  assert.ok(Math.abs(sevenDayFlexural(1.4) - 0.98) < 1e-9);
});

const construction = { ...dumper, subBaseTrips: 200, ctbTrips: 70, ctbSevenDayMPa: 1.0 };

const ctbInput = {
  combination: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
  thicknesses: { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 160, SUB_BASE: 250 },
  materials: { subgradeCBR: 7, binderGrade: 'VG40', pavementTemperatureC: 35, overrides: { SUBGRADE: 62 } },
  mix: { airVoidsPercent: 3.5, effectiveBinderPercent: 11.5 },
  designTrafficMsa: 50,
  construction,
};

test('CTB under the dumper: 0.767 MPa at 160 mm, as in the example', () => {
  const result = evaluateTrial(ctbInput);
  const check = result.checks.find((c) => c.id === 'ctb-construction');
  assert.ok(check, 'expected the CTB construction check');
  assert.ok(Math.abs(check.stress - 0.767) < 0.005, check.stress.toFixed(4));
  assert.equal(check.safe, true);
  assert.equal(check.inService, false);

  const thin = evaluateTrial({ ...ctbInput, thicknesses: { ...ctbInput.thicknesses, BASE: 150 } });
  assert.equal(thin.checks.find((c) => c.id === 'ctb-construction').safe, false);
  assert.equal(thin.safe, false);
});

test('the designed CTB carries its construction traffic', () => {
  const outcome = designSection(ctbInput);
  assert.ok(outcome.found, outcome.message);
  assert.ok(outcome.thicknesses.BASE >= 160, `CTB ${outcome.thicknesses.BASE}`);
  assert.ok(outcome.trial.checks.find((c) => c.id === 'ctb-construction').safe);
});

test('without construction inputs the CTB is not checked for it', () => {
  const { construction: _, ...plain } = ctbInput;
  const result = evaluateTrial(plain);
  assert.ok(!result.checks.some((c) => c.id === 'ctb-construction'));
});

test('heavy dumper traffic thickens the granular sub-base', () => {
  const granular = {
    ...ctbInput,
    combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB', crackReliefId: null },
    thicknesses: {},
    materials: { subgradeCBR: 5, binderGrade: 'VG40', pavementTemperatureC: 35 },
  };
  const light = designSection({ ...granular, construction: { ...construction, subBaseTrips: 200 } });
  const heavy = designSection({ ...granular, construction: { ...construction, subBaseTrips: 20000 } });
  assert.ok(light.found && heavy.found);
  assert.ok(heavy.thicknesses.SUB_BASE > light.thicknesses.SUB_BASE, `${heavy.thicknesses.SUB_BASE} vs ${light.thicknesses.SUB_BASE}`);
});
