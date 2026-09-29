import { h, card, numberField, segmented, notice, button, msa, keyResult, fold, textArea, metric } from '../dom.js';
import { designTraffic, subgradeWarning } from '../project.js';
import { hasCTB, ctbSevenDay } from '../ctbProject.js';
import {
  flexibleInput,
  flexibleResult,
  reliabilityOf,
  enforceCodeChoices,
  bindersFor,
  longLifeApplies,
  longLifeOf,
  lowCtsbAllowed,
  cbrPercentile,
  flexibleMissing,
  catalogueFor,
} from '../flexibleProject.js';
import { catalogueTrial } from '../../engine/catalogue.js';
import { clauseChip } from '../citations.js';
import { describeCombination, BEHAVIOUR, BITUMINOUS_OPTIONS, findOption } from '../../data/layerCatalog.js';
import { designSection } from '../../engine/flexibleDesign.js';
import { bottomMixModulus } from '../../engine/materials.js';
import { effectiveSubgradeCase } from '../iitpave.js';
import { entryGuide, copyButton } from '../iitpaveTables.js';
import {
  MODULI,
  CRITERIA,
  MINIMUM_THICKNESS,
  BITUMINOUS_RULES,
  FROST,
  LONG_LIFE,
  CBR_PERCENTILE,
} from '../../data/ircConstants.js';

/** The base and sub-base material classes the code gives two values for. */
function baseCard(app, described, msa) {
  const m = app.state.materials;
  const ctsb = described.subBase.id === 'CTSB';
  const granularOnCtsb = ctsb && described.base.behaviour === BEHAVIOUR.GRANULAR;
  const lowAllowed = ctsb && lowCtsbAllowed(app.state, msa);
  if (!lowAllowed && !granularOnCtsb) return null;
  const spec = MODULI.lowStrengthCTSB;
  return card(
    'Base and sub-base',
    lowAllowed
      ? segmented({
          label: 'CTSB, 7-day UCS',
          ref: spec.ref,
          value: m.ctsbStrength,
          options: [
            { value: 'standard', label: `${spec.standardUcsMPa.join(' – ')} MPa · ${MODULI.cemented.ctsbModulusMPa} MPa` },
            { value: 'low', label: `${spec.ucsMPa.join(' – ')} MPa · ${spec.modulusMPa} MPa` },
          ],
          onChange: (value) => app.patch('materials', { ctsbStrength: value }, { rerender: true }),
        })
      : null,
    granularOnCtsb
      ? segmented({
          label: `${described.base.short} aggregate`,
          ref: MODULI.granularOverCTSB.ref,
          value: m.granularOverCtsb,
          options: [
            { value: 'crushed', label: `Crushed rock · ${MODULI.granularOverCTSB.crushedRockMPa} MPa` },
            { value: 'gravel', label: `Natural gravel · ${MODULI.granularOverCTSB.naturalGravelMPa} MPa` },
          ],
          onChange: (value) => app.patch('materials', { granularOverCtsb: value }, { rerender: true }),
        })
      : null
  );
}

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

/**
 * The IRC:37 catalogue section for the composition, a starting trial for the
 * analysis and never its verdict (Cl. 12.1).
 */
function catalogueCard(app, msaValue) {
  const title = 'IRC:37 catalogue';
  const section = catalogueFor(app.state, msaValue);
  if (!section.ok) {
    return card(title, h('p', { class: 'guideline' }, h('span', {}, section.reason), section.ref ? clauseChip(title, section.ref) : null));
  }
  const { combination } = app.state;
  const trial = catalogueTrial(section, combination);
  const courses = findOption(BITUMINOUS_OPTIONS, trial.combination.bituminousId).courses;
  const described = describeCombination(trial.combination);
  const { surface, binder, crackRelief, base, subBase } = section.layers;
  const rows = [
    [courses[0].id, surface],
    binder > 0 ? [courses[1].id, binder] : null,
    crackRelief > 0 ? [described.crackRelief.short, crackRelief] : null,
    [described.base.short, base],
    [described.subBase.short, subBase],
  ].filter(Boolean);
  return card(
    title,
    h(
      'p',
      { class: 'guideline' },
      h('span', {}, `${section.figure} · ${section.trafficMsa} msa · CBR ${section.cbr}%`),
      clauseChip(title, section.ref)
    ),
    h(
      'div',
      { class: 'metric-grid three' },
      rows.map(([label, mm]) => metric(label, `${mm} mm`)),
      metric('Total', `${section.totalMm} mm`)
    ),
    section.warnings.map((w) => notice('warn', null, w)),
    h(
      'div',
      { class: 'spectrum-actions' },
      button(
        'Use as trial',
        () => {
          app.state.combination = trial.combination;
          app.state.thicknesses = { ...app.state.thicknesses, ...trial.thicknesses };
          app.state.result = null;
          app.persist();
          app.render();
        },
        { kind: 'secondary' }
      )
    )
  );
}

