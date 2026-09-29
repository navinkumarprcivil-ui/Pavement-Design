/**
 * The road across its width: how far each layer runs, where the shoulders
 * and longitudinal joints are, and what bars the joints carry. The report
 * draws it and the bill of quantities measures it.
 *
 * Layers bound to the pavement run under the carriageway and any paved or
 * tied shoulders; the drainage and filter layers run to the embankment slopes
 * (IRC:37 Cl. 7.2.1, IRC:58 Cl. 6.5.2).
 */

import { CROSS_SECTION } from '../data/ircConstants.js';
import { SP72 } from '../data/sp72.js';
import { SP62 } from '../data/sp62.js';

const positive = (v) => Number.isFinite(v) && v > 0;
const width = (v) => (positive(v) ? v : 0);

/**
 * A layer that drains: the granular sub-base of a flexible road, and under a
 * slab the drainage layer with the separation layer below it, when designed.
 */
function drainsToFormation(slot, type, rigid) {
  if (slot.behaviour !== 'granular') return false;
  if (type === 'flexible') return slot.slotId === 'SUB_BASE';
  if (type === 'rigid') return rigid.drainage === true && ['SUB_BASE', 'DRAIN', 'GSB'].includes(slot.slotId);
  return false;
}

/**
 * @param {object} input
 * @param {'flexible'|'rigid'|'rural'|'ruralRigid'} input.type
 * @param {Array} input.slots       The design's layers, top down.
 * @param {object} input.geometry   carriagewayWidthM, pavedShoulderM and earthenShoulderM (each side).
 * @param {object} [input.rigid]    For IRC:58: shoulder, widenedM, laneWidthM, jointSpacingM,
 *                                   drainage (true when a drainage layer is designed),
 *                                   separation (true for a debonding sheet), dowels, tieBars.
 * @param {object} [input.lvRigid]  For IRC:SP:62: jointSpacingM.
 */
export function crossSection({ type, slots, geometry, rigid = null, lvRigid = null }) {
  const carriagewayM = width(geometry.carriagewayWidthM);
  const shoulderKind =
    type === 'rigid' ? (rigid.shoulder === 'tied' ? 'tied' : 'none') : type === 'flexible' && positive(geometry.pavedShoulderM) ? 'paved' : 'none';
  const shoulderM = shoulderKind === 'none' ? 0 : width(geometry.pavedShoulderM);
  const widenedM = type === 'rigid' && rigid.shoulder === 'widened' ? width(rigid.widenedM) : 0;
  const earthenM = width(geometry.earthenShoulderM);
  const pavedM = carriagewayM + 2 * (widenedM + shoulderM);
  const formationM = pavedM + 2 * earthenM;

  const layers = slots
    .filter((s) => s.behaviour !== 'subgrade' && s.thicknessMm > 0)
    .map((s) => {
      const toFormation = drainsToFormation(s, type, rigid) && earthenM > 0;
      return {
        slotId: s.slotId,
        materialId: s.materialId ?? s.slotId,
        label: s.label,
        behaviour: s.behaviour,
        thicknessMm: s.thicknessMm,
        extent: toFormation ? 'formation' : 'paved',
        widthM: toFormation ? formationM : pavedM,
        ref: toFormation ? (type === 'rigid' ? CROSS_SECTION.rigidDrainage : CROSS_SECTION.flexibleDrainage) : null,
      };
    });

  const notes = [];
  if (layers.some((l) => l.extent === 'formation')) {
    notes.push({ text: 'Drainage and filter layers to the full width, up to the embankment slopes', ref: layers.find((l) => l.ref).ref });
  }

  // A debonding sheet between the slab and a DLC or cement treated sub-base.
  const membrane =
    type === 'rigid' && rigid.separation
      ? { widthM: pavedM, micron: CROSS_SECTION.separationMicron, ref: CROSS_SECTION.separation }
      : null;

  // IRC:SP:72 shoulders: sub-base quality material, 100 mm thick, over the earthen shoulder.
  const shoulderLayer =
    type === 'rural' && earthenM > 0
      ? { thicknessMm: SP72.shoulders.thicknessMm, widthM: earthenM, ref: SP72.shoulders.ref }
      : null;

  // Longitudinal joints, measured from the left edge of the paved width.
  const joints = [];
  let lanes = 1;
  if (type === 'rigid') {
    lanes = positive(rigid.laneWidthM) ? Math.max(1, Math.round(carriagewayM / rigid.laneWidthM)) : 1;
    const left = shoulderM + widenedM;
    for (let i = 1; i < lanes; i++) joints.push({ x: left + (carriagewayM * i) / lanes, tied: true });
    if (shoulderKind === 'tied' && shoulderM > 0) {
      joints.push({ x: shoulderM, tied: true, shoulder: true }, { x: pavedM - shoulderM, tied: true, shoulder: true });
    }
    joints.sort((a, b) => a.x - b.x);
  } else if (type === 'ruralRigid' && carriagewayM > SP62.joints.longitudinalAboveM) {
    lanes = 2;
    joints.push({ x: carriagewayM / 2, tied: false, ref: SP62.joints.ref });
  }

  return {
    type,
    carriagewayM,
    shoulderKind,
    shoulderM,
    widenedM,
    earthenM,
    pavedM,
    formationM,
    lanes,
    layers,
    membrane,
    shoulderLayer,
    joints,
    transverseSpacingM: type === 'rigid' ? width(rigid.jointSpacingM) : type === 'ruralRigid' ? width(lvRigid.jointSpacingM) : 0,
    dowels: type === 'rigid' ? rigid.dowels : null,
    tieBars: type === 'rigid' ? rigid.tieBars : null,
    widenedRef: widenedM > 0 ? CROSS_SECTION.widenedLane : null,
    notes,
  };
}
