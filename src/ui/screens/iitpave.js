import { h, card, numberField, segmented, button, msa } from '../dom.js';
import { clauseChip } from '../citations.js';
import { iitpaveCases, sectionKey, engineValue, caseText } from '../iitpave.js';
import { flexibleInput } from '../flexibleProject.js';
import { evaluateTrial } from '../../engine/flexibleDesign.js';

const fmt = (value, unit) => (unit === 'MPa' ? value.toFixed(3) : value.toFixed(1));

function stackTable(c) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Layer'), h('th', {}, 'E, MPa'), h('th', {}, 'μ'), h('th', {}, 'h, mm'))),
      h(
        'tbody',
        {},
        c.layers.map((l) =>
          h(
            'tr',
            {},
            h('td', {}, l.label),
            h('td', { class: 'numeric' }, l.E.toFixed(1)),
            h('td', { class: 'numeric' }, l.nu.toFixed(2)),
            h('td', { class: 'numeric' }, l.h == null ? '∞' : String(l.h))
          )
        )
      )
    )
  );
}

function loadTable(c) {
  const rows = [
    ['No. of layers', String(c.layers.length)],
    c.wheelLoadN != null ? ['Wheel load', `${Math.round(c.wheelLoadN).toLocaleString('en-IN')} N`] : null,
    ['Tyre pressure', `${c.tyrePressureMPa.toFixed(2)} MPa`],
    ['Wheel set', c.dualSpacingMm > 0 ? `Dual, ${c.dualSpacingMm} mm c/c` : 'Single'],
    ['Analysis points', c.points.map((p) => `z ${p.z.toFixed(0)}, r ${p.r.toFixed(0)}`).join(' · ')],
  ].filter(Boolean);
  return h(
    'div',
    { class: 'table-scroll' },
    h('table', { class: 'data kv' }, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))))
  );
}

function copyButton(c) {
  const copy = button(
    'Copy inputs',
    async () => {
      try {
        await navigator.clipboard.writeText(caseText(c));
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Copy failed';
      }
      setTimeout(() => (copy.textContent = 'Copy inputs'), 1600);
    },
    { kind: 'ghost' }
  );
  return h('div', { class: 'card-actions' }, copy);
}

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
    button('Result', () => app.go('results'), { kind: 'secondary' }),
    button('Report', () => app.go('report'))
  );

  // Values read for another section do not carry over.
  const key = sectionKey(result);
  if (app.state.iitpave?.key !== key) {
    app.state.iitpave = { key, values: {}, stresses: {}, use: false };
    app.persist();
  }
  const store = app.state.iitpave;
  const cases = iitpaveCases(result, app.state);
  const thicknesses = Object.fromEntries(
    result.slots.filter((s) => s.behaviour !== 'subgrade').map((s) => [s.slotId, s.thicknessMm])
  );

  const verdictHost = h('div', {});
  const showVerdict = () => {
    const r = app.state.result;
    const fromIitpave = r.checks.some((c) => c.source === 'IITPAVE') || r.checks.some((c) => c.rows?.some((row) => row.source === 'IITPAVE'));
    verdictHost.replaceChildren(
      h(
        'section',
        { class: `verdict ${r.safe ? 'safe' : 'unsafe'}` },
        h('h2', {}, r.safe ? 'Safe' : 'Not safe'),
        h('p', {}, `Life ${msa(r.governingLifeMsa)} against ${msa(r.designTrafficMsa)} · ${fromIitpave ? 'IITPAVE values' : 'app analysis'}`)
      )
    );
  };

  const reevaluate = () => {
    const measured = {};
    for (const c of cases) {
      for (const o of c.outputs || []) {
        const v = engineValue(o, store.values[o.key]);
        if (v != null) measured[o.key] = v;
      }
    }
    const stresses = Object.fromEntries(Object.entries(store.stresses).filter(([, v]) => v > 0));
    app.state.result = evaluateTrial(
      flexibleInput(app.state, store.use ? { thicknesses, measured, stresses } : { thicknesses })
    );
    app.persist();
    showVerdict();
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
            h('td', { class: 'numeric' }, fmt(o.app, o.unit)),
            h('td', { class: 'numeric' }, store.values[o.key] > 0 ? fmt(store.values[o.key], o.unit) : '—'),
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
            if (store.use) reevaluate();
          },
        })
      ),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Output'), h('th', {}, 'App'), h('th', {}, 'IITPAVE'), h('th', {}, 'Diff.'))),
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
          h('tr', {}, h('th', {}, 'Axle, kN'), h('th', {}, 'Wheel, N'), h('th', {}, 'App σt'), h('th', {}, 'IITPAVE σt'))
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
              h('td', { class: 'numeric' }, k.app.toFixed(3)),
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
                  onchange: () => {
                    if (store.use) reevaluate();
                  },
                })
              )
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

  showVerdict();

  return h(
    'div',
    { class: 'card-stack' },
    verdictHost,
    card(
      'Verdict from',
      segmented({
        label: null,
        value: store.use ? 'iitpave' : 'app',
        options: [
          { value: 'app', label: 'App analysis' },
          { value: 'iitpave', label: 'IITPAVE values' },
        ],
        onChange: (value) => {
          store.use = value === 'iitpave';
          reevaluate();
          app.render();
        },
      })
    ),
    cases.map(caseCard)
  );
}
