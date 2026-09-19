import { h, optionGroup, notice } from '../dom.js';
import {
  BITUMINOUS_OPTIONS,
  BASE_OPTIONS,
  SUB_BASE_OPTIONS,
  CRACK_RELIEF_OPTIONS,
  describeCombination,
} from '../../data/layerCatalog.js';

const LAYER_COLOURS = {
  bituminous: '#3c4552',
  granular: '#c9a227',
  cemented: '#8fa3b8',
  subgrade: '#a9805a',
};

export function sectionDiagram(slots) {
  return h(
    'div',
    { class: 'section-diagram' },
    slots.map((slot) =>
      h(
        'div',
        {
          class: 'section-layer',
          style: {
            background: LAYER_COLOURS[slot.behaviour] || '#ccc',
            color: slot.behaviour === 'granular' ? '#10161d' : '#f5f8fb',
          },
        },
        h('span', { class: 'layer-name' }, slot.label),
        h(
          'span',
          { class: 'layer-thickness' },
          slot.thicknessMm != null && slot.thicknessMm > 0
            ? `${slot.thicknessMm} mm`
            : slot.behaviour === 'subgrade'
              ? 'fixed'
              : ''
        )
      )
    )
  );
}

export default function renderLayers(app) {
  const { combination } = app.state;
  const needsCrackRelief = combination.baseId === 'CTB';
  const described = describeCombination(combination);

  const choose = (patch) => {
    app.state.combination = { ...combination, ...patch };
    app.render();
  };

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('span', { class: 'step-label' }, 'Step 2 of 4'),
      h('h2', { class: 'screen-title' }, 'Layer combination'),
      h(
        'p',
        { class: 'screen-intro' },
        'Fix the material for each layer. Thicknesses come next — you can ' +
          'change any of this later and re-run the design as a new trial.'
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Bituminous layer'),
      optionGroup({
        name: 'bituminous',
        value: combination.bituminousId,
        options: BITUMINOUS_OPTIONS.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
        })),
        onChange: (id) => choose({ bituminousId: id }),
      })
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Base layer'),
      optionGroup({
        name: 'base',
        value: combination.baseId,
        options: BASE_OPTIONS.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
        })),
        onChange: (id) => choose({ baseId: id }),
      })
    ),

    needsCrackRelief
      ? h(
          'div',
          { class: 'card' },
          h('h2', { class: 'section-title' }, 'Crack relief interlayer'),
          notice(
            'warn',
            'Required above a cement treated base',
            'A cement treated base cracks as it cures and under traffic. An ' +
              'interlayer keeps those cracks from reflecting through the ' +
              'bituminous surfacing.'
          ),
          h('div', { style: { height: '12px' } }),
          optionGroup({
            name: 'crack-relief',
            value: combination.crackReliefId,
            options: CRACK_RELIEF_OPTIONS.map((o) => ({
              id: o.id,
              label: o.label,
              description: o.description,
            })),
            onChange: (id) => choose({ crackReliefId: id }),
          })
        )
      : null,

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Sub-base layer'),
      optionGroup({
        name: 'sub-base',
        value: combination.subBaseId,
        options: SUB_BASE_OPTIONS.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
        })),
        onChange: (id) => choose({ subBaseId: id }),
      })
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Subgrade soil'),
      h(
        'p',
        { class: 'muted', style: { marginTop: 0 } },
        'Fixed. The subgrade is characterised by its effective CBR, which you ' +
          'enter on the next screen.'
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Section'),
      sectionDiagram(
        described.slots.map((s) => ({ ...s, thicknessMm: null }))
      )
    ),

    h(
      'button',
      { class: 'button', onclick: () => app.go('inputs') },
      'Continue to inputs'
    )
  );
}
