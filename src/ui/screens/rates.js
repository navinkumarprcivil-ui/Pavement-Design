import { h, card, numberField, metric, notice, button } from '../dom.js';
import { currentDesign } from '../currentDesign.js';
import { sectionFor } from '../crossSection.js';
import { formatCurrency, formatNumber } from '../../engine/costing.js';
import { billOfQuantities, EXTRA_ITEMS } from '../../engine/quantities.js';
import { saveTrial } from '../../store/trials.js';

const UNITS = Object.fromEntries(EXTRA_ITEMS.map((item) => [item.id, item.unit]));

export default function renderRates(app) {
  const design = currentDesign(app);
  if (!design) {
    const inputs = { rigid: 'rigidSlab', rural: 'rural', ruralRigid: 'lvRigidSlab' }[app.state.pavementType] || 'inputs';
    return h(
      'div',
      { class: 'card-stack' },
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to inputs', () => app.go(inputs)))
    );
  }

  const g = app.state.geometry;
  const summary = h('div', {});

  const recompute = () => {
    const model = sectionFor(app);
    const bill = model ? billOfQuantities(model, app.state.rates, g.lengthKm) : null;
    if (!bill) {
      summary.replaceChildren();
      return null;
    }
    const digits = (unit) => (unit === 't' ? 2 : 0);
    summary.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Cost per km'),
          h('span', { class: 'headline-value' }, formatCurrency(bill.costPerKm))
        ),
        bill.items.map((line) =>
          h(
            'div',
            { class: 'line-item' },
            h(
              'div',
              {},
              h('span', { class: 'line-label' }, line.item),
              h(
                'span',
                { class: 'line-detail' },
                `${formatNumber(line.quantity, digits(line.unit))} ${line.unit} × ` +
                  `${line.rateMissing ? 'no rate' : formatCurrency(line.rate)}`
              )
            ),
            h('span', { class: 'line-amount' }, formatCurrency(line.amount))
          )
        ),
        h(
          'div',
          { class: 'line-total' },
          h('span', {}, `Total, ${formatNumber(g.lengthKm, 2)} km`),
          h('span', { class: 'line-amount' }, formatCurrency(bill.total))
        ),
        h('div', { class: 'metric-grid' }, metric('Per m²', formatCurrency(bill.costPerSqm)), metric('Paved width', `${formatNumber(model.pavedM, 2)} m`)),
        bill.anyRateMissing ? notice('warn', null, 'Rates missing: those items are costed at zero') : null
      )
    );
    return { bill, model };
  };

  const save = () => {
    const priced = recompute();
    const bill = priced?.bill;
    saveTrial({
      ...design.record(),
      name: design.name,
      projectName: app.state.project.name,
      safe: design.safe,
      slots: design.slots.map((s) => ({
        slotId: s.slotId,
        materialId: s.materialId,
        label: s.label,
        thicknessMm: s.thicknessMm,
        behaviour: s.behaviour,
      })),
      rates: { ...app.state.rates },
      geometry: { ...g },
      cost: bill
        ? {
            total: bill.total,
            costPerKm: bill.costPerKm,
            costPerSqm: bill.costPerSqm,
            complete: !bill.anyRateMissing,
          }
        : null,
    });
    app.go('trials');
  };

  app.setActions(button('Save trial', save));

  const geometryField = (label, key) =>
    numberField({
      label,
      value: g[key],
      suffix: key === 'lengthKm' ? 'km' : 'm',
      min: 0,
      onInput: (value) => {
        app.patch('geometry', { [key]: value ?? (key === 'lengthKm' || key === 'carriagewayWidthM' ? 0 : null) });
        recompute();
      },
    });

  // Shoulders a design has: paved on a flexible road, tied concrete on a rigid one, earthen beside either.
  const type = design.type;
  const rigid = app.state.rigid;
  const pavedLabel = type === 'flexible' ? 'Paved shoulder, each side' : type === 'rigid' && rigid.slab.shoulder === 'tied' ? 'Concrete shoulder, each side' : null;
  const shoulderField = (label, key, fallback) =>
    numberField({
      label,
      value: g[key] ?? fallback ?? null,
      suffix: 'm',
      min: 0,
      onInput: (value) => {
        app.patch('geometry', { [key]: value });
        recompute();
      },
    });

  // One rate for each item measured, in the item's unit.
  const initial = recompute();
  const keys = [];
  for (const item of initial?.bill.items || []) {
    if (keys.some((k) => k.key === item.key)) continue;
    const layer = initial.model.layers.find((l) => l.materialId === item.key);
    keys.push({ key: item.key, label: layer ? layer.label : item.key, unit: item.unit });
  }
  const rateField = ({ key, label, unit }) =>
    numberField({
      label,
      value: app.state.rates[key] ?? '',
      suffix: `₹/${UNITS[key] || unit}`,
      min: 0,
      onInput: (value) => {
        const rates = { ...app.state.rates };
        if (value == null) delete rates[key];
        else rates[key] = value;
        app.state.rates = rates;
        app.persist();
        recompute();
      },
    });

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      { class: 'summary-chips' },
      h('span', { class: `chip ${design.safe ? 'pass' : 'fail'}` }, design.safe ? 'Safe' : 'Not safe'),
      h('span', { class: 'chip' }, design.name),
      design.chips.map((text) => h('span', { class: 'chip' }, text))
    ),

    card(
      'Road',
      h('div', { class: 'field-row keep' }, geometryField('Carriageway width', 'carriagewayWidthM'), geometryField('Length', 'lengthKm')),
      h(
        'div',
        { class: 'field-row keep' },
        pavedLabel ? shoulderField(pavedLabel, 'pavedShoulderM', type === 'rigid' ? rigid.drainage.concreteShoulderM : null) : null,
        shoulderField('Earthen shoulder, each side', 'earthenShoulderM', type === 'rigid' ? rigid.drainage.unpavedShoulderM : null)
      )
    ),

    card('Rates', keys.map(rateField)),

    summary
  );
}
