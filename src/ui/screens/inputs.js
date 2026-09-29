import { h, card, numberField, segmented, notice, button, msa, keyResult, fold, textArea } from '../dom.js';
import { designTraffic, subgradeWarning } from '../project.js';
import { hasCTB, ctbSevenDay } from '../ctbProject.js';
import { flexibleInput, flexibleResult, reliabilityOf } from '../flexibleProject.js';
import { describeCombination, BINDER_GRADES, BEHAVIOUR } from '../../data/layerCatalog.js';
import { designSection } from '../../engine/flexibleDesign.js';
import { bituminousModulus } from '../../engine/materials.js';
import { effectiveSubgradeCase } from '../iitpave.js';
import { entryGuide, copyButton } from '../iitpaveTables.js';
import { MODULI, CRITERIA, MINIMUM_THICKNESS } from '../../data/ircConstants.js';

/** Dumpers on the granular sub-base and on the CTB, for the construction checks. */
function constructionCard(app, described) {
  const c = app.state.construction;
  const granularSubBase = described.subBase.behaviour === BEHAVIOUR.GRANULAR;
  const ctb = hasCTB(app.state);
  if (!granularSubBase && !ctb) return null;

  const field = (label, key, suffix, ref, extra = {}) =>
    numberField({
      label,
      ref,
      value: c[key],
      suffix,
      min: 0,
      onInput: (value) => app.patch('construction', { [key]: value }),
      ...extra,
    });

  const trafficRef = CRITERIA.constructionTraffic.ref;
  const ctbRef = CRITERIA.ctbConstruction.ref;
  return card(
    'Construction traffic',
    field('Dumper rear tandem axle', 'rearTandemKN', 'kN', CRITERIA.constructionTraffic.vdf.ref),
    field('Dumper front axle', 'frontKN', 'kN', CRITERIA.constructionTraffic.vdf.ref),
    granularSubBase ? field('Dumper trips on the sub-base', 'subBaseTrips', null, trafficRef) : null,
    ctb ? field('Dumper trips on the CTB', 'ctbTrips', null, ctbRef) : null,
    ctb
      ? field('CTB 7-day flexural strength', 'ctbSevenDayMPa', 'MPa', ctbRef, {
          placeholder: ctbSevenDay(app.state).derived.toFixed(2),
        })
      : null
  );
}

