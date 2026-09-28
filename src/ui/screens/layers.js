import { h, card, segmented, button } from '../dom.js';
import { stepper } from '../stepper.js';
import {
  BITUMINOUS_OPTIONS,
  BASE_OPTIONS,
  SUB_BASE_OPTIONS,
  CRACK_RELIEF_OPTIONS,
  describeCombination,
  findOption,
} from '../../data/layerCatalog.js';

const LAYER_COLOURS = {
  bituminous: '#3c4552',
  granular: '#c9a227',
  cemented: '#8fa3b8',
  concrete: '#d3d8de',
  subgrade: '#a9805a',
};

/**
 * The pavement cross-section, top down. Band heights follow the thicknesses
 * when they are known, so the drawing reads as the section it describes.
 */
export function sectionDiagram(slots) {
  const drawn = slots.filter((s) => s.behaviour === 'subgrade' || s.thicknessMm !== 0);
  const known = drawn.every((s) => s.behaviour === 'subgrade' || s.thicknessMm > 0);

  return h(
    'div',
    { class: 'section-diagram' },
    drawn.map((slot) => {
      const height = known && slot.behaviour !== 'subgrade'
        ? `${Math.min(84, Math.max(30, slot.thicknessMm * 0.26))}px`
        : null;
      return h(
        'div',
        {
          class: `section-layer ${slot.behaviour}`,
          style: {
            background: LAYER_COLOURS[slot.behaviour] || '#ccc',
            color: slot.behaviour === 'granular' || slot.behaviour === 'concrete' ? '#10161d' : '#f5f8fb',
            minHeight: height,
          },
        },
        h('span', { class: 'layer-name' }, slot.label),
        slot.thicknessMm > 0
          ? h('span', { class: 'layer-thickness' }, `${slot.thicknessMm} mm`)
          : null
      );
    })
  );
}

export default function renderLayers(app) {
  const { combination } = app.state;
  const described = describeCombination(combination);
  const needsCrackRelief = Boolean(described.base.requiresCrackRelief);

  // A new material starts from its own default thickness, not the last one's.
  const choose = (patch, resetSlots) => {
    app.state.combination = { ...combination, ...patch };
    const thicknesses = { ...app.state.thicknesses };
    for (const slotId of resetSlots) delete thicknesses[slotId];
    app.state.thicknesses = thicknesses;
    app.state.result = null;
    app.persist();
    app.render();
  };

  const bituminousSlots = (id) => (findOption(BITUMINOUS_OPTIONS, id)?.courses || []).map((c) => c.id);

  const options = (list) => list.map((o) => ({ value: o.id, label: o.short }));

  app.setActions(button('Continue to inputs', () => app.go('inputs')));

  return h(
    'div',
    { class: 'card-stack' },
    stepper(app),

    card(
      null,
      segmented({
        label: 'Bituminous layer',
        value: combination.bituminousId,
        options: options(BITUMINOUS_OPTIONS),
        onChange: (id) =>
          choose({ bituminousId: id }, [...bituminousSlots(combination.bituminousId), ...bituminousSlots(id)]),
      }),
      segmented({
        label: 'Base',
        value: combination.baseId,
        options: options(BASE_OPTIONS),
        onChange: (id) => choose({ baseId: id }, ['BASE', 'CRACK_RELIEF']),
      }),
      needsCrackRelief
        ? segmented({
            label: 'Crack relief layer',
            value: combination.crackReliefId || CRACK_RELIEF_OPTIONS[0].id,
            options: CRACK_RELIEF_OPTIONS.map((o) => ({ value: o.id, label: o.label })),
            onChange: (id) => choose({ crackReliefId: id }, ['CRACK_RELIEF']),
          })
        : null,
      segmented({
        label: 'Sub-base',
        value: combination.subBaseId,
        options: options(SUB_BASE_OPTIONS),
        onChange: (id) => choose({ subBaseId: id }, ['SUB_BASE']),
      })
    ),

    card('Section', sectionDiagram(described.slots.map((s) => ({ ...s, thicknessMm: null }))))
  );
}
