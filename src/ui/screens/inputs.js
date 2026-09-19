import { h, numberField, selectField, notice, msa } from '../dom.js';
import { describeCombination, BINDER_GRADES } from '../../data/layerCatalog.js';
import { BEHAVIOUR } from '../../data/layerCatalog.js';
import { evaluateTrial, findMinimumBituminous } from '../../engine/flexibleDesign.js';
import { reliabilityFor } from '../../engine/criteria.js';

export default function renderInputs(app) {
  const { combination, materials, mix, trafficResult } = app.state;
  const described = describeCombination(combination);
  const designTrafficMsa = trafficResult?.msa ?? 0;

  // Seed any thickness not yet chosen with the catalogue default.
  const thicknesses = { ...app.state.thicknesses };
  for (const slot of described.slots) {
    if (slot.behaviour === BEHAVIOUR.SUBGRADE) continue;
    if (thicknesses[slot.slotId] == null) thicknesses[slot.slotId] = slot.defaultMm;
  }
  app.state.thicknesses = thicknesses;

  const status = h('div', {});

  const runDesign = () => {
    const result = evaluateTrial({
      combination,
      thicknesses: app.state.thicknesses,
      materials,
      mix,
      designTrafficMsa,
    });
    app.state.result = result;
    app.go('results');
  };

  const autoDesign = () => {
    status.replaceChildren(
      notice('info', 'Searching', 'Finding the thinnest safe bituminous thickness…'),
      h('div', { class: 'progress' }, h('span', { style: { width: '5%' } }))
    );

    // Yield to the browser so the notice paints before the search blocks.
    setTimeout(() => {
      const outcome = findMinimumBituminous({
        combination,
        thicknesses: app.state.thicknesses,
        materials,
        mix,
        designTrafficMsa,
      });

      if (!outcome.found) {
        status.replaceChildren(
          notice('danger', 'No safe section found', outcome.message)
        );
        return;
      }

      app.state.thicknesses = outcome.thicknesses;
      app.state.result = outcome.trial;
      app.go('results');
    }, 30);
  };

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('span', { class: 'step-label' }, 'Step 3 of 4'),
      h('h2', { class: 'screen-title' }, 'Design inputs'),
      h(
        'p',
        { class: 'screen-intro' },
        `Designing for ${msa(designTrafficMsa)} at ` +
          `${reliabilityFor(designTrafficMsa)}% reliability.`
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Subgrade'),
      numberField({
        label: 'Effective CBR of the subgrade',
        hint:
          'The CBR of the 500 mm below the sub-base, soaked, at the design ' +
          'moisture content and 97% of maximum dry density.',
        value: materials.subgradeCBR,
        suffix: '%',
        min: 1,
        max: 100,
        onInput: (value) => app.patch('materials', { subgradeCBR: value }),
      }),
      materials.subgradeCBR < 5
        ? notice(
            'warn',
            'Low subgrade CBR',
            'IRC:37 expects a subgrade CBR of at least 5% for design traffic ' +
              'above 2 msa. Consider a capping layer or subgrade improvement.'
          )
        : null
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Bituminous mix'),
      selectField({
        label: 'Binder grade',
        value: materials.binderGrade,
        options: BINDER_GRADES.map((g) => ({ value: g, label: g })),
        onChange: (value) => app.patch('materials', { binderGrade: value }),
      }),
      numberField({
        label: 'Mean annual pavement temperature',
        hint: 'Sets the resilient modulus of the bituminous layers.',
        value: materials.pavementTemperatureC,
        suffix: '°C',
        min: 10,
        max: 50,
        onInput: (value) => app.patch('materials', { pavementTemperatureC: value }),
      }),
      h(
        'div',
        { class: 'field-row' },
        numberField({
          label: 'Air voids, Va',
          value: mix.airVoidsPercent,
          suffix: '%',
          min: 0,
          onInput: (value) => app.patch('mix', { airVoidsPercent: value }),
        }),
        numberField({
          label: 'Effective binder, Vbe',
          hint: 'By volume of the mix.',
          value: mix.effectiveBinderPercent,
          suffix: '%',
          min: 0,
          onInput: (value) => app.patch('mix', { effectiveBinderPercent: value }),
        })
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Trial thicknesses'),
      h(
        'p',
        { class: 'muted', style: { marginTop: 0 } },
        'Enter a trial section and check it, or let the app find the thinnest ' +
          'safe bituminous thickness for the foundation you have set.'
      ),
      described.slots
        .filter((slot) => slot.behaviour !== BEHAVIOUR.SUBGRADE)
        .map((slot) =>
          numberField({
            label: slot.label,
            hint: `Minimum ${slot.minMm} mm`,
            value: thicknesses[slot.slotId],
            suffix: 'mm',
            min: 0,
            step: 5,
            onInput: (value) => {
              app.state.thicknesses = {
                ...app.state.thicknesses,
                [slot.slotId]: value ?? 0,
              };
              app.persist();
            },
          })
        )
    ),

    status,

    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'button secondary', onclick: autoDesign }, 'Find minimum'),
      h('button', { class: 'button', onclick: runDesign }, 'Check this section')
    )
  );
}
