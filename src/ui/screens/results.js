import { h, card, keyResult, badge, notice, button, msa, micro } from '../dom.js';
import { stepCard, clauseChip, formatCitation } from '../citations.js';
import { designTraffic } from '../project.js';
import { sectionDiagram } from './layers.js';
import { TRAFFIC } from '../../data/ircConstants.js';

const ALLOWABLE_LABEL = {
  'bituminous-fatigue': 'Allowable εt, bituminous',
  'subgrade-rutting': 'Allowable εv, subgrade',
  'cemented-fatigue': 'Allowable εt, CTB',
};

/** One performance check: the computed strain against the allowable one. */
export function checkTile(check) {
  const compressive = check.compressive === true;
  const ratio =
    check.allowableMicro > 0 ? check.strainMicro / check.allowableMicro : check.utilisation;
  const fill = Math.min(100, Math.max(2, ratio * 100));

  return h(
    'div',
    { class: 'check-tile', 'data-safe': String(check.safe) },
    h(
      'div',
      { class: 'check-head' },
      h('strong', {}, check.title),
      badge(check.safe ? 'pass' : 'fail', check.safe ? 'Pass' : 'Fail')
    ),
    h('span', { class: 'check-sub' }, check.strainLabel, clauseChip(check.title, check.ref)),
    compressive
      ? h('div', { class: 'check-figures' }, h('span', {}, 'Compressive at the underside'))
      : h(
          'div',
          { class: 'check-figures' },
          h('span', { class: 'check-actual' }, micro(check.strainMicro)),
          check.allowableMicro != null
            ? h('span', { class: 'check-allowable' }, `of ${micro(check.allowableMicro)} allowable`)
            : null
        ),
    compressive
      ? null
      : h('div', { class: 'meter', role: 'presentation' }, h('span', { style: { width: `${fill}%` } }))
  );
}

/** A check's arithmetic, as a calculation step. */
export function checkStep(check) {
  return {
    title: check.title,
    formula: check.formula,
    substitution: check.substitution,
    result: `Allowable ${msa(check.allowableMsa)} against ${msa(check.demandMsa)}`,
    ref: check.ref,
  };
}

/** The layer system analysed: thickness, modulus and Poisson's ratio. */
export function layerTable(layers) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'data' },
      h(
        'thead',
        {},
        h('tr', {}, h('th', {}, 'Layer'), h('th', {}, 'h, mm'), h('th', {}, 'E, MPa'), h('th', {}, 'μ'))
      ),
      h(
        'tbody',
        {},
        layers.map((layer) =>
          h(
            'tr',
            {},
            h('td', {}, layer.label),
            h('td', { class: 'numeric' }, layer.behaviour === 'subgrade' ? '∞' : String(layer.thicknessMm)),
            h('td', { class: 'numeric' }, layer.E.toFixed(0)),
            h('td', { class: 'numeric' }, layer.nu.toFixed(2))
          )
        )
      )
    )
  );
}

export function strainTable(responses) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Point'), h('th', {}, 'Horiz. µε'), h('th', {}, 'Vert. µε'))),
      h(
        'tbody',
        {},
        responses.map((r) =>
          h(
            'tr',
            {},
            h('td', {}, `${r.z.toFixed(0)} mm, ${r.label}${r.pressureMPa !== 0.56 ? `, ${r.pressureMPa} MPa` : ''}`),
            h('td', { class: 'numeric' }, (r.maxHorizontalStrain * 1e6).toFixed(1)),
            h('td', { class: 'numeric' }, (-r.epsZZ * 1e6).toFixed(1))
          )
        )
      )
    )
  );
}

/** A titled group of calculation steps. */
export function stepGroup(title, steps) {
  return h('div', { class: 'step-group' }, h('h3', { class: 'step-group-title' }, title), steps.map(stepCard));
}

export default function renderResults(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'card-stack' },
      h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.'), button('Go to inputs', () => app.go('inputs')))
    );
  }

  const traffic = designTraffic(app.state);

  app.setActions(
    button('Edit', () => app.go('inputs'), { kind: 'secondary' }),
    button('Report', () => app.go('report'))
  );

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'section',
      { class: `verdict ${result.safe ? 'safe' : 'unsafe'}` },
      h('h2', {}, result.safe ? 'Safe' : 'Not safe'),
      h('p', {}, `${result.totalThicknessMm} mm section · life ${msa(result.governingLifeMsa)} against ${msa(result.designTrafficMsa)}`)
    ),

    h(
      'div',
      { class: 'key-results' },
      keyResult('Design traffic', result.designTrafficMsa.toFixed(2), 'msa', TRAFFIC.growthEquation.ref),
      result.checks
        .filter((c) => c.allowableMicro != null)
        .map((c) => keyResult(ALLOWABLE_LABEL[c.id] || c.title, c.allowableMicro.toFixed(1), 'µε', c.ref)),
      keyResult('Reliability', String(result.reliability), '%', null)
    ),

    card('Checks', h('div', { class: 'check-grid' }, result.checks.map(checkTile))),

    result.thicknessWarnings.length
      ? notice(
          'warn',
          'Below minimum thickness',
          h('ul', { class: 'plain-list' }, result.thicknessWarnings.map((w) => h('li', {}, w)))
        )
      : null,

    result.notChecked.map((item) =>
      notice('warn', 'Not checked here', `${item.title} · ${formatCitation(item.ref)}`)
    ),

    card('Section', sectionDiagram(result.slots), layerTable(result.layers)),

    card('Computed strains', strainTable(result.responses)),

    card(
      'Calculation steps',
      stepGroup('Design traffic', traffic.result.steps),
      stepGroup('Layer moduli', result.modulusSteps),
      stepGroup('Performance criteria', result.checks.map(checkStep))
    )
  );
}
