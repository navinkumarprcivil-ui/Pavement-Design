import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDesignTraffic, indicativeVDF } from '../src/engine/traffic.js';
import { subgradeModulus, bituminousModulus, granularModulus } from '../src/engine/materials.js';
import { mixFatigueFactor, reliabilityFor } from '../src/engine/criteria.js';
import { evaluateTrial, findMinimumBituminous, designSection } from '../src/engine/flexibleDesign.js';

test('design traffic follows the cumulative standard axle equation', () => {
  const result = computeDesignTraffic({
    presentCVPD: 1500,
    growthRatePercent: 5,
    yearsToCompletion: 3,
    designLifeYears: 15,
    laneDistributionFactor: 0.75,
    vehicleDamageFactor: 4.5,
  });

  const A = 1500 * Math.pow(1.05, 3);
  const growth = (Math.pow(1.05, 15) - 1) / 0.05;
  const expected = (365 * A * 0.75 * 4.5 * growth) / 1e6;

  assert.ok(Math.abs(result.msa - expected) < 1e-9, 'msa mismatch');
  assert.equal(result.route, 'flexible');
  assert.equal(result.steps.length, 4);
});

test('light traffic routes to the low volume rural road guideline', () => {
  const result = computeDesignTraffic({
    presentCVPD: 40,
    growthRatePercent: 6,
    yearsToCompletion: 2,
    designLifeYears: 10,
    laneDistributionFactor: 1.0,
    vehicleDamageFactor: 1.5,
  });
  assert.ok(result.msa < 2, `expected under 2 msa, got ${result.msa}`);
  assert.equal(result.route, 'rural');
});

test('zero growth rate does not divide by zero', () => {
  const result = computeDesignTraffic({
    presentCVPD: 500,
    growthRatePercent: 0,
    yearsToCompletion: 2,
    designLifeYears: 15,
    laneDistributionFactor: 0.5,
    vehicleDamageFactor: 3.5,
  });
  assert.ok(Number.isFinite(result.msa));
  assert.ok(Math.abs(result.growthFactor - 15) < 1e-9);
});

test('indicative VDF follows the traffic volume bands', () => {
  assert.equal(indicativeVDF(100, 'plain'), 1.7);
  assert.equal(indicativeVDF(100, 'hilly'), 0.6);
  assert.equal(indicativeVDF(800, 'rolling'), 3.9);
  assert.equal(indicativeVDF(800, 'hilly'), 1.7);
  assert.equal(indicativeVDF(5000, 'plain'), 5.0);
  assert.equal(indicativeVDF(5000, 'hilly'), 2.8);
});

test('a divided carriageway designs for the traffic in one direction', () => {
  // Annex-II example II.3: 5000 CVPD two-way at completion, half each way.
  const result = computeDesignTraffic({
    presentCVPD: 5000,
    growthRatePercent: 6,
    yearsToCompletion: 0,
    designLifeYears: 20,
    laneDistributionFactor: 0.75,
    directionalSplitPercent: 50,
    vehicleDamageFactor: 5.2,
  });
  assert.equal(Math.round(result.msa), 131);
  assert.equal(result.initialCVPD, 2500);
  assert.equal(result.steps.length, 5);
});

test('subgrade modulus switches branch at CBR 5', () => {
  assert.equal(subgradeModulus(4), 40);
  assert.equal(subgradeModulus(5), 50);
  const above = subgradeModulus(10);
  assert.ok(Math.abs(above - 17.6 * Math.pow(10, 0.64)) < 1e-9);
  assert.ok(subgradeModulus(100) <= 100, 'modulus should be capped');
});

test('bituminous modulus interpolates between tabulated temperatures', () => {
  assert.equal(bituminousModulus('VG40', 35), 3000);
  const midpoint = bituminousModulus('VG40', 32.5);
  assert.ok(midpoint > 3000 && midpoint < 4000, `got ${midpoint}`);
  assert.equal(bituminousModulus('VG30', 10), 3500, 'clamps below the table');
  assert.equal(bituminousModulus('VG30', 50), 1250, 'clamps above the table');
});

test('granular modulus grows with thickness and support', () => {
  const thin = granularModulus(200, 50);
  const thick = granularModulus(400, 50);
  const stiffer = granularModulus(200, 80);
  assert.ok(thick > thin);
  assert.ok(stiffer > thin);
});

