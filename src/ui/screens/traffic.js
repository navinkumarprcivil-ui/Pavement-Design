import {
  h,
  card,
  numberField,
  selectField,
  segmented,
  fold,
  metric,
  notice,
  button,
  msa,
} from '../dom.js';
import { stepCard } from '../citations.js';
import { designTraffic, trafficMissing } from '../project.js';
import { surveyCard } from '../spectrum.js';
import { laneDistributionOptions } from '../../engine/traffic.js';
import { TRAFFIC, MODULI, STAGE_CONSTRUCTION, roadCategory } from '../../data/ircConstants.js';
import { projectCard } from '../projectCard.js';
import { lowVolumeChoice } from '../lowVolume.js';

export default function renderTraffic(app) {
  const { traffic, project } = app.state;
  const lanes = laneDistributionOptions();
  const lane = lanes.find((o) => o.id === traffic.laneDistributionId) || lanes[0];
  const direct = traffic.mode === 'direct';
  // Undivided roads take the larger of the two directions' VDF (Cl. 4.6.2).
  const direction = lane.directional || direct ? 'design direction' : 'larger direction';

  const resultHost = h('div', { class: 'card-stack' });
  const status = h('div', {});
  const next = button('Continue', null);
  app.setActions(next);

  /** Recompute on every edit; only this part of the screen is redrawn. */
  const show = () => {
    const design = designTraffic(app.state);
    const { result } = design;

    next.textContent = 'Continue to composition';
    next.onclick = () => {
      const gap = trafficMissing(app.state);
      if (!gap) return app.go('layers');
      status.replaceChildren(notice('danger', null, gap));
      status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    status.replaceChildren();

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
          metric(!result.direct && lane.directional ? 'CVPD one way' : 'CVPD', Math.round(result.initialCVPD).toLocaleString('en-IN'))
        ),

        design.routeChoice
          ? lowVolumeChoice(app, {
              label: `Low volume road · under ${design.result.threshold} msa`,
              current: 'flexible',
              regular: { value: 'flexible', label: 'IRC:37-2018' },
              low: { value: 'rural', label: 'IRC:SP:72-2015' },
            })
          : h('div', { class: 'guideline' }, h('span', {}, 'Guideline'), h('strong', {}, 'IRC:37-2018')),

        design.stage
          ? h('div', { class: 'guideline' }, h('span', {}, 'Stage-1 bituminous layers'), h('strong', {}, msa(design.stage.designMsa)))
          : null,

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

  const screen = h(
    'div',
    { class: 'card-stack' },

    projectCard(app, {
      terrain: true,
      // The category carries the code's design period; start from it.
      onCategory: (value) => app.patch('traffic', { designLifeYears: roadCategory(value).designPeriodYears }),
    }),

    card(
      'Traffic',
      segmented({
        label: 'Traffic data',
        ref: TRAFFIC.growthEquation.ref,
        value: direct ? 'direct' : 'calculate',
        options: [
          { value: 'calculate', label: 'Commercial vehicle count' },
          { value: 'direct', label: 'Design traffic known' },
        ],
        onChange: (value) => app.patch('traffic', { mode: value }, { rerender: true }),
      }),
      direct
        ? [
            numberField({
              label: 'Design traffic',
              ref: TRAFFIC.growthEquation.ref,
              value: traffic.designMsa,
              suffix: 'msa',
              min: 0,
              onInput: onNumber('designMsa'),
            }),
            numberField({
              label: 'Commercial vehicles per day at completion, both ways',
              ref: MODULI.minimumCBR.ref,
              value: traffic.completionCVPD,
              suffix: 'CVPD',
              min: 0,
              onInput: onNumber('completionCVPD'),
            }),
          ]
        : [
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
          ],
      numberField({
        label: 'Design period',
        ref: TRAFFIC.longLife.ref,
        value: traffic.designLifeYears,
        suffix: 'yr',
        min: 1,
        onInput: onNumber('designLifeYears'),
      }),
      segmented({
        label: 'Construction',
        ref: STAGE_CONSTRUCTION.ref,
        value: traffic.stage.enabled ? 'stages' : 'single',
        options: [
          { value: 'single', label: 'Single stage' },
          { value: 'stages', label: 'In stages' },
        ],
        onChange: (value) => app.patch('traffic', { stage: { ...traffic.stage, enabled: value === 'stages' } }, { rerender: true }),
      }),
      traffic.stage.enabled
        ? numberField({
            label: direct ? 'Stage-1 traffic' : 'Stage-1 period',
            ref: STAGE_CONSTRUCTION.ref,
            value: direct ? traffic.stage.stage1Msa : traffic.stage.stage1Years,
            suffix: direct ? 'msa' : 'yr',
            min: 0,
            onInput: (value) => {
              traffic.stage[direct ? 'stage1Msa' : 'stage1Years'] = value;
              app.persist();
              show();
            },
          })
        : null,
      direct
        ? null
        : selectField({
            label: 'Carriageway',
            ref: TRAFFIC.laneDistributionFactors.ref,
            value: traffic.laneDistributionId,
            options: lanes.map((o) => ({ value: o.id, label: `${o.label} · D = ${o.value}` })),
            onChange: (value) => app.patch('traffic', { laneDistributionId: value }, { rerender: true }),
          }),
      !direct && lane.directional
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
          { value: 'survey', label: 'Survey VDF' },
          { value: 'axles', label: 'Axle loads' },
        ],
        onChange: (value) => app.patch('traffic', { vdfMode: value }, { rerender: true }),
      }),
      traffic.vdfMode === 'survey'
        ? numberField({
            label: `VDF from the survey, ${direction}`,
            ref: TRAFFIC.directionalVDF.ref,
            value: traffic.vehicleDamageFactor ?? '',
            min: 0,
            onInput: onNumber('vehicleDamageFactor'),
          })
        : null,
      traffic.vdfMode === 'axles'
        ? numberField({
            label: `Commercial vehicles weighed, ${direction}`,
            ref: TRAFFIC.axleEquivalence.sample.ref,
            value: traffic.axleSurvey.vehicles,
            min: 0,
            onInput: (value) => {
              traffic.axleSurvey.vehicles = value;
              app.persist();
              show();
            },
          })
        : null
    ),

    traffic.vdfMode === 'axles'
      ? TRAFFIC.axleEquivalence.axles.map((axle) => surveyCard(app, traffic.axleSurvey, axle, show))
      : null,

    status,
    resultHost
  );

  show();
  return screen;
}
