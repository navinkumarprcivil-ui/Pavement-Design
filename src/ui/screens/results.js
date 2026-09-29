import { h, card, keyResult, badge, notice, button, msa, micro } from '../dom.js';
import { stepCard, clauseChip, formatCitation } from '../citations.js';
import { designTraffic } from '../project.js';
import { sectionDiagram } from './layers.js';
import { hasCTB, ctbDamageInput } from '../ctbProject.js';
import { AXLES } from '../spectrum.js';
import { TRAFFIC } from '../../data/ircConstants.js';
import { iitpaveMissing } from '../iitpave.js';
import { verdictBanner } from './iitpave.js';

const ALLOWABLE_LABEL = {
  'bituminous-fatigue': 'Allowable εt, bituminous',
  'subgrade-rutting': 'Allowable εv, subgrade',
  'cemented-fatigue': 'Allowable εt, CTB',
};

/** Whether any of a check's values were read from IITPAVE. */
export const fromIitpave = (check) => check.source === 'IITPAVE' || Boolean(check.rows?.some((r) => r.source === 'IITPAVE'));

/** Whether every value of a check was read from IITPAVE. */
export const allFromIitpave = (check) =>
  check.rows ? check.rows.every((r) => r.source === 'IITPAVE') : check.source === 'IITPAVE';

/** Where a check's values came from: IITPAVE, or the app standing in for it. */
const sourceBadge = (check) =>
  allFromIitpave(check) ? badge('source', 'IITPAVE') : badge('muted', fromIitpave(check) ? 'Part app' : 'App');

/** The app's own figure beside an IITPAVE one, as a cross-check. */
const appFigure = (check, text) => (check.source === 'IITPAVE' && check.computed != null ? h('span', { class: 'check-app' }, `App ${text}`) : null);

/** One performance check: the computed strain against the allowable one. */
export function checkTile(check) {
  if (check.kind === 'damage') return damageTile(check);
  if (check.kind === 'stress') return stressTile(check);
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
      h('span', { class: 'badges' }, sourceBadge(check), badge(check.safe ? 'pass' : 'fail', check.safe ? 'Pass' : 'Fail'))
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
            : null,
          appFigure(check, check.computed != null ? micro(Math.max(0, check.computed) * 1e6) : '')
        ),
    compressive
      ? null
      : h('div', { class: 'meter', role: 'presentation' }, h('span', { style: { width: `${fill}%` } }))
  );
}

/** A stress against the stress allowed. */
function stressTile(check) {
  return h(
    'div',
    { class: 'check-tile', 'data-safe': String(check.safe) },
    h(
      'div',
      { class: 'check-head' },
      h('strong', {}, check.title),
      h('span', { class: 'badges' }, sourceBadge(check), badge(check.safe ? 'pass' : 'fail', check.safe ? 'Pass' : 'Fail'))
    ),
    h('span', { class: 'check-sub' }, check.strainLabel, clauseChip(check.title, check.ref)),
    h(
      'div',
      { class: 'check-figures' },
      h('span', { class: 'check-actual' }, `${check.stress.toFixed(3)} MPa`),
      h('span', { class: 'check-allowable' }, `of ${check.allowableStress.toFixed(3)} MPa allowable`),
      appFigure(check, check.computed != null ? `${check.computed.toFixed(3)} MPa` : '')
    ),
    h('div', { class: 'meter', role: 'presentation' }, h('span', { style: { width: `${Math.min(100, Math.max(2, check.utilisation * 100))}%` } }))
  );
}

/** A check's working: any steps that lead to it, then its own. */
export function checkSteps(check) {
  return [...(check.preSteps || []), checkStep(check)];
}

/** The damage summed over the axle load classes against its limit of one. */
function damageTile(check) {
  return h(
    'div',
    { class: 'check-tile', 'data-safe': String(check.safe) },
    h(
      'div',
      { class: 'check-head' },
      h('strong', {}, check.title),
      h('span', { class: 'badges' }, sourceBadge(check), badge(check.safe ? 'pass' : 'fail', check.safe ? 'Pass' : 'Fail'))
    ),
    h('span', { class: 'check-sub' }, check.strainLabel, clauseChip(check.title, check.ref)),
    h(
      'div',
      { class: 'check-figures' },
      h('span', { class: 'check-actual' }, `CFD ${check.damage.toFixed(3)}`),
      h('span', { class: 'check-allowable' }, `of ${check.allowableDamage.toFixed(2)} allowable`)
    ),
    h('div', { class: 'meter', role: 'presentation' }, h('span', { style: { width: `${Math.min(100, Math.max(2, check.damage * 100))}%` } }))
  );
}

/** A check's arithmetic, as a calculation step. */
export function checkStep(check) {
  return {
    title: check.title,
    formula: check.formula,
    substitution: check.substitution,
    result: check.stepResult ?? `Allowable ${msa(check.allowableMsa)} against ${msa(check.demandMsa)}`,
    ref: check.ref,
  };
}

const count = (value) => Math.round(value).toLocaleString('en-IN');

/**
 * Rows of the CTB damage table for one axle type: the load, its passes as
 * single axles, the stress, stress ratio, fatigue life and damage.
 */
export function damageRows(check, axle) {
  return check.rows
    .filter((r) => r.axle === axle)
    .map((r) => [
      String(r.loadKN),
      count(r.singleRepetitions),
      r.stressMPa.toFixed(3),
      r.stressRatio.toFixed(3),
      r.life.toExponential(2),
      r.damage.toFixed(3),
    ]);
}


/** The damage check's working, one table per axle type. */
function damageCard(check) {
  const tableFor = (axle) => {
    const rows = damageRows(check, axle.id);
    if (!rows.length) return null;
    return h(
      'div',
      { class: 'class-table' },
      h('h4', {}, `${axle.label} axles · ${check.byAxle[axle.id].toFixed(3)}`),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data' },
          h('thead', {}, h('tr', {}, ['kN', 'ni', 'MPa', 'SR', 'Nf', 'Damage'].map((c) => h('th', {}, c)))),
          h('tbody', {}, rows.map((row) => h('tr', {}, row.map((cell) => h('td', { class: 'numeric' }, cell)))))
        )
      )
    );
  };
  return card('CTB damage by load class', AXLES.map(tableFor));
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
  const damage = result.checks.find((c) => c.kind === 'damage');

  const missing = iitpaveMissing(result, app.state);
  app.setActions(
    button('IITPAVE', () => app.go('iitpave'), { kind: 'secondary' }),
    button('Report', () => app.go('report'))
  );

  return h(
    'div',
    { class: 'card-stack' },

    verdictBanner(result, missing),

    h(
      'div',
      { class: 'key-results' },
      keyResult('Design traffic', result.designTrafficMsa.toFixed(2), 'msa', TRAFFIC.growthEquation.ref),
      result.checks
        .filter((c) => c.allowableMicro != null)
        .map((c) => keyResult(ALLOWABLE_LABEL[c.id] || c.title, c.allowableMicro.toFixed(1), 'µε', c.ref)),
      damage ? keyResult('CFD, CTB', damage.damage.toFixed(3), null, damage.ref) : null,
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

    card('Strains, app analysis', strainTable(result.responses)),

    damage ? damageCard(damage) : null,

    card(
      'Calculation steps',
      stepGroup('Design traffic', traffic.result.steps),
      stepGroup('Layer moduli', result.modulusSteps),
      damage && hasCTB(app.state) ? stepGroup('CTB axle loads', ctbDamageInput(app.state, traffic).steps) : null,
      stepGroup('Performance criteria', result.checks.flatMap(checkSteps))
    )
  );
}
