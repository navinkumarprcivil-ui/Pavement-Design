import { h, card, numberField, fold, metric, notice, button, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import { designTraffic } from '../project.js';
import { designRuralRoad, setComposition } from '../../engine/ruralSP72.js';

export default function renderRural(app) {
  const traffic = designTraffic(app.state);
  const cumulativeEsal = traffic.result.msa * 1e6;
  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const design = designRuralRoad({
      cumulativeEsal,
      subgradeCBR: app.state.materials.subgradeCBR,
    });

    host.replaceChildren(
      design.missing
        ? notice('warn', null, 'No catalogue entry yet for this traffic and CBR')
        : h(
            'section',
            { class: 'card' },
            h(
              'div',
              { class: 'headline' },
              h('span', { class: 'headline-label' }, 'Total thickness'),
              h('span', { class: 'headline-value' }, `${design.totalThicknessMm} mm`)
            ),
            h(
              'div',
              { class: 'metric-grid three' },
              metric('Surfacing', `${design.composition.surfacingMm} mm`),
              metric('Base', `${design.composition.baseMm} mm`),
              metric('Sub-base', `${design.composition.subBaseMm} mm`)
            ),
            design.composition.note ? h('p', { class: 'muted' }, design.composition.note) : null
          ),

      compositionEditor(design),

      h(
        'section',
        { class: 'card folds' },
        fold({ title: 'Working', memory: app.folds, key: 'rural-working', children: design.steps.map(stepCard) })
      )
    );
  };

  /** Catalogue entries come from the user's own copy of IRC:SP:72. */
  function compositionEditor(design) {
    const draft = {
      surfacingMm: design.composition?.surfacingMm ?? null,
      baseMm: design.composition?.baseMm ?? null,
      subBaseMm: design.composition?.subBaseMm ?? null,
    };
    const field = (label, key) =>
      numberField({
        label,
        value: draft[key] ?? '',
        suffix: 'mm',
        min: 0,
        onInput: (value) => {
          draft[key] = value ?? 0;
        },
      });

    return card(
      `Catalogue: ${design.category.label}, ${design.band.label}`,
      h('div', { class: 'field-row three' }, field('Surfacing', 'surfacingMm'), field('Base', 'baseMm'), field('Sub-base', 'subBaseMm')),
      button(
        'Save catalogue entry',
        () => {
          setComposition(design.category.id, design.band.id, {
            surfacingMm: draft.surfacingMm ?? 0,
            baseMm: draft.baseMm ?? 0,
            subBaseMm: draft.subBaseMm ?? 0,
          });
          show();
        },
        { kind: 'secondary' }
      )
    );
  }

  show();

  return h(
    'div',
    { class: 'card-stack' },
    h(
      'div',
      { class: 'summary-chips' },
      h('span', { class: 'chip' }, msa(traffic.result.msa)),
      h('span', { class: 'chip' }, 'IRC:SP:72-2015')
    ),
    card(
      'Subgrade',
      numberField({
        label: 'Subgrade CBR',
        value: app.state.materials.subgradeCBR,
        suffix: '%',
        min: 1,
        onInput: (value) => {
          if (value == null) return;
          app.patch('materials', { subgradeCBR: value });
          show();
        },
      })
    ),
    host
  );
}
