import { h, card, fold, metric, badge, notice, button, msa, micro } from '../dom.js';
import { stepCard, citationChip, formatCitation } from '../citations.js';
import { stepper } from '../stepper.js';
import { designTraffic } from '../project.js';
import { sectionDiagram } from './layers.js';

/** One performance check: the computed strain against the allowable one. */
function checkRow(check) {
  const compressive = check.compressive === true;
  const ratio =
    check.allowableMicro > 0 ? check.strainMicro / check.allowableMicro : check.utilisation;
  const fill = Math.min(100, Math.max(2, ratio * 100));

  return h(
    'div',
    { class: 'check', 'data-safe': String(check.safe) },
    h(
      'div',
      { class: 'check-head' },
      h('strong', {}, check.title),
      badge(check.safe ? 'pass' : 'fail', check.safe ? 'Pass' : 'Fail')
    ),
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

/** The arithmetic behind one check, for the working section. */
function checkWorking(check) {
  return h(
    'div',
    { class: 'step' },
    h('h4', {}, check.title),
    h('div', { class: 'step-line' }, check.strainLabel),
    check.formula ? h('div', { class: 'formula' }, check.formula) : null,
    check.substitution ? h('div', { class: 'formula' }, check.substitution) : null,
    h(
      'div',
      { class: 'step-result' },
      `Allowable ${msa(check.allowableMsa)} against ${msa(check.demandMsa)}`
    ),
    citationChip(check)
  );
}

export default function renderResults(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'card-stack' },
      stepper(app),
      h(
        'div',
        { class: 'empty-state' },
        h('p', {}, 'No design yet.'),
        button('Go to inputs', () => app.go('inputs'))
      )
    );
  }

  const traffic = designTraffic(app.state);

  app.setActions(
    button('Edit', () => app.go('inputs'), { kind: 'secondary' }),
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
        metric('Life', msa(result.governingLifeMsa)),
        metric('Design', msa(result.designTrafficMsa)),
        metric('Reliability', `${result.reliability}%`)
      )
    ),

    card(
      'Section',
      sectionDiagram(result.slots),
      h(
        'div',
        { class: 'metric-grid' },
        metric('Total', `${result.totalThicknessMm} mm`),
        metric('Bituminous', `${result.bituminousMm} mm`)
      )
    ),

    card('Checks', result.checks.map(checkRow)),

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

    h(
      'section',
      { class: 'card folds' },
      fold({
        title: 'Layer moduli',
        memory: app.folds,
        key: 'result-moduli',
        children: [
          h(
            'div',
            { class: 'table-scroll' },
            h(
              'table',
              { class: 'data' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Layer'), h('th', {}, 'mm'), h('th', {}, 'E, MPa'), h('th', {}, 'μ'))),
              h(
                'tbody',
                {},
                result.layers.map((layer) =>
                  h(
                    'tr',
                    {},
                    h('td', {}, layer.label),
                    h('td', { class: 'numeric' }, layer.behaviour === 'subgrade' ? '—' : String(layer.thicknessMm)),
                    h('td', { class: 'numeric' }, layer.E.toFixed(0)),
                    h('td', { class: 'numeric' }, layer.nu.toFixed(2))
                  )
                )
              )
            )
          ),
          result.modulusSteps.map(stepCard),
        ],
      }),

      fold({
        title: 'Computed strains',
        memory: app.folds,
        key: 'result-strains',
        children: h(
          'div',
          { class: 'table-scroll' },
          h(
            'table',
            { class: 'data' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Point'), h('th', {}, 'Horiz. µε'), h('th', {}, 'Vert. µε'))),
            h(
              'tbody',
              {},
              result.responses.map((r) =>
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
        ),
      }),

      fold({
        title: 'Performance criteria',
        memory: app.folds,
        key: 'result-criteria',
        children: result.checks.map(checkWorking),
      }),

      fold({
        title: 'Design traffic',
        memory: app.folds,
        key: 'result-traffic',
        children: traffic.result.steps.map(stepCard),
      })
    )
  );
}
