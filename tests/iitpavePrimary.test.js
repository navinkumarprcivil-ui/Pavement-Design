/**
 * IITPAVE's values decide the flexible design; the app's own analysis stands in
 * only for values not yet entered, and the verdict is provisional until then.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flexibleResult } from '../src/ui/flexibleProject.js';
import { iitpaveMissing, sectionKey } from '../src/ui/iitpave.js';
import { defaultCtbState, defaultConstructionState } from '../src/ui/ctbProject.js';
import { defaultLayeredSubgrade, defaultNarratives } from '../src/ui/flexibleProject.js';

const state = () => ({
  project: { roadCategory: 'nh', terrain: 'plain' },
  traffic: { mode: 'direct', designMsa: 50, completionCVPD: 2000, designLifeYears: 20, vdfMode: 'indicative', laneDistributionId: 'dual-two-lane' },
  combination: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB', crackReliefId: null },
  thicknesses: { BC: 40, DBM: 105, BASE: 250, SUB_BASE: 200 },
  materials: { subgradeCBR: 10, binderGrade: 'VG40', pavementTemperatureC: 35, bituminousModulusMPa: null, layeredSubgrade: defaultLayeredSubgrade() },
  mix: { airVoidsPercent: 3.5, effectiveBinderPercent: 11.5 },
  ctb: defaultCtbState(),
  construction: defaultConstructionState(),
  reliabilityChoice: null,
  narratives: defaultNarratives(),
  iitpave: { key: '', values: {}, stresses: {} },
});

test('without IITPAVE values every check rests on the app and the verdict is provisional', () => {
  const s = state();
  const r = flexibleResult(s);
  assert.ok(r.checks.every((c) => c.source !== 'IITPAVE'));
  const missing = iitpaveMissing(r, s);
  assert.ok(missing.includes('εt, bottom of bituminous layer'));
  assert.ok(missing.includes('εv, top of subgrade'));
});

test('IITPAVE values replace the app strains, and the app keeps its own as a check', () => {
  const s = state();
  const first = flexibleResult(s);
  s.iitpave = { key: sectionKey(first), values: { bituminous: 160, subgrade: 250, construction: 1500 }, stresses: {} };
  const r = flexibleResult(s);
  const fatigue = r.checks.find((c) => c.id === 'bituminous-fatigue');
  const rutting = r.checks.find((c) => c.id === 'subgrade-rutting');
  assert.equal(fatigue.source, 'IITPAVE');
  assert.ok(Math.abs(fatigue.strainMicro - 160) < 1e-9);
  assert.ok(Math.abs(rutting.strainMicro - 250) < 1e-9);
  assert.ok(fatigue.computed > 0 && Math.abs(fatigue.computed * 1e6 - 160) > 1, 'app value kept beside it');
  assert.deepEqual(iitpaveMissing(r, s), []);
});

test('values entered for another section are not used', () => {
  const s = state();
  s.iitpave = { key: 'another', values: { bituminous: 160, subgrade: 250 }, stresses: {} };
  const r = flexibleResult(s);
  assert.ok(r.checks.every((c) => c.source !== 'IITPAVE'));
});
