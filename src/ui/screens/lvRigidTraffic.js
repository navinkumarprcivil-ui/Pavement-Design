import { h, card, numberField, fold, metric, notice, button } from '../dom.js';
import { stepCard } from '../citations.js';
import { projectCard } from '../projectCard.js';
import { lowVolumeChoice } from '../lowVolume.js';
import { designCase, sp62Repetitions } from '../../engine/ruralRigid.js';
import { SP62 } from '../../data/sp62.js';

const inr = (n, digits = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export default function renderLvRigidTraffic(app) {
  const t = app.state.lvRigid.traffic;
  const resultHost = h('div', { class: 'card-stack' });

  app.setActions(button('Continue to slab', () => app.go('lvRigidSlab')));

  const show = () => {
    const cvpd = (t.presentCVPD || 0) * Math.pow(1 + (t.growthPercent || 0) / 100, t.yearsToCompletion || 0);
    const kase = designCase(cvpd);
    const reps = sp62Repetitions({ cvpd, growthPercent: t.growthPercent || 0, years: t.designYears || SP62.designPeriod.years, heavySharePercent: t.heavySharePercent ?? SP62.repetitions.heavySharePercent });
    const warnings = [];
    if (cvpd >= SP62.scope.maximumCVPD) warnings.push(`${SP62.scope.maximumCVPD} CVPD or more: IRC:58 applies · ${SP62.scope.ref.clause}`);

    resultHost.replaceChildren(
      h(
        'section',
        { class: 'card result-card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'After completion'),
          h('span', { class: 'headline-value' }, `${inr(cvpd, 1)} CVPD`)
        ),
        h(
          'div',
          { class: 'metric-grid three' },
          metric('Design case', String(kase)),
          metric('Vehicles, design period', kase === 3 ? `${(reps.N / 1e6).toFixed(2)} M` : '—'),
          metric('100 kN axles', kase === 3 ? inr(reps.heavy) : '—')
        ),
        lowVolumeChoice(app, {
          label: 'Design to',
          current: 'ruralRigid',
          regular: { value: 'rigid', label: 'IRC:58-2015' },
          low: { value: 'ruralRigid', label: 'IRC:SP:62-2014' },
        }),
        warnings.length ? h('div', { class: 'warning-list' }, warnings.map((w) => notice('warn', null, w))) : null,
        fold({
          title: 'Working',
          memory: app.folds,
          key: 'lv-rigid-traffic-working',
          children: [
            stepCard({
              title: 'Design case',
              formula: 'Under 50 CVPD: load; 50 – 150: load and curling; over 150: fatigue',
              substitution: `A = ${inr(cvpd, 1)} CVPD`,
              result: `Case ${kase}`,
              ref: SP62.cases.ref,
            }),
            kase === 3
              ? stepCard({
                  title: 'Commercial vehicles over the design period',
                  formula: 'N = 365 A [(1 + r)^n − 1] / r',
                  substitution: `N = 365 x ${inr(cvpd, 1)} x ${reps.F.toFixed(3)}`,
                  result: `N = ${inr(reps.N)}; ${t.heavySharePercent}% at 100 kN = ${inr(reps.heavy)}`,
                  ref: SP62.repetitions.ref,
                })
              : null,
          ],
        })
      )
    );
  };

  const onNumber = (key) => (value) => {
    t[key] = value;
    app.persist();
    show();
  };

  const screen = h(
    'div',
    { class: 'card-stack' },
    projectCard(app),
    card(
      'Traffic',
      numberField({ label: 'Commercial vehicles per day', ref: SP62.scope.ref, value: t.presentCVPD, suffix: 'CVPD', min: 0, onInput: onNumber('presentCVPD') }),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Growth rate', ref: SP62.repetitions.ref, value: t.growthPercent, suffix: '%', min: 0, onInput: onNumber('growthPercent') }),
        numberField({ label: 'Years to completion', value: t.yearsToCompletion, suffix: 'yr', min: 0, onInput: onNumber('yearsToCompletion') })
      ),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Design period', ref: SP62.designPeriod.ref, value: t.designYears, suffix: 'yr', min: 1, onInput: onNumber('designYears') }),
        numberField({ label: 'Share at 100 kN axle load', ref: SP62.repetitions.ref, value: t.heavySharePercent, suffix: '%', min: 0, max: 100, onInput: onNumber('heavySharePercent') })
      )
    ),
    resultHost
  );

  show();
  return screen;
}
