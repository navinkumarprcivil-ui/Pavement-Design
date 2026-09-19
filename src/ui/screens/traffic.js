import { h, numberField, selectField, notice, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import {
  computeDesignTraffic,
  indicativeVDF,
  laneDistributionOptions,
} from '../../engine/traffic.js';

export default function renderTraffic(app) {
  const { traffic, project } = app.state;
  const laneOptions = laneDistributionOptions();

  const effectiveVDF = () =>
    traffic.vdfMode === 'manual' && traffic.vehicleDamageFactor
      ? traffic.vehicleDamageFactor
      : indicativeVDF(traffic.presentCVPD || 0, project.terrain);

  const compute = () => {
    const lane = laneOptions.find((o) => o.id === traffic.laneDistributionId);
    return computeDesignTraffic({
      presentCVPD: traffic.presentCVPD || 0,
      growthRatePercent: traffic.growthRatePercent || 0,
      yearsToCompletion: traffic.yearsToCompletion || 0,
      designLifeYears: traffic.designLifeYears || 1,
      laneDistributionFactor: lane.value,
      vehicleDamageFactor: effectiveVDF(),
    });
  };

  const resultHost = h('div', { class: 'card-stack' });

  const show = () => {
    const result = compute();
    app.state.trafficResult = result;
    resultHost.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Design traffic'),
        h(
          'div',
          { class: 'metric-grid' },
          h(
            'div',
            { class: 'metric' },
            h('span', { class: 'metric-label' }, 'Cumulative standard axles'),
            h('span', { class: 'metric-value' }, msa(result.msa))
          ),
          h(
            'div',
            { class: 'metric' },
            h('span', { class: 'metric-label' }, 'Vehicle damage factor'),
            h('span', { class: 'metric-value' }, effectiveVDF().toFixed(2))
          )
        ),
        result.steps.map(stepCard)
      ),

      result.route === 'rural'
        ? notice(
            'info',
            'This is a low volume rural road',
            `At ${msa(result.msa)} the design traffic is below the ${result.threshold} msa ` +
              'floor of IRC:37-2018, so IRC:SP:72-2015 applies.'
          )
        : notice(
            'info',
            'Full flexible pavement design',
            `At ${msa(result.msa)} the design traffic is at or above the ` +
              `${result.threshold} msa floor, so IRC:37-2018 applies.`
          ),

      h(
        'button',
        {
          class: 'button',
          onclick: () => app.go(result.route === 'rural' ? 'rural' : 'layers'),
        },
        result.route === 'rural'
          ? 'Continue to rural road design'
          : 'Continue to layer combination'
      )
    );
  };

  const form = h(
    'div',
    { class: 'card' },

    h('h2', { class: 'section-title' }, 'Project'),
    h('div', { class: 'field' },
      h('label', {}, 'Project name'),
      h('input', {
        type: 'text',
        value: project.name,
        placeholder: 'e.g. Widening of SH-27, km 12 to 18',
        oninput: (e) => app.patch('project', { name: e.target.value }),
      })
    ),

    selectField({
      label: 'Terrain',
      hint: 'Used for the indicative vehicle damage factor.',
      value: project.terrain,
      options: [
        { value: 'plain', label: 'Plain' },
        { value: 'rolling', label: 'Rolling' },
        { value: 'hilly', label: 'Hilly' },
      ],
      onChange: (value) => {
        app.patch('project', { terrain: value });
        show();
      },
    }),

    h('h2', { class: 'section-title', style: { marginTop: '18px' } }, 'Traffic'),

    numberField({
      label: 'Commercial vehicles per day at the last count',
      hint: 'Both directions, vehicles of laden weight 3 tonnes and above.',
      value: traffic.presentCVPD,
      suffix: 'CVPD',
      min: 0,
      onInput: (value) => {
        app.patch('traffic', { presentCVPD: value });
        show();
      },
    }),

    h(
      'div',
      { class: 'field-row' },
      numberField({
        label: 'Annual growth rate',
        value: traffic.growthRatePercent,
        suffix: '%',
        min: 0,
        onInput: (value) => {
          app.patch('traffic', { growthRatePercent: value });
          show();
        },
      }),
      numberField({
        label: 'Years to completion',
        hint: 'From the count to the end of construction.',
        value: traffic.yearsToCompletion,
        suffix: 'yr',
        min: 0,
        onInput: (value) => {
          app.patch('traffic', { yearsToCompletion: value });
          show();
        },
      })
    ),

    numberField({
      label: 'Design life',
      value: traffic.designLifeYears,
      suffix: 'yr',
      min: 1,
      onInput: (value) => {
        app.patch('traffic', { designLifeYears: value });
        show();
      },
    }),

    selectField({
      label: 'Carriageway type',
      hint: 'Sets the lane distribution factor.',
      value: traffic.laneDistributionId,
      options: laneOptions.map((o) => ({
        value: o.id,
        label: `${o.label} — D = ${o.value}`,
      })),
      onChange: (value) => {
        app.patch('traffic', { laneDistributionId: value });
        show();
      },
    }),

    selectField({
      label: 'Vehicle damage factor',
      value: traffic.vdfMode,
      options: [
        { value: 'indicative', label: 'Use the indicative value for this traffic and terrain' },
        { value: 'manual', label: 'Enter a value from an axle load survey' },
      ],
      onChange: (value) => {
        app.patch('traffic', { vdfMode: value }, { rerender: true });
      },
    }),

    traffic.vdfMode === 'manual'
      ? numberField({
          label: 'Vehicle damage factor from the survey',
          hint: 'A measured VDF always takes precedence over the indicative value.',
          value: traffic.vehicleDamageFactor ?? '',
          min: 0,
          onInput: (value) => {
            app.patch('traffic', { vehicleDamageFactor: value });
            show();
          },
        })
      : h(
          'p',
          { class: 'muted' },
          `Indicative VDF for ${traffic.presentCVPD || 0} CVPD in ${project.terrain} ` +
            `terrain: ${effectiveVDF().toFixed(2)}`
        )
  );

  show();

  return h(
    'div',
    { class: 'card-stack' },
    h(
      'div',
      {},
      h('span', { class: 'step-label' }, 'Step 1 of 4'),
      h('h2', { class: 'screen-title' }, 'Design traffic'),
      h(
        'p',
        { class: 'screen-intro' },
        'Traffic comes first because it decides which guideline applies — a ' +
          'full flexible design or a low volume rural road.'
      )
    ),
    form,
    resultHost
  );
}
