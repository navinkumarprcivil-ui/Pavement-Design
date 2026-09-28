/**
 * The cement treated base's axle loads and strength, and what the flexible
 * design derives from them for its cumulative fatigue damage.
 */

import { describeCombination, BEHAVIOUR } from '../data/layerCatalog.js';
import { CRITERIA, TRAFFIC } from '../data/ircConstants.js';
import { axleRepetitions, modulusOfRupture } from '../engine/ctbDamage.js';
import { AXLES, defaultSpectrum, frontAxlePercent, spectrumTotal } from './spectrum.js';

export const defaultCtbState = () => ({
  material: 'aggregate',
  ucsMPa: 7,
  axlesPerVehicle: 2.35,
  axleMix: { single: 15, tandem: 25, tridem: 15 },
  spectrum: defaultSpectrum(),
});

/** Whether the chosen composition has a cement treated base. */
export function hasCTB(state) {
  return describeCombination(state.combination).base?.behaviour === BEHAVIOUR.CEMENTED;
}

const count = (value) => Math.round(value).toLocaleString('en-IN');

/**
 * Axle load classes with their expected repetitions, the modulus of rupture,
 * and the working behind both.
 *
 * @param {object} state  App state.
 * @param {object} traffic  From designTraffic(state).
 */
export function ctbDamageInput(state, traffic) {
  const ctb = state.ctb;
  const t = traffic.result;
  const lane = traffic.lane.value;
  const vehicles = 365 * t.initialCVPD * lane * t.growthFactor;
  const rupture = modulusOfRupture(ctb.ucsMPa, ctb.material);
  const classes = axleRepetitions({
    vehicles,
    axlesPerVehicle: ctb.axlesPerVehicle,
    axleMix: ctb.axleMix,
    spectrum: ctb.spectrum,
  });

  const warnings = [];
  if (frontAxlePercent(ctb.axleMix) < 0) warnings.push('Axle mix adds up to more than 100%');
  for (const axle of AXLES) {
    const total = spectrumTotal(ctb.spectrum[axle.id]);
    if ((ctb.axleMix[axle.id] || 0) > 0 && total > 0 && Math.abs(total - 100) > 0.5) {
      warnings.push(`${axle.label} spectrum adds up to ${total.toFixed(1)}%, not 100%`);
    }
  }

  const mix = AXLES.map((a) => `${ctb.axleMix[a.id] || 0}% ${a.id}`).join(', ');
  const steps = [
    rupture.step,
    {
      title: 'Commercial vehicles in the design lane over the design period',
      formula: 'Nv = 365 x A x D x [(1 + r)^n - 1] / r',
      substitution: `Nv = 365 x ${t.initialCVPD.toFixed(1)} x ${lane} x ${t.growthFactor.toFixed(3)}`,
      result: `Nv = ${count(vehicles)}`,
      ref: TRAFFIC.growthEquation.ref,
      verified: TRAFFIC.growthEquation.verified,
    },
    {
      title: 'Expected repetitions of each axle load class',
      formula: 'ni = Nv x axles per vehicle x share of the axle type x share of the load class',
      substitution: `ni = ${count(vehicles)} x ${ctb.axlesPerVehicle} x (${mix}) x class share`,
      result: `${classes.length} load classes, ${count(classes.reduce((sum, c) => sum + c.repetitions, 0))} axles`,
      ref: CRITERIA.cementedDamage.ref,
      verified: CRITERIA.cementedDamage.verified,
    },
  ];

  const ready = classes.length > 0 && rupture.value > 0;
  return {
    vehicles,
    rupture,
    classes,
    warnings,
    steps,
    ready,
    /** What the design engine takes, or null when there is nothing to sum. */
    engineInput: ready ? { classes, modulusOfRuptureMPa: rupture.value } : null,
  };
}
