/**
 * Inputs of the overlay module and the design derived from them, in one
 * place so every screen, the report and the cost step see the same design.
 *
 * Two routes: a Benkelman beam survey designed to IRC:81-1997, and a falling
 * weight deflectometer survey designed to IRC:115-2014. Back-calculated moduli
 * are kept with the bowls they came from; moduli read from KGPBACK, the
 * program IRC:115 recommends, take their place once entered.
 */

import { IRC81, IRC115 } from '../data/overlay.js';
import { bituminousModulus } from '../engine/materials.js';
import {
  overlayTraffic,
  designBbd,
  normalisePoint,
  designModuli,
  designFwdOverlay,
  backcalcRanges,
  backcalculate,
} from '../engine/overlay.js';

export const DEFAULT_RADII = [0, 300, 600, 900, 1200, 1500, 1800];

const blankBbd = () => ({ deflectionMm: null, temperatureC: null, moisturePercent: null });
const blankFwd = (sensors) => ({ loadKN: null, deflections: Array(sensors).fill(null), temperatureC: null });

export const defaultOverlayState = () => ({
  /** 'fwd' to IRC:115, 'bbd' to IRC:81. */
  method: 'fwd',
  traffic: {
    mode: 'calculate',
    designMsa: null,
    presentCVPD: null,
    growthRatePercent: IRC115.traffic.growth.minimumPercent,
    yearsToCompletion: 1,
    designLifeYears: IRC115.traffic.designLife.years,
    laneId: 'two-lane',
    directionalSplitPercent: 50,
    vdfMode: 'indicative',
    vehicleDamageFactor: null,
  },
  bbd: {
    bituminousMm: null,
    severelyCracked: false,
    coldArea: false,
    season: 'monsoon',
    soil: 'clayLow',
    rainfall: 'low',
    points: Array.from({ length: IRC81.survey.minimumPoints }, blankBbd),
  },
  fwd: {
    bituminousMm: null,
    granularMm: null,
    condition: 'good',
    coldArea: false,
    season: 'monsoon',
    nu: { ...IRC115.backcalculation.poisson },
    radii: [...DEFAULT_RADII],
    points: Array.from({ length: IRC115.homogeneous.minimumPoints }, () => blankFwd(DEFAULT_RADII.length)),
    /** Moduli read from KGPBACK, by point; blank takes the app's back-calculation. */
    kgpback: [],
    /** The app's back-calculation, kept with the inputs it was made from. */
    backcalc: { key: '', results: [] },
  },
  overlay: {
    /** Mix of an IRC:115 overlay, its binder, and a modulus in place of the IRC:37 value. */
    mix: 'BC',
    binderGrade: 'VG30',
    modulusMPa: null,
    /** An overlay thickness to check in place of the least one found. */
    trialMm: null,
    /** Strains read from IITPAVE, microstrain. */
    iitpave: { existing: { tensile: null, vertical: null, key: '' }, overlaid: { tensile: null, vertical: null, key: '' } },
    /** How an IRC:81 overlay is laid: 'dbm' (DBM or BC) or 'bm' (BM with a BC surfacing). */
    bbdMaterial: 'dbm',
  },
});

export function migrateOverlay(saved) {
  const d = defaultOverlayState();
  if (!saved) return d;
  const fwd = { ...d.fwd, ...saved.fwd, nu: { ...d.fwd.nu, ...saved.fwd?.nu }, backcalc: { ...d.fwd.backcalc, ...saved.fwd?.backcalc } };
  const overlay = {
    ...d.overlay,
    ...saved.overlay,
    iitpave: {
      existing: { ...d.overlay.iitpave.existing, ...saved.overlay?.iitpave?.existing },
      overlaid: { ...d.overlay.iitpave.overlaid, ...saved.overlay?.iitpave?.overlaid },
    },
  };
  return {
    method: saved.method === 'bbd' ? 'bbd' : 'fwd',
    traffic: { ...d.traffic, ...saved.traffic },
    bbd: { ...d.bbd, ...saved.bbd, points: Array.isArray(saved.bbd?.points) ? saved.bbd.points : d.bbd.points },
    fwd: { ...fwd, points: Array.isArray(saved.fwd?.points) ? saved.fwd.points : d.fwd.points, kgpback: Array.isArray(saved.fwd?.kgpback) ? saved.fwd.kgpback : [] },
    overlay,
  };
}

