import { h, card, notice, button, keyResult, fold } from '../dom.js';
import { stepCard } from '../citations.js';
import { dataGrid } from '../dataGrid.js';
import { fwdSurvey, pointModuli, backcalcStale, runBackcalculation, overlayDesignFor } from '../overlayProject.js';
import { IRC115 } from '../../data/overlay.js';

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');

/** Back-calculation in progress, so a redraw during it does not start another. */
let running = null;

export default function renderOverlayModuli(app) {
  const f = app.state.overlay.fwd;
  app.setActions(button('Design the overlay', () => app.go('overlayResult')));

  if (app.state.overlay.method !== 'fwd') {
    return h('div', { class: 'card-stack' }, notice('info', null, 'Moduli are back-calculated for a falling weight deflectometer survey'));
  }
  if (!(f.bituminousMm > 0 && f.granularMm > 0)) {
    return h('div', { class: 'card-stack' }, notice('info', null, 'Enter the layer thicknesses'), button('Deflections', () => app.go('overlaySurvey'), { kind: 'secondary' }));
  }
  const survey = fwdSurvey(app.state);
  if (survey.points.length < 2) {
    return h('div', { class: 'card-stack' }, notice('info', null, 'Enter the deflection bowls'), button('Deflections', () => app.go('overlaySurvey'), { kind: 'secondary' }));
  }

  const progress = h('div', { class: 'card-stack' });
  if (backcalcStale(app.state)) {
    progress.replaceChildren(notice('info', null, 'Back-calculating the moduli…'));
    if (!running) {
      running = runBackcalculation(app.state, (done, total) => {
        progress.replaceChildren(notice('info', null, `Back-calculating the moduli: ${done} of ${total}`));
      }).then(() => {
        running = null;
        app.persist();
        if (app.state.screen === 'overlayModuli') app.render();
      });
    }
  }

  const points = pointModuli(app.state);
  const design = overlayDesignFor(app.state);
  const m = design.moduli;

  if (!Array.isArray(f.kgpback)) f.kgpback = [];
  const kgpRows = survey.points.map((p) => {
    if (!f.kgpback[p.index]) f.kgpback[p.index] = { bituminous: null, granular: null, subgrade: null };
    return f.kgpback[p.index];
  });

  const appTable = h(
    'div',
    { class: 'data-grid-wrap' },
    h(
      'table',
      { class: 'data-grid read' },
      h('thead', {}, h('tr', {}, ['#', 'Bituminous', 'Granular', 'Subgrade', 'Fit, %', 'Used'].map((c) => h('th', { scope: 'col' }, c)))),
      h(
        'tbody',
        {},
        points.map((p) =>
          h(
            'tr',
            {},
            h('th', { scope: 'row' }, String(p.index + 1)),
            h('td', {}, p.app ? fmt(p.app.E[0]) : '…'),
            h('td', {}, p.app ? fmt(p.app.E[1]) : '…'),
            h('td', {}, p.app ? fmt(p.app.E[2], 1) : '…'),
            h('td', {}, p.app ? fmt(p.app.rmsPercent, 1) : '…'),
            h('td', {}, p.source || '—')
          )
        )
      )
    )
  );

  const kgpGrid = dataGrid(app, {
    columns: [
      { label: 'Bituminous, MPa', get: (r) => r.bituminous, set: (r, v) => (r.bituminous = v) },
      { label: 'Granular, MPa', get: (r) => r.granular, set: (r, v) => (r.granular = v) },
      { label: 'Subgrade, MPa', get: (r) => r.subgrade, set: (r, v) => (r.subgrade = v) },
    ],
    rows: kgpRows,
    blank: () => ({ bituminous: null, granular: null, subgrade: null }),
    key: 'kgpback',
    fromLine: (nums) => (nums.length >= 3 ? { bituminous: nums[nums.length - 3], granular: nums[nums.length - 2], subgrade: nums[nums.length - 1] } : null),
    onChange: () => {},
    fixed: true,
    rowLabel: (i) => String(survey.points[i].index + 1),
  });

  const corrected = m
    ? h(
        'div',
        { class: 'data-grid-wrap' },
        h(
          'table',
          { class: 'data-grid read' },
          h('thead', {}, h('tr', {}, ['#', 'Bit. at 35 °C', 'Granular, monsoon', 'Subgrade, monsoon'].map((c) => h('th', { scope: 'col' }, c)))),
          h(
            'tbody',
            {},
            m.rows.map((r, i) =>
              h('tr', {}, h('th', { scope: 'row' }, String(points[i].index + 1)), h('td', {}, fmt(r.bituminous35)), h('td', {}, fmt(r.granularMonsoon, 1)), h('td', {}, fmt(r.subgradeMonsoon, 1)))
            )
          )
        )
      )
    : null;

  return h(
    'div',
    { class: 'card-stack' },
    progress,
    m
      ? h(
          'div',
          { class: 'key-results' },
          keyResult('Bituminous', fmt(m.design.bituminous), 'MPa', IRC115.procedure.ref),
          keyResult('Granular', fmt(m.design.granular), 'MPa', IRC115.procedure.ref),
          keyResult('Subgrade', fmt(m.design.subgrade, 1), 'MPa', IRC115.procedure.ref)
        )
      : null,
    m?.warnings.length ? h('div', { class: 'warning-list' }, m.warnings.map((w) => notice('warn', null, w))) : null,
    card('Back-calculated by the app', appTable),
    card('Back-calculated in KGPBACK', kgpGrid),
    m ? card('To 35 °C and the monsoon', corrected, fold({ title: 'Working', memory: app.folds, key: 'overlay-moduli-working', children: m.steps.map(stepCard) })) : null
  );
}
