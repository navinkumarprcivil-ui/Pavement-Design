import { h, card, numberField, fold, metric, notice } from '../dom.js';
import { stepCard } from '../citations.js';
import { checkTrialSlab } from '../../engine/rigidIRC58.js';

export default function renderRigid(app) {
  const rigid = app.state.rigid;
  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const result = checkTrialSlab(rigid);
    app.state.rigidResult = result;

    host.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h(
          'div',
          { class: 'headline' },
          h('span', { class: 'headline-label' }, 'Stress ratio'),
          h('span', { class: 'headline-value' }, result.stressRatio.toFixed(3))
        ),
        h(
          'div',
          { class: 'metric-grid' },
          metric('Edge load stress', `${result.stresses.edge.toFixed(2)} MPa`),
          metric('Warping stress', `${result.warping.stress.toFixed(2)} MPa`),
          metric('Interior', `${result.stresses.interior.toFixed(2)} MPa`),
          metric('Corner', `${result.stresses.corner.toFixed(2)} MPa`),
          metric('Relative stiffness, l', `${result.radiusOfRelativeStiffnessMm.toFixed(0)} mm`)
        )
      ),
      h(
        'section',
        { class: 'card folds' },
        fold({ title: 'Working', memory: app.folds, key: 'rigid-working', children: result.steps.map(stepCard) })
      )
    );
  };

  const field = (label, key, suffix) =>
    numberField({
      label,
      value: rigid[key],
      suffix,
      min: 0,
      onInput: (value) => {
        if (value == null) return;
        app.patch('rigid', { [key]: value });
        show();
      },
    });

  show();

  return h(
    'div',
    { class: 'card-stack' },
    notice('warn', null, 'Westergaard stresses only — not yet the IRC:58-2015 fatigue design'),
    card(
      'Slab',
      h('div', { class: 'field-row' }, field('Thickness', 'slabThicknessMm', 'mm'), field('Joint spacing', 'slabLengthMm', 'mm')),
      h('div', { class: 'field-row' }, field('Elastic modulus', 'elasticModulusMPa', 'MPa'), field("Poisson's ratio", 'poissonRatio', '')),
      field('Flexural strength, 28 day', 'flexuralStrengthMPa', 'MPa')
    ),
    card(
      'Foundation and load',
      field('Effective k', 'modulusOfSubgradeReactionMPaPerM', 'MPa/m'),
      h('div', { class: 'field-row' }, field('Wheel load', 'wheelLoadN', 'N'), field('Tyre pressure', 'tyrePressureMPa', 'MPa')),
      field('Temperature differential', 'temperatureDifferentialC', '°C')
    ),
    host
  );
}
