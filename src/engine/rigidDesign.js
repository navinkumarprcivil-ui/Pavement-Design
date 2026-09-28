/**
 * Thickness design of a jointed plain concrete pavement — IRC:58-2015.
 *
 * Foundation k from Tables 2 – 4, temperature differentials from Table 1,
 * design repetitions from Cl. 5.5.2, and the cumulative fatigue damage of
 * Cl. 6.3 summed over the axle load spectrum. The slab thickness is the
 * thinnest, in 10 mm steps, whose bottom-up and top-down damage together do
 * not exceed 1.
 */

import { RIGID } from '../data/ircConstants.js';
import {
  radiusOfRelativeStiffness,
  designFlexuralStrength,
  nightTemperatureDifferential,
  bottomUpStress,
  topDownStress,
  designRepetitions,
  categoryDamage,
} from './rigidFatigue.js';

const STEP_MM = 10;
const SEARCH_MM = { from: 150, to: 500 };

/** Linear interpolation in a table, clamped at its ends. */
function interpolate(xs, ys, x) {
  if (x <= xs[0]) return { value: ys[0], outside: x < xs[0] };
  const last = xs.length - 1;
  if (x >= xs[last]) return { value: ys[last], outside: x > xs[last] };
  const i = xs.findIndex((xi) => xi >= x);
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return { value: ys[i - 1] + t * (ys[i] - ys[i - 1]), outside: false };
}

/** Interpolate across rows (subgrade k), then across columns (thickness). */
function interpolate2D(rowXs, colXs, grid, rowX, colX) {
  const across = grid.map((row) => interpolate(colXs, row, colX));
  const down = interpolate(rowXs.slice(0, grid.length), across.map((a) => a.value), rowX);
  return { value: down.value, outside: down.outside || across.some((a) => a.outside) };
}

export function subgradeKFromCBR(cbr) {
  const t = RIGID.subgradeK;
  return interpolate(t.cbr, t.k, cbr);
}

/**
 * Effective k of the foundation.
 * @param {object} f
 * @param {'dlc'|'cementTreated'|'granular'|'measured'} f.subBase
 * @param {number} f.subgradeCBR
 * @param {number} f.subBaseMm   DLC, cement treated or granular sub-base thickness.
 * @param {number} [f.measuredK] Plate load or FWD value, used as it stands.
 */
export function foundationK(f) {
  const warnings = [];
  if (f.subBase === 'measured') {
    return { subgradeK: null, k: f.measuredK, warnings };
  }

  const sub = subgradeKFromCBR(f.subgradeCBR);
  if (sub.outside) warnings.push('Subgrade CBR is outside Table 2');

  let effective;
  if (f.subBase === 'dlc') {
    const t = RIGID.dlcK;
    effective = interpolate2D(t.subgradeK, t.thicknessesMm, t.subgradeK.map((_, i) => t.k.map((row) => row[i])), sub.value, f.subBaseMm);
    effective.value = Math.min(effective.value, t.maximumK);
  } else {
    const t = RIGID.subBaseK;
    const table = t[f.subBase];
    effective = interpolate2D(t.subgradeK, table.thicknessesMm, table.k, sub.value, f.subBaseMm);
  }
  if (effective.outside) warnings.push('Foundation is outside the range of the k table; the nearest value is used');

  return { subgradeK: sub.value, k: effective.value, warnings };
}

/**
 * Day-time differential for a slab. Table 1 rises with thickness, so the
 * column for the next listed thickness up is taken.
 */
export function dayTemperatureDifferential(temperature, thicknessMm) {
  if (temperature.mode === 'site') return temperature.dayC;
  const t = RIGID.temperature;
  const zone = t.zones.find((z) => z.id === temperature.zone) || t.zones[0];
  const column = t.thicknessesMm.findIndex((mm) => mm >= thicknessMm);
  return zone.values[column === -1 ? zone.values.length - 1 : column];
}

/** Recommended dowel bars for a slab thickness, or null below the minimum. */
export function dowelBars(thicknessMm) {
  const t = RIGID.dowels;
  if (thicknessMm < t.minimumSlabMm) return null;
  const row = t.rows.find(([mm]) => mm >= thicknessMm) || t.rows[t.rows.length - 1];
  const [, diameterMm, lengthMm, spacingMm] = row;
  return { diameterMm, lengthMm, spacingMm };
}

/**
 * Design repetitions for the rigid design lane.
 * @param {object} traffic  See defaultRigidState in main.js for the fields.
 */
