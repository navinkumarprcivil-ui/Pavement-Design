import { h, card, numberField, segmented, fold, metric, notice, button } from '../dom.js';
import { stepCard } from '../citations.js';
import { rigidTrafficFor } from '../rigidProject.js';
import { ref, RIGID } from '../../data/ircConstants.js';

const million = (n) => `${(n / 1e6).toFixed(n >= 1e8 ? 0 : n >= 1e7 ? 1 : 2)} M`;

export default function renderRigidTraffic(app) {
  const rigid = app.state.rigid;
  const t = rigid.traffic;
  const resultHost = h('div', { class: 'card-stack' });

  app.setActions(button('Continue to axle loads', () => app.go('rigidAxles')));

  const show = () => {
    const traffic = rigidTrafficFor(rigid);
    resultHost.replaceChildren(
      h(
        'section',
        { class: 'card result-card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Design lane axles'),
          h('span', { class: 'headline-value' }, million(traffic.laneAxles))
        ),
        h(
          'div',
          { class: 'metric-grid three' },
          metric('BUC', million(traffic.bottomUp)),
          metric('TDC', million(traffic.topDown)),
          metric('CVPD', Math.round(traffic.openingCVPD).toLocaleString('en-IN'))
        ),
        h('div', { class: 'guideline' }, h('span', {}, 'Guideline'), h('strong', {}, 'IRC:58-2015')),
        traffic.warnings.length
          ? h('div', { class: 'warning-list' }, traffic.warnings.map((w) => notice('warn', null, w)))
          : null,
        fold({
          title: 'Working',
          memory: app.folds,
          key: 'rigid-traffic-working',
          children: [
            stepCard({
              title: 'Commercial vehicles over the design period',
              formula: 'C = 365 A [(1 + r)^n − 1] / r',
              result: `${(traffic.vehicles / 1e6).toFixed(2)} million vehicles`,
              ref: ref('IRC58', 'Cl. 5.5.2.7', { equation: 'Eq. 1' }),
            }),
            stepCard({
              title: 'Design lane',
              formula:
                t.carriageway === 'divided'
                  ? '25% of the axles in the predominant direction'
                  : '25% of the two-way axles',
              result: `${(traffic.laneAxles / 1e6).toFixed(2)} million axles`,
              ref: ref('IRC58', 'Cl. 5.5.2.3'),
            }),
            stepCard({
              title: 'Six-hour periods',
              formula: 'Day traffic for bottom-up; night traffic with a short wheel base for top-down',
              result: `${million(traffic.bottomUp)} bottom-up · ${million(traffic.topDown)} top-down`,
              ref: ref('IRC58', 'Cl. 5.5.2.4 / 6.3.3'),
            }),
          ],
        })
      )
    );
  };

  // Inputs edit the state in place, so handlers never read a stale copy.
  const onNumber = (key) => (value) => {
    t[key] = value;
    app.persist();
    show();
  };

  const screen = h(
    'div',
    { class: 'card-stack' },

    card(
      'Traffic',
      numberField({
        label: 'Commercial vehicles per day, both ways',
        ref: RIGID.traffic.ref,
        value: t.twoWayCVPD,
        suffix: 'CVPD',
        min: 0,
        onInput: onNumber('twoWayCVPD'),
      }),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Growth rate', ref: RIGID.traffic.ref, value: t.growthRatePercent, suffix: '%', min: 0, onInput: onNumber('growthRatePercent') }),
        numberField({ label: 'Years to completion', value: t.yearsToCompletion, suffix: 'yr', min: 0, onInput: onNumber('yearsToCompletion') })
      ),
      numberField({ label: 'Design period', value: t.designPeriodYears, suffix: 'yr', min: 1, onInput: onNumber('designPeriodYears') }),
      segmented({
        label: 'Carriageway',
        ref: RIGID.traffic.ref,
        value: t.carriageway,
        options: [
          { value: 'two-lane', label: 'Two-lane two-way' },
          { value: 'divided', label: 'Divided multi-lane' },
        ],
        onChange: (value) => {
          t.carriageway = value;
          app.persist();
          app.render();
        },
      }),
      t.carriageway === 'divided'
        ? numberField({
            label: 'Share in the predominant direction',
            value: t.directionalSplitPercent,
            suffix: '%',
            min: 0,
            max: 100,
            onInput: onNumber('directionalSplitPercent'),
          })
        : null
    ),

    card(
      'Day and night',
      numberField({ label: 'Commercial vehicles travelling at night', value: t.nightSharePercent, suffix: '%', min: 0, max: 100, onInput: onNumber('nightSharePercent') }),
      numberField({
        label: 'Wheel base shorter than the joint spacing',
        ref: RIGID.traffic.ref,
        value: t.shortWheelBasePercent,
        suffix: '%',
        min: 0,
        max: 100,
        onInput: onNumber('shortWheelBasePercent'),
      })
    ),

    resultHost
  );

  show();
  return screen;
}
