/**
 * Flexible pavement design by the mechanistic-empirical route of IRC:37-2018.
 *
 * `evaluateTrial` analyses one candidate section and reports whether it is safe,
 * with the full working. `findMinimumBituminous` scans bituminous thickness for
 * the thinnest safe section on a given granular/cemented foundation.
 *
 * The strain field comes from the exact layered-elastic solution in
 * engine/elastic.js, which is the same analysis IITPAVE performs.
 */

import { analyze } from './elastic.js';
import { buildLayerStack, granularModulus, subgradeModulus } from './materials.js';
import {
  bituminousFatigueLife,
  cementedFatigueLife,
  ctbReliabilityFactor,
  reliabilityFor,
  subgradeRuttingLife,
} from './criteria.js';
import {
  CRITERIA,
  MINIMUM_THICKNESS,
  STANDARD_AXLE,
  THICKNESS_INCREMENTS,
} from '../data/ircConstants.js';
import { BEHAVIOUR, describeCombination } from '../data/layerCatalog.js';

/** Under the centre of one wheel, and on the axis between the dual pair. */
const OFFSETS = [
  { x: 0, label: 'under a wheel' },
  { x: STANDARD_AXLE.dualSpacingMm / 2, label: 'between the wheels' },
];

const pointsAt = (z, layerIndex, role) =>
  OFFSETS.map((o) => ({ x: o.x, y: 0, z, layerIndex, role, label: o.label }));

const standardLoad = (tyrePressureMPa) => ({
  wheelLoadN: STANDARD_AXLE.wheelLoadN,
  tyrePressureMPa,
  dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
});

/** Depth to the underside of every layer, top down. */
function interfaceDepths(layers) {
  const depths = [];
  let depth = 0;
  for (const layer of layers) {
    depth += layer.thicknessMm || 0;
    depths.push(depth);
  }
  return depths;
}

/** The largest response among points of one role. */
const worst = (responses, role, selector) =>
  responses
    .filter((r) => r.role === role)
    .reduce((best, r) => Math.max(best, selector(r)), -Infinity);

function check(fields) {
  const { strain, allowableStrain, allowableMsa, demandMsa } = fields;
  return {
    ...fields,
    strainMicro: strain * 1e6,
    allowableMicro: allowableStrain == null ? null : allowableStrain * 1e6,
    // How much of the allowable is used; above 1 the check fails.
    utilisation: allowableMsa > 0 ? demandMsa / allowableMsa : Infinity,
    safe: allowableMsa >= demandMsa,
  };
}

/**
 * Analyse one candidate section.
 *
 * @param {object} input
 * @param {object} input.combination  {bituminousId, baseId, subBaseId, crackReliefId}
 * @param {Object<string,number>} input.thicknesses  slotId -> mm
 * @param {object} input.materials  {subgradeCBR, binderGrade, pavementTemperatureC, overrides}
 * @param {object} input.mix        {airVoidsPercent, effectiveBinderPercent}
 * @param {number} input.designTrafficMsa
 * @param {string} [input.roadCategory]
 * @param {80|90} [input.reliability]
 */
