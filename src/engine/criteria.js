/**
 * Performance criteria: how many standard axles a computed strain will survive,
 * and — inverting the same relation — the largest strain a given design traffic
 * allows.
 *
 * Each function returns the allowable repetitions together with the citation
 * and the substituted arithmetic, so the result screen can show the working.
 */

import { CRITERIA, roadCategory } from '../data/ircConstants.js';

/**
 * Reliability level to design at: 90% on the important roads whatever the
 * traffic, and on other roads from the traffic threshold up; 80% below it.
 *
 * @param {number} msa
 * @param {string} [roadCategoryId]
 */
export function reliabilityFor(msa, roadCategoryId) {
  if (roadCategory(roadCategoryId)?.important) return 90;
  return msa >= CRITERIA.reliability.thresholdMsa ? 90 : 80;
}

/** Reliability factor of a cement treated base: 1 or 2. */
export function ctbReliabilityFactor(msa, roadCategoryId) {
  if (roadCategory(roadCategoryId)?.important) return 1;
  return msa > CRITERIA.cementedFatigue.reliabilityFactorThresholdMsa ? 1 : 2;
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
 * @param {number} [input.designAxles]  Design traffic, for the allowable strain.
 */
export function bituminousFatigueLife(input) {
  const {
    tensileStrain,
    modulusMPa,
    airVoidsPercent,
    effectiveBinderPercent,
    reliability,
    designAxles,
  } = input;

  const spec = CRITERIA.bituminousFatigue;
  const k = spec.coefficients[reliability];
  const { C, M } = mixFatigueFactor(airVoidsPercent, effectiveBinderPercent);
  const scale = C * k * Math.pow(1 / modulusMPa, spec.modulusExponent);

  const allowableStrain =
    designAxles > 0 ? Math.pow(scale / designAxles, 1 / spec.strainExponent) : null;

  const common = {
    C,
    M,
    reliability,
    allowableStrain,
    formula:
      'Nf = k x C x (1/eps_t)^3.89 x (1/MR)^0.854,  C = 10^[4.84 x (Vbe/(Va+Vbe) - 0.69)]',
    ref: spec.ref,
    verified: spec.verified,
  };

  if (!(tensileStrain > 0)) {
    return { ...common, allowableAxles: Infinity, allowableMsa: Infinity, compressive: true };
  }

  const allowableAxles = scale * Math.pow(1 / tensileStrain, spec.strainExponent);

  return {
    ...common,
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    substitution:
      `Nf = ${k.toExponential(4)} x ${C.toFixed(3)} x ` +
      `(1/${(tensileStrain * 1e6).toFixed(1)}e-6)^3.89 x (1/${modulusMPa.toFixed(0)})^0.854`,
  };
}

/**
 * Allowable repetitions before the subgrade ruts by 20 mm.
 *
 * @param {number} verticalStrain  Vertical compressive strain, positive.
 * @param {80|90} reliability
 * @param {number} [designAxles]   Design traffic, for the allowable strain.
 */
export function subgradeRuttingLife(verticalStrain, reliability, designAxles) {
  const spec = CRITERIA.subgradeRutting;
  const k = spec.coefficients[reliability];

  const allowableStrain =
    designAxles > 0 ? Math.pow(k / designAxles, 1 / spec.strainExponent) : null;

  const common = {
    reliability,
    allowableStrain,
    formula: 'Nr = k x (1/eps_v)^4.5337',
    ref: spec.ref,
    verified: spec.verified,
  };

  if (!(verticalStrain > 0)) {
    return { ...common, allowableAxles: Infinity, allowableMsa: Infinity };
  }

  const allowableAxles = k * Math.pow(1 / verticalStrain, spec.strainExponent);
  return {
    ...common,
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    substitution:
      `Nr = ${k.toExponential(4)} x (1/${(verticalStrain * 1e6).toFixed(1)}e-6)^4.5337`,
  };
}

/**
 * Allowable repetitions before fatigue cracking of a cement treated base.
 *
 * @param {number} tensileStrain  At the underside of the CTB, dimensionless,
 *        from an analysis at the CTB contact stress.
 * @param {object} options
 * @param {number} options.modulusMPa  Elastic modulus of the CTB.
 * @param {1|2} options.reliabilityFactor
 * @param {number} [options.designAxles]
 */
export function cementedFatigueLife(tensileStrain, { modulusMPa, reliabilityFactor, designAxles }) {
  const spec = CRITERIA.cementedFatigue;
  const numerator =
    spec.numerator / Math.pow(modulusMPa, spec.modulusExponent) + spec.constant;

  // In microstrain, as the relation is written.
  const allowableMicro =
    designAxles > 0
      ? numerator / Math.pow(designAxles / reliabilityFactor, 1 / spec.exponent)
      : null;

  const common = {
    reliabilityFactor,
    allowableStrain: allowableMicro == null ? null : allowableMicro * 1e-6,
    formula: 'N = RF x [(113000 / E^0.804 + 191) / eps_t]^12,  eps_t in microstrain',
    ref: spec.ref,
    verified: spec.verified,
  };

  if (!(tensileStrain > 0)) {
    return { ...common, allowableAxles: Infinity, allowableMsa: Infinity, compressive: true };
  }

  const strainMicro = tensileStrain * 1e6;
  const allowableAxles = reliabilityFactor * Math.pow(numerator / strainMicro, spec.exponent);

  return {
    ...common,
    allowableAxles,
    allowableMsa: allowableAxles / 1e6,
    substitution:
      `N = ${reliabilityFactor} x [(113000 / ${modulusMPa.toFixed(0)}^0.804 + 191) / ` +
      `${strainMicro.toFixed(1)}]^12`,
  };
}
