/**
 * Everything the rigid screens derive from the rigid inputs, in one place, so
 * a screen never depends on another having been visited first.
 */

import { RIGID, ref } from '../data/ircConstants.js';
import { rigidTraffic, foundationK, evaluateSlab, designSlab, dowelBars } from '../engine/rigidDesign.js';
import { bondedSlab, equivalentSlab, bondedSteps, tieBars } from '../engine/rigidDetails.js';
import { drainageLayer, drainageMaterial } from '../engine/drainage.js';
import { AXLES, defaultSpectrum, frontAxlePercent, spectrumTotal } from './spectrum.js';

export { AXLES, frontAxlePercent, spectrumTotal, parseSpectrum } from './spectrum.js';

export const SUB_BASES = [
  { value: 'dlc', label: 'DLC', materialId: 'DLC', behaviour: 'cemented', name: 'Dry lean concrete' },
  { value: 'cementTreated', label: 'CTSB', materialId: 'CTSB', behaviour: 'cemented', name: 'Cement treated sub-base' },
  { value: 'granular', label: 'GSB', materialId: 'GSB', behaviour: 'granular', name: 'Granular sub-base' },
];

export const SHOULDERS = [
  { value: 'tied', label: 'Tied concrete' },
  { value: 'widened', label: 'Widened lane' },
  { value: 'none', label: 'None' },
];

export const defaultRigidState = () => ({
  traffic: {
    twoWayCVPD: 3000,
    growthRatePercent: 5,
    yearsToCompletion: 2,
    designPeriodYears: 30,
    carriageway: 'divided',
    directionalSplitPercent: 50,
    nightSharePercent: 50,
    shortWheelBasePercent: RIGID.traffic.defaultShortWheelBaseShare * 100,
    axlesPerVehicle: 2.35,
    axleMix: { single: 15, tandem: 25, tridem: 15 },
  },
  spectrum: defaultSpectrum(),
  foundation: {
    subgradeCBR: 8,
    subBase: 'dlc',
    subBaseMm: 150,
    gsbMm: 150,
    kSource: 'tables',
    measuredK: null,
    /** PQC laid straight on the DLC and bonded to it (Cl. 6.7), in place of a debonding layer. */
    bonded: false,
    dlc7DayMPa: RIGID.bonded.minimumDlcSevenDayMPa,
    dlc28DayMPa: RIGID.bonded.dlc28DayMPa,
  },
  slab: {
    shoulder: 'tied',
    doweled: true,
    flexural28MPa: RIGID.concrete.minimumFlexural28MPa,
    ninetyDay: true,
    E: RIGID.concrete.elasticModulusMPa,
    mu: RIGID.concrete.poissonRatio,
    thicknessMm: 300,
    retexture: true,
    tieBarType: 'deformed',
    tieBarDiameterMm: 12,
    laneWidthM: RIGID.tieBars.laneWidthM,
    jointSpacingM: RIGID.joints.maximumSpacingM,
  },
  temperature: { mode: 'zone', zone: 'III', dayC: 16.8 },
  /** Drainage layer below the sub-base (Cl. 6.5); a granular sub-base is itself the layer. */
  drainage: {
    provided: false,
    rainfallMm: null,
    layerMm: 150,
    pavementM: null,
    concreteShoulderM: null,
    unpavedShoulderM: null,
    longitudinalJoints: null,
    gradePercent: null,
    crossFallPercent: null,
    sideSlope: null,
    permeability: null,
    d10Mm: null,
    d60Mm: null,
    abrasionPercent: null,
    stabiliser: 'none',
    stabiliserPercent: null,
  },
});

/** Fill a saved rigid state up to the current shape. */
export function migrateRigid(saved) {
  const defaults = defaultRigidState();
  if (!saved || !saved.traffic || !saved.spectrum) return defaults;
  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) merged[key] = { ...defaults[key], ...(saved[key] || {}) };
  merged.traffic.axleMix = { ...defaults.traffic.axleMix, ...(saved.traffic.axleMix || {}) };
  return merged;
}

export function subBaseOption(value) {
  return SUB_BASES.find((o) => o.value === value) || SUB_BASES[0];
}

export function rigidTrafficFor(rigid) {
  return rigidTraffic(rigid.traffic);
}

/** Whether the PQC is bonded to a DLC layer (Cl. 6.7). */
export const isBonded = (rigid) => rigid.foundation.subBase === 'dlc' && rigid.foundation.bonded === true;

