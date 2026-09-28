/**
 * Construction traffic: the dumpers that run on a layer while the next one is
 * laid, IRC:37-2018 Cl. 7.2.2 for a granular sub-base and Cl. 8.2.1 for a
 * cement treated base, worked as in the Annex-II examples.
 */

import { CRITERIA } from '../data/ircConstants.js';

const round = (value) => Math.round(value).toLocaleString('en-IN');

/**
 * Standard axles per dumper trip: the rear tandem as two single axles on dual
 * wheels, and the front axle on single wheels.
 */
export function dumperVDF({ rearTandemKN, frontKN }) {
  const v = CRITERIA.constructionTraffic.vdf;
  const rear = 2 * Math.pow((rearTandemKN || 0) / 2 / v.singleAxleKN, v.exponent);
  const front = Math.pow((frontKN || 0) / v.singleWheelAxleKN, v.exponent);
  return rear + front;
}

/**
 * Standard axles the granular sub-base must carry: the dumper traffic, or the
 * code's floor, whichever is more.
 */
export function subBaseConstructionTraffic(construction) {
  const spec = CRITERIA.constructionTraffic;
  const { rearTandemKN, frontKN, subBaseTrips } = construction;
  const vdf = dumperVDF(construction);
  const computed = (subBaseTrips || 0) * vdf;
  const repetitions = Math.max(computed, spec.minimumRepetitions);
  return {
    vdf,
    computed,
    repetitions,
    step: {
      title: 'Construction traffic on the sub-base',
      formula:
        `N = trips x [2 x (Pt / 2 / ${spec.vdf.singleAxleKN})^${spec.vdf.exponent} + ` +
        `(Pf / ${spec.vdf.singleWheelAxleKN})^${spec.vdf.exponent}], not less than ${round(spec.minimumRepetitions)}`,
      substitution:
        `N = ${subBaseTrips || 0} x [2 x (${rearTandemKN} / 2 / ${spec.vdf.singleAxleKN})^${spec.vdf.exponent} + ` +
        `(${frontKN} / ${spec.vdf.singleWheelAxleKN})^${spec.vdf.exponent}] = ${subBaseTrips || 0} x ${vdf.toFixed(2)} = ${round(computed)}`,
      result: `N = ${round(repetitions)} standard axles`,
      ref: spec.ref,
      verified: spec.verified,
    },
  };
}

/** The tensile stress a CTB can take for n passes: Eq. 3.6 solved for the stress. */
export function allowableCtbStress(repetitions, flexuralMPa) {
  const spec = CRITERIA.cementedDamage;
  return flexuralMPa * (spec.intercept - spec.slope * Math.log10(repetitions));
}

/** 7-day flexural strength of the CTB, from its 28-day modulus of rupture. */
export function sevenDayFlexural(modulusOfRuptureMPa) {
  return CRITERIA.ctbConstruction.sevenDayShare * modulusOfRuptureMPa;
}
