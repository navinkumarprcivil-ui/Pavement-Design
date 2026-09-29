/**
 * Everything the screens derive from the project inputs, in one place, so a
 * screen never depends on another screen having been visited first.
 */

import {
  computeDesignTraffic,
  indicativeVDF,
  laneDistributionOptions,
  surveySample,
  trafficAtCompletion,
  vdfFromAxles,
} from '../engine/traffic.js';
import { reliabilityFor } from '../engine/criteria.js';
import { MODULI, STAGE_CONSTRUCTION, TRAFFIC, roadCategory } from '../data/ircConstants.js';

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
  const { vdf, survey } = vdfOf(state, twoWayAtCompletion);

  const result = computeDesignTraffic({
    presentCVPD: traffic.presentCVPD || 0,
    growthRatePercent,
    yearsToCompletion: years,
    designLifeYears: traffic.designLifeYears || 1,
    laneDistributionFactor: lane.value,
    directionalSplitPercent: lane.directional ? traffic.directionalSplitPercent ?? 50 : null,
    vehicleDamageFactor: vdf,
  });

  result.steps.splice(result.steps.findIndex((st) => st.id === 'design-traffic'), 0, ...vdfSteps(state, vdf, survey, twoWayAtCompletion));

  let stage = null;
  if (traffic.stage?.enabled && traffic.stage.stage1Years > 0) {
    const n1 = traffic.stage.stage1Years;
    const first = computeDesignTraffic({
      presentCVPD: traffic.presentCVPD || 0,
      growthRatePercent,
      yearsToCompletion: years,
      designLifeYears: n1,
      laneDistributionFactor: lane.value,
      directionalSplitPercent: lane.directional ? traffic.directionalSplitPercent ?? 50 : null,
      vehicleDamageFactor: vdf,
    });
    const r = growthRatePercent / 100;
    stage = stageOf(result.msa, first.msa, {
      formula: 'N1 = 365 x A x D x F x [(1 + r)^n1 - 1] / r',
      substitution:
        `N1 = 365 x ${first.initialCVPD.toFixed(1)} x ${lane.value} x ${vdf.toFixed(2)} x ` +
        `[(1 + ${r.toFixed(4)})^${n1} - 1] / ${r.toFixed(4)}`,
      years: n1,
    });
    result.steps.splice(result.steps.findIndex((st) => st.id === 'route'), 0, ...stage.steps);
  }

  // Below 2 msa IRC:SP:72 is offered beside IRC:37.
  const routeChoice = result.route === 'rural';
  const route = result.route;

  const warnings = [];
  if (entered < floor) {
    warnings.push(`Growth rate taken as the ${floor}% minimum · ${TRAFFIC.minimumGrowthRate.ref.clause}`);
  }
  if (survey?.ready) {
    // The survey weighs one direction's traffic at the time of the count.
    const share = lane.directional ? (traffic.directionalSplitPercent ?? 50) / 100 : 0.5;
    const cvpd = Math.round((traffic.presentCVPD || 0) * share);
    const sample = surveySample(cvpd);
    if (survey.vehicles < sample.vehicles) {
      warnings.push(
        `Axle load survey of ${survey.vehicles} vehicles; ${sample.vehicles} for ${cvpd.toLocaleString('en-IN')} CVPD in the direction · ${TRAFFIC.axleEquivalence.sample.ref.clause}, ${TRAFFIC.axleEquivalence.sample.ref.table}`
      );
    }
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
    survey,
    stage,
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
  const { vdf, survey } = vdfOf(state, twoWayAtCompletion);
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

  let stage = null;
  if (traffic.stage?.enabled && traffic.stage.stage1Msa > 0) {
    stage = stageOf(msa, traffic.stage.stage1Msa, { formula: 'Entered', substitution: '', years: null });
    steps.splice(1, 0, ...stage.steps);
  }

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
    survey,
    stage,
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

/**
 * The VDF the design takes: entered from a survey, worked out from the axles
 * weighed, or the indicative value (Table 4.2) until either is complete.
 */
function vdfOf(state, twoWayAtCompletion) {
  const { traffic, project } = state;
  const indicative = () => indicativeVDF(twoWayAtCompletion, project.terrain);
  if (traffic.vdfMode === 'axles') {
    const survey = vdfFromAxles(traffic.axleSurvey || {});
    return { vdf: survey.ready ? survey.value : indicative(), survey };
  }
  if (traffic.vdfMode === 'survey' && traffic.vehicleDamageFactor > 0) {
    return { vdf: traffic.vehicleDamageFactor, survey: null };
  }
  return { vdf: indicative(), survey: null };
}

/** How the VDF was arrived at, as working steps. */
function vdfSteps(state, vdf, survey, twoWayAtCompletion) {
  const { traffic, project } = state;
  if (survey?.ready) return survey.steps;
  if (traffic.vdfMode === 'survey' && traffic.vehicleDamageFactor > 0) {
    return [
      {
        id: 'vdf',
        title: 'Vehicle damage factor',
        formula: 'From the axle load survey',
        substitution: '',
        result: `VDF = ${vdf}`,
        value: vdf,
        ref: TRAFFIC.directionalVDF.ref,
        verified: TRAFFIC.directionalVDF.verified,
      },
    ];
  }
  const cvpd = Math.round(twoWayAtCompletion).toLocaleString('en-IN');
  return [
    {
      id: 'vdf',
      title: 'Vehicle damage factor',
      formula: 'Indicative, by the initial two-way traffic and terrain',
      substitution: `A = ${cvpd} CVPD, ${project.terrain === 'hilly' ? 'hilly' : 'plain / rolling'}`,
      result: `VDF = ${vdf}`,
      value: vdf,
      ref: TRAFFIC.indicativeVDF.ref,
      verified: TRAFFIC.indicativeVDF.verified,
    },
  ];
}

/**
 * Stage construction (Cl. 4.3.2): the stage-1 bituminous layers designed for
 * 1.67 times the stage-1 traffic, never more than the full design traffic.
 */
function stageOf(fullMsa, stage1Msa, { formula, substitution, years }) {
  const spec = STAGE_CONSTRUCTION;
  const raised = spec.factor * stage1Msa;
  const designMsa = Math.min(raised, fullMsa);
  return {
    years,
    stage1Msa,
    designMsa,
    fullMsa,
    steps: [
      {
        id: 'stage-1-traffic',
        title: years ? `Traffic over the stage-1 period, ${years} years` : 'Stage-1 traffic',
        formula,
        substitution,
        result: `N1 = ${stage1Msa.toFixed(2)} msa`,
        value: stage1Msa,
        ref: spec.ref,
        verified: spec.verified,
      },
      {
        id: 'stage-1-design',
        title: 'Stage-1 bituminous layers, 40% life left',
        formula: `N1' = ${spec.factor} x N1, not more than N`,
        substitution: `N1' = ${spec.factor} x ${stage1Msa.toFixed(2)} = ${raised.toFixed(2)} msa; N = ${fullMsa.toFixed(2)} msa`,
        result: `N1' = ${designMsa.toFixed(2)} msa`,
        value: designMsa,
        ref: spec.ref,
        verified: spec.verified,
      },
    ],
  };
}

/** What the traffic still needs, as a prompt, or null. */
export function trafficMissing(state) {
  const traffic = state.traffic;
  const stage = traffic.stage;
  if (stage?.enabled) {
    if (traffic.mode === 'direct') {
      if (!(stage.stage1Msa > 0)) return 'Enter the stage-1 traffic';
      if (traffic.designMsa > 0 && stage.stage1Msa >= traffic.designMsa) return 'Stage-1 traffic must be less than the design traffic';
    } else {
      if (!(stage.stage1Years > 0)) return 'Enter the stage-1 period';
      if (stage.stage1Years >= (traffic.designLifeYears || 0)) return 'Stage-1 period must be shorter than the design period';
    }
  }
  return vdfMissing(state);
}

/** What the chosen VDF source still needs, as a prompt, or null. */
function vdfMissing(state) {
  const traffic = state.traffic;
  if (traffic.vdfMode === 'survey' && !(traffic.vehicleDamageFactor > 0)) return 'Enter the VDF from the survey';
  if (traffic.vdfMode === 'axles') {
    const survey = traffic.axleSurvey || {};
    if (!(survey.vehicles > 0)) return 'Enter the commercial vehicles weighed';
    if (!vdfFromAxles(survey).ready) return 'Enter the axles weighed';
  }
  return null;
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