/** Whether a drainage layer is designed (Cl. 6.5). */
export const hasDrainage = (rigid) => rigid.drainage?.provided === true;

/** A DLC or cement treated sub-base, with granular layers below it. */
const boundSubBase = (rigid) => rigid.foundation.subBase !== 'granular';

/** Granular layers under a DLC: the drainage layer, when designed, and the GSB below it. */
export function granularBelowMm(rigid) {
  const f = rigid.foundation;
  return f.gsbMm + (hasDrainage(rigid) && boundSubBase(rigid) ? rigid.drainage.layerMm || 0 : 0);
}

export function rigidFoundation(rigid) {
  const f = rigid.foundation;
  const bonded = isBonded(rigid);
  const warnings = [];
  if (bonded) {
    const b = RIGID.bonded;
    if (!(f.dlc7DayMPa >= b.minimumDlcSevenDayMPa)) {
      warnings.push(`DLC for a bonded slab needs a 7-day strength of ${b.minimumDlcSevenDayMPa} MPa or more · Cl. 6.7.1`);
    }
    const granular = granularBelowMm(rigid);
    if (!(granular >= b.granularMm.min && granular <= b.granularMm.max)) {
      warnings.push(`Granular layers of ${b.granularMm.min} – ${b.granularMm.max} mm below the DLC, ${granular} mm given · Cl. 6.7.2`);
    }
  }
  if (f.kSource === 'measured') {
    return { subgradeK: null, k: f.measuredK, warnings };
  }
  // A bonded slab is designed on the granular layer below the DLC (Cl. 6.7.2, Table 3).
  const result = bonded ? foundationK({ ...f, subBase: 'granular', subBaseMm: granularBelowMm(rigid) }) : foundationK(f);
  result.warnings.push(...warnings);
  if (f.subgradeCBR < RIGID.subgradeK.minimumCBR) {
    result.warnings.push(`Select subgrade CBR below the ${RIGID.subgradeK.minimumCBR}% minimum`);
  }
  if (f.subBase === 'dlc' && f.subBaseMm < RIGID.dlcK.minimumThicknessMm) {
    result.warnings.push(`DLC below the ${RIGID.dlcK.minimumThicknessMm} mm minimum for major highways`);
  }
  return result;
}

/** The inputs evaluateSlab and designSlab take. */
function slabInput(rigid, traffic, foundation) {
  return {
    kMPaPerM: foundation.k,
    traffic,
    spectrum: rigid.spectrum,
    slab: rigid.slab,
    temperature: rigid.temperature,
  };
}

/** Warnings that do not depend on the slab thickness. */
function inputWarnings(rigid, traffic) {
  const warnings = [...traffic.warnings];
  const { slab, spectrum, traffic: t } = rigid;
  if (slab.flexural28MPa < RIGID.concrete.minimumFlexural28MPa) {
    warnings.push(`28-day flexural strength below ${RIGID.concrete.minimumFlexural28MPa} MPa`);
  }
  if (!slab.doweled && traffic.openingCVPD > RIGID.scope.minimumCVPD) {
    warnings.push(`Dowel bars are required above ${RIGID.scope.minimumCVPD} CVPD`);
  }
  const joints = RIGID.joints;
  if (slab.jointSpacingM > joints.maximumSpacingM) {
    warnings.push(`Contraction joints no further apart than ${joints.maximumSpacingM} m · Cl. 7.1.3`);
  }
  if (slab.laneWidthM > joints.maximumSlabWidthM) {
    warnings.push(`A slab wider than ${joints.maximumSlabWidthM} m needs a longitudinal joint · Cl. 7.1.6`);
  }
  const d = rigid.drainage;
  if (!hasDrainage(rigid) && d?.rainfallMm > RIGID.drainage.rainfallMm) {
    warnings.push(`Annual rainfall over ${RIGID.drainage.rainfallMm} mm: design a drainage layer · Cl. 6.5.2`);
  }
  if (frontAxlePercent(t.axleMix) < 0) warnings.push('Axle mix adds up to more than 100%');
  for (const axle of AXLES) {
    if ((t.axleMix[axle.id] || 0) > 0 && Math.abs(spectrumTotal(spectrum[axle.id]) - 100) > 0.5) {
      warnings.push(`${axle.label} spectrum adds up to ${spectrumTotal(spectrum[axle.id]).toFixed(1)}%, not 100%`);
    }
  }
  return warnings;
}

