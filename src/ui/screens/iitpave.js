import { h, card, numberField, button, msa } from '../dom.js';
import { clauseChip } from '../citations.js';
import { iitpaveCases, iitpaveMissing, sectionKey } from '../iitpave.js';
import { stackTable, loadTable, copyButton } from '../iitpaveTables.js';
import { flexibleResult } from '../flexibleProject.js';

/**
 * The verdict, and whether it rests on IITPAVE throughout or, for values not
 * yet entered, on the app's analysis and so is provisional.
 */
export function verdictBanner(result, missing) {
  const provisional = missing.length > 0;
  return h(
    'section',
    { class: `verdict ${result.safe ? 'safe' : 'unsafe'}${provisional ? ' provisional' : ''}` },
    h('h2', {}, `${provisional ? 'Provisional · ' : ''}${result.safe ? 'Safe' : 'Not safe'}`),
    h(
      'p',
      {},
      `${result.totalThicknessMm} mm section · life ${msa(result.governingLifeMsa)} against ${msa(result.designTrafficMsa)} · ` +
        (provisional ? `${missing.length} IITPAVE value${missing.length > 1 ? 's' : ''} to enter` : 'IITPAVE')
    )
  );
}

const fmt = (value, unit) => (unit === 'MPa' ? value.toFixed(3) : value.toFixed(1));

const difference = (app, entered) => {
  if (!(entered > 0) || !(app > 0)) return '—';
  const pct = ((entered - app) / app) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

export default function renderIitpave(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'card-stack' },
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to inputs', () => app.go('inputs')))
    );
  }

  app.setActions(
    button('Inputs', () => app.go('inputs'), { kind: 'secondary' }),
    button('Result', () => app.go('results'))
  );

  // Values read for another section do not carry over.
  const key = sectionKey(result);
  if (app.state.iitpave?.key !== key) {
    app.state.iitpave = { key, values: {}, stresses: {} };
    app.persist();
  }
  const store = app.state.iitpave;
  const cases = iitpaveCases(result, app.state);
  const thicknesses = Object.fromEntries(
    result.slots.filter((s) => s.behaviour !== 'subgrade').map((s) => [s.slotId, s.thicknessMm])
  );

  const statusHost = h('div', {});
  const showStatus = () => {
    const r = app.state.result;
    const missing = iitpaveMissing(r, app.state);
    statusHost.replaceChildren(verdictBanner(r, missing));
  };

  const reevaluate = () => {
    app.state.result = flexibleResult(app.state, { thicknesses });
    app.persist();
    showStatus();
  };

  const outputsBlock = (c) => {
    const compare = h('tbody', {});
    const showCompare = () =>
      compare.replaceChildren(
        ...c.outputs.map((o) =>
          h(
            'tr',
            {},
            h('td', {}, o.label),
            h('td', { class: 'numeric' }, store.values[o.key] > 0 ? fmt(store.values[o.key], o.unit) : '—'),
            h('td', { class: 'numeric' }, fmt(o.app, o.unit)),
            h('td', { class: 'numeric' }, difference(o.app, store.values[o.key]))
          )
        )
      );
    showCompare();
    return [
      c.outputs.map((o) =>
        numberField({
          label: `${o.label} from IITPAVE`,
          value: store.values[o.key],
          suffix: o.unit,
          min: 0,
          onInput: (value) => {
            store.values[o.key] = value;
            app.persist();
            showCompare();
            reevaluate();
          },
        })
      ),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Output'), h('th', {}, 'IITPAVE'), h('th', {}, 'App'), h('th', {}, 'App vs IITPAVE'))),
          compare
        )
      ),
    ];
  };

  const classesBlock = (c) =>
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'data' },
        h(
          'thead',
          {},
          h('tr', {}, h('th', {}, 'Axle, kN'), h('th', {}, 'Wheel, N'), h('th', {}, 'IITPAVE σt, MPa'), h('th', {}, 'App σt'))
        ),
        h(
          'tbody',
          {},
          c.classes.map((k) =>
            h(
              'tr',
              {},
              h('td', { class: 'numeric' }, k.singleKN.toFixed(1)),
              h('td', { class: 'numeric' }, Math.round(k.wheelLoadN).toLocaleString('en-IN')),
              h(
                'td',
                {},
                h('input', {
                  class: 'cell-input',
                  type: 'number',
                  inputmode: 'decimal',
                  step: 'any',
                  min: 0,
                  'aria-label': `IITPAVE stress for ${k.singleKN.toFixed(1)} kN`,
                  value: store.stresses[k.key] ?? '',
                  oninput: (event) => {
                    const raw = event.target.value;
                    store.stresses[k.key] = raw === '' ? null : Number(raw);
                    app.persist();
                  },
                  onchange: reevaluate,
                })
              ),
              h('td', { class: 'numeric' }, k.app.toFixed(3))
            )
          )
        )
      )
    );

  const caseCard = (c, index) =>
    card(
      `${index + 1}. ${c.title}`,
      h('div', { class: 'case-ref' }, clauseChip(c.title, c.ref)),
      stackTable(c),
      loadTable(c),
      c.readout ? h('div', { class: 'key-results' }, h('div', { class: 'key-result' }, h('span', { class: 'key-label' }, c.readout.label), h('span', { class: 'key-value' }, c.readout.value, h('small', {}, c.readout.unit)))) : null,
      c.outputs ? outputsBlock(c) : null,
      c.classes ? classesBlock(c) : null,
      copyButton(c)
    );

  showStatus();

  return h('div', { class: 'card-stack' }, statusHost, cases.map(caseCard));
}
