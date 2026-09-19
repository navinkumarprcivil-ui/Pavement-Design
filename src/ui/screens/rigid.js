import { h, numberField, notice } from '../dom.js';
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
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Slab stresses'),
        h(
          'div',
          { class: 'metric-grid' },
          metric('Radius of relative stiffness', `${result.radiusOfRelativeStiffnessMm.toFixed(0)} mm`),
          metric('Edge load stress', `${result.stresses.edge.toFixed(2)} MPa`),
          metric('Warping stress', `${result.warping.stress.toFixed(2)} MPa`),
          metric('Stress ratio', result.stressRatio.toFixed(3))
        ),
        result.steps.map(stepCard)
      ),

      h(
        'div',
        { class: 'card' },
        h('h2', { class: 'section-title' }, 'Other load positions'),
        h(
          'div',
          { class: 'metric-grid' },
          metric('Interior', `${result.stresses.interior.toFixed(2)} MPa`),
          metric('Corner', `${result.stresses.corner.toFixed(2)} MPa`)
        )
      ),

      notice('warn', 'No pass or fail verdict is given', result.message)
    );
  };

  const metric = (label, value) =>
    h(
      'div',
      { class: 'metric' },
      h('span', { class: 'metric-label' }, label),
      h('span', { class: 'metric-value' }, value)
    );

  const field = (label, key, suffix, hint) =>
    numberField({
      label,
      hint,
      value: rigid[key],
      suffix,
      min: 0,
      onInput: (value) => {
        app.patch('rigid', { [key]: value ?? 0 });
        show();
      },
    });

  show();

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'Rigid pavement'),
      h(
        'p',
        { class: 'screen-intro' },
        'Westergaard slab stresses and warping stress for a trial slab.'
      )
    ),

    notice(
      'warn',
      'Partial implementation',
      'The IRC:58-2015 design procedure — finite-element derived flexural ' +
        'stress equations and cumulative fatigue damage over the axle load ' +
        'spectrum — is not implemented yet. What is shown here is the classical ' +
        'Westergaard analysis, which is a sound estimate of slab stresses but ' +
        'is not the code procedure. Do not use it as an IRC:58 design.'
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Slab'),
      field('Trial slab thickness', 'slabThicknessMm', 'mm'),
      field('Slab length between joints', 'slabLengthMm', 'mm'),
      field('Concrete elastic modulus', 'elasticModulusMPa', 'MPa'),
      field('Flexural strength', 'flexuralStrengthMPa', 'MPa', '28 day modulus of rupture.'),
      field("Poisson's ratio", 'poissonRatio', '')
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Foundation and load'),
      field(
        'Modulus of subgrade reaction',
        'modulusOfSubgradeReactionMPaPerM',
        'MPa/m',
        'Effective k of the subgrade with the sub-base in place.'
      ),
      field('Wheel load', 'wheelLoadN', 'N'),
      field('Tyre pressure', 'tyrePressureMPa', 'MPa'),
      field(
        'Temperature differential',
        'temperatureDifferentialC',
        '°C',
        'Top to bottom across the slab, for the warping stress.'
      )
    ),

    host,

    h(
      'button',
      { class: 'button secondary', onclick: () => app.go('home') },
      'Back to start'
    )
  );
}