test('reliability steps up at 20 msa, and is 90% on important roads', () => {
  assert.equal(reliabilityFor(19.9), 80);
  assert.equal(reliabilityFor(20), 90);
  assert.equal(reliabilityFor(19.9, 'mdr'), 80);
  assert.equal(reliabilityFor(5, 'nh'), 90);
  assert.equal(reliabilityFor(5, 'expressway'), 90);
  assert.equal(reliabilityFor(5, 'urban'), 90);
});

test('mix fatigue factor responds to binder content', () => {
  const lean = mixFatigueFactor(4, 10);
  const rich = mixFatigueFactor(4, 13);
  assert.ok(rich.C > lean.C, 'more effective binder must improve fatigue life');
});

const baseInput = {
  combination: {
    bituminousId: 'BC_DBM',
    baseId: 'WMM',
    subBaseId: 'GSB',
    crackReliefId: null,
  },
  thicknesses: { BC: 40, DBM: 110, BASE: 250, SUB_BASE: 200 },
  materials: {
    subgradeCBR: 8,
    binderGrade: 'VG40',
    pavementTemperatureC: 35,
  },
  mix: { airVoidsPercent: 4.5, effectiveBinderPercent: 11.5 },
  designTrafficMsa: 30,
};

test('a trial section is evaluated with both IRC checks and the sub-base check', () => {
  const result = evaluateTrial(baseInput);

  assert.equal(result.reliability, 90, '30 msa designs at 90% reliability');
  assert.deepEqual(
    result.checks.map((c) => c.id),
    ['bituminous-fatigue', 'subgrade-rutting', 'construction-traffic']
  );
  assert.equal(result.totalThicknessMm, 600);

  for (const check of result.checks) {
    assert.ok(Number.isFinite(check.strainMicro), `${check.id} strain not finite`);
    assert.ok(check.strainMicro > 0, `${check.id} strain should be positive`);
    assert.ok(check.allowableMsa > 0, `${check.id} allowable life should be positive`);
  }

  const fatigue = result.checks.find((c) => c.id === 'bituminous-fatigue');
  const rutting = result.checks.find((c) => c.id === 'subgrade-rutting');
  // Sanity bands for a section of this class under the IRC standard axle.
  assert.ok(
    fatigue.strainMicro > 30 && fatigue.strainMicro < 400,
    `tensile strain ${fatigue.strainMicro.toFixed(1)} microstrain out of band`
  );
  assert.ok(
    rutting.strainMicro > 80 && rutting.strainMicro < 1200,
    `subgrade strain ${rutting.strainMicro.toFixed(1)} microstrain out of band`
  );
});

test('a thicker section is safer than a thin one', () => {
  const thin = evaluateTrial({
    ...baseInput,
    thicknesses: { BC: 40, DBM: 50, BASE: 250, SUB_BASE: 150 },
  });
  const thick = evaluateTrial({
    ...baseInput,
    thicknesses: { BC: 40, DBM: 160, BASE: 300, SUB_BASE: 250 },
  });
  assert.ok(
    thick.governingLifeMsa > thin.governingLifeMsa,
    'a thicker section must carry more traffic'
  );
});

test('a weaker subgrade needs a stronger section', () => {
  const good = evaluateTrial({
    ...baseInput,
    materials: { ...baseInput.materials, subgradeCBR: 10 },
  });
  const poor = evaluateTrial({
    ...baseInput,
    materials: { ...baseInput.materials, subgradeCBR: 3 },
  });
  assert.ok(
    poor.governingLifeMsa < good.governingLifeMsa,
    'a weaker subgrade must reduce the life of the same section'
  );
});

test('thicknesses below the IRC minimum are flagged', () => {
  const result = evaluateTrial({
    ...baseInput,
    thicknesses: { BC: 40, DBM: 110, BASE: 100, SUB_BASE: 100 },
  });
  assert.equal(result.thicknessWarnings.length, 2, 'expected minimum thickness warnings');
});

test('a cement treated base adds its own fatigue check', () => {
  const result = evaluateTrial({
    ...baseInput,
    combination: {
      bituminousId: 'BC_DBM',
      baseId: 'CTB',
      subBaseId: 'CTSB',
      crackReliefId: 'AGG_INTERLAYER',
    },
    thicknesses: { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 150, SUB_BASE: 200 },
  });
  const ids = result.checks.map((c) => c.id);
  assert.ok(ids.includes('cemented-fatigue'), 'expected a cemented base check');
  assert.equal(result.layers.length, 6, 'BC, DBM, interlayer, CTB, CTSB, subgrade');
});