export default function renderInputs(app) {
  const traffic = designTraffic(app.state);
  const designTrafficMsa = traffic.result.msa;
  if (enforceCodeChoices(app.state, designTrafficMsa)) app.persist();
  const { combination, materials, mix } = app.state;
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

  const blocked = () => {
    const gap = flexibleMissing(app.state, designTrafficMsa);
    if (!gap) return false;
    status.replaceChildren(notice('danger', null, gap));
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  // The app finds or checks a trial section; IITPAVE's values then decide it.
  const check = () => {
    if (blocked()) return;
    app.state.result = flexibleResult(app.state);
    app.persist();
    app.go('iitpave');
  };

  const design = () => {
    if (blocked()) return;
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

  const bottom = described.bituminous.courses[described.bituminous.courses.length - 1];
  const tableModulus = bottomMixModulus(bottom.id, materials.binderGrade, materials.pavementTemperatureC);
  const binders = bindersFor(app.state, designTrafficMsa);
  const longLifeOpen = longLifeApplies(app.state, designTrafficMsa);
  const longLife = longLifeOf(app.state, designTrafficMsa);
  const percentile = cbrPercentile(app.state, designTrafficMsa);
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
      traffic.stage ? h('span', { class: 'chip' }, `Stage 1 · ${msa(traffic.stage.designMsa)}`) : null,
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
            segmented({
              label: 'Subgrade, 500 mm',
              ref: MODULI.effectiveSubgrade.ref,
              value: layered.subLayers === 2 ? 'two' : 'one',
              options: [
                { value: 'one', label: 'One layer' },
                { value: 'two', label: 'Two sub-layers' },
              ],
              onChange: (value) => {
                layered.subLayers = value === 'two' ? 2 : 1;
                if (value === 'two') {
                  layered.borrowMm = MODULI.effectiveSubgrade.subgradeThicknessMm / 2;
                  layered.lowerMm = MODULI.effectiveSubgrade.subgradeThicknessMm / 2;
                } else {
                  layered.borrowMm = MODULI.effectiveSubgrade.subgradeThicknessMm;
                  layered.lowerCBR = null;
                  layered.lowerMm = null;
                }
                app.persist();
                app.render();
              },
            }),
            layeredField(layered.subLayers === 2 ? 'Upper sub-layer CBR' : 'Select borrow CBR', 'borrowCBR', '%'),
            layeredField(layered.subLayers === 2 ? 'Upper sub-layer thickness' : 'Select borrow thickness', 'borrowMm', 'mm'),
            layered.subLayers === 2
              ? [layeredField('Lower sub-layer CBR', 'lowerCBR', '%'), layeredField('Lower sub-layer thickness', 'lowerMm', 'mm')]
              : null,
            layeredField('Embankment CBR', 'embankmentCBR', '%'),
            guideHost,
            layeredField('Surface deflection, IITPAVE DispZ at z 0, r 0', 'iitpaveDeflectionMm', 'mm'),
            effectiveHost,
          ]
        : numberField({
            label: `Effective CBR, ${percentile}th percentile`,
            ref: CBR_PERCENTILE.ref,
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
      longLifeOpen
        ? segmented({
            label: 'Long-life pavement',
            ref: LONG_LIFE.ref,
            value: longLife ? 'yes' : 'no',
            options: [
              { value: 'yes', label: `Endurance strains, ${materials.snowBound ? LONG_LIFE.bituminousMicro.other : LONG_LIFE.bituminousMicro.plains} / ${LONG_LIFE.subgradeMicro} µε` },
              { value: 'no', label: 'Fatigue and rutting only' },
            ],
            onChange: (value) => app.patch('materials', { longLife: value === 'yes' }, { rerender: true }),
          })
        : null,
      cbrWarning
    ),

    card(
      'Bituminous mix',
      segmented({
        label: 'Climate',
        ref: FROST.ref,
        value: materials.snowBound ? 'snow' : 'plains',
        options: [
          { value: 'plains', label: 'Plains' },
          { value: 'snow', label: 'Snow bound, frost' },
        ],
        onChange: (value) => {
          const t = BITUMINOUS_RULES.designTemperatureC;
          app.patch(
            'materials',
            { snowBound: value === 'snow', pavementTemperatureC: value === 'snow' ? t.snowBound : t.plains },
            { rerender: true }
          );
        },
      }),
      segmented({
        label: `Binder, ${bottom.id === 'BM' ? 'BM' : bottom.id === 'DBM' ? 'DBM' : 'bottom layer'}`,
        ref: BITUMINOUS_RULES.ref,
        value: materials.binderGrade,
        options: binders.map((g) => ({ value: g, label: g })),
        onChange: (value) => app.patch('materials', { binderGrade: value }, { rerender: true }),
      }),
      bottom.id === 'BM'
        ? null
        : numberField({
            label: 'Average annual pavement temperature',
            ref: BITUMINOUS_RULES.temperatureRef,
            aside: `${BITUMINOUS_RULES.designTemperatureC.plains} plains · ${BITUMINOUS_RULES.designTemperatureC.snowBound} snow bound`,
            value: materials.pavementTemperatureC,
            suffix: '°C',
            min: 20,
            max: 40,
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
        ref: BITUMINOUS_RULES.airVoidsRef,
        aside: bottom.id === 'DBM' ? `${BITUMINOUS_RULES.airVoids.single} one DBM · ${BITUMINOUS_RULES.airVoids.bottomOfTwo.toFixed(1)} two` : null,
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

    baseCard(app, described, designTrafficMsa),

    constructionCard(app, described),

    catalogueCard(app, designTrafficMsa),

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
