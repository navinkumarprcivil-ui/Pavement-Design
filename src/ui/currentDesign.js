/**
 * The design on the go — flexible or rigid — as the cost and compare screens
 * need it: its layers, a name, summary chips, and the record a trial saves.
 */

import { msa } from './dom.js';
import { combinationName } from '../data/layerCatalog.js';
import { hasCTB } from './ctbProject.js';

function flexible(app) {
  const result = app.state.result;
  if (!result) return null;
  const { combination } = app.state;
  return {
    type: 'flexible',
    slots: result.slots,
    safe: result.safe,
    name: combinationName(combination),
    chips: [`${result.totalThicknessMm} mm`, msa(result.governingLifeMsa)],
    inputsScreen: 'inputs',
    record: () => ({
      pavementType: 'flexible',
      combination: { ...combination },
      thicknesses: { ...app.state.thicknesses },
      materials: { ...app.state.materials },
      mix: { ...app.state.mix },
      ctb: hasCTB(app.state) ? structuredClone(app.state.ctb) : null,
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
    chips: [`${result.adoptedMm} mm slab`, `CFD ${result.evaluation.cfd.toFixed(2)}`],
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
  const result = app.state.ruralResult;
  if (!result) return null;
  const { design } = result;
  return {
    type: 'rural',
    slots: result.slots,
    safe: true,
    name: `SP:72 · ${result.name}`,
    chips: [`${design.totalThicknessMm} mm`, msa(result.designTrafficMsa)],
    inputsScreen: 'rural',
    record: () => ({
      pavementType: 'rural',
      subgradeCBR: result.subgradeCBR,
      designTrafficMsa: result.designTrafficMsa,
      totalThicknessMm: design.totalThicknessMm,
    }),
  };
}

const DESIGNS = { flexible, rigid, rural };

export function currentDesign(app) {
  return (DESIGNS[app.state.pavementType] || flexible)(app);
}
