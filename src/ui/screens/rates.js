import { h, card, numberField, metric, notice, button, msa } from '../dom.js';
import { stepper } from '../stepper.js';
import { costSection, formatCurrency, formatNumber } from '../../engine/costing.js';
import { combinationName } from '../../data/layerCatalog.js';
import { saveTrial } from '../../store/trials.js';

export default function renderRates(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'card-stack' },
      stepper(app),
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to inputs', () => app.go('inputs')))
    );
  }

  const slots = result.slots.filter((s) => s.thicknessMm > 0);
  const summary = h('div', {});

  const recompute = () => {
    const cost = costSection(slots, app.state.rates, app.state.geometry);
    summary.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Cost per km'),
          h('span', { class: 'headline-value' }, formatCurrency(cost.costPerKm))
        ),
        cost.lines.map((line) =>
          h(
            'div',
            { class: 'line-item' },
            h(
              'div',
              {},
              h('span', { class: 'line-label' }, `${line.materialId} · ${line.thicknessMm} mm`),
              h(
                'span',
                { class: 'line-detail' },
                `${formatNumber(line.volumeCum, 1)} m³ × ` +
                  `${line.rateMissing ? 'no rate' : formatCurrency(line.rate)}`
              )
            ),
            h('span', { class: 'line-amount' }, formatCurrency(line.amount))
          )
        ),
        h(
          'div',
          { class: 'line-total' },
          h('span', {}, `Total, ${formatNumber(app.state.geometry.lengthKm, 2)} km`),
          h('span', { class: 'line-amount' }, formatCurrency(cost.total))
        ),
        h('div', { class: 'metric-grid' }, metric('Per m²', formatCurrency(cost.costPerSqm)), metric('Volume', `${formatNumber(cost.totalVolume, 0)} m³`)),
        cost.anyRateMissing ? notice('warn', null, 'Rates missing: those layers are costed at zero') : null
      )
    );
    return cost;
  };

  const save = () => {
    const cost = recompute();
    const { combination } = app.state;
    saveTrial({
      name: combinationName(combination),
      combination: { ...combination },
      thicknesses: { ...app.state.thicknesses },
      materials: { ...app.state.materials },
      mix: { ...app.state.mix },
      roadCategory: app.state.project.roadCategory,
      projectName: app.state.project.name,
      designTrafficMsa: result.designTrafficMsa,
      totalThicknessMm: result.totalThicknessMm,
      governingLifeMsa: result.governingLifeMsa,
      safe: result.safe,
      reliability: result.reliability,
      slots: result.slots.map((s) => ({
        slotId: s.slotId,
        materialId: s.materialId,
        label: s.label,
        thicknessMm: s.thicknessMm,
        behaviour: s.behaviour,
      })),
      rates: { ...app.state.rates },
      geometry: { ...app.state.geometry },
      cost: {
        total: cost.total,
        costPerKm: cost.costPerKm,
        costPerSqm: cost.costPerSqm,
        totalVolume: cost.totalVolume,
        complete: !cost.anyRateMissing,
      },
    });
    app.go('trials');
  };

  app.setActions(button('Save trial', save));

  const body = h(
    'div',
    { class: 'card-stack' },
    stepper(app),

    h(
      'div',
      { class: 'summary-chips' },
      h('span', { class: `chip ${result.safe ? 'pass' : 'fail'}` }, result.safe ? 'Safe' : 'Not safe'),
      h('span', { class: 'chip' }, combinationName(app.state.combination)),
      h('span', { class: 'chip' }, `${result.totalThicknessMm} mm`),
      h('span', { class: 'chip' }, msa(result.governingLifeMsa))
    ),

    card(
      'Road',
      h(
        'div',
        { class: 'field-row keep' },
        numberField({
          label: 'Carriageway width',
          value: app.state.geometry.carriagewayWidthM,
          suffix: 'm',
          min: 0,
          onInput: (value) => {
            app.patch('geometry', { carriagewayWidthM: value ?? 0 });
            recompute();
          },
        }),
        numberField({
          label: 'Length',
          value: app.state.geometry.lengthKm,
          suffix: 'km',
          min: 0,
          onInput: (value) => {
            app.patch('geometry', { lengthKm: value ?? 0 });
            recompute();
          },
        })
      )
    ),

    card(
      'Rates per m³',
      slots.map((slot) =>
        numberField({
          label: slot.label,
          value: app.state.rates[slot.materialId] ?? '',
          suffix: '₹/m³',
          min: 0,
          onInput: (value) => {
            const rates = { ...app.state.rates };
            if (value == null) delete rates[slot.materialId];
            else rates[slot.materialId] = value;
            app.state.rates = rates;
            app.persist();
            recompute();
          },
        })
      )
    ),

    summary
  );

  recompute();
  return body;
}