test('the minimum bituminous search returns the thinnest safe section', () => {
  // 50 msa on this foundation is governed by strain, not by the IRC minimum
  // thickness, so the search result should sit exactly on the safe/unsafe edge.
  const demand = { ...baseInput, designTrafficMsa: 50 };
  const result = findMinimumBituminous({
    ...demand,
    thicknesses: { BC: 40, DBM: 50, BASE: 250, SUB_BASE: 200 },
  });

  assert.ok(result.found, result.message);

  const atMinimum = evaluateTrial({ ...demand, thicknesses: result.thicknesses });
  assert.ok(atMinimum.safe, 'the reported minimum must itself pass');
  assert.ok(
    result.thicknessMm > 50,
    `expected strain to govern, but the search stopped at the ${result.thicknessMm} mm floor`
  );

  const thinner = evaluateTrial({
    ...demand,
    thicknesses: { ...result.thicknesses, DBM: result.thicknessMm - 5 },
  });
  assert.ok(!thinner.safe, 'one increment thinner must fail, or it is not the minimum');
});

test('the search stops at the IRC minimum when strain is not governing', () => {
  // Light traffic on a good foundation: nothing about the strain check forces
  // extra bitumen, so the construction minimum is the answer.
  const result = findMinimumBituminous({
    ...baseInput,
    designTrafficMsa: 10,
    thicknesses: { BC: 40, DBM: 50, BASE: 250, SUB_BASE: 200 },
  });
  assert.ok(result.found, result.message);
  assert.equal(result.thicknessMm, 50, 'expected the DBM minimum thickness');
});

test('an impossible demand reports that the foundation is the problem', () => {
  const result = findMinimumBituminous({
    ...baseInput,
    designTrafficMsa: 5000,
    materials: { ...baseInput.materials, subgradeCBR: 2 },
    thicknesses: { BC: 40, DBM: 50, BASE: 250, SUB_BASE: 200 },
  });
  assert.equal(result.found, false);
  assert.match(result.message, /foundation/);
});

test('designing a section returns thicknesses that pass every check', () => {
  for (const combination of [
    { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB', crackReliefId: null },
    { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'GSB', crackReliefId: 'AGG_INTERLAYER' },
    { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'SAMI' },
    { bituminousId: 'SDBC_DBM', baseId: 'WMM', subBaseId: 'CTSB', crackReliefId: null },
  ]) {
    const outcome = designSection({
      ...baseInput,
      combination,
      thicknesses: {},
      designTrafficMsa: 40,
      roadCategory: 'nh',
    });
    assert.ok(outcome.found, outcome.message);
    assert.ok(outcome.trial.safe, `${combination.baseId}/${combination.subBaseId} design must pass`);
    assert.equal(outcome.trial.thicknessWarnings.length, 0, outcome.trial.thicknessWarnings.join('; '));
  }
});

test('the designed granular sub-base is the thinnest that carries construction traffic', () => {
  const input = { ...baseInput, thicknesses: {}, designTrafficMsa: 40, roadCategory: 'nh' };
  const outcome = designSection(input);
  assert.ok(outcome.found, outcome.message);
  const gsb = outcome.thicknesses.SUB_BASE;
  if (gsb > 150) {
    const thinner = evaluateTrial({
      ...input,
      thicknesses: { ...outcome.thicknesses, SUB_BASE: gsb - 10 },
    });
    assert.equal(thinner.checks.find((c) => c.id === 'construction-traffic').safe, false);
  }
});

test('a CTB is sized with the bituminous layer at its minimum, whatever was entered', () => {
  const input = {
    ...baseInput,
    combination: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'GSB', crackReliefId: 'AGG_INTERLAYER' },
    designTrafficMsa: 131,
    roadCategory: 'nh',
  };
  const fresh = designSection({ ...input, thicknesses: {} });
  const carried = designSection({ ...input, thicknesses: { BC: 40, DBM: 150 } });
  assert.deepEqual(carried.thicknesses, fresh.thicknesses);
  assert.ok(carried.trial.safe);
});
