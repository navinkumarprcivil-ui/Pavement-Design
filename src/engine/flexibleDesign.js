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
import { cumulativeDamage, ctbFatigueLife } from './ctbDamage.js';
import { subBaseConstructionTraffic, allowableCtbStress } from './construction.js';
import { buildLayerStack, granularModulus, subgradeFor } from './materials.js';
import {
  bituminousFatigueLife,
  cementedFatigueLife,
  ctbReliabilityFactor,
  reliabilityFor,
  subgradeRuttingLife,
} from './criteria.js';
import {
  CRITERIA,
  FROST,
  LONG_LIFE,
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
 * @param {object} [input.ctbDamage]  {classes, modulusOfRuptureMPa}: the axle
 *        load classes for the CTB's cumulative fatigue damage.
 * @param {boolean} [input.skipDamage]  Leave the damage sum out, for searches
 *        that cannot change it.
 * @param {object} [input.construction]  Dumper loads and trips:
 *        {rearTandemKN, frontKN, subBaseTrips, ctbTrips, ctbSevenDayMPa}.
 *        Without it the sub-base is checked at the code's floor of repetitions.
 * @param {object} [input.measured]  Strains read from IITPAVE for this section,
 *        used in place of the computed ones: {bituminous, subgrade, ctb}.
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

  // A strain read from IITPAVE stands in for the computed one.
  const measured = (key) => (input.measured?.[key] > 0 ? input.measured[key] : null);
  const sourceOf = (key) => (measured(key) != null ? 'IITPAVE' : null);

  const checks = [];

  if (lastBituminous >= 0) {
    const computed = worst(responses, 'bituminous-tension', (r) => r.maxHorizontalStrain);
    const strain = measured('bituminous') ?? computed;
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
        source: sourceOf('bituminous'),
        computed,
        title: 'Fatigue of the bituminous layer',
        strainLabel: 'Tensile strain, bottom of bituminous layer',
        strain: Math.max(strain, 0),
        demandMsa: designTrafficMsa,
        inService: true,
        ...fatigue,
      })
    );
  }

  const computedVertical = worst(responses, 'subgrade-compression', (r) => r.verticalCompressiveStrain);
  const verticalStrain = measured('subgrade') ?? computedVertical;
  checks.push(
    check({
      id: 'subgrade-rutting',
      source: sourceOf('subgrade'),
      computed: computedVertical,
      title: 'Rutting of the subgrade',
      strainLabel: 'Vertical strain, top of subgrade',
      strain: verticalStrain,
      demandMsa: designTrafficMsa,
      inService: true,
      ...subgradeRuttingLife(verticalStrain, reliability, designAxles),
    })
  );

  // A long-life pavement keeps both strains under their endurance limits (Cl. 10).
  if (input.longLife) {
    const endurance = (fields) => {
      const micro = fields.strain * 1e6;
      const safe = micro <= fields.limitMicro;
      return {
        ...fields,
        kind: 'endurance',
        strain: Math.max(fields.strain, 0),
        strainMicro: Math.max(micro, 0),
        allowableStrain: fields.limitMicro * 1e-6,
        allowableMicro: fields.limitMicro,
        demandMsa: designTrafficMsa,
        allowableMsa: Infinity,
        utilisation: micro / fields.limitMicro,
        safe,
        inService: true,
        formula: `${fields.symbol} not more than ${fields.limitMicro} µε`,
        substitution: `${fields.symbol} = ${micro.toFixed(1)} µε`,
        stepResult: `${micro.toFixed(1)} µε ${safe ? '≤' : '>'} ${fields.limitMicro} µε`,
        ref: LONG_LIFE.ref,
        verified: LONG_LIFE.verified,
      };
    };
    if (lastBituminous >= 0) {
      const computed = worst(responses, 'bituminous-tension', (r) => r.maxHorizontalStrain);
      checks.push(
        endurance({
          id: 'long-life-bituminous',
          title: 'Long life, bituminous layer',
          strainLabel: 'Tensile strain, bottom of bituminous layer, endurance limit',
          symbol: 'εt',
          strain: measured('bituminous') ?? computed,
          computed,
          source: sourceOf('bituminous'),
          limitMicro: materials.snowBound ? LONG_LIFE.bituminousMicro.other : LONG_LIFE.bituminousMicro.plains,
        })
      );
    }
    checks.push(
      endurance({
        id: 'long-life-subgrade',
        title: 'Long life, subgrade',
        strainLabel: 'Vertical strain, top of subgrade, endurance limit',
        symbol: 'εv',
        strain: verticalStrain,
        computed: computedVertical,
        source: sourceOf('subgrade'),
        limitMicro: LONG_LIFE.subgradeMicro,
      })
    );
  }

  if (ctbIndex >= 0) {
    const computed = worst(responses, 'cemented-tension', (r) => r.maxHorizontalStrain);
    const strain = measured('ctb') ?? computed;
    const reliabilityFactor = ctbReliabilityFactor(designTrafficMsa, roadCategory);
    checks.push(
      check({
        id: 'cemented-fatigue',
        source: sourceOf('ctb'),
        computed,
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

  const spectrum = input.ctbDamage;
  const damageReady = ctbIndex >= 0 && spectrum?.classes?.length > 0 && spectrum.modulusOfRuptureMPa > 0;
  if (damageReady && !input.skipDamage) {
    checks.push(
      damageCheck(
        cumulativeDamage({
          layers: elasticLayers,
          ctbIndex,
          depthMm: depths[ctbIndex],
          modulusOfRuptureMPa: spectrum.modulusOfRuptureMPa,
          classes: spectrum.classes,
          stresses: spectrum.stresses,
        }),
        designTrafficMsa
      )
    );
  }

  const construction = constructionTrafficCheck(layers, reliability, input.construction, measured('construction'));
  if (construction) checks.push(construction);
  const ctbConstruction = ctbConstructionCheck(layers, ctbIndex, input.construction, measured('ctbConstruction'));
  if (ctbConstruction) checks.push(ctbConstruction);

  const inServiceChecks = checks.filter((c) => c.inService);
  const governingLifeMsa = Math.min(...inServiceChecks.map((c) => c.allowableMsa));
  const totalThicknessMm = slots.reduce((sum, s) => sum + (s.thicknessMm || 0), 0);
  const bituminousMm = slots
    .filter((s) => s.behaviour === BEHAVIOUR.BITUMINOUS)
    .reduce((sum, s) => sum + s.thicknessMm, 0);

  const thicknessWarnings = slots
    .filter((s) => s.minMm != null && s.thicknessMm < s.minMm)
    .map((s) => `${s.label}: ${s.thicknessMm} mm, below the ${s.minMm} mm minimum`);

  if (materials.snowBound && totalThicknessMm < FROST.minimumTotalMm) {
    thicknessWarnings.push(`Frost: total ${totalThicknessMm} mm, below the ${FROST.minimumTotalMm} mm minimum · ${FROST.ref.clause}`);
  }

  const overCTB = MINIMUM_THICKNESS.bituminousOverCTB;
  if (ctbIndex >= 0 && designTrafficMsa > overCTB.aboveMsa && bituminousMm < overCTB.mm) {
    thicknessWarnings.push(
      `Bituminous layers over a CTB: ${bituminousMm} mm, below the ${overCTB.mm} mm minimum above ${overCTB.aboveMsa} msa`
    );
  }

  const notChecked =
    ctbIndex >= 0 && !damageReady
      ? [{ title: 'Cumulative fatigue damage of the CTB, no axle load spectrum', ref: CRITERIA.cementedDamage.ref }]
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

/** The damage sum as a check, with the life it leaves in msa for comparison. */
function damageCheck(damage, designTrafficMsa) {
  const fixed = (value) => value.toFixed(3);
  return {
    id: 'cemented-damage',
    kind: 'damage',
    title: 'Cumulative fatigue damage of the CTB',
    strainLabel: `Σ ni/Nfi over ${damage.rows.length} axle load classes at ${CRITERIA.cementedDamage.tyrePressureMPa.toFixed(2)} MPa`,
    damage: damage.total,
    allowableDamage: CRITERIA.cementedDamage.allowableDamage,
    demandMsa: designTrafficMsa,
    // The same traffic mix could grow until the damage reached 1.
    allowableMsa: damage.total > 0 ? designTrafficMsa / damage.total : Infinity,
    utilisation: damage.total,
    safe: damage.safe,
    inService: true,
    formula: damage.formula,
    substitution:
      `CFD = ${fixed(damage.byAxle.single)} (single) + ${fixed(damage.byAxle.tandem)} (tandem) + ` +
      `${fixed(damage.byAxle.tridem)} (tridem),  MRup = ${damage.modulusOfRuptureMPa.toFixed(2)} MPa`,
    stepResult: `CFD = ${fixed(damage.total)} ${damage.safe ? '≤' : '>'} ${CRITERIA.cementedDamage.allowableDamage}`,
    ref: damage.ref,
    verified: damage.verified,
    rows: damage.rows,
    byAxle: damage.byAxle,
    modulusOfRuptureMPa: damage.modulusOfRuptureMPa,
  };
}

/**
 * The granular sub-base carries loaded tippers before anything is laid on it.
 * It is checked as a two-layer system on the subgrade for subgrade rutting
 * under the dumper traffic, or the code's floor of repetitions if that is more.
 */
function constructionTrafficCheck(layers, reliability, construction, measuredStrain) {
  const subBase = layers.find((l) => l.slotId === 'SUB_BASE');
  if (!subBase || subBase.behaviour !== BEHAVIOUR.GRANULAR || !(subBase.thicknessMm > 0)) {
    return null;
  }
  const subgrade = layers[layers.length - 1];
  return subBaseCheck(subBase.thicknessMm, subgrade.E, reliability, construction, measuredStrain);
}

/** Two-layer check of a granular sub-base of given thickness on the subgrade. */
function subBaseCheck(thicknessMm, subgradeMPa, reliability, construction, measuredStrain) {
  const nu = 0.35;
  const modulus = granularModulus(thicknessMm, subgradeMPa);
  const pts = pointsAt(thicknessMm, 1, 'construction');
  const computedStrain = worst(
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

  const strain = measuredStrain ?? computedStrain;
  const traffic = construction ? subBaseConstructionTraffic(construction) : null;
  const repetitions = traffic ? traffic.repetitions : CRITERIA.constructionTraffic.minimumRepetitions;
  const rutting = subgradeRuttingLife(strain, reliability, repetitions);
  return check({
    source: measuredStrain != null ? 'IITPAVE' : null,
    computed: computedStrain,
    preSteps: traffic ? [traffic.step] : [],
    analysis: {
      layers: [
        { label: 'Granular sub-base', h: thicknessMm, E: modulus, nu },
        { label: 'Subgrade', h: null, E: subgradeMPa, nu },
      ],
      wheelLoadN: STANDARD_AXLE.wheelLoadN,
      tyrePressureMPa: STANDARD_AXLE.tyrePressureMPa,
      dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
      points: OFFSETS.map((o) => ({ z: thicknessMm, r: o.x })),
    },
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
 * A freshly laid CTB carries the dumpers bringing the layer above it, before
 * that layer can spread their load and before the CTB has its full strength.
 * The CTB, the layers under it and the subgrade are analysed under the rear
 * tandem taken as two single axles, at the CTB contact stress, and the stress
 * at its underside is held to what Eq. 3.6 allows for those passes at the
 * 7-day flexural strength.
 */
function ctbConstructionCheck(layers, ctbIndex, construction, measuredStress) {
  if (ctbIndex < 0 || !construction) return null;
  const { rearTandemKN, ctbTrips, ctbSevenDayMPa } = construction;
  if (!(ctbTrips > 0) || !(rearTandemKN > 0) || !(ctbSevenDayMPa > 0)) return null;

  const spec = CRITERIA.ctbConstruction;
  const stage = layers.slice(ctbIndex);
  const ctb = stage[0];
  const singleKN = rearTandemKN / 2;
  const passes = ctbTrips * 2;
  const pressure = CRITERIA.cementedDamage.tyrePressureMPa;

  const computedStress = Math.max(
    0,
    ...analyze({
      layers: stage.map((l) => ({ h: l.thicknessMm, E: l.E, nu: l.nu })),
      load: { wheelLoadN: (singleKN * 1000) / 4, tyrePressureMPa: pressure, dualSpacingMm: STANDARD_AXLE.dualSpacingMm },
      points: OFFSETS.map((o) => ({ x: o.x, y: 0, z: ctb.thicknessMm, layerIndex: 0 })),
    }).map((r) => Math.max(r.sigmaXX, r.sigmaYY))
  );
  const stress = measuredStress ?? computedStress;
  const allowable = allowableCtbStress(passes, ctbSevenDayMPa);
  const life = ctbFatigueLife(stress / ctbSevenDayMPa);
  const safe = stress <= allowable;
  const below = stage.slice(1, -1).map((l) => l.label.match(/\(([^)]+)\)$/)?.[1] ?? l.label).join(', ');

  return {
    id: 'ctb-construction',
    kind: 'stress',
    source: measuredStress != null ? 'IITPAVE' : null,
    computed: computedStress,
    singleKN,
    analysis: {
      layers: stage.map((l, i) => ({ label: l.label, h: i === stage.length - 1 ? null : l.thicknessMm, E: l.E, nu: l.nu })),
      wheelLoadN: (singleKN * 1000) / 4,
      tyrePressureMPa: pressure,
      dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
      points: OFFSETS.map((o) => ({ z: ctb.thicknessMm, r: o.x })),
    },
    title: 'CTB under construction traffic',
    strainLabel: `Tensile stress, bottom of CTB, ${singleKN} kN axle on the CTB${below ? `, ${below}` : ''} and subgrade`,
    stress,
    allowableStress: allowable,
    demandMsa: passes / 1e6,
    allowableMsa: life / 1e6,
    utilisation: stress / allowable,
    safe,
    inService: false,
    formula: 'σ allowable = MR(7 day) x (0.972 - 0.0825 x log10 n),  n = 2 x dumper trips',
    substitution:
      `σ allowable = ${ctbSevenDayMPa.toFixed(2)} x (0.972 - 0.0825 x log10 ${passes}) = ${allowable.toFixed(3)} MPa;  ` +
      `σt under a ${singleKN} kN axle at ${pressure.toFixed(2)} MPa = ${stress.toFixed(3)} MPa`,
    stepResult: `σt = ${stress.toFixed(3)} MPa ${safe ? '≤' : '>'} ${allowable.toFixed(3)} MPa`,
    ref: spec.ref,
    verified: spec.verified,
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
  // More bituminous cover only relieves the CTB, so the damage sum, the
  // costliest part of a trial, is left to the final section.
  const tryThickness = (value) => {
    const trial = evaluateTrial({ ...input, skipDamage: true, thicknesses: withThickness(value) });
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
  for (let t = bracketLow; t <= bracketHigh; t += step) {
    if (tryThickness(t).serviceSafe) {
      best = t;
      break;
    }
  }
  const bestTrial = evaluateTrial({ ...input, thicknesses: withThickness(best) });

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
 *   2. a cement treated base just thick enough for its own fatigue,
 *      cumulative damage and construction traffic, with the
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
    const subgradeMPa = subgradeFor(materials).value;
    const step = THICKNESS_INCREMENTS.granularMm;
    let sized = null;
    for (let t = subBase.minMm; t <= 600; t += step) {
      if (subBaseCheck(t, subgradeMPa, reliability, input.construction).safe) {
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
      const ctbChecks = trial.checks.filter((c) =>
        ['cemented-fatigue', 'cemented-damage', 'ctb-construction'].includes(c.id)
      );
      if (ctbChecks.every((c) => c.safe)) {
        sized = t;
        break;
      }
    }
    if (sized == null) {
      return {
        found: false,
        message: 'No cement treated base up to 400 mm passes fatigue, cumulative damage and construction traffic. Check the design traffic, the axle loads and the CTB strength.',
      };
    }
    thicknesses.BASE = sized;
  }

  // 3. Bituminous layers.
  const found = findMinimumBituminous({ ...input, reliability, thicknesses });

  // 4. Where frost acts, the sub-base makes the section up to 450 mm (Cl. 13.2).
  if (found.found && materials.snowBound) {
    const total = Object.values(found.thicknesses).reduce((sum, mm) => sum + (mm || 0), 0);
    if (total < FROST.minimumTotalMm) {
      const step = THICKNESS_INCREMENTS.granularMm;
      const add = Math.ceil((FROST.minimumTotalMm - total) / step) * step;
      found.thicknesses = { ...found.thicknesses, SUB_BASE: found.thicknesses.SUB_BASE + add };
      found.trial = evaluateTrial({ ...input, reliability, thicknesses: found.thicknesses });
    }
  }
  return found;
}
