/**
 * The flexible design's engine input, built from the app state in one place so
 * the inputs and IITPAVE screens evaluate exactly the same section.
 */

import { designTraffic, trafficMissing } from './project.js';
import { hasCTB, ctbDamageInput, constructionInput } from './ctbProject.js';
import { reliabilityFor } from '../engine/criteria.js';
import { evaluateTrial } from '../engine/flexibleDesign.js';
import { sectionKey, iitpaveMeasured } from './iitpave.js';
import { LONG_LIFE, MODULI, CBR_PERCENTILE, roadCategory } from '../data/ircConstants.js';
import {
  BITUMINOUS_OPTIONS,
  bituminousAllowed,
  bindersAllowed,
  bottomCourse,
  findOption,
} from '../data/layerCatalog.js';

/**
 * The first input a flexible design still needs, as a prompt, or null. An
 * empty value must stop the design rather than stand in as zero or as the
 * end of a table.
 */
export function flexibleMissing(state, msa = designTraffic(state).result.msa) {
  const m = state.materials;
  const mix = state.mix;
  const layered = m.layeredSubgrade;
  if (!(msa > 0)) return 'Enter the traffic';
  const trafficGap = trafficMissing(state);
  if (trafficGap) return trafficGap;
  if (layered?.enabled) {
    if (!(layered.borrowCBR > 0)) return `Enter the ${layered.subLayers === 2 ? 'upper sub-layer' : 'select borrow'} CBR`;
    if (!(layered.borrowMm > 0)) return `Enter the ${layered.subLayers === 2 ? 'upper sub-layer' : 'select borrow'} thickness`;
    if (layered.subLayers === 2 && !(layered.lowerCBR > 0 && layered.lowerMm > 0)) return 'Enter the lower sub-layer CBR and thickness';
    if (!(layered.embankmentCBR > 0)) return 'Enter the embankment CBR';
  } else if (!(m.subgradeCBR > 0)) {
    return 'Enter the effective CBR';
  }
  const option = findOption(BITUMINOUS_OPTIONS, state.combination.bituminousId) || BITUMINOUS_OPTIONS[0];
  if (bottomCourse(option).id !== 'BM' && !Number.isFinite(m.pavementTemperatureC)) {
    return 'Enter the average annual pavement temperature';
  }
  if (!(mix.airVoidsPercent > 0)) return 'Enter the air voids, Va';
  if (!(mix.effectiveBinderPercent > 0)) return 'Enter the effective binder, Vbe';
  return null;
}

/** The subgrade CBR percentile to design on (Cl. 6.2.2). */
export function cbrPercentile(state, msa) {
  return roadCategory(state.project.roadCategory)?.important || msa >= CBR_PERCENTILE.fromMsa ? 90 : 80;
}

/** Whether the long-life route is open: from 300 msa, and on expressways (Cl. 4.3.1 / 10); not built in stages. */
export function longLifeApplies(state, msa) {
  if (staged(state)) return false;
  return msa >= LONG_LIFE.fromMsa || state.project.roadCategory === 'expressway';
}

/** Whether the pavement is built in stages (Cl. 4.3.2). */
export const staged = (state) => Boolean(state.traffic.stage?.enabled);

/** Long-life unless the designer turns it off where it applies. */
export const longLifeOf = (state, msa) => longLifeApplies(state, msa) && state.materials.longLife !== false;

/** Whether a CTSB of 0.75 - 1.5 MPa may be used: below 10 msa, off major highways (Cl. 7.3.2). */
export function lowCtsbAllowed(state, msa) {
  const spec = MODULI.lowStrengthCTSB;
  return msa < spec.belowMsa && !spec.majorHighways.includes(state.project.roadCategory);
}

/** Binders Table 9.1 admits for the chosen bituminous layers. */
export function bindersFor(state, msa) {
  const option = findOption(BITUMINOUS_OPTIONS, state.combination.bituminousId) || BITUMINOUS_OPTIONS[0];
  return bindersAllowed(bottomCourse(option).id, msa, state.project.roadCategory, state.materials.snowBound);
}

/**
 * Hold the choices to what Table 9.1 and Cl. 7.3.2 admit at the design
 * traffic: the bituminous layers, the binder and the CTSB strength. Returns
 * whether anything changed.
 */