export const newBbdPoint = blankBbd;
export const newFwdPoint = blankFwd;

export const overlayCode = (state) => (state.overlay.method === 'bbd' ? 'IRC81' : 'IRC115');

export function overlayTrafficFor(state) {
  return overlayTraffic(state.overlay.method, state.overlay.traffic, state.project);
}

/* ---------- IRC:115: the survey, and the moduli of each point ---------- */

const PLATE = { loadN: IRC115.load.targetKN * 1000, radiusMm: IRC115.load.plateDiameterMm / 2 };

/** The complete bowls, normalised to 40 kN, with the checks the code asks for. */
export function fwdSurvey(state) {
  const f = state.overlay.fwd;
  const radii = f.radii.filter((r) => Number.isFinite(r));
  const warnings = [];
  const points = [];
  f.points.forEach((p, index) => {
    const n = normalisePoint(p, radii);
    if (!n.complete) return;
    points.push({ index, ...n, temperatureC: p.temperatureC, sci: radii[1] === 300 ? n.normalised[0] - n.normalised[1] : null });
  });
  const { targetKN, toleranceKN } = IRC115.load;
  const offLoad = points.filter((p) => Math.abs(p.load - targetKN) > toleranceKN);
  if (offLoad.length) warnings.push(`${offLoad.length} drop${offLoad.length > 1 ? 's' : ''} outside ${targetKN} ± ${toleranceKN} kN, scaled to ${targetKN} kN · ${IRC115.load.ref.clause}`);
  const rising = points.filter((p) => !p.falling);
  if (rising.length) {
    warnings.push(`Point${rising.length > 1 ? 's' : ''} ${rising.map((p) => p.index + 1).join(', ')}: deflections do not fall away from the plate · ${IRC115.checks.ref.clause}`);
  }
  const hot = points.filter((p) => p.temperatureC > IRC115.maxTemperatureC.value);
  if (hot.length) warnings.push(`Measured above ${IRC115.maxTemperatureC.value} °C at ${hot.length} point${hot.length > 1 ? 's' : ''} · ${IRC115.maxTemperatureC.ref.clause}`);
  if (points.length && points.length < IRC115.homogeneous.minimumPoints) {
    warnings.push(`At least ${IRC115.homogeneous.minimumPoints} test points in a homogeneous section · ${IRC115.homogeneous.ref.clause}`);
  }
  return { radii, points, warnings };
}

/** What the back-calculation depends on; a change makes the stored results stale. */
export function backcalcKey(state) {
  const f = state.overlay.fwd;
  const survey = fwdSurvey(state);
  return JSON.stringify([survey.radii, survey.points.map((p) => [p.index, p.normalised]), f.bituminousMm, f.granularMm, f.nu, f.condition]);
}

const kgpbackOf = (state, index) => {
  const k = state.overlay.fwd.kgpback[index];
  return k && k.bituminous > 0 && k.granular > 0 && k.subgrade > 0 ? k : null;
};

/** True when the back-calculation must be run for the current bowls. */
export function backcalcStale(state) {
  const f = state.overlay.fwd;
  if (!(f.bituminousMm > 0 && f.granularMm > 0)) return false;
  const survey = fwdSurvey(state);
  const needed = survey.points.some((p) => !kgpbackOf(state, p.index));
  return needed && f.backcalc.key !== backcalcKey(state);
}

/**
 * Back-calculate every complete bowl, one at a time so the page stays live,
 * and keep the results with their key. `onProgress(done, total)` after each.
 */
export function runBackcalculation(state, onProgress) {
  const f = state.overlay.fwd;
  const survey = fwdSurvey(state);
  const key = backcalcKey(state);
  const nu = [f.nu.bituminous, f.nu.granular, f.nu.subgrade];
  const results = [];
  let i = 0;
  return new Promise((resolve) => {
    const next = () => {
      if (i >= survey.points.length) {
        f.backcalc = { key, results };
        resolve(results);
        return;
      }
      const p = survey.points[i];
      const ranges = backcalcRanges({ radii: survey.radii, normalised: p.normalised, loadN: PLATE.loadN, nu: f.nu.subgrade, condition: f.condition });
      const fit = backcalculate({ radii: survey.radii, measured: p.normalised, thicknesses: [f.bituminousMm, f.granularMm], nu, plate: PLATE, ranges });
      results.push({ index: p.index, E: fit.E, rmsPercent: fit.rmsPercent, atBound: fit.atBound, ranges: [ranges.bituminous, ranges.granular, ranges.subgrade] });
      i += 1;
      onProgress?.(i, survey.points.length);
      setTimeout(next, 0);
    };
    next();
  });
}

