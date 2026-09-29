/**
 * IRC:37-2018 Cl. 4.3.2 and Annex-II, II.7: stage construction. The
 * bituminous layers of stage 1 are designed for 1.67 times the stage-1
 * traffic; cement treated layers are not allowed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designTraffic, trafficMissing } from '../src/ui/project.js';
import { enforceCodeChoices, longLifeApplies } from '../src/ui/flexibleProject.js';

// Annex-II, II.3: 5000 CVPD two-way at completion, 6%, 20 years, VDF 5.2,
// four lane divided (D = 0.75, half each way): 131 msa, 46.9 msa in ten years.
const annex = () => ({
  project: { roadCategory: 'nh', terrain: 'plain' },
  traffic: {
    mode: 'calculate',
    presentCVPD: 5000,
    growthRatePercent: 6,
    yearsToCompletion: 0,
    designLifeYears: 20,
    laneDistributionId: 'dual-two-lane',
    directionalSplitPercent: 50,
    vdfMode: 'survey',
    vehicleDamageFactor: 5.2,
    stage: { enabled: true, stage1Years: 10, stage1Msa: null },
  },
  combination: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
  thicknesses: { BC: 40, DBM: 100, BASE: 150, CRACK_RELIEF: 100, SUB_BASE: 200 },
  materials: { binderGrade: 'VG40', snowBound: false, ctsbStrength: 'standard' },
});

test('Annex-II, II.7: 46.9 msa in ten years, the bituminous layers for 78 msa', () => {
  const t = designTraffic(annex());
  assert.ok(Math.abs(t.result.msa - 131) < 0.5, `N ${t.result.msa}`);
  assert.ok(Math.abs(t.stage.stage1Msa - 46.9) < 0.05, `N1 ${t.stage.stage1Msa}`);
  assert.ok(Math.abs(t.stage.designMsa - 78) < 0.5, `N1' ${t.stage.designMsa}`);
  assert.equal(t.stage.fullMsa, t.result.msa);
  assert.ok(t.result.steps.some((s) => s.id === 'stage-1-design'));
  // Reliability and the route stay with the full design traffic.
  assert.equal(t.route, 'flexible');
  assert.equal(t.reliability, 90);
});

test('Cl. 4.3.2: the stage-1 traffic never exceeds the full design traffic', () => {
  const state = annex();
  state.traffic.stage.stage1Years = 18;
  const t = designTraffic(state);
  assert.equal(t.stage.designMsa, t.result.msa);
});

test('Cl. 4.3.2: the stage-1 period must be given and shorter than the design period', () => {
  const state = annex();
  state.traffic.stage.stage1Years = null;
  assert.equal(designTraffic(state).stage, null);
  assert.match(trafficMissing(state), /stage-1 period/);
  state.traffic.stage.stage1Years = 20;
  assert.match(trafficMissing(state), /shorter/);
  state.traffic.stage.stage1Years = 10;
  assert.equal(trafficMissing(state), null);
});

test('Stage-1 traffic entered directly', () => {
  const state = annex();
  state.traffic.mode = 'direct';
  state.traffic.designMsa = 131;
  state.traffic.completionCVPD = 5000;
  state.traffic.stage.stage1Msa = 46.9;
  const t = designTraffic(state);
  assert.ok(Math.abs(t.stage.designMsa - 46.9 * 1.67) < 1e-9);
  state.traffic.stage.stage1Msa = 140;
  assert.match(trafficMissing(state), /less than/);
});

test('Cl. 4.3.2: no cement treated base or sub-base, and no long-life, when built in stages', () => {
  const state = annex();
  assert.equal(enforceCodeChoices(state, 131), true);
  assert.equal(state.combination.baseId, 'WMM');
  assert.equal(state.combination.subBaseId, 'GSB');
  assert.equal(state.thicknesses.BASE, undefined);
  assert.equal(state.thicknesses.SUB_BASE, undefined);
  assert.equal(state.thicknesses.BC, 40);
  assert.equal(longLifeApplies({ ...state, project: { roadCategory: 'expressway' } }, 400), false);
  state.traffic.stage.enabled = false;
  assert.equal(longLifeApplies({ ...state, project: { roadCategory: 'expressway' } }, 400), true);
});

test('Survey VDF chosen but not entered holds the design', () => {
  const state = annex();
  state.traffic.stage.enabled = false;
  state.traffic.vehicleDamageFactor = null;
  assert.match(trafficMissing(state), /VDF/);
  state.traffic.vdfMode = 'axles';
  state.traffic.axleSurvey = { vehicles: 100, singleDual: [{ loadKN: 100, count: 150 }] };
  assert.equal(trafficMissing(state), null);
  const t = designTraffic(state);
  assert.ok(Math.abs(t.vdf - (150 * Math.pow(100 / 80, 4)) / 100) < 1e-9);
  assert.ok(t.result.steps.some((s) => s.title === 'Vehicle damage factor'));
});
