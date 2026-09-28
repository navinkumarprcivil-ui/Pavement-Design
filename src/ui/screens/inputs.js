import { h, card, numberField, segmented, notice, button, msa } from '../dom.js';
import { stepper } from '../stepper.js';
import { designTraffic, subgradeWarning } from '../project.js';
import { describeCombination, BINDER_GRADES, BEHAVIOUR } from '../../data/layerCatalog.js';
import { evaluateTrial, designSection } from '../../engine/flexibleDesign.js';

export default function renderInputs(app) {
  const { combination, materials, mix, project } = app.state;
  const traffic = designTraffic(app.state);
  const designTrafficMsa = traffic.result.msa;
  const described = describeCombination(combination);
  const layerSlots = described.slots.filter((s) => s.behaviour !== BEHAVIOUR.SUBGRADE);

  // Seed any thickness not yet chosen with the catalogue default.
  const thicknesses = { ...app.state.thicknesses };
  for (const slot of layerSlots) {
    if (thicknesses[slot.slotId] == null) thicknesses[slot.slotId] = slot.defaultMm;
  }
  app.state.thicknesses = thicknesses;

  const designInput = () => ({
    combination,
    thicknesses: app.state.thicknesses,
    materials,
    mix,
    designTrafficMsa,
    roadCategory: project.roadCategory,
  });

  const status = h('div', {});
  const cbrWarning = h('div', {});
  const showCbrWarning = () => {
    const text = subgradeWarning(app.state, traffic.twoWayAtCompletion);
    cbrWarning.replaceChildren(text ? notice('warn', null, text) : '');
  };

  const check = () => {
    app.state.result = evaluateTrial(designInput());
    app.go('results');
  };

  const design = () => {
    status.replaceChildren(h('div', { class: 'progress indeterminate' }, h('span')));
    // Yield so the progress bar paints before the search runs.
    setTimeout(() => {
      const outcome = designSection(designInput());
      if (!outcome.found) {
        status.replaceChildren(notice('danger', 'No safe section', outcome.message));
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      app.state.thicknesses = outcome.thicknesses;
      app.state.result = outcome.trial;
      app.persist();
      app.go('results');
    }, 30);
  };

  app.setActions(
    button('Check entered', check, { kind: 'secondary' }),
    button('Design thicknesses', design)
  );

  showCbrWarning();

  return h(
    'div',
    { class: 'card-stack' },
    stepper(app),

    h(
      'div',
      { class: 'summary-chips' },
      h('span', { class: 'chip' }, msa(designTrafficMsa)),
      h('span', { class: 'chip' }, `${traffic.reliability}% reliability`),
      traffic.category ? h('span', { class: 'chip' }, traffic.category.label) : null
    ),

    card(
      'Subgrade',
      numberField({
        label: 'Effective CBR',
        value: materials.subgradeCBR,
        suffix: '%',
        min: 1,
        max: 100,
        onInput: (value) => {
          app.patch('materials', { subgradeCBR: value });
          showCbrWarning();
        },
      }),
      cbrWarning
    ),

    card(
      'Bituminous mix',
      segmented({
        label: 'Binder, bottom layer',
        value: materials.binderGrade,
        options: BINDER_GRADES.map((g) => ({ value: g, label: g })),
        onChange: (value) => app.patch('materials', { binderGrade: value }, { rerender: true }),
      }),
      numberField({
        label: 'Average annual pavement temperature',
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
          value: mix.effectiveBinderPercent,
          suffix: '%',
          min: 0,
          onInput: (value) => app.patch('mix', { effectiveBinderPercent: value }),
        })
      )
    ),

    card(
      'Thicknesses',
      layerSlots.map((slot) =>
        numberField({
          label: slot.label,
          aside: slot.minMm ? `min ${slot.minMm}` : null,
          value: thicknesses[slot.slotId],
          suffix: 'mm',
          min: 0,
          step: 5,
          onInput: (value) => {
            app.state.thicknesses = { ...app.state.thicknesses, [slot.slotId]: value ?? 0 };
            app.persist();
          },
        })
      )
    ),

    status
  );
}
