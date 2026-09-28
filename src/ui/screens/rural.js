import { h, card, numberField, keyResult, notice, button, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import { designTraffic } from '../project.js';
import { sectionDiagram } from './layers.js';
import { designRuralRoad, setComposition, CATALOGUE_REF } from '../../engine/ruralSP72.js';
import { TRAFFIC } from '../../data/ircConstants.js';

/** The catalogue section as costed layers, top down. */
export function ruralSlots(composition) {
  return [
    { slotId: 'SURFACING', materialId: 'Surfacing', label: 'Bituminous surfacing', thicknessMm: composition.surfacingMm || 0, behaviour: 'bituminous' },
    { slotId: 'BASE', materialId: 'Base', label: 'Granular base', thicknessMm: composition.baseMm || 0, behaviour: 'granular' },
    { slotId: 'SUB_BASE', materialId: 'GSB', label: 'Granular sub-base (GSB)', thicknessMm: composition.subBaseMm || 0, behaviour: 'granular' },
    { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
  ];
}

export default function renderRural(app) {
  const traffic = designTraffic(app.state);
  const cumulativeEsal = traffic.result.msa * 1e6;
  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const design = designRuralRoad({
      cumulativeEsal,
      subgradeCBR: app.state.materials.subgradeCBR,
    });

    app.state.ruralResult = design.missing
      ? null
      : {
          design,
          slots: ruralSlots(design.composition),
          name: `${design.category.label} · ${design.band.label}`,
          designTrafficMsa: traffic.result.msa,
          subgradeCBR: app.state.materials.subgradeCBR,
          trafficSteps: traffic.result.steps,
        };

    app.setActions(
      app.state.ruralResult ? button('Report', () => app.go('report'), { kind: 'secondary' }) : null,
      app.state.ruralResult ? button('Cost and save', () => app.go('rates')) : null
    );

    host.replaceChildren(
      h(
        'div',
        { class: 'key-results' },
        keyResult('Design traffic', msa(traffic.result.msa), null, TRAFFIC.growthEquation.ref),
        keyResult('Traffic category', design.category.label, null, CATALOGUE_REF),
        keyResult('Subgrade', design.band.label, null, CATALOGUE_REF),
        design.missing ? null : keyResult('Total thickness', String(design.totalThicknessMm), 'mm', CATALOGUE_REF)
      ),

      design.missing
        ? notice('warn', null, 'No catalogue entry yet for this traffic and CBR')
        : card('Section', sectionDiagram(app.state.ruralResult.slots)),

      compositionEditor(design),

      card('Calculation steps', [...traffic.result.steps, ...design.steps].map(stepCard))
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
      field('Surfacing', 'surfacingMm'),
      field('Base', 'baseMm'),
      field('Sub-base', 'subBaseMm'),
      h(
        'div',
        { class: 'card-actions' },
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
      )
    );
  }

  show();

  return h(
    'div',
    { class: 'card-stack' },
    card(
      'Subgrade',
      numberField({
        label: 'Subgrade CBR',
        ref: CATALOGUE_REF,
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