export function enforceCodeChoices(state, msa = designTraffic(state).result.msa) {
  let changed = false;
  const category = state.project.roadCategory;
  const option = findOption(BITUMINOUS_OPTIONS, state.combination.bituminousId);
  if (!option || !bituminousAllowed(option, msa, category)) {
    const courses = new Set((option?.courses || []).map((c) => c.id));
    state.combination = { ...state.combination, bituminousId: 'BC_DBM' };
    state.thicknesses = Object.fromEntries(Object.entries(state.thicknesses || {}).filter(([id]) => !courses.has(id)));
    changed = true;
  }
  const binders = bindersFor(state, msa);
  if (!binders.includes(state.materials.binderGrade)) {
    state.materials.binderGrade = binders[0];
    changed = true;
  }
  if (state.materials.ctsbStrength === 'low' && !lowCtsbAllowed(state, msa)) {
    state.materials.ctsbStrength = 'standard';
    changed = true;
  }
  // No cement treated base or sub-base when built in stages (Cl. 4.3.2).
  if (staged(state) && (state.combination.baseId === 'CTB' || state.combination.subBaseId === 'CTSB')) {
    const reset = [];
    if (state.combination.baseId === 'CTB') reset.push('BASE', 'CRACK_RELIEF');
    if (state.combination.subBaseId === 'CTSB') reset.push('SUB_BASE');
    state.combination = {
      ...state.combination,
      baseId: state.combination.baseId === 'CTB' ? 'WMM' : state.combination.baseId,
      subBaseId: state.combination.subBaseId === 'CTSB' ? 'GSB' : state.combination.subBaseId,
    };
    state.thicknesses = Object.fromEntries(Object.entries(state.thicknesses || {}).filter(([id]) => !reset.includes(id)));
    changed = true;
  }
  return changed;
}

export const defaultLayeredSubgrade = () => ({
  enabled: false,
  borrowCBR: null,
  borrowMm: 500,
  /** The 500 mm subgrade as one layer or two sub-layers (Cl. 6.4.1). */
  subLayers: 1,
  lowerCBR: null,
  lowerMm: null,
  embankmentCBR: null,
  /** Read from IITPAVE; until then the app's analysis stands in. */
  iitpaveDeflectionMm: null,
});

export const defaultNarratives = () => ({ traffic: '', subgrade: '', mix: '', materials: '' });

/** Reliability the design uses: the designer's choice, or the code's. */
export function reliabilityOf(state, traffic = designTraffic(state)) {
  const code = reliabilityFor(traffic.result.msa, state.project.roadCategory);
  return { value: state.reliabilityChoice ?? code, code, chosen: state.reliabilityChoice != null };
}

/**
 * @param {object} state
 * @param {object} [options]
 * @param {object} [options.thicknesses]  In place of the state's.
 * @param {object} [options.measured]  Strains read from IITPAVE.
 * @param {object} [options.stresses]  CTB stresses read from IITPAVE, by load.
 */
export function flexibleInput(state, { thicknesses, measured, stresses } = {}) {
  const traffic = designTraffic(state);
  const m = state.materials;
  const damage = hasCTB(state) ? ctbDamageInput(state, traffic).engineInput : null;
  return {
    combination: state.combination,
    thicknesses: thicknesses ?? state.thicknesses,
    materials: {
      ...m,
      layeredSubgrade: m.layeredSubgrade?.enabled ? m.layeredSubgrade : null,
      bituminousModulusMPa: m.bituminousModulusMPa > 0 ? m.bituminousModulusMPa : null,
    },
    mix: state.mix,
    longLife: longLifeOf(state, traffic.result.msa),
    // Built in stages, the bituminous layers are designed for stage 1 (Cl. 4.3.2).
    designTrafficMsa: traffic.stage ? traffic.stage.designMsa : traffic.result.msa,
    roadCategory: state.project.roadCategory,
    reliability: reliabilityOf(state, traffic).value,
    ctbDamage: damage && stresses ? { ...damage, stresses } : damage,
    construction: constructionInput(state),
    measured,
  };
}

/**
 * The section evaluated on the IITPAVE values entered for it, the app's own
 * analysis standing in only for values not yet entered.
 */
export function flexibleResult(state, { thicknesses } = {}) {
  const trial = evaluateTrial(flexibleInput(state, { thicknesses }));
  if (state.iitpave?.key !== sectionKey(trial)) return trial;
  const { measured, stresses } = iitpaveMeasured(trial, state);
  if (!Object.keys(measured).length && !Object.keys(stresses).length) return trial;
  return evaluateTrial(flexibleInput(state, { thicknesses, measured, stresses }));
}
