/**
 * Performance criteria: how many standard axles a computed strain will survive.
 *
 * Each function returns the allowable repetitions together with the citation
 * and the substituted arithmetic, so the result screen can show the working.
 */

import { CRITERIA } from '../data/ircConstants.js';

/**
 * Reliability level to design at, chosen from the design traffic.
 * 80% below the threshold, 90% at or above it.
 */
export function reliabilityFor(msa) {
  return msa >= CRITERIA.reliabilityThresholdMsa.value ? 90 : 80;
}

/**
 * Mix adjustment factor C = 10^M, M = 4.84 * (Vbe/(Va + Vbe) - 0.69).
 *
 * @param {number} airVoidsPercent      Va
 * @param {number} effectiveBinderPercent Vbe, by volume of the mix
 */
export function mixFatigueFactor(airVoidsPercent, effectiveBinderPercent) {
  const { slope, offset } = CRITERIA.bituminousFatigue.mixFactor;
  const ratio =
    effectiveBinderPercent / (airVoidsPercent + effectiveBinderPercent);
  const m = slope * (ratio - offset);
  return { C: Math.pow(10, m), M: m, ratio };
}

/**
 * Allowable repetitions before fatigue cracking of the bituminous layer.
 *
 * @param {object} input
 * @param {number} input.tensileStrain  Horizontal tensile strain, dimensionless.
 * @param {number} input.modulusMPa     Resilient modulus of the bituminous mix.
 * @param {number} input.airVoidsPercent
 * @param {number} input.effectiveBinderPercent
 * @param {80|90} input.reliability
 */
export function bituminousFatigueLife(input) {
  const {
    tensileStrain,
    modulusMPa,
    airVoidsPercent,
    effectiveBinderPercent,
    reliability,
  } = input;

  const spec = CRITERIA.bituminousFatigue;
  const k = spec.coefficients[reliability];
  const { C, M } = mixFatigueFactor(airVoidsPercent, effectiveBinderPercent);

  if (!(tensileStrain > 0)) {
    return {
      allowableAxles: Infinity,
      allowableMsa: Infinity,
      C,
      M,
      note: 'No tensile strain developed at the underside of the bituminous layer.',
      ref: spec.ref,
      verified: spec.verified,
    };
  }

  const allowableAxles =
    C *
    k *
    Math.pow(1 / tensileStrain, spec.strainExponent) *
    Math.pow(1 / modulusMPa, spec.modulusExponent);

  return {
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    C,
    M,
    reliability,
    formula:
      'Nf = C x k x (1/eps_t)^3.89 x (1/MR)^0.854,  C = 10^[4.84 x (Vbe/(Va+Vbe) - 0.69)]',
    substitution:
      `Nf = ${C.toFixed(4)} x ${k.toExponential(4)} x ` +
      `(1/${(tensileStrain * 1e6).toFixed(1)}e-6)^3.89 x (1/${modulusMPa.toFixed(0)})^0.854`,
    ref: spec.ref,
    verified: spec.verified,
    note: spec.note,
  };
}

/**
 * Allowable repetitions before the subgrade ruts by 20 mm.
 *
 * @param {number} verticalStrain  Vertical compressive strain, positive.
 * @param {80|90} reliability
 */
export function subgradeRuttingLife(verticalStrain, reliability) {
  const spec = CRITERIA.subgradeRutting;
  const k = spec.coefficients[reliability];

  if (!(verticalStrain > 0)) {
    return {
      allowableAxles: Infinity,
      allowableMsa: Infinity,
      ref: spec.ref,
      verified: spec.verified,
    };
  }

  const allowableAxles = k * Math.pow(1 / verticalStrain, spec.strainExponent);
  return {
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    reliability,
    formula: 'Nr = k x (1/eps_v)^4.5337',
    substitution:
      `Nr = ${k.toExponential(4)} x (1/${(verticalStrain * 1e6).toFixed(1)}e-6)^4.5337`,
    ref: spec.ref,
    verified: spec.verified,
    note: spec.note,
  };
}

/**
 * Allowable repetitions before fatigue cracking of a cement treated base.
 *
 * The coefficients behind this one are flagged unverified in ircConstants.js;
 * the result is reported but marked provisional.
 */
export function cementedFatigueLife(tensileStrain, reliability) {
  const spec = CRITERIA.cementedFatigue;
  const rf = spec.reliabilityFactors[reliability];

  if (!(tensileStrain > 0)) {
    return {
      allowableAxles: Infinity,
      allowableMsa: Infinity,
      provisional: true,
      ref: spec.ref,
      verified: spec.verified,
    };
  }

  const allowableAxles =
    rf * spec.coefficient * Math.pow(1 / tensileStrain, spec.strainExponent);

  return {
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    reliability,
    provisional: true,
    formula: 'Nf(CTB) = RF x k x (1/eps_t)^(1/0.804)',
    substitution:
      `Nf = ${rf} x ${spec.coefficient.toExponential(4)} x ` +
      `(1/${(tensileStrain * 1e6).toFixed(1)}e-6)^${spec.strainExponent.toFixed(3)}`,
    ref: spec.ref,
    verified: spec.verified,
    note: spec.note,
  };
}
