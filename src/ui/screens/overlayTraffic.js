import { h, card, numberField, segmented, fold, metric, notice, button, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import { projectCard } from '../projectCard.js';
import { overlayTrafficFor } from '../overlayProject.js';
import { laneOptions } from '../../engine/overlay.js';
import { IRC81, IRC115 } from '../../data/overlay.js';

export const METHODS = [
  { value: 'fwd', label: 'Falling weight deflectometer · IRC:115' },
  { value: 'bbd', label: 'Benkelman beam · IRC:81' },
];

export default function renderOverlayTraffic(app) {
  const o = app.state.overlay;
  const t = o.traffic;
  const spec = (o.method === 'bbd' ? IRC81 : IRC115).traffic;
  const resultHost = h('div', { class: 'card-stack' });

  app.setActions(button('Continue to deflections', () => app.go('overlaySurvey')));

  const show = () => {
    const traffic = overlayTrafficFor(app.state);
    resultHost.replaceChildren(
      traffic.ok
        ? h(
            'section',
            { class: 'card result-card' },
            h(
              'div',
              { class: 'headline' },
              h('span', { class: 'headline-label' }, 'Design traffic'),
              h('span', { class: 'headline-value' }, msa(traffic.msa))
            ),
            traffic.A != null
              ? h(
                  'div',
                  { class: 'metric-grid three' },
                  metric('CVPD at start', Math.round(traffic.A).toLocaleString('en-IN')),
                  metric('Lane factor', traffic.D.toFixed(2)),
                  metric('VDF', String(traffic.F))
                )
              : null,
            traffic.warnings.length ? h('div', { class: 'warning-list' }, traffic.warnings.map((w) => notice('warn', null, w))) : null,
            fold({ title: 'Working', memory: app.folds, key: 'overlay-traffic-working', children: traffic.steps.map(stepCard) })
          )
        : notice('info', null, traffic.message)
    );
  };

  const onNumber = (key) => (value) => {
    t[key] = value;
    app.persist();
    show();
  };
  const onChoice = (key) => (value) => {
    t[key] = value;
    app.persist();
    app.render();
  };

  const direct = t.mode === 'direct';
  const lanes = laneOptions(o.method);
  const lane = lanes.find((l) => l.id === t.laneId);

  const screen = h(
    'div',
    { class: 'card-stack' },
    projectCard(app, { terrain: true }),
    card(
      'Survey',
      segmented({
        label: 'Deflection survey',
        value: o.method,
        options: METHODS,
        onChange: (value) => {
          // Each code's own default growth, unless another rate was entered.
          const defaults = { fwd: IRC115.traffic.growth.minimumPercent, bbd: IRC81.traffic.growth.defaultPercent };
          if (t.growthRatePercent === defaults[o.method]) t.growthRatePercent = defaults[value];
          o.method = value;
          if (!laneOptions(value).some((l) => l.id === t.laneId)) t.laneId = 'two-lane';
          app.persist();
          app.refreshChrome();
          app.render();
        },
      })
    ),
    card(
      'Traffic',
      segmented({
        label: 'Traffic data',
        ref: spec.ref,
        value: t.mode,
        options: [
          { value: 'calculate', label: 'From the counts' },
          { value: 'direct', label: 'Design traffic known' },
        ],
        onChange: onChoice('mode'),
      }),
      direct
        ? numberField({ label: 'Design traffic', ref: spec.ref, value: t.designMsa, suffix: 'msa', min: 0, onInput: onNumber('designMsa') })
        : [
            numberField({ label: 'Commercial vehicles per day, both directions', ref: spec.ref, value: t.presentCVPD, suffix: 'CVPD', min: 0, onInput: onNumber('presentCVPD') }),
            h(
              'div',
              { class: 'field-row' },
              numberField({
                label: 'Growth rate',
                ref: spec.growth.ref,
                aside: o.method === 'fwd' ? `min ${IRC115.traffic.growth.minimumPercent}%` : null,
                value: t.growthRatePercent,
                suffix: '%',
                min: 0,
                onInput: onNumber('growthRatePercent'),
              }),
              numberField({ label: 'Years from count to completion', value: t.yearsToCompletion, suffix: 'yr', min: 0, onInput: onNumber('yearsToCompletion') })
            ),
            numberField({ label: 'Design life', ref: spec.designLife.ref, value: t.designLifeYears, suffix: 'yr', min: 1, onInput: onNumber('designLifeYears') }),
            segmented({
              label: 'Carriageway',
              ref: spec.lanes.ref,
              value: t.laneId,
              options: lanes.map((l) => ({ value: l.id, label: `${l.label} · ${l.factor}` })),
              onChange: onChoice('laneId'),
            }),
            lane?.basis === 'direction'
              ? numberField({
                  label: 'Share of the heavier direction',
                  ref: spec.lanes.ref,
                  value: t.directionalSplitPercent,
                  suffix: '%',
                  min: 50,
                  max: 100,
                  onInput: onNumber('directionalSplitPercent'),
                })
              : null,
            segmented({
              label: 'Vehicle damage factor',
              ref: spec.vdf.ref,
              value: t.vdfMode,
              options: [
                { value: 'indicative', label: 'Indicative' },
                { value: 'value', label: 'From an axle load survey' },
              ],
              onChange: onChoice('vdfMode'),
            }),
            t.vdfMode === 'value'
              ? numberField({ label: 'Vehicle damage factor', ref: spec.vdf.ref, value: t.vehicleDamageFactor, min: 0, onInput: onNumber('vehicleDamageFactor') })
              : null,
          ]
    ),
    resultHost
  );

  show();
  return screen;
}