/** Moduli of each complete point: KGPBACK where entered, else the app's. */
export function pointModuli(state) {
  const f = state.overlay.fwd;
  const survey = fwdSurvey(state);
  const fresh = f.backcalc.key === backcalcKey(state);
  return survey.points.map((p) => {
    const k = kgpbackOf(state, p.index);
    const app = fresh ? f.backcalc.results.find((r) => r.index === p.index) : null;
    const E = k ? [k.bituminous, k.granular, k.subgrade] : app ? app.E : null;
    return { index: p.index, temperatureC: p.temperatureC, source: k ? 'KGPBACK' : app ? 'App' : null, E, app, sci: p.sci };
  });
}

/** The overlay mix modulus: entered, or IRC:37 Table 9.2 at 35 °C for the binder. */
export function overlayModulusOf(state) {
  const o = state.overlay.overlay;
  return o.modulusMPa > 0 ? o.modulusMPa : bituminousModulus(o.binderGrade, 35);
}

/**
 * The pavement as IITPAVE takes it; strains entered are kept with this key,
 * and those for an overlay with its modulus and thickness after it.
 */
export function iitpaveKey(state, design) {
  const f = state.overlay.fwd;
  return [f.bituminousMm, f.granularMm, Math.round(design.bituminous), Math.round(design.granular), design.subgrade.toFixed(1), f.nu.bituminous, f.nu.granular, f.nu.subgrade].join('|');
}

/* ---------- The design ---------- */

const ceil5 = (v) => Math.ceil(v / 5) * 5;

function bbdSlots(state, design) {
  const o = state.overlay.overlay;
  const b = state.overlay.bbd;
  const existing = b.bituminousMm > 0 ? [{ slotId: 'EXISTING', materialId: 'Existing pavement', label: 'Existing pavement', behaviour: 'bituminous', thicknessMm: b.bituminousMm, existing: true }] : [];
  if (!design.structural) return [...existing, { slotId: 'SUBGRADE', label: 'Subgrade', behaviour: 'subgrade', thicknessMm: 0 }];
  const min = IRC81.minimum;
  const eq = IRC81.equivalence;
  const layers =
    o.bbdMaterial === 'bm'
      ? [
          { slotId: 'BC', materialId: 'BC', label: 'Bituminous concrete', behaviour: 'bituminous', thicknessMm: min.bcMm },
          { slotId: 'BM', materialId: 'BM', label: 'Bituminous macadam', behaviour: 'bituminous', thicknessMm: Math.max(ceil5(design.overlayBmMm), min.bmMm) },
        ]
      : [
          {
            slotId: 'OVERLAY',
            materialId: 'DBM / BC',
            label: 'DBM and BC',
            behaviour: 'bituminous',
            thicknessMm: Math.max(ceil5(design.overlayBmMm * eq.dbmCm), ceil5(min.bmMm * eq.dbmCm + min.bcMm)),
          },
        ];
  return [...layers, ...existing, { slotId: 'SUBGRADE', label: 'Subgrade', behaviour: 'subgrade', thicknessMm: 0 }];
}

function fwdSlots(state, design) {
  const o = state.overlay.overlay;
  const f = state.overlay.fwd;
  const overlay = design.overlayMm > 0
    ? [{ slotId: 'OVERLAY', materialId: o.mix, label: `${o.mix === 'BC' ? 'Bituminous concrete' : 'Dense bituminous macadam'}, ${o.binderGrade}`, behaviour: 'bituminous', thicknessMm: design.overlayMm }]
    : [];
  return [
    ...overlay,
    { slotId: 'EXISTING_BIT', materialId: 'Existing bituminous', label: 'Existing bituminous layers', behaviour: 'bituminous', thicknessMm: f.bituminousMm, existing: true },
    { slotId: 'EXISTING_GRAN', materialId: 'Existing granular', label: 'Existing granular layers', behaviour: 'granular', thicknessMm: f.granularMm, existing: true },
    { slotId: 'SUBGRADE', label: 'Subgrade', behaviour: 'subgrade', thicknessMm: 0 },
  ];
}