export function evaluateTrial(input) {
  const { combination, thicknesses, materials, mix, designTrafficMsa, roadCategory } = input;

  const reliability = input.reliability ?? reliabilityFor(designTrafficMsa, roadCategory);
  const designAxles = designTrafficMsa * 1e6;
  const described = describeCombination(combination);

  const slots = described.slots.map((slot) => ({
    ...slot,
    thicknessMm:
      slot.behaviour === BEHAVIOUR.SUBGRADE ? 0 : thicknesses[slot.slotId] ?? slot.defaultMm,
  }));

  const { layers, steps: modulusSteps } = buildLayerStack(slots, materials);
  const elasticLayers = layers.map((l) => ({ h: l.thicknessMm, E: l.E, nu: l.nu }));
  const depths = interfaceDepths(layers);
  const subgradeIndex = layers.length - 1;

  const lastBituminous = layers.reduce(
    (found, l, i) => (l.behaviour === BEHAVIOUR.BITUMINOUS ? i : found),
    -1
  );
  const ctbIndex = layers.findIndex(
    (l) => l.behaviour === BEHAVIOUR.CEMENTED && l.slotId === 'BASE'
  );

  // Bituminous fatigue and subgrade rutting under the standard contact stress.
  const points = [
    ...(lastBituminous >= 0
      ? pointsAt(depths[lastBituminous], lastBituminous, 'bituminous-tension')
      : []),
    ...pointsAt(depths[subgradeIndex - 1], subgradeIndex, 'subgrade-compression'),
  ];
  const responses = analyze({
    layers: elasticLayers,
    load: standardLoad(STANDARD_AXLE.tyrePressureMPa),
    points,
  }).map((r, i) => ({ ...r, role: points[i].role, pressureMPa: STANDARD_AXLE.tyrePressureMPa }));

  // The cement treated base is analysed at its own, higher, contact stress.
  if (ctbIndex >= 0) {
    const ctbPoints = pointsAt(depths[ctbIndex], ctbIndex, 'cemented-tension');
    responses.push(
      ...analyze({
        layers: elasticLayers,
        load: standardLoad(STANDARD_AXLE.ctbTyrePressureMPa),
        points: ctbPoints,
      }).map((r, i) => ({
        ...r,
        role: ctbPoints[i].role,
        pressureMPa: STANDARD_AXLE.ctbTyrePressureMPa,
      }))
    );
  }

  const checks = [];

  if (lastBituminous >= 0) {
    const strain = worst(responses, 'bituminous-tension', (r) => r.maxHorizontalStrain);
    const fatigue = bituminousFatigueLife({
      tensileStrain: strain,
      modulusMPa: layers[lastBituminous].E,
      airVoidsPercent: mix.airVoidsPercent,
      effectiveBinderPercent: mix.effectiveBinderPercent,
      reliability,
      designAxles,
    });
    checks.push(
      check({
        id: 'bituminous-fatigue',
        title: 'Fatigue of the bituminous layer',
        strainLabel: 'Tensile strain, bottom of bituminous layer',
        strain: Math.max(strain, 0),
        demandMsa: designTrafficMsa,
        inService: true,
        ...fatigue,
      })
    );
  }

  const verticalStrain = worst(responses, 'subgrade-compression', (r) => r.verticalCompressiveStrain);
  checks.push(
    check({
      id: 'subgrade-rutting',
      title: 'Rutting of the subgrade',
      strainLabel: 'Vertical strain, top of subgrade',
      strain: verticalStrain,
      demandMsa: designTrafficMsa,
      inService: true,
      ...subgradeRuttingLife(verticalStrain, reliability, designAxles),
    })
  );

  if (ctbIndex >= 0) {
    const strain = worst(responses, 'cemented-tension', (r) => r.maxHorizontalStrain);
    const reliabilityFactor = ctbReliabilityFactor(designTrafficMsa, roadCategory);
    checks.push(
      check({
        id: 'cemented-fatigue',
        title: 'Fatigue of the cement treated base',
        strainLabel: 'Tensile strain, bottom of CTB at 0.80 MPa',
        strain: Math.max(strain, 0),
        demandMsa: designTrafficMsa,
        inService: true,
        ...cementedFatigueLife(strain, {
          modulusMPa: layers[ctbIndex].E,
          reliabilityFactor,
          designAxles,
        }),
      })
    );
  }

  const construction = constructionTrafficCheck(layers, reliability);
  if (construction) checks.push(construction);

  const inServiceChecks = checks.filter((c) => c.inService);
  const governingLifeMsa = Math.min(...inServiceChecks.map((c) => c.allowableMsa));
  const totalThicknessMm = slots.reduce((sum, s) => sum + (s.thicknessMm || 0), 0);
  const bituminousMm = slots
    .filter((s) => s.behaviour === BEHAVIOUR.BITUMINOUS)
    .reduce((sum, s) => sum + s.thicknessMm, 0);

  const thicknessWarnings = slots
    .filter((s) => s.minMm != null && s.thicknessMm < s.minMm)
    .map((s) => `${s.label}: ${s.thicknessMm} mm, below the ${s.minMm} mm minimum`);

  const overCTB = MINIMUM_THICKNESS.bituminousOverCTB;
  if (ctbIndex >= 0 && designTrafficMsa > overCTB.aboveMsa && bituminousMm < overCTB.mm) {
    thicknessWarnings.push(
      `Bituminous layers over a CTB: ${bituminousMm} mm, below the ${overCTB.mm} mm minimum above ${overCTB.aboveMsa} msa`
    );
  }

  const notChecked =
    ctbIndex >= 0
      ? [{ title: 'Cumulative fatigue damage of the CTB', ref: CRITERIA.cementedDamage.ref }]
      : [];

  return {
    reliability,
    slots,
    layers,
    responses,
    checks,
    modulusSteps,
    safe: checks.every((c) => c.safe),
    serviceSafe: inServiceChecks.every((c) => c.safe),
    governingLifeMsa,
    totalThicknessMm,
    bituminousMm,
    thicknessWarnings,
    notChecked,
    designTrafficMsa,
  };
}

/**
 * The granular sub-base carries loaded tippers before anything is laid on it.
 * It is checked as a two-layer system on the subgrade for subgrade rutting
 * under the construction traffic, taken as the code's floor of repetitions.
 */