export function rigidTraffic(traffic) {
  const warnings = [];
  const floor = RIGID.traffic.minimumGrowthRatePercent;
  const growth = Math.max(traffic.growthRatePercent ?? 0, floor);
  if ((traffic.growthRatePercent ?? 0) < floor) warnings.push(`Growth rate taken as the ${floor}% minimum`);

  const opening = traffic.twoWayCVPD * Math.pow(1 + growth / 100, traffic.yearsToCompletion || 0);
  if (opening <= RIGID.scope.minimumCVPD) {
    warnings.push(`${RIGID.scope.minimumCVPD} CVPD or fewer: IRC:SP:62 governs`);
  }

  const reps = designRepetitions({
    twoWayCVPD: opening,
    growthRatePercent: growth,
    designPeriodYears: traffic.designPeriodYears,
    axlesPerVehicle: traffic.axlesPerVehicle,
    directionalSplit: traffic.carriageway === 'divided' ? traffic.directionalSplitPercent / 100 : 1,
    nightShare: traffic.nightSharePercent / 100,
    shortWheelBaseShare: traffic.shortWheelBasePercent / 100,
  });

  const mix = traffic.axleMix;
  const share = (id) => (mix[id] || 0) / 100;
  return {
    ...reps,
    openingCVPD: opening,
    growthRatePercent: growth,
    categories: {
      bottomUp: { single: reps.bottomUp * share('single'), tandem: reps.bottomUp * share('tandem') },
      topDown: {
        single: reps.topDown * share('single'),
        tandem: reps.topDown * share('tandem'),
        tridem: reps.topDown * share('tridem'),
      },
    },
    warnings,
  };
}

/** Rows of a spectrum with a load and a positive share. */
function usable(rows = []) {
  return rows.filter((r) => Number.isFinite(r.loadKN) && r.loadKN > 0 && r.percent > 0);
}

/**
 * Cumulative fatigue damage of one slab thickness.
 * @param {object} input
 * @param {number} input.thicknessMm
 * @param {number} input.kMPaPerM
 * @param {object} input.traffic      Output of rigidTraffic.
 * @param {object} input.spectrum     {single, tandem, tridem}: [{loadKN, percent}]
 * @param {object} input.slab         {shoulder, doweled, flexural28MPa, ninetyDay, E, mu}
 * @param {object} input.temperature  {mode:'zone', zone} or {mode:'site', dayC}
 */
export function evaluateSlab({ thicknessMm, kMPaPerM, traffic, spectrum, slab, temperature }) {
  const thicknessM = thicknessMm / 1000;
  const { E, mu } = slab;
  const flexuralMPa = slab.ninetyDay ? designFlexuralStrength(slab.flexural28MPa) : slab.flexural28MPa;
  const dayC = dayTemperatureDifferential(temperature, thicknessMm);
  const nightC = nightTemperatureDifferential(dayC);
  // A widened outer lane relieves the edge about as much as a tied shoulder.
  const tiedShoulder = slab.shoulder !== 'none';
  const shared = { thicknessM, kMPaPerM, E, mu };

  const bottom = (axle) =>
    categoryDamage(
      traffic.categories.bottomUp[axle],
      usable(spectrum[axle]),
      (loadKN) => bottomUpStress({ ...shared, axle, tiedShoulder, loadKN, deltaTC: dayC }),
      flexuralMPa
    );
  const top = (axle) =>
    categoryDamage(
      traffic.categories.topDown[axle],
      usable(spectrum[axle]),
      (loadKN) => topDownStress({ ...shared, axle, doweled: slab.doweled, loadKN, deltaTC: nightC }),
      flexuralMPa
    );

  const bottomUp = { single: bottom('single'), tandem: bottom('tandem') };
  const topDown = { single: top('single'), tandem: top('tandem'), tridem: top('tridem') };
  const cfdBottomUp = bottomUp.single.damage + bottomUp.tandem.damage;
  const cfdTopDown = topDown.single.damage + topDown.tandem.damage + topDown.tridem.damage;
  const cfd = cfdBottomUp + cfdTopDown;

  return {
    thicknessMm,
    kMPaPerM,
    radiusOfRelativeStiffnessM: radiusOfRelativeStiffness({ thicknessM, kMPaPerM, E, mu }),
    flexuralMPa,
    dayC,
    nightC,
    bottomUp,
    topDown,
    cfdBottomUp,
    cfdTopDown,
    cfd,
    safe: cfd <= RIGID.criterion.maximumCFD,
  };
}

/** The thinnest slab, in 10 mm steps, whose total damage is at most 1. */
export function designSlab(input) {
  for (let mm = SEARCH_MM.from; mm <= SEARCH_MM.to; mm += STEP_MM) {
    const trial = evaluateSlab({ ...input, thicknessMm: mm });
    if (trial.safe) return { found: true, thicknessMm: mm, trial };
  }
  return { found: false, thicknessMm: null, trial: null };
}
