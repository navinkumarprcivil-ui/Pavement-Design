/**
 * Inputs of the two low volume road modules, and the designs derived from
 * them, in one place so a screen never depends on another having been visited.
 */

import { sp72Traffic, designSP72 } from '../engine/ruralSP72.js';
import { designSP62 } from '../engine/ruralRigid.js';
import { SP72 } from '../data/sp72.js';
import { SP62 } from '../data/sp62.js';

/* ---------- IRC:SP:72, flexible ---------- */

export const defaultRuralState = () => ({
  traffic: {
    mode: 'counts',
    hcv: 10,
    mcv: 40,
    cvpd: 50,
    ladenPercent: 50,
    vdfMode: 'indicative',
    vdfHcv: null,
    vdfMcv: null,
    harvest: { enabled: false, countSeason: 'peak', rise: 1, seasonDays: 75, seasons: SP72.harvest.seasons },
    yearsToOpening: 1,
    growthPercent: SP72.growth.defaultPercent,
    designLifeYears: SP72.designLife.years,
    laneId: 'single',
  },
  design: {
    subgradeCBR: 5,
    baseType: 'granular',
    rainfall: 'under1000',
    frost: false,
    surfacing: 'auto',
    surfaceGravelMm: SP72.surfaceGravel.maxMm,
    gravelSubBaseCBR: null,
    gravelCBR80Available: true,
    existingMm: null,
  },
  /** Soil test results for a first estimate of CBR (Appendix B). */
  quick: { plastic: true, passing75Percent: null, plasticityIndex: null, d60Mm: null },
});

export function migrateRural(saved) {
  const d = defaultRuralState();
  if (!saved) return d;
  return {
    traffic: { ...d.traffic, ...saved.traffic, harvest: { ...d.traffic.harvest, ...saved.traffic?.harvest } },
    design: { ...d.design, ...saved.design },
    quick: { ...d.quick, ...saved.quick },
  };
}

/** Construction types that strengthen an existing road. */
export const UPGRADES = ['overlay', 'rehabilitation'];

export function ruralTrafficFor(state) {
  return sp72Traffic(state.rural.traffic);
}

/** The SP:72 design, with what the cost, compare and report steps keep of it. */
export function ruralDesignFor(state) {
  const traffic = ruralTrafficFor(state);
  const d = state.rural.design;
  const upgrade = UPGRADES.includes(state.project.constructionType);
  const design = designSP72({
    ...d,
    esal: traffic.esal,
    newRoad: state.project.constructionType === 'greenfield',
    existingMm: upgrade ? d.existingMm : null,
  });
  return {
    traffic,
    design,
    slots: design.slots,
    name: `${design.category.id} · ${design.subgradeClass.id} · ${design.baseType === 'cemented' ? 'Cement treated' : design.gravelRoad ? 'Gravel road' : 'Granular'}`,
    esal: traffic.esal,
    subgradeCBR: d.subgradeCBR,
  };
}

/* ---------- IRC:SP:62, rigid ---------- */

export const defaultLvRigidState = () => ({
  traffic: {
    presentCVPD: 100,
    growthPercent: 5,
    yearsToCompletion: 1,
    designYears: SP62.designPeriod.years,
    heavySharePercent: SP62.repetitions.heavySharePercent,
  },
  slab: {
    subgradeCBR: 4,
    subBase: 'granular',
    measuredK: null,
    strengthMode: 'fck',
    fck: SP62.concrete.minimumFck,
    flexural28: null,
    temperature: { mode: 'zone', zone: 'I', deltaC: null },
    jointM: SP62.scope.laneWidthM,
    tractor: true,
    trialMm: null,
  },
});

export function migrateLvRigid(saved) {
  const d = defaultLvRigidState();
  if (!saved) return d;
  return {
    traffic: { ...d.traffic, ...saved.traffic },
    slab: { ...d.slab, ...saved.slab, temperature: { ...d.slab.temperature, ...saved.slab?.temperature } },
  };
}

export function lvRigidDesignFor(state) {
  const { traffic, slab } = state.lvRigid;
  const design = designSP62({ ...traffic, ...slab });
  const e = design.adopted;
  return {
    design,
    slots: design.slots,
    safe: design.safe,
    name: `${e.thicknessMm} mm · ${slab.subBase === 'cementitious' ? 'Cementitious' : slab.subBase === 'measured' ? 'Measured k' : 'Granular'} · ${slab.jointM} m joints`,
  };
}
