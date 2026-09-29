/**
 * Design traffic in cumulative standard axles, and the branch decision between
 * a full flexible design (IRC:37) and a low volume rural road (IRC:SP:72).
 *
 * Every returned step carries the citation it was computed from, so the UI can
 * show the user exactly which clause produced each number.
 */

import { TRAFFIC } from '../data/ircConstants.js';

/**
 * Indicative vehicle damage factor, used only when no axle load survey exists.
 *
 * @param {number} cvpd    Initial commercial vehicles per day, both directions.
 * @param {'plain'|'rolling'|'hilly'} terrain
 */
export function indicativeVDF(cvpd, terrain) {
  const row = TRAFFIC.indicativeVDF.rows.find((r) => cvpd <= r.maxCVPD);
  return terrain === 'hilly' ? row.hilly : row.plainRolling;
}

/**
 * Vehicle damage factor from an axle load survey (Eq. 4.1 - 4.4): every axle
 * weighed, as equivalent standard axles, over the vehicles weighed.
 *
 * @param {object} survey
 * @param {number} survey.vehicles  Commercial vehicles weighed.
 * @param {Object<string, {loadKN: number, count: number}[]>} survey  Rows of
 *        each axle type in TRAFFIC.axleEquivalence.axles, by its id.
 */
export function vdfFromAxles(survey) {
  const spec = TRAFFIC.axleEquivalence;
  const types = spec.axles.map((axle) => {
    const rows = (survey[axle.id] || []).filter((r) => r.loadKN > 0 && r.count > 0);
    const axles = rows.reduce((sum, r) => sum + r.count, 0);
    const equivalent = rows.reduce((sum, r) => sum + r.count * Math.pow(r.loadKN / axle.standardKN, spec.exponent), 0);
    return { ...axle, classes: rows.length, axles, equivalent };
  });
  const equivalent = types.reduce((sum, t) => sum + t.equivalent, 0);
  const vehicles = survey.vehicles > 0 ? survey.vehicles : 0;
  const ready = vehicles > 0 && equivalent > 0;
  const value = ready ? equivalent / vehicles : null;

  const steps = types
    .filter((t) => t.axles > 0)
    .map((t) => ({
      title: t.label,
      formula: `Σ n × (P / ${t.standardKN})^${spec.exponent}`,
      substitution: `${fmt(t.axles)} axles in ${t.classes} load classes`,
      result: `${fmt(t.equivalent, 1)} standard axles`,
      ref: spec.ref,
      verified: spec.verified,
    }));
  if (ready) {
    steps.push({
      title: 'Vehicle damage factor',
      formula: 'VDF = standard axles / commercial vehicles weighed',
      substitution: `VDF = ${fmt(equivalent, 1)} / ${fmt(vehicles)}`,
      result: `VDF = ${value.toFixed(2)}`,
      ref: spec.ref,
      verified: spec.verified,
    });
  }
  return { value, vehicles, equivalent, types, ready, steps };
}

/** The fewest commercial vehicles an axle load survey should weigh (Table 4.1). */
export function surveySample(cvpd) {
  const row = TRAFFIC.axleEquivalence.sample.rows.find((r) =>
    r.belowCVPD != null ? cvpd < r.belowCVPD : cvpd <= r.uptoCVPD
  );
  return { ...row, vehicles: Math.ceil(Math.max((cvpd * row.percent) / 100, row.minimum)) };
}

export function laneDistributionOptions() {
  return TRAFFIC.laneDistributionFactors.options;
}

/** Two-way traffic in the year construction is completed, A = P(1 + r)^x. */
export function trafficAtCompletion(presentCVPD, growthRatePercent, yearsToCompletion) {
  return presentCVPD * Math.pow(1 + growthRatePercent / 100, yearsToCompletion);
}

/**
 * Cumulative standard axles over the design life.
 *
 * @param {object} input
 * @param {number} input.presentCVPD        Two-way commercial vehicles/day at the last count.
 * @param {number} input.growthRatePercent  Annual growth rate, per cent.
 * @param {number} input.yearsToCompletion  Years between the count and the end of construction.
 * @param {number} input.designLifeYears
 * @param {number} input.laneDistributionFactor
 * @param {number} [input.directionalSplitPercent]  Share of the two-way traffic in
 *        the design direction. Given only for a divided carriageway, where the
 *        lateral distribution factor applies to one direction.
 * @param {number} input.vehicleDamageFactor
 */
