/**
 * The flexible design's engine input, built from the app state in one place so
 * the inputs and IITPAVE screens evaluate exactly the same section.
 */

import { designTraffic } from './project.js';
import { hasCTB, ctbDamageInput, constructionInput } from './ctbProject.js';
import { reliabilityFor } from '../engine/criteria.js';

export const defaultLayeredSubgrade = () => ({
  enabled: false,
  borrowCBR: null,
  borrowMm: 500,
  embankmentCBR: null,
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
    designTrafficMsa: traffic.result.msa,
    roadCategory: state.project.roadCategory,
    reliability: reliabilityOf(state, traffic).value,
    ctbDamage: damage && stresses ? { ...damage, stresses } : damage,
    construction: constructionInput(state),
    measured,
  };
}
