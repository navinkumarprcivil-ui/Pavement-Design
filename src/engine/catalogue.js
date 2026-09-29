/**
 * The IRC:37 catalogue section for a composition, design traffic and
 * effective subgrade CBR (Cl. 12). The catalogues are for initial cost
 * estimation and guidance only: above 2 msa the section must still satisfy
 * the performance models (Cl. 12.1), so this gives a starting trial, never a
 * verdict.
 *
 * Traffic between the catalogue's levels takes the next level up, and CBR
 * between them the next level down, both on the safe side.
 */

import { IRC37_CATALOGUE as C } from '../data/irc37Catalogue.js';
import { ref, BITUMINOUS_RULES } from '../data/ircConstants.js';
import { reliabilityFor } from './criteria.js';
import { BITUMINOUS_OPTIONS, findOption } from '../data/layerCatalog.js';

/** Which of the six catalogued compositions (Cl. 12.2) a combination is, or null. */
export function catalogueType({ baseId, subBaseId, crackReliefId }) {
  const granularBase = baseId === 'WMM' || baseId === 'WBM';
  if (granularBase && subBaseId === 'GSB') return 'granular';
  if (granularBase && subBaseId === 'CTSB') return 'ctsbGranular';
  if (baseId === 'RAP' && subBaseId === 'CTSB') return 'rap';
  if (baseId === 'CTB' && subBaseId === 'CTSB') return crackReliefId === 'SAMI' ? 'ctbSami' : crackReliefId === 'AGG_INTERLAYER' ? 'ctbAil' : null;
  if (baseId === 'CTB' && subBaseId === 'GSB' && crackReliefId === 'AGG_INTERLAYER') return 'gsbCtbAil';
  return null;
}

/**
 * @param {object} input
 * @param {object} input.combination   bituminousId, baseId, subBaseId, crackReliefId.
 * @param {number} input.designMsa
 * @param {number} input.cbr            Effective subgrade CBR, %.
 * @param {string} input.roadCategory
 */
export function catalogueSection({ combination, designMsa, cbr, roadCategory }) {
  const type = catalogueType(combination);
  if (!type) return { ok: false, reason: 'This composition has no catalogue', ref: C.ref };
  if (!(designMsa >= C.minimumMsa)) return { ok: false, reason: `Below ${C.minimumMsa} msa, IRC:SP:72`, ref: C.scope };
  if (designMsa > C.maximumMsa) return { ok: false, reason: `Catalogues go up to ${C.maximumMsa} msa`, ref: C.scope };
  if (!(cbr >= C.cbr[0])) return { ok: false, reason: `Catalogues start at ${C.cbr[0]}% effective CBR`, ref: C.ref };

  const t = C.trafficMsa.findIndex((level) => level >= designMsa - 1e-9);
  const cbrLevel = [...C.cbr].reverse().find((level) => level <= cbr + 1e-9);
  const spec = C.types[type];
  const figure = spec.firstFigure + C.cbr.indexOf(cbrLevel);
  const [surface, binder, crackRelief, base, subBase] = spec.byCbr[cbrLevel][t];
  const trafficMsa = C.trafficMsa[t];

  const warnings = [];
  if (trafficMsa <= C.reliability80UpToMsa && reliabilityFor(designMsa, roadCategory) === 90) {
    warnings.push(`The catalogue is at 80% reliability; 90% applies to this road · ${C.assumptions.clause}`);
  }
  if (trafficMsa < BITUMINOUS_RULES.vg40FromMsa && BITUMINOUS_RULES.vg40Categories.includes(roadCategory)) {
    warnings.push(`The catalogue takes VG30 below ${BITUMINOUS_RULES.vg40FromMsa} msa; VG40 for the surface and DBM on this road · ${C.assumptions.clause}`);
  }
  if (combination.baseId === 'CTB') {
    warnings.push(`The CTB was checked for fatigue by Eq. 3.5 alone; check its cumulative damage with the project's axle loads · ${C.assumptions.clause}`);
  }

  return {
    ok: true,
    type,
    figure: `Fig. 12.${figure}`,
    ref: ref('IRC37', 'Cl. 12', { table: `Fig. 12.${figure}`, page: C.firstFigurePage + Math.floor((figure - 1) / 3) }),
    trafficMsa,
    cbr: cbrLevel,
    layers: { surface, binder, crackRelief, base, subBase },
    totalMm: surface + binder + crackRelief + base + subBase,
    warnings,
  };
}

/**
 * The combination and thicknesses that lay a catalogue section: one BC
 * course where the catalogue has no binder course, two courses otherwise.
 */
export function catalogueTrial(section, combination) {
  const { surface, binder, crackRelief, base, subBase } = section.layers;
  const current = findOption(BITUMINOUS_OPTIONS, combination.bituminousId) || BITUMINOUS_OPTIONS[0];
  const bituminousId = binder > 0 ? (current.courses.length > 1 ? current.id : 'BC_DBM') : 'BC_ONLY';
  const courses = findOption(BITUMINOUS_OPTIONS, bituminousId).courses;
  const thicknesses = { [courses[0].id]: surface, BASE: base, SUB_BASE: subBase };
  if (binder > 0) thicknesses[courses[1].id] = binder;
  if (crackRelief > 0) thicknesses.CRACK_RELIEF = crackRelief;
  return { combination: { ...combination, bituminousId }, thicknesses };
}