export function computeDesignTraffic(input) {
  const {
    presentCVPD,
    growthRatePercent,
    yearsToCompletion,
    designLifeYears,
    laneDistributionFactor,
    directionalSplitPercent = null,
    vehicleDamageFactor,
  } = input;

  const r = growthRatePercent / 100;
  const directional = directionalSplitPercent != null;
  const steps = [];

  const twoWayCVPD = trafficAtCompletion(presentCVPD, growthRatePercent, yearsToCompletion);
  steps.push({
    id: 'projected-traffic',
    title: 'Commercial vehicles at the year of completion',
    formula: 'A = P x (1 + r)^x',
    substitution:
      `A = ${fmt(presentCVPD)} x (1 + ${r.toFixed(4)})^${yearsToCompletion}`,
    result: `A = ${fmt(twoWayCVPD, 1)} CVPD, both directions`,
    value: twoWayCVPD,
    ref: TRAFFIC.growthEquation.ref,
    verified: TRAFFIC.growthEquation.verified,
  });

  let initialCVPD = twoWayCVPD;
  if (directional) {
    initialCVPD = (twoWayCVPD * directionalSplitPercent) / 100;
    steps.push({
      id: 'directional-traffic',
      title: 'Traffic in the design direction',
      formula: 'A = A(two way) x directional share',
      substitution: `A = ${fmt(twoWayCVPD, 1)} x ${directionalSplitPercent}%`,
      result: `A = ${fmt(initialCVPD, 1)} CVPD`,
      value: initialCVPD,
      ref: TRAFFIC.growthEquation.ref,
      verified: TRAFFIC.growthEquation.verified,
    });
  }

  // Growth factor over the design life; the limit as r -> 0 is simply n.
  const growthFactor =
    Math.abs(r) < 1e-9
      ? designLifeYears
      : (Math.pow(1 + r, designLifeYears) - 1) / r;
  steps.push({
    id: 'growth-factor',
    title: 'Cumulative growth factor over the design life',
    formula: '[(1 + r)^n - 1] / r',
    substitution:
      `[(1 + ${r.toFixed(4)})^${designLifeYears} - 1] / ${r.toFixed(4)}`,
    result: growthFactor.toFixed(3),
    value: growthFactor,
    ref: TRAFFIC.growthEquation.ref,
    verified: TRAFFIC.growthEquation.verified,
  });

  const cumulativeAxles =
    365 * initialCVPD * laneDistributionFactor * vehicleDamageFactor * growthFactor;
  const msa = cumulativeAxles / 1e6;

  steps.push({
    id: 'design-traffic',
    title: 'Cumulative standard axles',
    formula: 'N = 365 x A x D x F x [(1 + r)^n - 1] / r',
    substitution:
      `N = 365 x ${fmt(initialCVPD, 1)} x ${laneDistributionFactor} x ` +
      `${vehicleDamageFactor} x ${growthFactor.toFixed(3)}`,
    result: `N = ${msa.toFixed(2)} msa`,
    value: msa,
    ref: TRAFFIC.growthEquation.ref,
    verified: TRAFFIC.growthEquation.verified,
  });

  const threshold = TRAFFIC.lowVolumeThresholdMsa.value;
  const route = msa < threshold ? 'rural' : 'flexible';

  steps.push({
    id: 'route',
    title: 'Applicable design guideline',
    formula: `N < ${threshold} msa -> IRC:SP:72;  N >= ${threshold} msa -> IRC:37`,
    substitution: `N = ${msa.toFixed(2)} msa`,
    result:
      route === 'rural'
        ? 'Low volume rural road (IRC:SP:72-2015)'
        : 'Flexible pavement (IRC:37-2018)',
    value: route,
    ref: TRAFFIC.lowVolumeThresholdMsa.ref,
    verified: TRAFFIC.lowVolumeThresholdMsa.verified,
  });

  return {
    twoWayCVPD,
    initialCVPD,
    growthFactor,
    cumulativeAxles,
    msa,
    route,
    threshold,
    steps,
  };
}

function fmt(value, digits = 0) {
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
