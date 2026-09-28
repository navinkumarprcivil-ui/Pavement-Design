import { h, card, numberField, segmented, keyResult, notice, button } from '../dom.js';
import { designTraffic } from '../project.js';
import { ctbDamageInput } from '../ctbProject.js';
import { AXLES, axleMixCard, spectrumCard } from '../spectrum.js';
import { CRITERIA, TRAFFIC } from '../../data/ircConstants.js';

export default function renderCtbAxles(app) {
  const ctb = app.state.ctb;
  const traffic = designTraffic(app.state);

  app.setActions(button('Continue to inputs', () => app.go('inputs')));

  const summary = h('div', { class: 'key-results' });
  const warnings = h('div', {});

  const show = () => {
    const input = ctbDamageInput(app.state, traffic);
    summary.replaceChildren(
      keyResult('Modulus of rupture', input.rupture.value.toFixed(2), 'MPa', CRITERIA.ctbRupture.ref),
      keyResult('Vehicles, design lane', (input.vehicles / 1e6).toFixed(2), 'million', TRAFFIC.growthEquation.ref),
      keyResult('Load classes', String(input.classes.length), null, CRITERIA.cementedDamage.ref)
    );
    warnings.replaceChildren(...input.warnings.map((w) => notice('warn', null, w)));
  };

  show();

  return h(
    'div',
    { class: 'card-stack' },
    summary,
    card(
      'Cement treated base',
      segmented({
        label: 'Material',
        ref: CRITERIA.ctbRupture.ref,
        value: ctb.material,
        options: CRITERIA.ctbRupture.materials.map((m) => ({ value: m.id, label: m.short })),
        onChange: (value) => {
          ctb.material = value;
          app.persist();
          app.render();
        },
      }),
      numberField({
        label: '28-day UCS',
        ref: CRITERIA.ctbRupture.ref,
        value: ctb.ucsMPa,
        suffix: 'MPa',
        min: 0,
        onInput: (value) => {
          ctb.ucsMPa = value;
          app.persist();
          show();
        },
      })
    ),
    warnings,
    axleMixCard(app, ctb, show),
    AXLES.map((axle) => spectrumCard(app, ctb.spectrum, axle, 'ctb-paste', show))
  );
}
