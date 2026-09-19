/**
 * Rigid (concrete) pavements — IRC:58-2015.
 *
 * What is implemented here is the classical Westergaard analysis: radius of
 * relative stiffness, edge / interior / corner load stresses, and warping
 * stress by Bradbury's coefficient. Those relations are long-published
 * engineering theory, not IRC content, and they give a sound first estimate of
 * slab stresses.
 *
 * What is NOT implemented is the IRC:58-2015 design procedure proper, which
 * uses finite-element-derived regression equations for flexural stress under
 * the combined axle-load-and-temperature cases, and a cumulative fatigue damage
 * summation over the axle load spectrum. Those equations are the content of the
 * code. Supply them and they slot in behind `slabStress` without disturbing
 * anything else.
 *
 * Every result from this module is therefore marked provisional.
 */

import { ref } from '../data/ircConstants.js';

export const RIGID_REF = ref('IRC58', 'Cl. 6');

export const DEFAULTS = {
  concreteElasticModulusMPa: 30000,
  poissonRatio: 0.15,
  flexuralStrengthMPa: 4.5,
  thermalCoefficientPerC: 10e-6,
  wheelLoadN: 20000,
  tyrePressureMPa: 0.8,
  modulusOfSubgradeReactionMPaPerM: 80,
};

/**
 * Radius of relative stiffness.
 *   l = [ E h^3 / (12 (1 - mu^2) k) ]^0.25
 *
 * @param {number} E  Concrete elastic modulus, MPa.
 * @param {number} h  Slab thickness, mm.
 * @param {number} mu Poisson's ratio.
 * @param {number} k  Modulus of subgrade reaction, MPa/m.
 * @returns {number} mm
 */
export function radiusOfRelativeStiffness(E, h, mu, k) {
  const kMPaPerMm = k / 1000; // MPa/m -> MPa/mm
  return Math.pow((E * h * h * h) / (12 * (1 - mu * mu) * kMPaPerMm), 0.25);
}

/** Westergaard's equivalent radius of resisting section, mm. */
export function equivalentRadius(contactRadiusMm, slabThicknessMm) {
  const a = contactRadiusMm;
  const h = slabThicknessMm;
  if (a >= 1.724 * h) return a;
  return Math.sqrt(1.6 * a * a + h * h) - 0.675 * h;
}

/**
 * Westergaard load stresses, MPa.
 *
 * @param {object} input
 * @param {number} input.wheelLoadN
 * @param {number} input.contactRadiusMm
 * @param {number} input.slabThicknessMm
 * @param {number} input.radiusOfRelativeStiffnessMm
 */
export function slabStress(input) {
  const {
    wheelLoadN: P,
    contactRadiusMm: a,
    slabThicknessMm: h,
    radiusOfRelativeStiffnessMm: l,
  } = input;

  const b = equivalentRadius(a, h);
  const h2 = h * h;

  const interior = ((0.316 * P) / h2) * (4 * Math.log10(l / b) + 1.069);
  const edge = ((0.803 * P) / h2) * (4 * Math.log10(l / b) + 0.666 * (a / l) - 0.034);
  const corner = ((3 * P) / h2) * (1 - Math.pow((a * Math.SQRT2) / l, 1.2));

  return {
    interior,
    edge,
    corner,
    equivalentRadiusMm: b,
    provisional: true,
    formula:
      'Westergaard: edge = 0.803P/h^2 [4 log10(l/b) + 0.666(a/l) - 0.034]',
    note:
      'Westergaard closed form. IRC:58-2015 designs against finite-element ' +
      'derived regression equations instead; this is an estimate until those ' +
      'are supplied.',
  };
}

/**
 * Bradbury's warping stress coefficient for a slab of given ratio L/l.
 * Digitised from Bradbury's published chart.
 */
