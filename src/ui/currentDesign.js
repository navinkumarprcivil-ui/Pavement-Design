/**
 * The design on the go — flexible or rigid — as the cost and compare screens
 * need it: its layers, a name, summary chips, and the record a trial saves.
 */

import { msa } from './dom.js';
import { combinationName } from '../data/layerCatalog.js';

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

export function currentDesign(app) {
  return app.state.pavementType === 'rigid' ? rigid(app) : flexible(app);
}
