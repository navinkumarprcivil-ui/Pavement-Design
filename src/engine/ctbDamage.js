/**
 * Cumulative fatigue damage of a cement treated base, IRC:37-2018 Cl. 3.6.3.2.
 *
 * Every axle load class on the road uses up a share of the CTB's fatigue life.
 * A tandem or tridem axle counts as two or three single axles sharing its load,
 * and each class's tensile stress at the underside of the CTB comes from the
 * same layered elastic analysis as the other checks, at the CTB contact stress.
 */

import { analyze } from './elastic.js';
import { CRITERIA, STANDARD_AXLE } from '../data/ircConstants.js';

const SPEC = CRITERIA.cementedDamage;
const RUPTURE = CRITERIA.ctbRupture;

export const AXLE_TYPES = ['single', 'tandem', 'tridem'];

/** Modulus of rupture from the 28-day UCS, held to the material's cap. */
export function modulusOfRupture(ucsMPa, materialId) {
  const material = RUPTURE.materials.find((m) => m.id === materialId) || RUPTURE.materials[0];
  const fromUcs = RUPTURE.ucsShare * (ucsMPa || 0);
  const value = Math.min(fromUcs, material.maxMPa);
  return {
    value,
    material,
    step: {
      title: 'Modulus of rupture of the CTB',
      formula: `MRup = ${RUPTURE.ucsShare} x UCS(28 day), not above ${material.maxMPa} MPa for ${material.label.toLowerCase()}`,
      substitution: `MRup = min(${RUPTURE.ucsShare} x ${ucsMPa}, ${material.maxMPa})`,
      result: `MRup = ${value.toFixed(2)} MPa`,
      ref: RUPTURE.ref,
      verified: RUPTURE.verified,
    },
  };
}

/** The key a stress read for one equivalent single axle load is filed under. */
export function stressKey(singleKN) {
  return String(Math.round(singleKN * 10) / 10);
}

/** Repetitions of one axle class the CTB can carry, at a given stress ratio. */
export function ctbFatigueLife(stressRatio) {
  return Math.pow(10, (SPEC.intercept - stressRatio) / SPEC.slope);
}

/**
 * Expected repetitions of every axle load class over the design period, from
 * the commercial vehicles in the design lane and the axle load survey.
 *
 * @param {object} input
 * @param {number} input.vehicles  Cumulative commercial vehicles in the design lane.
 * @param {number} input.axlesPerVehicle
 * @param {{single:number,tandem:number,tridem:number}} input.axleMix  % of all axles.
 * @param {{single:Array,tandem:Array,tridem:Array}} input.spectrum  Rows of
 *        {loadKN, percent}: the share of that axle type in each load class.
 */
export function axleRepetitions({ vehicles, axlesPerVehicle, axleMix, spectrum }) {
  const axles = vehicles * (axlesPerVehicle || 0);
  const classes = [];
  for (const axle of AXLE_TYPES) {
    const ofType = (axles * (axleMix?.[axle] || 0)) / 100;
    for (const row of spectrum?.[axle] || []) {
      if (!(row.loadKN > 0) || !(row.percent > 0)) continue;
      classes.push({ axle, loadKN: row.loadKN, repetitions: (ofType * row.percent) / 100 });
    }
  }
  return classes;
}

/**
 * Largest horizontal tensile stress at the underside of the CTB under one
 * single axle on dual wheels: under a wheel and between the pair.
 */
function ctbStress(layers, ctbIndex, depthMm, axleKN) {
  const points = [0, STANDARD_AXLE.dualSpacingMm / 2].map((x) => ({ x, y: 0, z: depthMm, layerIndex: ctbIndex }));
  const responses = analyze({
    layers,
    load: {
      wheelLoadN: (axleKN * 1000) / 4,
      tyrePressureMPa: SPEC.tyrePressureMPa,
      dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
    },
    points,
  });
  return Math.max(...responses.map((r) => Math.max(r.sigmaXX, r.sigmaYY)));
}

/**
 * Damage summed over every axle load class.
 *
 * @param {object} input
 * @param {Array<{h:number,E:number,nu:number}>} input.layers  Elastic layer stack.
 * @param {number} input.ctbIndex
 * @param {number} input.depthMm  Depth to the underside of the CTB.
 * @param {number} input.modulusOfRuptureMPa
 * @param {Array<{axle:string,loadKN:number,repetitions:number}>} input.classes
 * @param {Object<string,number>} [input.stresses]  Stresses read from IITPAVE,
 *        keyed by stressKey(single axle load), in place of the computed ones.
 */
export function cumulativeDamage({ layers, ctbIndex, depthMm, modulusOfRuptureMPa, classes, stresses: measured = {} }) {
  // Classes that share an equivalent single axle load share one analysis.
  const stresses = new Map();
  const computedAt = (singleKN) => {
    const key = stressKey(singleKN);
    if (!stresses.has(key)) stresses.set(key, ctbStress(layers, ctbIndex, depthMm, singleKN));
    return stresses.get(key);
  };
  const stressAt = (singleKN) => {
    const entered = measured[stressKey(singleKN)];
    return entered > 0 ? entered : computedAt(singleKN);
  };

  const rows = classes.map((c) => {
    const count = SPEC.singleAxlesPer[c.axle] || 1;
    const singleKN = c.loadKN / count;
    const repetitions = c.repetitions * count;
    const stressMPa = Math.max(0, stressAt(singleKN));
    const source = measured[stressKey(singleKN)] > 0 ? 'IITPAVE' : null;
    const computedMPa = Math.max(0, computedAt(singleKN));
    const stressRatio = stressMPa / modulusOfRuptureMPa;
    const life = ctbFatigueLife(stressRatio);
    return { ...c, singleKN, singleRepetitions: repetitions, stressMPa, stressRatio, life, damage: repetitions / life, source, computedMPa };
  });

  const byAxle = Object.fromEntries(
    AXLE_TYPES.map((axle) => [axle, rows.filter((r) => r.axle === axle).reduce((sum, r) => sum + r.damage, 0)])
  );
  const total = byAxle.single + byAxle.tandem + byAxle.tridem;

  return {
    rows,
    byAxle,
    total,
    modulusOfRuptureMPa,
    safe: total <= SPEC.allowableDamage,
    formula: 'log10 Nfi = (0.972 - σt / MRup) / 0.0825;  CFD = Σ ni / Nfi',
    ref: SPEC.ref,
    verified: SPEC.verified,
  };
}
