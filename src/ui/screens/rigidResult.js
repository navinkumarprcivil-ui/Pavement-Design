import { h, card, fold, metric, badge, notice, button } from '../dom.js';
import { stepCard, citationChip } from '../citations.js';
import { stepper } from '../stepper.js';
import { sectionDiagram } from './layers.js';
import { AXLES } from '../rigidProject.js';
import { RIGID } from '../../data/ircConstants.js';

const LIMIT = RIGID.criterion.maximumCFD;

/** One damage check: its CFD against the limit of 1, with the categories behind it. */
function damageRow(title, cfd, parts) {
  const safe = cfd <= LIMIT;
  return h(
    'div',
    { class: 'check', 'data-safe': String(safe) },
    h('div', { class: 'check-head' }, h('strong', {}, title), badge(safe ? 'pass' : 'fail', safe ? 'Pass' : 'Fail')),
    h(
      'div',
      { class: 'check-figures' },
      h('span', { class: 'check-actual' }, cfd.toFixed(3)),
      parts ? h('span', { class: 'check-allowable' }, parts) : h('span', { class: 'check-allowable' }, `of ${LIMIT.toFixed(2)}`)
    ),
    h('div', { class: 'meter', role: 'presentation' }, h('span', { style: { width: `${Math.min(100, Math.max(2, cfd * 100))}%` } }))
  );
}

const count = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '∞');

function classTable(title, category) {
  const rows = category.rows.filter((r) => r.expected > 0);
  if (!rows.length) return null;
  return h(
    'div',
    { class: 'class-table' },
    h('h4', {}, `${title} · ${category.damage.toFixed(3)}`),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'kN'), h('th', {}, 'Expected'), h('th', {}, 'MPa'), h('th', {}, 'SR'), h('th', {}, 'Allowed'), h('th', {}, 'Damage'))),
        h(
          'tbody',
          {},
          rows.map((r) =>
            h(
              'tr',
              {},
              h('td', { class: 'numeric' }, String(r.loadKN)),
              h('td', { class: 'numeric' }, count(r.expected)),
              h('td', { class: 'numeric' }, r.stress.toFixed(3)),
              h('td', { class: 'numeric' }, r.stressRatio.toFixed(3)),
              h('td', { class: 'numeric' }, count(r.allowable)),
              h('td', { class: 'numeric' }, r.damage.toFixed(3))
            )
          )
        )
      )
    )
  );
}

export default function renderRigidResult(app) {
  const result = app.state.rigidResult;
  if (!result) {
    return h(
      'div',
      { class: 'card-stack' },
      stepper(app),
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to slab', () => app.go('rigidSlab')))
    );
  }

  const e = result.evaluation;
  const label = (id) => AXLES.find((a) => a.id === id).label;

  app.setActions(
    button('Edit', () => app.go('rigidSlab'), { kind: 'secondary' }),
    button('Cost and save', () => app.go('rates'))
  );

  return h(
    'div',
    { class: 'card-stack' },
    stepper(app),

    h(
      'section',
      { class: `verdict ${result.safe ? 'safe' : 'unsafe'}` },
      h('h2', {}, result.safe ? 'Safe' : 'Not safe'),
      h(
        'div',
        { class: 'verdict-figures' },
        metric('Slab, mm', String(result.adoptedMm)),
        metric('CFD', e.cfd.toFixed(3)),
        metric('k, MPa/m', e.kMPaPerM.toFixed(0))
      )
    ),

    result.mode === 'design' && result.retextureMm > 0
      ? notice('info', null, `${e.thicknessMm} mm for fatigue + ${result.retextureMm} mm retexturing`)
      : null,

    card('Section', sectionDiagram(result.slots)),

    card(
      'Fatigue damage',
      damageRow(
        'Bottom-up cracking',
        e.cfdBottomUp,
        `single ${e.bottomUp.single.damage.toFixed(3)} · tandem ${e.bottomUp.tandem.damage.toFixed(3)}`
      ),
      damageRow(
        'Top-down cracking',
        e.cfdTopDown,
        `single ${e.topDown.single.damage.toFixed(3)} · tandem ${e.topDown.tandem.damage.toFixed(3)} · tridem ${e.topDown.tridem.damage.toFixed(3)}`
      ),
      damageRow('Total', e.cfd, null),
      citationChip({ title: 'Cumulative fatigue damage', ref: RIGID.criterion.ref })
    ),

    result.dowels
      ? card(
          'Dowel bars',
          h(
            'div',
            { class: 'metric-grid three' },
            metric('Ø, mm', String(result.dowels.diameterMm)),
            metric('L, mm', String(result.dowels.lengthMm)),
            metric('c/c, mm', String(result.dowels.spacingMm))
          ),
          citationChip({ title: 'Dowel bars', ref: RIGID.dowels.ref })
        )
      : null,

    result.warnings.map((w) => notice('warn', null, w)),

    h(
      'section',
      { class: 'card folds' },
      fold({
        title: 'Stresses and damage by load class',
        memory: app.folds,
        key: 'rigid-classes',
        children: [
          ...['single', 'tandem'].map((id) => classTable(`Bottom-up, ${label(id).toLowerCase()}`, e.bottomUp[id])),
          ...['single', 'tandem', 'tridem'].map((id) => classTable(`Top-down, ${label(id).toLowerCase()}`, e.topDown[id])),
        ],
      }),
      fold({
        title: 'Working',
        memory: app.folds,
        key: 'rigid-working',
        children: result.steps.map(stepCard),
      })
    )
  );
}