/**
 * The overlay design on the go.
 * @returns {{ok:boolean, message?:string, method, traffic, ...}}
 */
let memo = { key: null, value: null };

export function overlayDesignFor(state) {
  // Asked for by several parts of each redraw; the last design is kept while its inputs stand.
  const key = JSON.stringify([state.overlay, state.project.roadCategory, state.project.terrain]);
  if (memo.key !== key) memo = { key, value: computeOverlayDesign(state) };
  return memo.value;
}

function computeOverlayDesign(state) {
  const method = state.overlay.method;
  const traffic = overlayTrafficFor(state);
  if (!traffic.ok) return { ok: false, stage: 'traffic', message: traffic.message, method, traffic };

  if (method === 'bbd') {
    const b = state.overlay.bbd;
    const design = designBbd({ ...b, roadCategory: state.project.roadCategory, designMsa: traffic.msa });
    if (!design.ok) return { ok: false, stage: 'survey', message: design.message, method, traffic, design };
    const slots = bbdSlots(state, design);
    const provided = slots.filter((s) => !s.existing && s.thicknessMm > 0);
    return {
      ok: true,
      method,
      traffic,
      design,
      slots,
      overlayMm: provided.reduce((s, l) => s + l.thicknessMm, 0),
      safe: true,
      warnings: [...traffic.warnings, ...design.warnings],
    };
  }

  const f = state.overlay.fwd;
  const survey = fwdSurvey(state);
  if (!(f.bituminousMm > 0 && f.granularMm > 0)) return { ok: false, stage: 'survey', message: 'Enter the layer thicknesses', method, traffic, survey };
  if (survey.points.length < 2) return { ok: false, stage: 'survey', message: 'Enter the deflection bowls', method, traffic, survey };
  const points = pointModuli(state);
  if (points.some((p) => !p.E)) return { ok: false, stage: 'moduli', message: 'Back-calculate the layer moduli', method, traffic, survey, points };
  const moduli = designModuli({
    moduli: points.map((p) => ({ bituminous: p.E[0], granular: p.E[1], subgrade: p.E[2], temperatureC: p.temperatureC })),
    bituminousMm: f.bituminousMm,
    condition: f.condition,
    coldArea: f.coldArea,
    season: f.season,
  });
  if (moduli.tempApplies && points.some((p) => !Number.isFinite(p.temperatureC))) {
    return { ok: false, stage: 'survey', message: 'Enter the pavement temperature at every point', method, traffic, survey, points };
  }
  const o = state.overlay.overlay;
  const overlayModulus = overlayModulusOf(state);
  // IITPAVE strains count only for the layer system they were read for.
  const base = iitpaveKey(state, moduli.design);
  const iit = o.iitpave;
  const measured = {
    existing: iit.existing.key === base ? iit.existing : null,
    overlaid: iit.overlaid.key?.startsWith(`${base}|${Math.round(overlayModulus)}|`)
      ? { ...iit.overlaid, forMm: Number(iit.overlaid.key.split('|').pop()) }
      : null,
  };
  const design = designFwdOverlay({
    moduli: moduli.design,
    bituminousMm: f.bituminousMm,
    granularMm: f.granularMm,
    nu: f.nu,
    overlayModulusMPa: overlayModulus,
    designMsa: traffic.msa,
    trialMm: o.trialMm,
    measured,
  });
  if (!design.ok) return { ok: false, stage: 'result', message: design.message, method, traffic, survey, points, moduli, design };
  const slots = fwdSlots(state, design);
  return {
    ok: true,
    method,
    traffic,
    survey,
    points,
    moduli,
    overlayModulus,
    design,
    slots,
    overlayMm: design.overlayMm,
    safe: design.needed ? design.withOverlay.safe : true,
    warnings: [...traffic.warnings, ...survey.warnings, ...moduli.warnings, ...design.warnings],
  };
}
