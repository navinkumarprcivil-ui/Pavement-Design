import { h, card, metric, keyResult, badge, notice, button } from '../dom.js';
import { stepCard, clauseChip } from '../citations.js';
import { sectionDiagram } from './layers.js';
import { AXLES } from '../rigidProject.js';
import { RIGID } from '../../data/ircConstants.js';

const LIMIT = RIGID.criterion.maximumCFD;

/** One damage check: its CFD against the limit of 1, with the categories behind it. */
function damageRow(title, cfd, parts) {
  const safe = cfd <= LIMIT;
  return h(
    'div',
    { class: 'check-tile', 'data-safe': String(safe) },
    h('div', { class: 'check-head' }, h('strong', {}, title), badge(safe ? 'pass' : 'fail', safe ? 'Pass' : 'Fail')),
    h('span', { class: 'check-sub' }, 'Cumulative fatigue damage', clauseChip(title, RIGID.criterion.ref)),
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
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to slab', () => app.go('rigidSlab')))
    );
  }

  const e = result.evaluation;
  const b = result.bonded;
  const ties = result.tieBars;
  const label = (id) => AXLES.find((a) => a.id === id).label;

  app.setActions(
    button('Edit', () => app.go('rigidSlab'), { kind: 'secondary' }),
    button('Report', () => app.go('report'))
  );

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'section',
      { class: `verdict ${result.safe ? 'safe' : 'unsafe'}` },
      h('h2', {}, result.safe ? 'Safe' : 'Not safe'),
      h(
        'p',
        {},
        `${result.adoptedMm} mm ${b ? 'PQC bonded to DLC' : 'slab'} · CFD ${e.cfd.toFixed(3)} against ${LIMIT.toFixed(2)}`
      )
    ),

    h(
      'div',
      { class: 'key-results' },
      keyResult(b ? 'PQC' : 'Slab', String(result.adoptedMm), 'mm', b ? RIGID.bonded.ref : RIGID.criterion.ref),
      b ? keyResult(b.designMm ? 'Designed on the GSB' : 'Equivalent slab', (b.designMm ?? b.equivalentMm).toFixed(0), 'mm', RIGID.bonded.ref) : null,
      keyResult('CFD', e.cfd.toFixed(3), null, RIGID.criterion.ref),
      keyResult('Effective k', e.kMPaPerM.toFixed(0), 'MPa/m', RIGID.subgradeK.ref),
      result.dowels ? keyResult('Dowel bars', `Ø${result.dowels.diameterMm}`, `@ ${result.dowels.spacingMm} mm`, RIGID.dowels.ref) : null,
      keyResult('Tie bars', `Ø${ties.diameterMm}`, `@ ${ties.spacingMm} mm`, RIGID.tieBars.ref)
    ),

    result.mode === 'design' && result.retextureMm > 0
      ? notice('info', null, `${result.fatigueMm} mm for fatigue + ${result.retextureMm} mm retexturing`)
      : null,

    card(
      'Fatigue damage',
      h(
        'div',
        { class: 'check-grid' },
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
        damageRow('Total', e.cfd, null)
      )
    ),

    result.warnings.map((w) => notice('warn', null, w)),

    card('Section', sectionDiagram(result.slots)),

    result.dowels
      ? card(
          'Dowel bars',
          h(
            'div',
            { class: 'metric-grid three' },
            metric('Ø, mm', String(result.dowels.diameterMm)),
            metric('L, mm', String(result.dowels.lengthMm)),
            metric('c/c, mm', String(result.dowels.spacingMm))
          )
        )
      : null,

    card(
      'Stresses and damage by load class',
      ...['single', 'tandem'].map((id) => classTable(`Bottom-up, ${label(id).toLowerCase()}`, e.bottomUp[id])),
      ...['single', 'tandem', 'tridem'].map((id) => classTable(`Top-down, ${label(id).toLowerCase()}`, e.topDown[id]))
    ),

    b
      ? card(
          'Bonded to the DLC',
          h(
            'div',
            { class: 'metric-grid three' },
            metric('D1 + D2, MN·m', b.combined.toFixed(2)),
            b.designMm ? metric('Required, MN·m', b.required.toFixed(2)) : metric('h equivalent, mm', b.equivalentMm.toFixed(1)),
            metric('Neutral axis, m', b.d.toFixed(3))
          )
        )
      : null,

    card(
      `Tie bars, ${RIGID.tieBars.steel[ties.type].label.toLowerCase()}`,
      h(
        'div',
        { class: 'metric-grid three' },
        metric('Ø, mm', String(ties.diameterMm)),
        metric('L, mm', String(ties.lengthMm)),
        metric('c/c, mm', String(ties.spacingMm))
      ),
      result.tieBarSteps.map(stepCard)
    ),

    card('Calculation steps', result.steps.map(stepCard))
  );
}
