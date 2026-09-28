import { h, card, numberField, segmented, fold, keyResult, notice, button } from '../dom.js';
import { stepCard } from '../citations.js';
import { sectionDiagram } from './layers.js';
import { ruralDesignFor, UPGRADES } from '../lowVolumeProject.js';
import { quickCBR } from '../../engine/ruralSP72.js';
import { SP72 } from '../../data/sp72.js';

const inr = (n) => Math.round(n).toLocaleString('en-IN');

export default function renderRural(app) {
  const d = app.state.rural.design;
  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const r = ruralDesignFor(app.state);
    const { design, traffic } = r;
    app.state.ruralResult = { ...r, designTrafficMsa: traffic.esal / 1e6 };

    app.setActions(
      button('Report', () => app.go('report'), { kind: 'secondary' }),
      button('Cost and save', () => app.go('rates'))
    );

    host.replaceChildren(
      ...[
        h(
          'div',
          { class: 'key-results' },
          keyResult('Design traffic', inr(traffic.esal), 'ESAL', SP72.cumulative.ref),
          keyResult('Traffic category', design.category.id, null, SP72.categories.ref),
          keyResult('Subgrade class', design.subgradeClass.id, null, SP72.subgradeClasses.ref),
          keyResult('Pavement', String(design.totalThicknessMm), 'mm', design.baseType === 'cemented' ? SP72.catalogueCemented.ref : SP72.catalogueGranular.ref)
        ),
        design.warnings.length ? h('div', { class: 'warning-list' }, design.warnings.map((w) => notice('warn', null, w))) : null,
        card(design.gravelRoad ? 'Section · gravel road' : 'Section', sectionDiagram(design.slots)),
        design.overlay
          ? card(
              'Strengthening',
              h(
                'div',
                { class: 'key-results' },
                keyResult('Required', String(design.overlay.requiredMm), 'mm', SP72.overlay.ref),
                keyResult('Existing', String(design.overlay.existingMm), 'mm', SP72.overlay.ref),
                keyResult('Overlay', String(design.overlay.needMm), 'mm', SP72.overlay.ref)
              )
            )
          : null,
        card('Calculation steps', [...traffic.steps, ...design.steps].map(stepCard))
      ].filter(Boolean)
    );
  };

  const set = (key, { rerender = false } = {}) => (value) => {
    d[key] = value;
    app.persist();
    if (rerender) app.render();
    else show();
  };

  // Appendix B: a first estimate of CBR from the classification tests.
  const q = app.state.rural.quick;
  const quickHost = h('div', {});
  const showQuick = () => {
    const ready = q.plastic ? q.passing75Percent > 0 && q.plasticityIndex >= 0 : q.d60Mm > 0;
    if (!ready) return quickHost.replaceChildren();
    const est = quickCBR(q);
    quickHost.replaceChildren(
      stepCard({
        title: 'Estimated soaked CBR',
        formula: q.plastic ? 'CBR = 75 / (1 + 0.728 WPI),  WPI = P0.075 x PI' : 'CBR = 28.091 D60^0.3581',
        substitution: q.plastic ? `WPI = ${(q.passing75Percent / 100).toFixed(2)} x ${q.plasticityIndex} = ${est.wpi.toFixed(2)}` : `D60 = ${q.d60Mm} mm`,
        result: `CBR ≈ ${est.value.toFixed(1)}%`,
        ref: SP72.quickCBR.ref,
      })
    );
  };
  const quickNumber = (key) => (value) => {
    q[key] = value;
    app.persist();
    showQuick();
  };

  const upgrade = UPGRADES.includes(app.state.project.constructionType);
  const granular = d.baseType === 'granular';

  const screen = h(
    'div',
    { class: 'card-stack' },
    card(
      'Subgrade',
      numberField({ label: 'Soaked CBR', ref: SP72.subgradeClasses.ref, value: d.subgradeCBR, suffix: '%', min: 1, onInput: (v) => v != null && set('subgradeCBR')(v) }),
      fold({
        title: 'Estimate from soil tests',
        memory: app.folds,
        key: 'rural-quick-cbr',
        children: [
          segmented({
            label: 'Soil',
            ref: SP72.quickCBR.ref,
            value: q.plastic ? 'plastic' : 'nonPlastic',
            options: [
              { value: 'plastic', label: 'Plastic' },
              { value: 'nonPlastic', label: 'Non-plastic' },
            ],
            onChange: (value) => {
              q.plastic = value === 'plastic';
              app.persist();
              app.render();
            },
          }),
          q.plastic
            ? h(
                'div',
                { class: 'field-row' },
                numberField({ label: 'Passing 75 µm', value: q.passing75Percent, suffix: '%', min: 0, max: 100, onInput: quickNumber('passing75Percent') }),
                numberField({ label: 'Plasticity index', value: q.plasticityIndex, suffix: '%', min: 0, onInput: quickNumber('plasticityIndex') })
              )
            : numberField({ label: 'D60', value: q.d60Mm, suffix: 'mm', min: 0, onInput: quickNumber('d60Mm') }),
          quickHost,
        ],
      })
    ),

    card(
      'Pavement layers',
      segmented({
        label: 'Base and sub-base',
        ref: granular ? SP72.catalogueGranular.ref : SP72.catalogueCemented.ref,
        value: d.baseType,
        options: [
          { value: 'granular', label: 'Gravel / granular' },
          { value: 'cemented', label: 'Cement treated' },
        ],
        onChange: set('baseType', { rerender: true }),
      }),
      segmented({
        label: 'Surfacing',
        ref: SP72.surfacingType.ref,
        value: d.surfacing,
        options: [
          { value: 'auto', label: 'As the catalogue' },
          { value: 'sd', label: 'Surface dressing' },
          { value: 'pc', label: 'Premix carpet' },
        ],
        onChange: set('surfacing', { rerender: true }),
      }),
      granular
        ? [
            segmented({
              label: 'Annual rainfall',
              ref: SP72.surfacingWarrant.ref,
              value: d.rainfall,
              options: SP72.surfacingWarrant.rainfall.map((r) => ({ value: r.id, label: r.label })),
              onChange: set('rainfall', { rerender: true }),
            }),
            numberField({
              label: 'Surface gravel',
              ref: SP72.surfaceGravel.ref,
              value: d.surfaceGravelMm,
              suffix: 'mm',
              min: SP72.surfaceGravel.minMm,
              max: SP72.surfaceGravel.maxMm,
              onInput: set('surfaceGravelMm'),
            }),
            segmented({
              label: 'Gravel base',
              ref: SP72.baseToSubBase.ref,
              value: d.gravelSubBaseCBR ? String(d.gravelSubBaseCBR) : 'whole',
              options: [
                { value: 'whole', label: 'Keep whole' },
                ...SP72.baseToSubBase.subBaseCBR.map((c) => ({ value: String(c), label: `Sub-base CBR ${c}` })),
              ],
              onChange: (value) => set('gravelSubBaseCBR', { rerender: true })(value === 'whole' ? null : Number(value)),
            }),
            segmented({
              label: `Gravel of soaked CBR ${SP72.gravelBase.soakedCBR}`,
              ref: SP72.gravelBase.ref,
              value: d.gravelCBR80Available ? 'yes' : 'no',
              options: [
                { value: 'yes', label: 'Available' },
                { value: 'no', label: 'Not available' },
              ],
              onChange: (value) => set('gravelCBR80Available', { rerender: true })(value === 'yes'),
            }),
          ]
        : null,
      segmented({
        label: 'Frost',
        ref: SP72.frost.ref,
        value: d.frost ? 'yes' : 'no',
        options: [
          { value: 'no', label: 'Not susceptible' },
          { value: 'yes', label: 'Susceptible' },
        ],
        onChange: (value) => set('frost', { rerender: true })(value === 'yes'),
      })
    ),

    upgrade
      ? card(
          'Existing road',
          numberField({ label: 'Existing pavement thickness', ref: SP72.overlay.ref, value: d.existingMm, suffix: 'mm', min: 0, onInput: set('existingMm') })
        )
      : null,

    host
  );

  show();
  showQuick();
  return screen;
}
