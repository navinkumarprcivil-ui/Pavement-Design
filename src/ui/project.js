/**
 * Everything the screens derive from the project inputs, in one place, so a
 * screen never depends on another screen having been visited first.
 */

import {
  computeDesignTraffic,
  indicativeVDF,
  laneDistributionOptions,
  trafficAtCompletion,
} from '../engine/traffic.js';
import { reliabilityFor } from '../engine/criteria.js';
import { MODULI, TRAFFIC, roadCategory } from '../data/ircConstants.js';

/**
 * Design traffic and the facts that follow from it.
 *
 * @returns {{
 *   result: object, vdf: number, lane: object, category: object|null,
 *   growthRatePercent: number, growthRaised: boolean, reliability: 80|90,
 *   route: 'flexible'|'rural', routeChoice: boolean, warnings: string[]
 * }}
 */
export function designTraffic(state) {
  const { traffic, project } = state;
  const lanes = laneDistributionOptions();
  const lane = lanes.find((o) => o.id === traffic.laneDistributionId) || lanes[0];
  const category = roadCategory(project.roadCategory);

  if (traffic.mode === 'direct') return enteredTraffic(state, lane, category);

  const entered = traffic.growthRatePercent ?? 0;
  const floor = TRAFFIC.minimumGrowthRate.percent;
  const growthRatePercent = Math.max(entered, floor);

  const years = traffic.yearsToCompletion || 0;
  const twoWayAtCompletion = trafficAtCompletion(traffic.presentCVPD || 0, growthRatePercent, years);
  const vdf =
    traffic.vdfMode === 'survey' && traffic.vehicleDamageFactor > 0
      ? traffic.vehicleDamageFactor
      : indicativeVDF(twoWayAtCompletion, project.terrain);

  const result = computeDesignTraffic({
    presentCVPD: traffic.presentCVPD || 0,
    growthRatePercent,
    yearsToCompletion: years,
    designLifeYears: traffic.designLifeYears || 1,
    laneDistributionFactor: lane.value,
    directionalSplitPercent: lane.directional ? traffic.directionalSplitPercent ?? 50 : null,
    vehicleDamageFactor: vdf,
  });

  // Below 2 msa IRC:SP:72 is offered beside IRC:37.
  const routeChoice = result.route === 'rural';
  const route = result.route;

  const warnings = [];
  if (entered < floor) {
    warnings.push(`Growth rate taken as the ${floor}% minimum · ${TRAFFIC.minimumGrowthRate.ref.clause}`);
  }
  if (category && traffic.designLifeYears < category.designPeriodYears) {
    warnings.push(
      `Design period under the ${category.designPeriodYears} years for ${category.label.toLowerCase()}s · Cl. 4.3.1`
    );
  }
  const longLife = TRAFFIC.longLife;
  if (result.msa > longLife.thresholdMsa && traffic.designLifeYears < longLife.minimumDesignPeriodYears) {
    warnings.push(
      `Over ${longLife.thresholdMsa} msa: long-life, or at least ${longLife.minimumDesignPeriodYears} years · Cl. 4.3.1`
    );
  }

  return {
    result,
    vdf,
    lane,
    category,
    twoWayAtCompletion,
    growthRatePercent,
    reliability: reliabilityFor(result.msa, project.roadCategory),
    route,
    routeChoice,
    warnings,
  };
}

/**
 * Design traffic entered as known, in msa. The commercial vehicles at
 * completion still decide the subgrade CBR floor and, with the VDF, the
 * vehicles behind a cement treated base's fatigue damage.
 */
function enteredTraffic(state, lane, category) {
  const { traffic, project } = state;
  const msa = traffic.designMsa > 0 ? traffic.designMsa : 0;
  const twoWayAtCompletion = traffic.completionCVPD > 0 ? traffic.completionCVPD : 0;
  const vdf =
    traffic.vdfMode === 'survey' && traffic.vehicleDamageFactor > 0
      ? traffic.vehicleDamageFactor
      : indicativeVDF(twoWayAtCompletion, project.terrain);
  const threshold = TRAFFIC.lowVolumeThresholdMsa.value;
  const route = msa < threshold ? 'rural' : 'flexible';
  const steps = [
    {
      id: 'design-traffic',
      title: 'Cumulative standard axles',
      formula: 'Entered',
      substitution: '',
      result: `N = ${msa.toFixed(2)} msa`,
      value: msa,
      ref: TRAFFIC.growthEquation.ref,
      verified: TRAFFIC.growthEquation.verified,
    },
    {
      id: 'route',
      title: 'Applicable design guideline',
      formula: `N < ${threshold} msa -> IRC:SP:72;  N >= ${threshold} msa -> IRC:37`,
      substitution: `N = ${msa.toFixed(2)} msa`,
      result: route === 'rural' ? 'Low volume rural road (IRC:SP:72-2015)' : 'Flexible pavement (IRC:37-2018)',
      value: route,
      ref: TRAFFIC.lowVolumeThresholdMsa.ref,
      verified: TRAFFIC.lowVolumeThresholdMsa.verified,
    },
  ];

  const warnings = [];
  if (category && traffic.designLifeYears < category.designPeriodYears) {
    warnings.push(`Design period under the ${category.designPeriodYears} years for ${category.label.toLowerCase()}s · Cl. 4.3.1`);
  }
  const longLife = TRAFFIC.longLife;
  if (msa > longLife.thresholdMsa && traffic.designLifeYears < longLife.minimumDesignPeriodYears) {
    warnings.push(`Over ${longLife.thresholdMsa} msa: long-life, or at least ${longLife.minimumDesignPeriodYears} years · Cl. 4.3.1`);
  }

  return {
    result: {
      direct: true,
      twoWayCVPD: twoWayAtCompletion,
      initialCVPD: twoWayAtCompletion,
      growthFactor: null,
      cumulativeAxles: msa * 1e6,
      msa,
      route,
      threshold,
      steps,
    },
    vdf,
    lane,
    category,
    twoWayAtCompletion,
    growthRatePercent: traffic.growthRatePercent,
    reliability: reliabilityFor(msa, project.roadCategory),
    route,
    routeChoice: route === 'rural',
    warnings,
  };
}

/** Subgrade CBR warning for the traffic on the road, or null. */
export function subgradeWarning(state, twoWayAtCompletion) {
  const rule = MODULI.minimumCBR;
  const cbr = state.materials.subgradeCBR;
  if (cbr != null && cbr <= rule.percent && twoWayAtCompletion > rule.aboveCVPD) {
    return `Effective CBR should exceed ${rule.percent}% above ${rule.aboveCVPD} CVPD · ${rule.ref.clause}`;
  }
  return null;
}