export function bradburyCoefficient(ratio) {
  const chart = [
    [1, 0.0], [2, 0.04], [3, 0.175], [4, 0.44], [5, 0.72], [6, 0.92],
    [7, 1.03], [8, 1.07], [9, 1.075], [10, 1.07], [11, 1.05], [12, 1.035],
  ];
  if (ratio <= chart[0][0]) return chart[0][1];
  if (ratio >= chart[chart.length - 1][0]) return chart[chart.length - 1][1];
  for (let i = 0; i < chart.length - 1; i++) {
    const [x0, y0] = chart[i];
    const [x1, y1] = chart[i + 1];
    if (ratio >= x0 && ratio <= x1) {
      return y0 + ((ratio - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return chart[chart.length - 1][1];
}

/**
 * Warping (temperature) stress at the slab edge, MPa.
 *   sigma_t = C E alpha dT / 2
 */
export function warpingStress({
  elasticModulusMPa,
  thermalCoefficientPerC,
  temperatureDifferentialC,
  slabLengthMm,
  radiusOfRelativeStiffnessMm,
}) {
  const ratio = slabLengthMm / radiusOfRelativeStiffnessMm;
  const C = bradburyCoefficient(ratio);
  const stress =
    (C * elasticModulusMPa * thermalCoefficientPerC * temperatureDifferentialC) / 2;
  return { stress, coefficient: C, ratio, provisional: true };
}

/**
 * A provisional check of a trial slab thickness.
 *
 * Reports the stress ratio against the flexural strength. It deliberately does
 * NOT report a fatigue life or a pass/fail verdict, because the IRC:58 fatigue
 * relation and load spectrum are not implemented — claiming a verdict from a
 * stress ratio alone would overstate what has been computed.
 */
export function checkTrialSlab(input) {
  const {
    slabThicknessMm,
    elasticModulusMPa = DEFAULTS.concreteElasticModulusMPa,
    poissonRatio = DEFAULTS.poissonRatio,
    flexuralStrengthMPa = DEFAULTS.flexuralStrengthMPa,
    modulusOfSubgradeReactionMPaPerM = DEFAULTS.modulusOfSubgradeReactionMPaPerM,
    wheelLoadN = DEFAULTS.wheelLoadN,
    tyrePressureMPa = DEFAULTS.tyrePressureMPa,
    thermalCoefficientPerC = DEFAULTS.thermalCoefficientPerC,
    temperatureDifferentialC = 0,
    slabLengthMm = 4500,
  } = input;

  const l = radiusOfRelativeStiffness(
    elasticModulusMPa,
    slabThicknessMm,
    poissonRatio,
    modulusOfSubgradeReactionMPaPerM
  );
  const contactRadiusMm = Math.sqrt(wheelLoadN / (tyrePressureMPa * Math.PI));

  const stresses = slabStress({
    wheelLoadN,
    contactRadiusMm,
    slabThicknessMm,
    radiusOfRelativeStiffnessMm: l,
  });

  const warping = warpingStress({
    elasticModulusMPa,
    thermalCoefficientPerC,
    temperatureDifferentialC,
    slabLengthMm,
    radiusOfRelativeStiffnessMm: l,
  });

  const combinedEdge = stresses.edge + warping.stress;

  const steps = [
    {
      id: 'relative-stiffness',
      title: 'Radius of relative stiffness',
      formula: 'l = [E h^3 / (12 (1 - mu^2) k)]^0.25',
      substitution:
        `l = [${elasticModulusMPa} x ${slabThicknessMm}^3 / ` +
        `(12 x (1 - ${poissonRatio}^2) x ${(modulusOfSubgradeReactionMPaPerM / 1000).toFixed(3)})]^0.25`,
      result: `l = ${l.toFixed(1)} mm`,
      ref: RIGID_REF,
      verified: false,
    },
    {
      id: 'load-stress',
      title: 'Westergaard edge load stress',
      formula: stresses.formula,
      substitution: `P = ${wheelLoadN} N, a = ${contactRadiusMm.toFixed(1)} mm, b = ${stresses.equivalentRadiusMm.toFixed(1)} mm`,
      result: `sigma(edge) = ${stresses.edge.toFixed(2)} MPa`,
      ref: RIGID_REF,
      verified: false,
      warning: stresses.note,
    },
    {
      id: 'warping-stress',
      title: 'Warping stress at the edge',
      formula: 'sigma(t) = C x E x alpha x dT / 2',
      substitution: `C = ${warping.coefficient.toFixed(3)} at L/l = ${warping.ratio.toFixed(2)}, dT = ${temperatureDifferentialC} deg C`,
      result: `sigma(t) = ${warping.stress.toFixed(2)} MPa`,
      ref: RIGID_REF,
      verified: false,
    },
    {
      id: 'combined',
      title: 'Combined edge stress against flexural strength',
      formula: 'Stress ratio = (sigma(edge) + sigma(t)) / flexural strength',
      substitution: `(${stresses.edge.toFixed(2)} + ${warping.stress.toFixed(2)}) / ${flexuralStrengthMPa}`,
      result: `Stress ratio = ${(combinedEdge / flexuralStrengthMPa).toFixed(3)}`,
      ref: RIGID_REF,
      verified: false,
    },
  ];

  return {
    radiusOfRelativeStiffnessMm: l,
    contactRadiusMm,
    stresses,
    warping,
    combinedEdgeStressMPa: combinedEdge,
    stressRatio: combinedEdge / flexuralStrengthMPa,
    flexuralStrengthMPa,
    steps,
    provisional: true,
    message:
      'Stresses only. The IRC:58-2015 cumulative fatigue damage check over the ' +
      'axle load spectrum is not implemented, so no pass or fail verdict is ' +
      'given for this slab.',
  };
}
