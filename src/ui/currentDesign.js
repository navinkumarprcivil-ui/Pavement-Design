/**
 * The design on the go — flexible, rigid or low volume — as the cost and compare screens
 * need it: its layers, a name, summary chips, and the record a trial saves.
 */

import { msa } from './dom.js';
import { combinationName } from '../data/layerCatalog.js';
import { hasCTB } from './ctbProject.js';
import { iitpaveMissing } from './iitpave.js';
import { ruralDesignFor, lvRigidDesignFor } from './lowVolumeProject.js';
import { overlayDesignFor } from './overlayProject.js';

function flexible(app) {
  const result = app.state.result;
  if (!result) return null;
  const { combination } = app.state;
  return {
    type: 'flexible',
    slots: result.slots,
    safe: result.safe,
    name: combinationName(combination),
    chips: [`${result.totalThicknessMm} mm`, msa(result.governingLifeMsa), iitpaveMissing(result, app.state).length ? 'Provisional' : 'IITPAVE'],
    inputsScreen: 'inputs',
    record: () => ({
      pavementType: 'flexible',
      combination: { ...combination },
      thicknesses: { ...app.state.thicknesses },
      materials: { ...app.state.materials },
      mix: { ...app.state.mix },
      ctb: hasCTB(app.state) ? structuredClone(app.state.ctb) : null,
      construction: { ...app.state.construction },
      roadCategory: app.state.project.roadCategory,
      designTrafficMsa: result.designTrafficMsa,
      totalThicknessMm: result.totalThicknessMm,
      governingLifeMsa: result.governingLifeMsa,
      reliability: result.reliability,
    }),
  };
}

function rigid(app) {
  const result = app.state.rigidResult;
  if (!result) return null;
  const layers = result.slots.filter((s) => s.thicknessMm > 0);
  return {
    type: 'rigid',
    slots: result.slots,
    safe: result.safe,
    name: result.name,
    chips: [`${result.adoptedMm} mm ${result.bonded ? 'PQC, bonded' : 'slab'}`, `CFD ${result.evaluation.cfd.toFixed(2)}`],
    inputsScreen: 'rigidSlab',
    record: () => ({
      pavementType: 'rigid',
      rigid: structuredClone(app.state.rigid),
      slabMm: result.adoptedMm,
      cfd: result.evaluation.cfd,
      totalThicknessMm: layers.reduce((sum, s) => sum + s.thicknessMm, 0),
    }),
  };
}

function rural(app) {
  const r = ruralDesignFor(app.state);
  const { design } = r;
  return {
    type: 'rural',
    slots: design.slots,
    safe: !design.aboveScope,
    name: `SP:72 · ${r.name}`,
    chips: [`${design.totalThicknessMm} mm`, `${Math.round(r.esal).toLocaleString('en-IN')} ESAL`],
    inputsScreen: 'rural',
    record: () => ({
      pavementType: 'rural',
      rural: structuredClone(app.state.rural),
      subgradeCBR: r.subgradeCBR,
      esal: r.esal,
      designTrafficMsa: r.esal / 1e6,
      totalThicknessMm: design.totalThicknessMm,
    }),
  };
}

function ruralRigid(app) {
  const r = lvRigidDesignFor(app.state);
  if (!r.ok) return null;
  const e = r.design.adopted;
  const layers = r.slots.filter((s) => s.thicknessMm > 0);
  return {
    type: 'ruralRigid',
    slots: r.slots,
    safe: r.safe,
    name: `SP:62 · ${r.name}`,
    chips: [`${e.thicknessMm} mm slab`, `Case ${r.design.case}`],
    inputsScreen: 'lvRigidSlab',
    record: () => ({
      pavementType: 'ruralRigid',
      lvRigid: structuredClone(app.state.lvRigid),
      slabMm: e.thicknessMm,
      cfd: e.fatigue ? e.fatigue.cfd : null,
      totalThicknessMm: layers.reduce((sum, s) => sum + s.thicknessMm, 0),
    }),
  };
}

function overlay(app) {
  const r = overlayDesignFor(app.state);
  if (!r.ok) return null;
  const code = r.method === 'bbd' ? 'IRC:81' : 'IRC:115';
  return {
    type: 'overlay',
    slots: r.slots,
    safe: r.safe,
    name: `${code} · ${r.overlayMm > 0 ? `${r.overlayMm} mm overlay` : 'No structural overlay'}`,
    chips: [r.overlayMm > 0 ? `${r.overlayMm} mm` : 'No overlay', msa(r.traffic.msa)],
    inputsScreen: 'overlayResult',
    record: () => ({
      pavementType: 'overlay',
      overlay: structuredClone(app.state.overlay),
      method: r.method,
      designTrafficMsa: r.traffic.msa,
      totalThicknessMm: r.overlayMm,
      governingLifeMsa: r.method === 'fwd' ? (r.design.withOverlay || r.design.existing).lifeMsa : null,
      characteristicDeflectionMm: r.method === 'bbd' ? r.design.Dc : null,
    }),
  };
}

const DESIGNS = { flexible, rigid, rural, ruralRigid, overlay };

export function currentDesign(app) {
  return (DESIGNS[app.state.pavementType] || flexible)(app);
}