function constructionTrafficCheck(layers, reliability) {
  const subBase = layers.find((l) => l.slotId === 'SUB_BASE');
  if (!subBase || subBase.behaviour !== BEHAVIOUR.GRANULAR || !(subBase.thicknessMm > 0)) {
    return null;
  }
  const subgrade = layers[layers.length - 1];
  return subBaseCheck(subBase.thicknessMm, subgrade.E, reliability);
}

/** Two-layer check of a granular sub-base of given thickness on the subgrade. */
function subBaseCheck(thicknessMm, subgradeMPa, reliability) {
  const nu = 0.35;
  const modulus = granularModulus(thicknessMm, subgradeMPa);
  const pts = pointsAt(thicknessMm, 1, 'construction');
  const strain = worst(
    analyze({
      layers: [
        { h: thicknessMm, E: modulus, nu },
        { h: 0, E: subgradeMPa, nu },
      ],
      load: standardLoad(STANDARD_AXLE.tyrePressureMPa),
      points: pts,
    }).map((r) => ({ ...r, role: 'construction' })),
    'construction',
    (r) => r.verticalCompressiveStrain
  );

  const repetitions = CRITERIA.constructionTraffic.minimumRepetitions;
  const rutting = subgradeRuttingLife(strain, reliability, repetitions);
  return check({
    id: 'construction-traffic',
    title: 'Sub-base under construction traffic',
    strainLabel: `Vertical strain, top of subgrade, ${thicknessMm} mm GSB alone`,
    strain,
    demandMsa: repetitions / 1e6,
    inService: false,
    ...rutting,
    ref: CRITERIA.constructionTraffic.ref,
    verified: CRITERIA.constructionTraffic.verified,
    substitution:
      `GSB modulus = 0.2 x ${thicknessMm}^0.45 x ${subgradeMPa.toFixed(0)} = ` +
      `${modulus.toFixed(0)} MPa;  ${rutting.substitution ?? ''}`,
  });
}

/**
 * Thinnest safe bituminous thickness for a fixed foundation.
 *
 * The bituminous layer is scanned rather than bisected: for thin sections the
 * tensile strain at the underside is not monotonic in thickness, so a bisection
 * can converge on the wrong side of the peak. A coarse scan brackets the answer
 * and a fine scan inside the bracket lands on the construction increment.
 *
 * Only the in-service checks steer the search. The sub-base check under
 * construction traffic does not depend on the bituminous thickness, so it is
 * reported on the result rather than searched on.
 *
 * @param {(progress:{done:number,total:number}) => void} [onProgress]
 */
export function findMinimumBituminous(input, onProgress) {
  const { combination, thicknesses, designTrafficMsa } = input;
  const described = describeCombination(combination);
  const courses = described.bituminous.courses;

  // The wearing course is held at its chosen thickness; the lower course
  // absorbs the search, since that is how a section is actually adjusted.
  const wearing = courses[0];
  const adjustable = courses.length > 1 ? courses[courses.length - 1] : courses[0];
  const wearingSlot = wearing.id;
  const adjustableSlot = adjustable.id;
  const wearingThickness =
    courses.length > 1 ? thicknesses[wearingSlot] ?? wearing.defaultMm : 0;

  // Over a CTB on heavier roads the bituminous layers have a combined minimum.
  const overCTB = MINIMUM_THICKNESS.bituminousOverCTB;
  const needsCombinedMinimum =
    described.base.behaviour === BEHAVIOUR.CEMENTED && designTrafficMsa > overCTB.aboveMsa;
  const step = THICKNESS_INCREMENTS.bituminousMm;
  const minAdjustable = Math.max(
    adjustable.minMm,
    needsCombinedMinimum ? Math.ceil((overCTB.mm - wearingThickness) / step) * step : 0
  );
  const maxAdjustable = 400;
  const coarseStep = 20;

  const withThickness = (value) =>
    courses.length > 1
      ? { ...thicknesses, [wearingSlot]: wearingThickness, [adjustableSlot]: value }
      : { ...thicknesses, [adjustableSlot]: value };

  const attempts = [];
  const tryThickness = (value) => {
    const trial = evaluateTrial({ ...input, thicknesses: withThickness(value) });
    attempts.push({ thickness: value, safe: trial.serviceSafe, governingLifeMsa: trial.governingLifeMsa });
    return trial;
  };

  let bracketLow = null;
  let bracketHigh = null;
  const coarseCount = Math.ceil((maxAdjustable - minAdjustable) / coarseStep) + 1;
  let done = 0;

  for (let t = minAdjustable; t <= maxAdjustable; t += coarseStep) {
    const trial = tryThickness(t);
    done += 1;
    onProgress?.({ done, total: coarseCount });
    if (trial.serviceSafe) {
      bracketHigh = t;
      bracketLow = Math.max(minAdjustable, t - coarseStep);
      break;
    }
  }

  if (bracketHigh == null) {
    return {
      found: false,
      attempts,
      message:
        `No safe section up to ${maxAdjustable} mm of ${adjustable.label}. ` +
        'Strengthen the foundation — base, sub-base or subgrade.',
    };
  }

  let best = bracketHigh;
  let bestTrial = null;
  for (let t = bracketLow; t <= bracketHigh; t += step) {
    const trial = tryThickness(t);
    if (trial.serviceSafe) {
      best = t;
      bestTrial = trial;
      break;
    }
  }
  if (!bestTrial) bestTrial = tryThickness(best);

  return {
    found: true,
    slotId: adjustableSlot,
    label: adjustable.label,
    thicknessMm: best,
    trial: bestTrial,
    attempts,
    thicknesses: withThickness(best),
  };
}

