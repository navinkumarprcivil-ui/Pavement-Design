import { h, card, numberField, segmented, fold, metric, notice, button } from '../dom.js';
import { stepCard } from '../citations.js';
import { projectCard } from '../projectCard.js';
import { lowVolumeChoice } from '../lowVolume.js';
import { ruralTrafficFor } from '../lowVolumeProject.js';
import { categorise } from '../../engine/ruralSP72.js';
import { SP72 } from '../../data/sp72.js';

const inr = (n) => Math.round(n).toLocaleString('en-IN');

export default function renderRuralTraffic(app) {
  const t = app.state.rural.traffic;
  const resultHost = h('div', { class: 'card-stack' });

  app.setActions(button('Continue to design', () => app.go('rural')));

  const show = () => {
    const traffic = ruralTrafficFor(app.state);
    const { category, withinScope, message } = categorise(traffic.esal);
    resultHost.replaceChildren(
      h(
        'section',
        { class: 'card result-card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Design traffic'),
          h('span', { class: 'headline-value' }, `${inr(traffic.esal)} ESAL`)
        ),
        h(
          'div',
          { class: 'metric-grid three' },
          metric('Category', category.id),
          traffic.esalPerDay != null ? metric('ESAL per day', traffic.esalPerDay.toFixed(2)) : metric('CVPD', inr(traffic.cvpdAtOpening)),
          metric('Lane factor', String(traffic.laneFactor))
        ),
        lowVolumeChoice(app, {
          label: 'Design to',
          current: 'rural',
          regular: { value: 'flexible', label: 'IRC:37-2018' },
          low: { value: 'rural', label: 'IRC:SP:72-2015' },
        }),
        [...traffic.warnings, ...(withinScope ? [] : [message])].length
          ? h(
              'div',
              { class: 'warning-list' },
              [...traffic.warnings, ...(withinScope ? [] : [message])].map((w) => notice('warn', null, w))
            )
          : null,
        fold({ title: 'Working', memory: app.folds, key: 'rural-traffic-working', children: traffic.steps.map(stepCard) })
      )
    );
  };

  const onNumber = (key, target = t) => (value) => {
    target[key] = value;
    app.persist();
    show();
  };
  const onChoice = (key, target = t) => (value) => {
    target[key] = value;
    app.persist();
    app.render();
  };

  const counts = t.mode === 'counts';
  const hv = t.harvest;

  const screen = h(
    'div',
    { class: 'card-stack' },
    projectCard(app),

    card(
      'Traffic',
      segmented({
        label: 'Traffic data',
        ref: SP72.commercialVehicle.ref,
        value: t.mode,
        options: [
          { value: 'counts', label: 'Counts by class' },
          { value: 'appendixA', label: 'CVPD only' },
        ],
        onChange: onChoice('mode'),
      }),
      counts
        ? [
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'Heavy commercial vehicles (HCV)', ref: SP72.vdf.ref, value: t.hcv, suffix: 'per day', min: 0, onInput: onNumber('hcv') }),
              numberField({ label: 'Medium commercial vehicles (MCV)', ref: SP72.vdf.ref, value: t.mcv, suffix: 'per day', min: 0, onInput: onNumber('mcv') })
            ),
            numberField({ label: 'Laden share', ref: SP72.vdf.ref, value: t.ladenPercent, suffix: '%', min: 0, max: 100, onInput: onNumber('ladenPercent') }),
            segmented({
              label: 'Vehicle damage factor',
              ref: SP72.vdf.ref,
              value: t.vdfMode,
              options: [
                { value: 'indicative', label: 'Indicative' },
                { value: 'survey', label: 'Axle load survey' },
              ],
              onChange: onChoice('vdfMode'),
            }),
            t.vdfMode === 'survey'
              ? h(
                  'div',
                  { class: 'field-row' },
                  numberField({ label: 'VDF, HCV', value: t.vdfHcv, min: 0, onInput: onNumber('vdfHcv') }),
                  numberField({ label: 'VDF, MCV', value: t.vdfMcv, min: 0, onInput: onNumber('vdfMcv') })
                )
              : null,
          ]
        : numberField({ label: 'Commercial vehicles per day', ref: SP72.appendixA.ref, value: t.cvpd, suffix: 'CVPD', min: 0, onInput: onNumber('cvpd') }),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Growth rate', ref: SP72.growth.ref, value: t.growthPercent, suffix: '%', min: 0, onInput: onNumber('growthPercent') }),
        numberField({ label: 'Years from count to opening', value: t.yearsToOpening, suffix: 'yr', min: 0, onInput: onNumber('yearsToOpening') })
      ),
      numberField({ label: 'Design life', ref: SP72.designLife.ref, value: t.designLifeYears, suffix: 'yr', min: 1, onInput: onNumber('designLifeYears') }),
      segmented({
        label: 'Carriageway',
        ref: SP72.lane.ref,
        value: t.laneId,
        options: SP72.lane.options.map((o) => ({ value: o.id, label: `${o.label} · L = ${o.value}` })),
        onChange: onChoice('laneId'),
      })
    ),

    counts
      ? card(
          'Harvesting seasons',
          segmented({
            label: 'Seasonal traffic',
            ref: SP72.harvest.ref,
            value: hv.enabled ? 'yes' : 'no',
            options: [
              { value: 'no', label: 'Counts are AADT' },
              { value: 'yes', label: 'Adjust for harvest' },
            ],
            onChange: (value) => onChoice('enabled', hv)(value === 'yes'),
          }),
          hv.enabled
            ? [
                segmented({
                  label: 'Counted in',
                  value: hv.countSeason,
                  options: [
                    { value: 'peak', label: 'Harvesting season' },
                    { value: 'lean', label: 'Lean season' },
                  ],
                  onChange: onChoice('countSeason', hv),
                }),
                h(
                  'div',
                  { class: 'field-row' },
                  numberField({ label: 'Peak rise over lean traffic, n', value: hv.rise, min: 0, onInput: onNumber('rise', hv) }),
                  numberField({ label: 'Length of a season, t', value: hv.seasonDays, suffix: 'days', min: 0, onInput: onNumber('seasonDays', hv) })
                ),
                numberField({ label: 'Harvesting seasons a year', value: hv.seasons, min: 1, onInput: onNumber('seasons', hv) }),
              ]
            : null
        )
      : null,

    resultHost
  );

  show();
  return screen;
}
