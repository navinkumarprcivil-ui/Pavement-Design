import {
  h,
  card,
  numberField,
  textField,
  selectField,
  segmented,
  fold,
  metric,
  notice,
  button,
  msa,
} from '../dom.js';
import { stepCard } from '../citations.js';
import { designTraffic } from '../project.js';
import { laneDistributionOptions } from '../../engine/traffic.js';
import { ROAD_CATEGORIES, TRAFFIC, roadCategory } from '../../data/ircConstants.js';

export default function renderTraffic(app) {
  const { traffic, project } = app.state;
  const lanes = laneDistributionOptions();
  const lane = lanes.find((o) => o.id === traffic.laneDistributionId) || lanes[0];

  const resultHost = h('div', { class: 'card-stack' });
  let mounted = false;
  const next = button('Continue', null);
  app.setActions(next);

  /** Recompute on every edit; only this part of the screen is redrawn. */
  const show = () => {
    const design = designTraffic(app.state);
    const { result } = design;

    // Below 2 msa the choice of guideline decides the module the design is in.
    const type = design.route === 'rural' ? 'rural' : 'flexible';
    if (app.state.pavementType !== type) {
      app.state.pavementType = type;
      app.persist();
      if (mounted) app.refreshChrome();
    }

    next.textContent =
      design.route === 'rural' ? 'Continue to design' : 'Continue to composition';
    next.onclick = () => app.go(design.route === 'rural' ? 'rural' : 'layers');

    resultHost.replaceChildren(
      h(
        'section',
        { class: 'card result-card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Design traffic'),
          h('span', { class: 'headline-value' }, msa(result.msa))
        ),
        h(
          'div',
          { class: 'metric-grid three' },
          metric('VDF', design.vdf.toFixed(2)),
          metric('Reliability', `${design.reliability}%`),
          metric(lane.directional ? 'CVPD one way' : 'CVPD', Math.round(result.initialCVPD).toLocaleString('en-IN'))
        ),

        design.routeChoice
          ? segmented({
              label: 'Design as',
              value: design.route,
              options: [
                { value: 'rural', label: 'Low volume road (IRC:SP:72)' },
                { value: 'flexible', label: 'Regular (IRC:37)' },
              ],
              onChange: (value) => {
                app.update({ routeChoice: value }, { rerender: false });
                show();
              },
            })
          : h('div', { class: 'guideline' }, h('span', {}, 'Guideline'), h('strong', {}, 'IRC:37-2018')),

        design.warnings.length
          ? h('div', { class: 'warning-list' }, design.warnings.map((w) => notice('warn', null, w)))
          : null,

        fold({
          title: 'Working',
          memory: app.folds,
          key: 'traffic-working',
          children: result.steps.map(stepCard),
        })
      )
    );
  };

  const onNumber = (key) => (value) => {
    app.patch('traffic', { [key]: value });
    show();
  };

  const categoryOptions = ROAD_CATEGORIES.options.map((o) => ({ value: o.id, label: o.label }));

  const screen = h(
    'div',
    { class: 'card-stack' },

    card(
      'Project',
      ['name', 'location', 'client', 'designer'].map((key) =>
        textField({
          label: { name: 'Project name', location: 'Location', client: 'Client', designer: 'Designer' }[key],
          value: project[key],
          onInput: (value) => app.patch('project', { [key]: value }),
        })
      ),
      segmented({
        label: 'Road category',
        ref: ROAD_CATEGORIES.ref,
        value: project.roadCategory,
        options: categoryOptions,
        onChange: (value) => {
          app.patch('project', { roadCategory: value });
          // The category carries the code's design period; start from it.
          app.patch('traffic', { designLifeYears: roadCategory(value).designPeriodYears });
          app.render();
        },
      }),
      segmented({
        label: 'Terrain',
        value: project.terrain,
        options: [
          { value: 'plain', label: 'Plain' },
          { value: 'rolling', label: 'Rolling' },
          { value: 'hilly', label: 'Hilly' },
        ],
        onChange: (value) => app.patch('project', { terrain: value }, { rerender: true }),
      })
    ),

    card(
      'Traffic',
      numberField({
        label: 'Commercial vehicles per day, both ways',
        ref: TRAFFIC.growthEquation.ref,
        value: traffic.presentCVPD,
        suffix: 'CVPD',
        min: 0,
        onInput: onNumber('presentCVPD'),
      }),
      numberField({
        label: 'Growth rate',
        ref: TRAFFIC.minimumGrowthRate.ref,
        value: traffic.growthRatePercent,
        suffix: '%',
        min: 0,
        onInput: onNumber('growthRatePercent'),
      }),
      numberField({
        label: 'Years to completion',
        value: traffic.yearsToCompletion,
        suffix: 'yr',
        min: 0,
        onInput: onNumber('yearsToCompletion'),
      }),
      numberField({
        label: 'Design period',
        ref: TRAFFIC.longLife.ref,
        value: traffic.designLifeYears,
        suffix: 'yr',
        min: 1,
        onInput: onNumber('designLifeYears'),
      }),
      selectField({
        label: 'Carriageway',
        ref: TRAFFIC.laneDistributionFactors.ref,
        value: traffic.laneDistributionId,
        options: lanes.map((o) => ({ value: o.id, label: `${o.label} · D = ${o.value}` })),
        onChange: (value) => app.patch('traffic', { laneDistributionId: value }, { rerender: true }),
      }),
      lane.directional
        ? numberField({
            label: 'Share in the design direction',
            value: traffic.directionalSplitPercent,
            suffix: '%',
            min: 0,
            max: 100,
            onInput: onNumber('directionalSplitPercent'),
          })
        : null,
      segmented({
        label: 'Vehicle damage factor',
        ref: TRAFFIC.indicativeVDF.ref,
        value: traffic.vdfMode,
        options: [
          { value: 'indicative', label: 'Indicative' },
          { value: 'survey', label: 'Axle load survey' },
        ],
        onChange: (value) => app.patch('traffic', { vdfMode: value }, { rerender: true }),
      }),
      traffic.vdfMode === 'survey'
        ? numberField({
            label: 'VDF from the survey',
            value: traffic.vehicleDamageFactor ?? '',
            min: 0,
            onInput: onNumber('vehicleDamageFactor'),
          })
        : null
    ),

    resultHost
  );

  show();
  mounted = true;
  return screen;
}
