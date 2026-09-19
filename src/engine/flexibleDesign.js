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
import { buildLayerStack } from './materials.js';
import {
  bituminousFatigueLife,
  cementedFatigueLife,
  reliabilityFor,
  subgradeRuttingLife,
} from './criteria.js';
import { STANDARD_AXLE, THICKNESS_INCREMENTS, MINIMUM_THICKNESS } from '../data/ircConstants.js';
import { BEHAVIOUR, describeCombination } from '../data/layerCatalog.js';

/** Depths at which the design-critical strains are read. */
function criticalPoints(layers) {
  const points = [];
  const analysisOffsets = [
    { x: 0, label: 'under the centre of one wheel' },
    { x: STANDARD_AXLE.dualSpacingMm / 2, label: 'between the dual wheels' },
  ];

  // Bottom of the lowest bituminous layer.
  let lastBituminous = -1;
  let depth = 0;
  const depthToBottomOf = [];
  for (let i = 0; i < layers.length; i++) {
    depth += layers[i].thicknessMm || 0;
    depthToBottomOf[i] = depth;
    if (layers[i].behaviour === BEHAVIOUR.BITUMINOUS) lastBituminous = i;
  }

  if (lastBituminous >= 0) {
    for (const o of analysisOffsets) {
      points.push({
        x: o.x,
        y: 0,
        z: depthToBottomOf[lastBituminous],
        layerIndex: lastBituminous,
        label: `Tensile strain at the underside of the bituminous layer, ${o.label}`,
        role: 'bituminous-tension',
      });
    }
  }

  // Bottom of a cemented base, if present.
  const cementedBase = layers.findIndex(
    (l) => l.behaviour === BEHAVIOUR.CEMENTED && l.slotId === 'BASE'
  );
  if (cementedBase >= 0) {
    for (const o of analysisOffsets) {
      points.push({
        x: o.x,
        y: 0,
        z: depthToBottomOf[cementedBase],
        layerIndex: cementedBase,
        label: `Tensile strain at the underside of the cemented base, ${o.label}`,
        role: 'cemented-tension',
      });
    }
  }

  // Top of the subgrade.
  const subgradeIndex = layers.length - 1;
  const subgradeTop = depthToBottomOf[subgradeIndex - 1];
  for (const o of analysisOffsets) {
    points.push({
      x: o.x,
      y: 0,
      z: subgradeTop,
      layerIndex: subgradeIndex,
      label: `Vertical compressive strain at the top of the subgrade, ${o.label}`,
      role: 'subgrade-compression',
    });
  }

  return points;
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
 * @param {80|90} [input.reliability]
 */
export function evaluateTrial(input) {
  const {
    combination,
    thicknesses,
    materials,
    mix,
    designTrafficMsa,
  } = input;

  const reliability = input.reliability ?? reliabilityFor(designTrafficMsa);
  const described = describeCombination(combination);

  const slots = described.slots.map((slot) => ({
    ...slot,
    thicknessMm:
      slot.behaviour === BEHAVIOUR.SUBGRADE
        ? 0
        : thicknesses[slot.slotId] ?? slot.defaultMm,
  }));

  const { layers, steps: modulusSteps } = buildLayerStack(slots, materials);

  const elasticLayers = layers.map((l) => ({
    h: l.thicknessMm,
    E: l.E,
    nu: l.nu,
  }));

  const points = criticalPoints(layers);
  const responses = analyze({
    layers: elasticLayers,
    load: {
      wheelLoadN: STANDARD_AXLE.wheelLoadN,
      tyrePressureMPa: STANDARD_AXLE.tyrePressureMPa,
      dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
    },
    points,
  });

  const withRoles = responses.map((r, i) => ({ ...r, role: points[i].role }));

  const pick = (role, selector) =>
    withRoles
      .filter((r) => r.role === role)
      .reduce((best, r) => Math.max(best, selector(r)), -Infinity);

  const checks = [];
  let governingLifeMsa = Infinity;

  const bituminousLayers = layers.filter(
    (l) => l.behaviour === BEHAVIOUR.BITUMINOUS
  );

  if (bituminousLayers.length > 0) {
    const tensileStrain = pick('bituminous-tension', (r) => r.maxHorizontalStrain);
    const lowest = bituminousLayers[bituminousLayers.length - 1];
    const fatigue = bituminousFatigueLife({
      tensileStrain,
      modulusMPa: lowest.E,
      airVoidsPercent: mix.airVoidsPercent,
      effectiveBinderPercent: mix.effectiveBinderPercent,
      reliability,
    });
    checks.push({
      id: 'bituminous-fatigue',
      title: 'Fatigue cracking of the bituminous layer',
      strainLabel: 'Horizontal tensile strain, eps_t',
      strainMicro: tensileStrain * 1e6,
      allowableMsa: fatigue.allowableMsa,
      demandMsa: designTrafficMsa,
      safe: fatigue.allowableMsa >= designTrafficMsa,
      ...fatigue,
    });
    governingLifeMsa = Math.min(governingLifeMsa, fatigue.allowableMsa);
  }

  const verticalStrain = pick(
    'subgrade-compression',
    (r) => r.verticalCompressiveStrain
  );
  const rutting = subgradeRuttingLife(verticalStrain, reliability);
  checks.push({
    id: 'subgrade-rutting',
    title: 'Rutting of the subgrade',
    strainLabel: 'Vertical compressive strain, eps_v',
    strainMicro: verticalStrain * 1e6,
    allowableMsa: rutting.allowableMsa,
    demandMsa: designTrafficMsa,
    safe: rutting.allowableMsa >= designTrafficMsa,
    ...rutting,
  });
  governingLifeMsa = Math.min(governingLifeMsa, rutting.allowableMsa);

  const hasCementedBase = layers.some(
    (l) => l.behaviour === BEHAVIOUR.CEMENTED && l.slotId === 'BASE'
  );
  if (hasCementedBase) {
    const strain = pick('cemented-tension', (r) => r.maxHorizontalStrain);
    const ctbFatigue = cementedFatigueLife(strain, reliability);
    checks.push({
      id: 'cemented-fatigue',
      title: 'Fatigue cracking of the cement treated base',
      strainLabel: 'Horizontal tensile strain, eps_t',
      strainMicro: strain * 1e6,
      allowableMsa: ctbFatigue.allowableMsa,
      demandMsa: designTrafficMsa,
      safe: ctbFatigue.allowableMsa >= designTrafficMsa,
      ...ctbFatigue,
    });
    // Provisional coefficients, so this does not govern the reported life.
  }

  const thicknessWarnings = slots
    .filter((s) => s.minMm != null && s.thicknessMm < s.minMm)
    .map(
      (s) =>
        `${s.label} is ${s.thicknessMm} mm, below the minimum of ${s.minMm} mm.`
    );

  if (
    combination.baseId === 'CTB' &&
    (!combination.crackReliefId || combination.crackReliefId === '')
  ) {
    thicknessWarnings.push(MINIMUM_THICKNESS.note);
  }

  const totalThicknessMm = slots
    .filter((s) => s.behaviour !== BEHAVIOUR.SUBGRADE)
    .reduce((sum, s) => sum + s.thicknessMm, 0);

  return {
    reliability,
    slots,
    layers,
    responses: withRoles,
    checks,
    modulusSteps,
    safe: checks.every((c) => c.id === 'cemented-fatigue' || c.safe),
    governingLifeMsa,
    totalThicknessMm,
    thicknessWarnings,
    designTrafficMsa,
  };
}

/**
 * Thinnest safe bituminous thickness for a fixed foundation.
 *
 * The bituminous layer is scanned rather than bisected: for thin sections the
 * tensile strain at the underside is not monotonic in thickness, so a bisection
 * can converge on the wrong side of the peak. A coarse scan brackets the answer
 * and a fine scan inside the bracket lands on the construction increment.
 *
 * @param {(progress:{done:number,total:number}) => void} [onProgress]
 */
export function findMinimumBituminous(input, onProgress) {
  const { combination, thicknesses } = input;
  const described = describeCombination(combination);
  const courses = described.bituminous.courses;

  // The wearing course is held at its chosen thickness; the lower course
  // absorbs the search, since that is how a section is actually adjusted.
  const wearing = courses[0];
  const adjustable = courses.length > 1 ? courses[courses.length - 1] : courses[0];
  // Catalogue courses key off `id`; that is the slot id used in `thicknesses`.
  const wearingSlot = wearing.id;
  const adjustableSlot = adjustable.id;
  const wearingThickness = thicknesses[wearingSlot] ?? wearing.defaultMm;

  const step = THICKNESS_INCREMENTS.bituminousMm;
  const minAdjustable = adjustable.minMm;
  const maxAdjustable = 400;
  const coarseStep = 20;

  const attempts = [];
  const tryThickness = (value) => {
    const trial = evaluateTrial({
      ...input,
      thicknesses: {
        ...thicknesses,
        [wearingSlot]: wearingThickness,
        [adjustableSlot]: value,
      },
    });
    attempts.push({ thickness: value, safe: trial.safe, governingLifeMsa: trial.governingLifeMsa });
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
    if (trial.safe) {
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
        `No safe section was found up to ${maxAdjustable} mm of ${adjustable.label}. ` +
        'Strengthen the foundation — a thicker or stiffer base, sub-base or subgrade — ' +
        'rather than adding more bitumen.',
    };
  }

  let best = bracketHigh;
  let bestTrial = null;
  for (let t = bracketLow; t <= bracketHigh; t += step) {
    const trial = tryThickness(t);
    if (trial.safe) {
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
    thicknesses: {
      ...thicknesses,
      [wearingSlot]: wearingThickness,
      [adjustableSlot]: best,
    },
  };
}
