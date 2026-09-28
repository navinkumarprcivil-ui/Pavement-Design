/**
 * Values entered in place of the app's own working: a known design traffic,
 * and the surface deflection of the two-layer subgrade read from IITPAVE.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSubgrade } from '../src/engine/materials.js';
import { sp72Traffic } from '../src/engine/ruralSP72.js';
import { designTraffic } from '../src/ui/project.js';

test('IRC:37 Annex II.1 with the IITPAVE deflection of 1.41 mm', () => {
  const e = effectiveSubgrade({ borrowCBR: 20, embankmentCBR: 8, source: 'iitpave', iitpaveDeflectionMm: 1.41 });
  assert.equal(e.fromIitpave, true);
  assert.equal(e.deflection, 1.41);
  assert.ok(Math.abs(e.equivalent - 105.1) < 0.1, `MRS ${e.equivalent}`);
  assert.equal(e.value, 100);
  assert.ok(Math.abs(e.computed - 1.41) < 0.01, 'the app still reports its own deflection');
});

test('an empty IITPAVE deflection keeps the app analysis', () => {
  const e = effectiveSubgrade({ borrowCBR: 20, embankmentCBR: 8, source: 'iitpave', iitpaveDeflectionMm: null });
  assert.equal(e.fromIitpave, false);
  assert.equal(e.deflection, e.computed);
});

test('IRC:37 design traffic entered directly', () => {
  const state = {
    project: { roadCategory: 'nh', terrain: 'plain' },
    traffic: { mode: 'direct', designMsa: 24.4, completionCVPD: 2000, designLifeYears: 20, vdfMode: 'indicative', laneDistributionId: 'dual-two-lane' },
  };
  const t = designTraffic(state);
  assert.equal(t.result.msa, 24.4);
  assert.equal(t.result.direct, true);
  assert.equal(t.result.cumulativeAxles, 24.4e6);
  assert.equal(t.twoWayAtCompletion, 2000);
  assert.equal(t.route, 'flexible');
  assert.ok(t.vdf > 0);
  state.traffic.designMsa = 1.5;
  assert.equal(designTraffic(state).routeChoice, true, 'under 2 msa offers IRC:SP:72');
});

test('IRC:SP:72 design traffic entered directly', () => {
  const t = sp72Traffic({ mode: 'direct', designEsal: 78660, designLifeYears: 10 });
  assert.equal(t.esal, 78660);
  assert.equal(t.mode, 'direct');
});

test('IRC:SP:72 survey VDF left empty keeps the indicative value', () => {
  const base = { mode: 'counts', hcv: 10, mcv: 40, ladenPercent: 50, vdfMode: 'survey', vdfHcv: null, vdfMcv: null, growthPercent: 6, designLifeYears: 10, laneId: 'single', harvest: {} };
  const indicative = sp72Traffic({ ...base, vdfMode: 'indicative' });
  assert.equal(sp72Traffic(base).esal, indicative.esal);
  const part = sp72Traffic({ ...base, vdfHcv: 2 });
  assert.ok(part.esal !== indicative.esal);
});
