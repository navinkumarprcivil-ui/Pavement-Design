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

  // Below 2 msa both guidelines are open to the designer; the rural road
  // guideline is the default. At 2 msa and above IRC:37 is the only one.
  const routeChoice = result.route === 'rural';
  const route = routeChoice && state.routeChoice === 'flexible' ? 'flexible' : result.route;

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

/** Subgrade CBR warning for the traffic on the road, or null. */
export function subgradeWarning(state, twoWayAtCompletion) {
  const rule = MODULI.minimumCBR;
  const cbr = state.materials.subgradeCBR;
  if (cbr != null && cbr <= rule.percent && twoWayAtCompletion > rule.aboveCVPD) {
    return `Effective CBR should exceed ${rule.percent}% above ${rule.aboveCVPD} CVPD · ${rule.ref.clause}`;
  }
  return null;
}
