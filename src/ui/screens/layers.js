import { h, card, segmented, button, notice } from '../dom.js';
import { hasCTB } from '../ctbProject.js';
import { designTraffic } from '../project.js';
import { enforceCodeChoices, staged } from '../flexibleProject.js';
import { BITUMINOUS_RULES } from '../../data/ircConstants.js';
import {
  bituminousAllowed,
  BITUMINOUS_OPTIONS,
  BASE_OPTIONS,
  SUB_BASE_OPTIONS,
  CRACK_RELIEF_OPTIONS,
  SITE_CONDITIONS,
  describeCombination,
  displaySlots,
  findOption,
  feasible,
} from '../../data/layerCatalog.js';

const LAYER_COLOURS = {
  bituminous: '#3c4552',
  granular: '#c9a227',
  cemented: '#8fa3b8',
  treated: '#5b4a3a',
  membrane: '#1f252d',
  concrete: '#d3d8de',
  subgrade: '#a9805a',
};

/**
 * The pavement cross-section, top down. Band heights follow the thicknesses
 * when they are known, so the drawing reads as the section it describes.
 */
export function sectionDiagram(slots) {
  // A surfacing with no structural thickness, such as a surface dressing, is drawn with its note.
  const drawn = slots.filter((s) => s.behaviour === 'subgrade' || s.thicknessMm !== 0 || s.note);
  const known = drawn.every((s) => s.behaviour === 'subgrade' || s.thicknessMm > 0 || s.note);

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
          : slot.note
            ? h('span', { class: 'layer-thickness' }, slot.note)
            : null
      );
    })
  );
}

/** Every base, crack relief and sub-base combination the site can build. */
function compositions(conditions, inStages) {
  // Stage construction rules out cement treated layers (Cl. 4.3.2).
  const can = (option) => feasible(option.id, conditions) && !(inStages && option.behaviour === 'cemented');
  const list = [];
  for (const base of BASE_OPTIONS.filter(can)) {
    const reliefs = base.requiresCrackRelief ? CRACK_RELIEF_OPTIONS.filter(can) : [null];
    for (const relief of reliefs) {
      for (const subBase of SUB_BASE_OPTIONS.filter(can)) {
        list.push({ base, relief, subBase });
      }
    }
  }
  return list;
}

const KIND = { granular: 'Granular', cemented: 'Cemented', treated: 'Bitumen treated' };

export default function renderLayers(app) {
  const msa = designTraffic(app.state).result.msa;
  if (enforceCodeChoices(app.state, msa)) app.persist();
  const bituminousOptions = BITUMINOUS_OPTIONS.filter((o) => bituminousAllowed(o, msa, app.state.project.roadCategory));
  const { conditions } = app.state;
  const available = compositions(conditions, staged(app.state));
  const isChosen = ({ base, relief, subBase }, c) =>
    c.baseId === base.id &&
    c.subBaseId === subBase.id &&
    (!relief || (c.crackReliefId || CRACK_RELIEF_OPTIONS[0].id) === relief.id);

  // A composition the site can no longer build gives way to the first it can.
  if (available.length && !available.some((option) => isChosen(option, app.state.combination))) {
    const first = available[0];
    app.state.combination = {
      ...app.state.combination,
      baseId: first.base.id,
      subBaseId: first.subBase.id,
      ...(first.relief ? { crackReliefId: first.relief.id } : {}),
    };
    const thicknesses = { ...app.state.thicknesses };
    for (const slotId of ['BASE', 'CRACK_RELIEF', 'SUB_BASE']) delete thicknesses[slotId];
    app.state.thicknesses = thicknesses;
    app.state.result = null;
    app.persist();
  }

  const { combination } = app.state;
  const described = describeCombination(combination);

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
  const bituminous = findOption(BITUMINOUS_OPTIONS, combination.bituminousId) || BITUMINOUS_OPTIONS[0];

  app.setActions(
    hasCTB(app.state)
      ? button('Continue to axle loads', () => app.go('ctbAxles'))
      : button('Continue to inputs', () => app.go('inputs'))
  );

  const compositionCard = ({ base, relief, subBase }) => {
    const selected = isChosen({ base, relief, subBase }, combination);
    const layers = [
      { name: bituminous.short, behaviour: 'bituminous' },
      relief ? { name: relief.short, behaviour: relief.behaviour || 'membrane' } : null,
      { name: base.short, behaviour: base.behaviour },
      { name: subBase.short, behaviour: subBase.behaviour },
    ].filter(Boolean);
    return h(
      'button',
      {
        type: 'button',
        class: 'composition',
        'aria-pressed': String(selected),
        onclick: () => {
          if (selected) return;
          const patch = { baseId: base.id, subBaseId: subBase.id };
          if (relief) patch.crackReliefId = relief.id;
          choose(patch, ['BASE', 'CRACK_RELIEF', 'SUB_BASE']);
        },
      },
      h(
        'span',
        { class: 'composition-stack', 'aria-hidden': 'true' },
        layers.map((l) => h('span', { class: `stack-band ${l.behaviour}` }))
      ),
      h(
        'span',
        { class: 'composition-text' },
        h('strong', {}, layers.map((l) => l.name).join(' + ')),
        h('span', {}, `${KIND[base.behaviour]} base · ${KIND[subBase.behaviour].toLowerCase()} sub-base`)
      ),
      selected ? h('span', { class: 'badge chosen' }, 'Selected') : null
    );
  };

  const conditionBox = ({ key, label }) =>
    h(
      'label',
      { class: 'check-option' },
      h('input', {
        type: 'checkbox',
        checked: Boolean(conditions[key]),
        onchange: (event) => {
          app.state.conditions = { ...app.state.conditions, [key]: event.target.checked };
          app.persist();
          app.render();
        },
      }),
      h('span', {}, label)
    );

  return h(
    'div',
    { class: 'card-stack' },

    card('Materials and conditions', h('div', { class: 'check-options' }, SITE_CONDITIONS.map(conditionBox))),

    card(
      'Bituminous layers',
      segmented({
        label: null,
        ref: BITUMINOUS_RULES.ref,
        value: combination.bituminousId,
        options: bituminousOptions.map((o) => ({ value: o.id, label: o.short })),
        onChange: (id) =>
          choose({ bituminousId: id }, [...bituminousSlots(combination.bituminousId), ...bituminousSlots(id)]),
      })
    ),

    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Composition'),
      available.length
        ? h('div', { class: 'composition-list' }, available.map(compositionCard))
        : notice('warn', null, 'No composition can be built with the materials ticked')
    ),

    card('Section', sectionDiagram(displaySlots(described.slots.map((s) => ({ ...s, thicknessMm: null })), combination)))
  );
}