/**
 * Layer thicknesses for a chosen combination, worked from the bottom up:
 *
 *   1. a granular sub-base just thick enough to carry the construction
 *      traffic, and a cement treated one at its minimum;
 *   2. a cement treated base just thick enough for its own fatigue, with the
 *      bituminous layers at their minimum over it;
 *   3. the thinnest bituminous layer that passes fatigue and rutting.
 *
 * A granular base is kept at the thickness entered, not below its minimum,
 * and the wearing course likewise — those are choices, not results.
 */
export function designSection(input) {
  const { combination, materials, designTrafficMsa, roadCategory } = input;
  const described = describeCombination(combination);
  const reliability = input.reliability ?? reliabilityFor(designTrafficMsa, roadCategory);
  const atLeast = (slot, value) => Math.max(slot.minMm ?? 0, value ?? slot.defaultMm ?? 0);

  const thicknesses = {};
  for (const slot of described.slots) {
    if (slot.behaviour === BEHAVIOUR.SUBGRADE) continue;
    thicknesses[slot.slotId] = atLeast(slot, input.thicknesses?.[slot.slotId]);
  }

  // 1. Sub-base.
  const subBase = described.slots.find((s) => s.slotId === 'SUB_BASE');
  if (subBase.behaviour === BEHAVIOUR.GRANULAR) {
    const subgradeMPa = materials.overrides?.SUBGRADE ?? subgradeModulus(materials.subgradeCBR);
    const step = THICKNESS_INCREMENTS.granularMm;
    let sized = null;
    for (let t = subBase.minMm; t <= 600; t += step) {
      if (subBaseCheck(t, subgradeMPa, reliability).safe) {
        sized = t;
        break;
      }
    }
    if (sized == null) {
      return {
        found: false,
        message: 'No granular sub-base up to 600 mm carries the construction traffic. Improve the subgrade or use a CTSB.',
      };
    }
    thicknesses.SUB_BASE = sized;
  } else {
    thicknesses.SUB_BASE = subBase.minMm;
  }

  if (thicknesses.CRACK_RELIEF != null) {
    thicknesses.CRACK_RELIEF = described.slots.find((s) => s.slotId === 'CRACK_RELIEF').minMm;
  }

  // 2. Cement treated base, sized with the bituminous layers at their minimum.
  if (described.base.behaviour === BEHAVIOUR.CEMENTED) {
    const courses = described.bituminous.courses;
    const overCTB = MINIMUM_THICKNESS.bituminousOverCTB;
    // The lower course starts from its minimum: the bituminous search below
    // only ever adds to it, which can only relieve the CTB further.
    const lower = courses[courses.length - 1];
    thicknesses[lower.id] = lower.minMm;
    const bituminousMm = courses.reduce((sum, c) => sum + thicknesses[c.id], 0);
    if (designTrafficMsa > overCTB.aboveMsa && bituminousMm < overCTB.mm) {
      thicknesses[lower.id] += overCTB.mm - bituminousMm;
    }

    const step = THICKNESS_INCREMENTS.cementedMm;
    let sized = null;
    for (let t = described.base.minMm; t <= 400; t += step) {
      const trial = evaluateTrial({ ...input, reliability, thicknesses: { ...thicknesses, BASE: t } });
      if (trial.checks.find((c) => c.id === 'cemented-fatigue').safe) {
        sized = t;
        break;
      }
    }
    if (sized == null) {
      return {
        found: false,
        message: 'No cement treated base up to 400 mm passes fatigue. Check the design traffic and the CTB modulus.',
      };
    }
    thicknesses.BASE = sized;
  }

  // 3. Bituminous layers.
  return findMinimumBituminous({ ...input, reliability, thicknesses });
}