export default function renderInputs(app) {
  const { combination, materials, mix } = app.state;
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

  const status = h('div', {});
  const cbrWarning = h('div', {});
  const showCbrWarning = () => {
    const text = subgradeWarning(app.state, traffic.twoWayAtCompletion);
    cbrWarning.replaceChildren(text ? notice('warn', null, text) : '');
  };

  // The app finds or checks a trial section; IITPAVE's values then decide it.
  const check = () => {
    app.state.result = flexibleResult(app.state);
    app.persist();
    app.go('iitpave');
  };

  const design = () => {
    status.replaceChildren(h('div', { class: 'progress indeterminate' }, h('span')));
    // Yield so the progress bar paints before the search runs.
    setTimeout(() => {
      const outcome = designSection(flexibleInput(app.state));
      if (!outcome.found) {
        status.replaceChildren(notice('danger', 'No safe section', outcome.message));
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      app.state.thicknesses = outcome.thicknesses;
      app.state.result = flexibleResult(app.state);
      app.persist();
      app.go('iitpave');
    }, 30);
  };

  app.setActions(
    button('Check entered', check, { kind: 'secondary' }),
    button('Design thicknesses', design)
  );

  showCbrWarning();

  const reliability = reliabilityOf(app.state, traffic);
  const layered = materials.layeredSubgrade;

  // Select borrow over the embankment: the effective CBR follows from the two.
  const guideHost = h('div', {});
  const effectiveHost = h('div', { class: 'key-results' });
  const showEffective = () => {
    if (!(layered.borrowCBR > 0 && layered.embankmentCBR > 0)) {
      guideHost.replaceChildren();
      effectiveHost.replaceChildren();
      return;
    }
    const c = effectiveSubgradeCase(layered);
    const e = c.effective;
    app.state.materials.subgradeCBR = Math.round(e.cbr * 100) / 100;
    app.persist();
    const ref = MODULI.effectiveSubgrade.ref;
    guideHost.replaceChildren(h('div', { class: 'iitpave-entry' }, h('h4', {}, 'IITPAVE input'), entryGuide(c), copyButton(c)));
    effectiveHost.replaceChildren(
      keyResult('Deflection, IITPAVE', e.fromIitpave ? e.deflection.toFixed(3) : '—', 'mm', ref),
      keyResult('Deflection, app', e.computed.toFixed(3), 'mm', ref),
      keyResult(e.fromIitpave ? 'Effective MR' : 'Effective MR, provisional', e.value.toFixed(1), 'MPa', ref),
      keyResult(e.fromIitpave ? 'Effective CBR' : 'Effective CBR, provisional', e.cbr.toFixed(1), '%', MODULI.subgrade.ref)
    );
    showCbrWarning();
  };
  const layeredField = (label, key, suffix) =>
    numberField({
      label,
      ref: MODULI.effectiveSubgrade.ref,
      value: layered[key],
      suffix,
      min: 0,
      onInput: (value) => {
        layered[key] = value;
        app.persist();
        showEffective();
      },
    });
  if (layered.enabled) showEffective();

  const tableModulus = bituminousModulus(materials.binderGrade, materials.pavementTemperatureC);
  const narratives = app.state.narratives;
  const narrative = (label, key) =>
    textArea({
      label,
      value: narratives[key],
      onInput: (value) => {
        narratives[key] = value;
        app.persist();
      },
    });

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      { class: 'summary-chips' },
      h('span', { class: 'chip' }, msa(designTrafficMsa)),
      h('span', { class: 'chip' }, `${reliability.value}% reliability`),
      traffic.category ? h('span', { class: 'chip' }, traffic.category.label) : null
    ),

    card(
      'Subgrade and reliability',
      segmented({
        label: 'Subgrade',
        ref: MODULI.effectiveSubgrade.ref,
        value: layered.enabled ? 'layered' : 'single',
        options: [
          { value: 'single', label: 'Single layer' },
          { value: 'layered', label: 'Select borrow over embankment' },
        ],
        onChange: (value) => {
          layered.enabled = value === 'layered';
          app.persist();
          app.render();
        },
      }),
      layered.enabled
        ? [
            layeredField('Select borrow CBR', 'borrowCBR', '%'),
            layeredField('Select borrow thickness', 'borrowMm', 'mm'),
            layeredField('Embankment CBR', 'embankmentCBR', '%'),
            guideHost,
            layeredField('Surface deflection, IITPAVE DispZ at z 0, r 0', 'iitpaveDeflectionMm', 'mm'),
            effectiveHost,
          ]
        : numberField({
            label: 'Effective CBR',
            ref: MODULI.subgrade.ref,
            value: materials.subgradeCBR,
            suffix: '%',
            min: 1,
            max: 100,
            onInput: (value) => {
              app.patch('materials', { subgradeCBR: value });
              showCbrWarning();
            },
          }),
      segmented({
        label: 'Reliability',
        ref: CRITERIA.reliability.ref,
        value: reliability.value,
        options: [
          { value: 80, label: '80%' },
          { value: 90, label: '90%' },
        ],
        onChange: (value) => {
          app.state.reliabilityChoice = value === reliability.code ? null : value;
          app.persist();
          app.render();
        },
      }),
      reliability.value < reliability.code
        ? notice('warn', null, `90% reliability applies to this road and traffic · ${CRITERIA.reliability.ref.clause}`)
        : null,
      cbrWarning
    ),

    card(
      'Bituminous mix',
      segmented({
        label: 'Binder, bottom layer',
        ref: MODULI.bituminous.ref,
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
      numberField({
        label: 'Bituminous modulus, MRm',
        ref: MODULI.bituminous.ref,
        value: materials.bituminousModulusMPa,
        placeholder: tableModulus.toFixed(0),
        suffix: 'MPa',
        min: 0,
        onInput: (value) => app.patch('materials', { bituminousModulusMPa: value }),
      }),
      numberField({
        label: 'Air voids, Va',
        ref: CRITERIA.bituminousFatigue.ref,
        value: mix.airVoidsPercent,
        suffix: '%',
        min: 0,
        onInput: (value) => app.patch('mix', { airVoidsPercent: value }),
      }),
      numberField({
        label: 'Effective binder, Vbe',
        ref: CRITERIA.bituminousFatigue.ref,
        value: mix.effectiveBinderPercent,
        suffix: '%',
        min: 0,
        onInput: (value) => app.patch('mix', { effectiveBinderPercent: value }),
      })
    ),

    constructionCard(app, described),

    card(
      'Thicknesses',
      layerSlots.map((slot) =>
        numberField({
          label: slot.label,
          aside: slot.minMm ? `min ${slot.minMm}` : null,
          ref: MINIMUM_THICKNESS.ref,
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

    h(
      'section',
      { class: 'card' },
      fold({
        title: 'Narrative summaries for the report',
        memory: app.folds,
        key: 'narratives',
        children: h(
          'div',
          { class: 'narratives' },
          narrative('Traffic survey', 'traffic'),
          narrative('Subgrade and borrow soil', 'subgrade'),
          narrative('Bituminous mix design', 'mix'),
          narrative('Other materials', 'materials')
        ),
      })
    ),

    status
  );
}
