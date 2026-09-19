import { h, numberField, notice } from '../dom.js';
import { costSection, formatCurrency, formatNumber } from '../../engine/costing.js';
import { listTrials, saveTrial } from '../../store/trials.js';

export default function renderRates(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'empty-state' },
      'Run a design first, then add rates to it.',
      h('div', { style: { height: '12px' } }),
      h('button', { class: 'button', onclick: () => app.go('inputs') }, 'Go to inputs')
    );
  }

  const slots = result.slots.filter((s) => s.thicknessMm > 0);
  const summary = h('div', {});

  const recompute = () => {
    const cost = costSection(slots, app.state.rates, app.state.geometry);
    summary.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Cost'),
        cost.lines.map((line) =>
          h(
            'div',
            { class: 'line-item' },
            h(
              'div',
              {},
              h('span', { class: 'line-label' }, `${line.label} · ${line.thicknessMm} mm`),
              h(
                'span',
                { class: 'line-detail' },
                `${formatNumber(line.volumeCum, 1)} m³ × ` +
                  `${line.rateMissing ? 'no rate' : formatCurrency(line.rate) + '/m³'}`
              )
            ),
            h('span', { class: 'line-amount' }, formatCurrency(line.amount))
          )
        ),
        h(
          'div',
          { class: 'line-total' },
          h(
            'div',
            {},
            'Total',
            h('span', { class: 'line-detail' }, `${formatNumber(cost.totalVolume, 1)} m³`)
          ),
          h('span', { class: 'line-amount' }, formatCurrency(cost.total))
        ),
        h(
          'div',
          { class: 'metric-grid', style: { marginTop: '12px' } },
          h(
            'div',
            { class: 'metric' },
            h('span', { class: 'metric-label' }, 'Cost per km'),
            h('span', { class: 'metric-value' }, formatCurrency(cost.costPerKm))
          ),
          h(
            'div',
            { class: 'metric' },
            h('span', { class: 'metric-label' }, 'Cost per m² of carriageway'),
            h('span', { class: 'metric-value' }, formatCurrency(cost.costPerSqm))
          )
        ),
        cost.anyRateMissing
          ? notice(
              'warn',
              'Some rates are not entered',
              'Layers without a rate are counted as zero, so the total is ' +
                'understated until every rate is filled in.'
            )
          : null
      )
    );
    return cost;
  };

  const attachToTrial = () => {
    const cost = recompute();
    const trials = listTrials();
    const latest = trials[trials.length - 1];
    if (!latest) return;
    saveTrial({
      ...latest,
      rates: { ...app.state.rates },
      geometry: { ...app.state.geometry },
      cost: {
        total: cost.total,
        costPerKm: cost.costPerKm,
        costPerSqm: cost.costPerSqm,
        totalVolume: cost.totalVolume,
      },
    });
    app.go('trials');
  };

  const body = h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'Rates and cost'),
      h(
        'p',
        { class: 'screen-intro' },
        'Enter a rate per cubic metre for each layer. Rates are remembered, so ' +
          'the next trial is costed the moment it is designed.'
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Road geometry'),
      h(
        'div',
        { class: 'field-row' },
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

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Layer rates'),
      slots.map((slot) =>
        numberField({
          label: `${slot.label} (${slot.thicknessMm} mm)`,
          hint: 'Rate per cubic metre',
          value: app.state.rates[slot.slotId] ?? '',
          suffix: '₹/m³',
          min: 0,
          onInput: (value) => {
            app.state.rates = { ...app.state.rates, [slot.slotId]: value ?? 0 };
            app.persist();
            recompute();
          },
        })
      )
    ),

    summary,

    h(
      'button',
      { class: 'button', onclick: attachToTrial },
      'Save cost to this trial'
    )
  );

  recompute();
  return body;
}