/** What a drainage layer is costed as. */
export const DRAINAGE_MATERIAL = 'Drainage layer';

/** The section as laid, top down, for drawing and costing. */
export function rigidSlots(rigid, slabMm) {
  const f = rigid.foundation;
  const sub = subBaseOption(f.subBase);
  const drains = hasDrainage(rigid);
  const slots = [
    { slotId: 'PQC', materialId: 'PQC', label: 'PQC', thicknessMm: slabMm, behaviour: 'concrete' },
    sub.value === 'granular' && drains
      ? { slotId: 'SUB_BASE', materialId: DRAINAGE_MATERIAL, label: 'GSB, drainage', thicknessMm: f.subBaseMm, behaviour: 'granular' }
      : { slotId: 'SUB_BASE', materialId: sub.materialId, label: isBonded(rigid) ? `${sub.label}, bonded` : sub.label, thicknessMm: f.subBaseMm, behaviour: sub.behaviour },
  ];
  if (sub.value !== 'granular' && drains) {
    slots.push({ slotId: 'DRAIN', materialId: DRAINAGE_MATERIAL, label: 'Drainage layer', thicknessMm: rigid.drainage.layerMm, behaviour: 'granular' });
  }
  if (sub.value !== 'granular' && f.gsbMm > 0) {
    slots.push({ slotId: 'GSB', materialId: 'GSB', label: drains ? 'GSB, separation' : 'GSB', thicknessMm: f.gsbMm, behaviour: 'granular' });
  }
  slots.push({ slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' });
  return slots;
}

export function rigidName(rigid) {
  const sub = subBaseOption(rigid.foundation.subBase);
  const shoulder = { tied: 'tied shoulders', widened: 'widened lane', none: 'no shoulders' }[rigid.slab.shoulder];
  return `PQC ${isBonded(rigid) ? 'bonded to' : '/'} ${sub.label} · ${shoulder}${rigid.slab.doweled ? '' : ' · no dowels'}`;
}

const fmt = (n, digits = 0) => n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const million = (n) => `${(n / 1e6).toFixed(2)} million`;

/** The working behind a result, as steps with their citations. */
function workingSteps(rigid, traffic, foundation, evaluation) {
  const t = rigid.traffic;
  const steps = [
    {
      title: 'Commercial vehicles over the design period',
      formula: 'C = 365 A [(1 + r)^n − 1] / r',
      substitution: `A = ${fmt(traffic.openingCVPD)} CVPD, r = ${traffic.growthRatePercent / 100}, n = ${t.designPeriodYears}`,
      result: `C = ${million(traffic.vehicles)} vehicles`,
      ref: ref('IRC58', 'Cl. 5.5.2.7', { equation: 'Eq. 1', page: 6 }),
    },
    {
      title: 'Axles in the design lane',
      formula: t.carriageway === 'divided' ? 'C × axles per vehicle × directional share × 0.25' : 'C × axles per vehicle × 0.25',
      substitution:
        `${million(traffic.vehicles)} × ${t.axlesPerVehicle}` +
        (t.carriageway === 'divided' ? ` × ${t.directionalSplitPercent / 100}` : '') +
        ' × 0.25',
      result: `${million(traffic.laneAxles)} axles`,
      ref: ref('IRC58', 'Cl. 5.5.2.3', { page: 5 }),
    },
    {
      title: 'Six-hour design repetitions',
      formula: 'Day: axles × (1 − night share) / 2 · Night: axles × night share / 2 × short wheel base share',
      substitution: `Night ${t.nightSharePercent}%, wheel base under joint spacing ${t.shortWheelBasePercent}%`,
      result: `Bottom-up ${million(traffic.bottomUp)} · top-down ${million(traffic.topDown)}`,
      ref: ref('IRC58', 'Cl. 5.5.2.4 / 6.3.3', { page: '5, 18' }),
    },
  ];

  if (foundation.subgradeK != null) {
    const f = rigid.foundation;
    steps.push({
      title: 'Foundation k',
      formula: 'Subgrade k from CBR, then effective k over the sub-base',
      substitution: `CBR ${f.subgradeCBR}% → ${fmt(foundation.subgradeK, 1)} MPa/m; ${f.subBaseMm} mm ${subBaseOption(f.subBase).label}`,
      result: `k = ${fmt(foundation.k, 1)} MPa/m`,
      ref: ref('IRC58', 'Cl. 5.7.3.4 / 5.7.4.4', {
        table: f.subBase === 'dlc' ? 'Table 2 / Table 4' : 'Table 2 / Table 3',
        page: '9, 11, 12',
      }),
    });
  }

  steps.push(
    {
      title: 'Design flexural strength',
      formula: rigid.slab.ninetyDay ? 'Fcr(90) = 1.1 × Fcr(28)' : 'Fcr(28)',
      substitution: rigid.slab.ninetyDay ? `1.1 × ${rigid.slab.flexural28MPa}` : null,
      result: `${evaluation.flexuralMPa.toFixed(2)} MPa`,
      ref: ref('IRC58', 'Cl. 5.8.2', { page: '12, 13' }),
    },
    {
      title: 'Temperature differentials',
      formula: 'Night = day / 2 + 5 °C built-in curl',
      substitution:
        rigid.temperature.mode === 'zone'
          ? `Zone ${rigid.temperature.zone}, ${Math.round(evaluation.thicknessMm)} mm slab: ${evaluation.dayC} °C by day`
          : `Site value ${evaluation.dayC} °C by day`,
      result: `Day ${evaluation.dayC} °C · night ${evaluation.nightC.toFixed(1)} °C`,
      ref: ref('IRC58', 'Cl. 5.6.1.1 / 5.6.2.3', { table: 'Table 1', page: '6 – 8' }),
    },
    {
      title: 'Radius of relative stiffness',
      formula: 'l = [E h³ / 12 k (1 − µ²)]^0.25',
      substitution: `E = ${fmt(rigid.slab.E)} MPa, h = ${+(evaluation.thicknessMm / 1000).toFixed(4)} m, k = ${fmt(foundation.k, 1)} MPa/m, µ = ${rigid.slab.mu}`,
      result: `l = ${evaluation.radiusOfRelativeStiffnessM.toFixed(3)} m`,
      ref: ref('IRC58', 'Appendix-V', { page: '73 – 75' }),
    }
  );
  return steps;
}

/** Drainage inputs, each with what to ask for and whether zero is allowed. */
const DRAINAGE_INPUTS = [
  ['pavementM', 'carriageway width draining one way', false],
  ['concreteShoulderM', 'concrete shoulder width', true],
  ['unpavedShoulderM', 'earthen shoulder width', true],
  ['longitudinalJoints', 'number of longitudinal joints and edges', false],
  ['gradePercent', 'longitudinal gradient', true],
  ['crossFallPercent', 'camber', false],
  ['sideSlope', 'embankment side slope', true],
];

/** The first drainage input still to be entered, or null. */
export function missingDrainage(rigid) {
  const d = rigid.drainage;
  const given = (value, zero) => Number.isFinite(value) && (zero ? value >= 0 : value > 0);
  const gap = DRAINAGE_INPUTS.find(([key, , zero]) => !given(d[key], zero));
  if (gap) return gap[1];
  if (boundSubBase(rigid) && !given(d.layerMm, false)) return 'drainage layer thickness';
  if (!given(rigid.slab.jointSpacingM, false)) return 'transverse joint spacing';
  return null;
}

/**
 * The drainage layer under a slab of the given thickness: below a DLC or
 * cement treated sub-base, or the granular sub-base itself.
 */
export function rigidDrainage(rigid, slabMm) {
  const d = rigid.drainage;
  const f = rigid.foundation;
  const bound = boundSubBase(rigid);
  const depthMm = slabMm + (bound ? f.subBaseMm : 0);
  const layerMm = bound ? d.layerMm : f.subBaseMm;
  const layer = drainageLayer({ ...d, jointSpacingM: rigid.slab.jointSpacingM, depthMm, layerMm });
  const material = drainageMaterial(d);
  const spec = RIGID.drainage;
  const warnings = [];
  if (!layer.checks.thickness) warnings.push(`Drainage layer at least ${spec.minimumThicknessMm} mm · Appendix-VI, VI-II`);
  if (layer.checks.permeability === false) {
    warnings.push(`Tested permeability ${layer.permeability} m/day, under the ${Math.round(layer.specifiedK)} m/day needed · Cl. 6.5.2`);
  }
  warnings.push(...material.warnings);
  return { ...layer, depthMm, layerMm, cu: material.cu, warnings, ok: layer.ok && warnings.length === 0 };
}

/**
 * Run a rigid design: 'design' finds the thickness, 'check' evaluates the one
 * entered. Returns everything the result and cost screens show.
 */
export function runRigid(rigid, mode) {
  const traffic = rigidTrafficFor(rigid);
  const foundation = rigidFoundation(rigid);
  const warnings = [...inputWarnings(rigid, traffic), ...foundation.warnings];

  if (!(foundation.k > 0)) {
    return { ok: false, message: 'Enter the foundation k' };
  }
  const empty = AXLES.find(
    (axle) => (rigid.traffic.axleMix[axle.id] || 0) > 0 && spectrumTotal(rigid.spectrum[axle.id]) <= 0
  );
  if (empty) {
    return { ok: false, message: `Enter the ${empty.label.toLowerCase()} axle load spectrum` };
  }

  const { slab } = rigid;
  const f = rigid.foundation;
  const bonded = isBonded(rigid);
  if (bonded && !(f.dlc28DayMPa > 0)) return { ok: false, message: 'Enter the DLC 28-day strength' };
  if (!(slab.laneWidthM > 0) || !(slab.tieBarDiameterMm > 0)) return { ok: false, message: 'Enter the lane width and tie bar diameter' };
  const drainageGap = hasDrainage(rigid) ? missingDrainage(rigid) : null;
  if (drainageGap) return { ok: false, message: `Enter the ${drainageGap}` };

  const input = slabInput(rigid, traffic, foundation);
  const retexture = mode === 'design' && slab.retexture ? RIGID.criterion.retexturingMm : 0;
  const bondInput = { dlcMm: f.subBaseMm, E1: slab.E, mu1: slab.mu, dlc28MPa: f.dlc28DayMPa };
  let evaluation;
  let fatigueMm;
  let bond = null;
  if (mode === 'design') {
    const outcome = designSlab(input);
    if (!outcome.found) return { ok: false, message: 'No slab up to 500 mm satisfies CFD ≤ 1' };
    evaluation = outcome.trial;
    fatigueMm = outcome.thicknessMm;
    if (bonded) {
      // The slab designed on the granular layer, replaced by a PQC as stiff bonded to the DLC.
      const b = bondedSlab({ designMm: outcome.thicknessMm, ...bondInput });
      fatigueMm = b.thicknessMm;
      bond = { ...b, designMm: outcome.thicknessMm, pqcMm: b.thicknessMm, steps: bondedSteps(b, { ...bondInput, designMm: outcome.thicknessMm, pqcMm: b.thicknessMm }) };
    }
  } else if (bonded) {
    // The entered PQC with the DLC, as the monolithic slab it is as stiff as.
    const b = equivalentSlab({ pqcMm: slab.thicknessMm, ...bondInput });
    evaluation = evaluateSlab({ ...input, thicknessMm: b.thicknessMm });
    fatigueMm = slab.thicknessMm;
    bond = { ...b, equivalentMm: b.thicknessMm, pqcMm: slab.thicknessMm, steps: bondedSteps(b, { ...bondInput, pqcMm: slab.thicknessMm, checking: true }) };
  } else {
    evaluation = evaluateSlab({ ...input, thicknessMm: slab.thicknessMm });
    fatigueMm = slab.thicknessMm;
  }
  const adoptedMm = fatigueMm + retexture;
  const ties = tieBars({ slabMm: adoptedMm, laneWidthM: slab.laneWidthM, type: slab.tieBarType, diameterMm: slab.tieBarDiameterMm });
  const drainage = hasDrainage(rigid) ? rigidDrainage(rigid, adoptedMm) : null;

  return {
    ok: true,
    mode,
    evaluation,
    adoptedMm,
    fatigueMm,
    retextureMm: retexture,
    bonded: bond,
    traffic,
    foundation,
    dowels: slab.doweled ? dowelBars(adoptedMm) : null,
    tieBars: ties,
    slots: rigidSlots(rigid, adoptedMm),
    name: rigidName(rigid),
    steps: [...workingSteps(rigid, traffic, foundation, evaluation), ...(bond ? bond.steps : [])],
    tieBarSteps: ties.steps,
    drainage,
    warnings: [...warnings, ...ties.warnings],
    safe: evaluation.safe,
  };
}
