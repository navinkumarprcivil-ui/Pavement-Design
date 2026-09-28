/**
 * Fatigue design of a jointed plain concrete slab — IRC:58-2015.
 *
 * Bottom-up cracking is checked under the day-time six-hour traffic with the
 * positive temperature differential; top-down cracking under the night-time
 * six-hour traffic of vehicles whose wheel base is shorter than the joint
 * spacing, with the negative differential. The slab is adequate when the
 * fatigue damage of both, summed over the axle load spectrum, is at most 1.
 *
 * Units follow the code's stress equations: h and l in m, k in MPa/m, loads
 * in kN, stresses in MPa.
 */

import { RIGID } from '../data/ircConstants.js';

/** Radius of relative stiffness, m:  l = [E h³ / (12 k (1 − µ²))]^0.25 */
export function radiusOfRelativeStiffness({ thicknessM, kMPaPerM, E = RIGID.concrete.elasticModulusMPa, mu = RIGID.concrete.poissonRatio }) {
  return Math.pow((E * thicknessM ** 3) / (12 * kMPaPerM * (1 - mu * mu)), 0.25);
}

/** Design flexural strength: the 90-day value from the 28-day one. */
export function designFlexuralStrength(flexural28MPa) {
  return flexural28MPa * RIGID.concrete.ninetyDayFactor;
}

/** Night-time differential for top-down cracking, °C. */
export function nightTemperatureDifferential(dayC) {
  return dayC * RIGID.nightTemperature.dayFraction + RIGID.nightTemperature.addC;
}

function slabTerms({ thicknessM: h, kMPaPerM: k, E, mu }) {
  const l = radiusOfRelativeStiffness({ thicknessM: h, kMPaPerM: k, E, mu });
  return { h, k, l, l2: l * l, l4: l ** 4 };
}

/**
 * Edge stress for bottom-up cracking under a rear single or tandem axle.
 * @param {object} input
 * @param {'single'|'tandem'} input.axle
 * @param {boolean} input.tiedShoulder
 * @param {number} input.loadKN   Whole axle load.
 * @param {number} input.deltaTC  Day-time temperature differential.
 */
export function bottomUpStress({ axle, tiedShoulder, loadKN, deltaTC, thicknessM, kMPaPerM, E, mu }) {
  const { h, k, l2, l4 } = slabTerms({ thicknessM, kMPaPerM, E, mu });
  const table = RIGID.bottomUpStress;
  const band = table.kBands.filter((limit) => k > limit).length;
  const [a, b, c, d] = table[axle][tiedShoulder ? 'tied' : 'untied'][band];
  const gamma = RIGID.concrete.unitWeightKNPerM3;
  return a + b * ((gamma * h * h) / (k * l2)) + c * ((loadKN * h) / (k * l4)) + d * deltaTC;
}

/**
 * Stress at the top of the slab for top-down cracking.
 * @param {'single'|'tandem'|'tridem'} input.axle
 * @param {boolean} input.doweled  Dowel bars across the transverse joints.
 * @param {number} input.loadKN    Whole axle load; the share on one slab is taken here.
 * @param {number} input.deltaTC   Night-time temperature differential.
 */
export function topDownStress({ axle, doweled, loadKN, deltaTC, thicknessM, kMPaPerM, E, mu }) {
  const { h, k, l2, l4 } = slabTerms({ thicknessM, kMPaPerM, E, mu });
  const table = RIGID.topDownStress;
  const [a, b, c, d] = table.coefficients;
  const beta = table.beta[doweled ? 'doweled' : 'undoweled'];
  const P = loadKN * table.axleShare[axle];
  return a + b * beta * ((P * h) / (k * l4)) + c * ((h * h) / (k * l2)) + d * deltaTC;
}

/** Allowable load repetitions at a stress ratio; Infinity below the endurance limit. */
export function allowableRepetitions(stressRatio) {
  const f = RIGID.fatigue;
  if (stressRatio < f.endurance) return Infinity;
  if (stressRatio <= f.middle.upper) {
    return Math.pow(f.middle.numerator / (stressRatio - f.middle.offset), f.middle.exponent);
  }
  return Math.pow(10, (f.upper.constant - stressRatio) / f.upper.divisor);
}

/**
 * Design axle repetitions in the six-hour periods analysed for each mode.
 * @param {object} input
 * @param {number} input.twoWayCVPD          Commercial vehicles a day, both ways, at completion.
 * @param {number} input.growthRatePercent
 * @param {number} input.designPeriodYears
 * @param {number} input.axlesPerVehicle
 * @param {number} input.directionalSplit    Share in the predominant direction, 0–1.
 * @param {number} input.nightShare          Share of commercial vehicles at night, 0–1.
 * @param {number} input.shortWheelBaseShare Share with wheel base under the joint spacing, 0–1.
 */
export function designRepetitions({
  twoWayCVPD,
  growthRatePercent,
  designPeriodYears,
  axlesPerVehicle,
  directionalSplit,
  nightShare,
  shortWheelBaseShare,
}) {
  const r = growthRatePercent / 100;
  const growth = r > 0 ? (Math.pow(1 + r, designPeriodYears) - 1) / r : designPeriodYears;
  const vehicles = 365 * twoWayCVPD * growth;
  const laneAxles = vehicles * axlesPerVehicle * directionalSplit * RIGID.traffic.laneShare;
  const six = RIGID.traffic.sixHourShare;
  return {
    vehicles,
    laneAxles,
    bottomUp: laneAxles * (1 - nightShare) * six,
    topDown: laneAxles * nightShare * six * shortWheelBaseShare,
  };
}

/**
 * Fatigue damage of one axle category over its load spectrum.
 * @param {number} repetitions  Design repetitions of this category.
 * @param {Array<{loadKN:number, percent:number}>} spectrum  Class mid-points and frequencies.
 * @param {(loadKN:number) => number} stressAt
 * @param {number} flexuralMPa  Design flexural strength.
 */
export function categoryDamage(repetitions, spectrum, stressAt, flexuralMPa) {
  const rows = spectrum.map(({ loadKN, percent }) => {
    const expected = (repetitions * percent) / 100;
    const stress = stressAt(loadKN);
    const stressRatio = stress / flexuralMPa;
    const allowable = allowableRepetitions(stressRatio);
    return { loadKN, expected, stress, stressRatio, allowable, damage: expected / allowable };
  });
  return { rows, damage: rows.reduce((sum, row) => sum + row.damage, 0) };
}
