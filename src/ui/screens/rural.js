import { h, numberField, notice, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import {
  designRuralRoad,
  setComposition,
  catalogueCoverage,
} from '../../engine/ruralSP72.js';

export default function renderRural(app) {
  const trafficResult = app.state.trafficResult;
  const cumulativeEsal = (trafficResult?.msa ?? 0) * 1e6;
  const cbr = app.state.materials.subgradeCBR;

  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const design = designRuralRoad({
      cumulativeEsal,
      subgradeCBR: cbr,
    });
    const coverage = catalogueCoverage();

    host.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Catalogue lookup'),
        design.steps.map(stepCard)
      ),

      design.missing
        ? h(
            'div',
            { class: 'card' },
            notice('warn', 'This catalogue entry is empty', design.message),
            h('div', { style: { height: '12px' } }),
            compositionEditor(design, show)
          )
        : h(
            'div',
            { class: 'card' },
            h('h2', { class: 'section-title' }, 'Pavement composition'),
            h(
              'div',
              { class: 'metric-grid' },
              metric('Surfacing', `${design.composition.surfacingMm} mm`),
              metric('Base', `${design.composition.baseMm} mm`),
              metric('Sub-base', `${design.composition.subBaseMm} mm`),
              metric('Total', `${design.totalThicknessMm} mm`)
            ),
            design.composition.note
              ? h('p', { class: 'muted' }, design.composition.note)
              : null,
            h('div', { style: { height: '12px' } }),
            compositionEditor(design, show)
          ),

      h(
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Catalogue'),
        h(
          'p',
          { class: 'muted', style: { marginTop: 0 } },
          `${coverage.entered} of ${coverage.total} cells entered. The IRC:SP:72 ` +
            'design catalogue is copyrighted, so it is not shipped with this ' +
            'app — entries you make from your own copy are stored on this ' +
            'device and reused for every later design.'
        )
      )
    );
  };

  const metric = (label, value) =>
    h(
      'div',
      { class: 'metric' },
      h('span', { class: 'metric-label' }, label),
      h('span', { class: 'metric-value' }, value)
    );

  function compositionEditor(design, onSaved) {
    const draft = {
      surfacingMm: design.composition?.surfacingMm ?? null,
      baseMm: design.composition?.baseMm ?? null,
      subBaseMm: design.composition?.subBaseMm ?? null,
    };

    return h(
      'div',
      {},
      h(
        'h2',
        { class: 'section-title' },
        `Entry for ${design.category.label} at ${design.band.label}`
      ),
      h(
        'p',
        { class: 'muted', style: { marginTop: 0 } },
        'Read the composition from your copy of IRC:SP:72-2015 and enter it here.'
      ),
      numberField({
        label: 'Surfacing',
        value: draft.surfacingMm ?? '',
        suffix: 'mm',
        min: 0,
        onInput: (value) => {
          draft.surfacingMm = value ?? 0;
        },
      }),
      numberField({
        label: 'Base',
        value: draft.baseMm ?? '',
        suffix: 'mm',
        min: 0,
        onInput: (value) => {
          draft.baseMm = value ?? 0;
        },
      }),
      numberField({
        label: 'Sub-base',
        value: draft.subBaseMm ?? '',
        suffix: 'mm',
        min: 0,
        onInput: (value) => {
          draft.subBaseMm = value ?? 0;
        },
      }),
      h(
        'button',
        {
          class: 'button',
          onclick: () => {
            setComposition(design.category.id, design.band.id, {
              surfacingMm: draft.surfacingMm ?? 0,
              baseMm: draft.baseMm ?? 0,
              subBaseMm: draft.subBaseMm ?? 0,
            });
            onSaved();
          },
        },
        'Save catalogue entry'
      )
    );
  }

  show();

  return h(
    'div',
    { class: 'card-stack' },
    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'Low volume rural road'),
      h(
        'p',
        { class: 'screen-intro' },
        `Design traffic of ${msa(trafficResult?.msa ?? 0)} falls below the IRC:37 ` +
          'floor, so this road is designed to IRC:SP:72-2015 by catalogue.'
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Subgrade'),
      numberField({
        label: 'Subgrade CBR',
        value: cbr,
        suffix: '%',
        min: 1,
        onInput: (value) => {
          app.patch('materials', { subgradeCBR: value ?? 1 });
          app.render();
        },
      })
    ),

    host
  );
}
