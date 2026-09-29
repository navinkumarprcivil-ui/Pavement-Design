import { h, card, numberField, segmented, selectField, metric, notice, button, fold } from '../dom.js';
import { SUB_BASES, SHOULDERS, rigidFoundation, runRigid, isBonded, hasDrainage, granularBelowMm, flexuralOf } from '../rigidProject.js';
import { RIGID } from '../../data/ircConstants.js';

export default function renderRigidSlab(app) {
  const rigid = app.state.rigid;
  const { foundation: f, slab, temperature, drainage: d } = rigid;
  const bonded = isBonded(rigid);
  const drains = hasDrainage(rigid);
  const D = RIGID.drainage;

  const kHost = h('div', {});
  const status = h('div', {});
  const flexuralHost = h('div', { class: 'metric-grid' });
  const showFlexural = () => {
    const value = flexuralOf(slab);
    flexuralHost.replaceChildren(metric('Flexural strength, 28 day', value > 0 ? `${value.toFixed(2)} MPa` : '—'));
  };

  const showK = () => {
    const result = rigidFoundation(rigid);
    kHost.replaceChildren(
      h(
        'div',
        { class: 'metric-grid' },
        result.subgradeK != null ? metric('Subgrade k', `${result.subgradeK.toFixed(1)} MPa/m`) : null,
        metric(bonded ? 'k on the GSB' : 'Effective k', result.k > 0 ? `${result.k.toFixed(1)} MPa/m` : '—')
      ),
      result.warnings.map((w) => notice('warn', null, w))
    );
  };

  const run = (mode) => {
    const outcome = runRigid(rigid, mode);
    if (!outcome.ok) {
      status.replaceChildren(notice('danger', null, outcome.message));
      status.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    app.state.rigidResult = outcome;
    if (mode === 'design') slab.thicknessMm = outcome.adoptedMm;
    app.persist();
    app.go('rigidResult');
  };

  app.setActions(
    button('Check entered', () => run('check'), { kind: 'secondary' }),
    button('Design slab', () => run('design'))
  );

  const set = (target, key, { rerender = false, after } = {}) => (value) => {
    target[key] = value;
    app.persist();
    if (rerender) app.render();
    else if (after) after();
  };

  const subBaseRange = {
    dlc: { aside: 'Table 4: 100 – 150', min: 100, max: 150 },
    cementTreated: { aside: 'Table 3: 100 – 200', min: 100, max: 200 },
    granular: { aside: 'Table 3: 150 – 300', min: 150, max: 300 },
  }[f.subBase];

  const rainHost = h('div', {});
  const showRain = () =>
    rainHost.replaceChildren(
      !drains && d.rainfallMm > D.rainfallMm ? notice('warn', null, `Annual rainfall over ${D.rainfallMm} mm: design a drainage layer · Cl. 6.5.2`) : ''
    );

  const materialFold = () =>
    fold({
      title: 'Drainage material',
      memory: app.folds,
      key: 'rigid-drainage-material',
      children: [
        numberField({
          label: 'Permeability, tested',
          ref: D.ref,
          aside: `min ${D.minimumPermeability}`,
          value: d.permeability,
          suffix: 'm/day',
          min: 0,
          onInput: set(d, 'permeability'),
        }),
        h(
          'div',
          { class: 'field-row' },
          numberField({ label: 'D10', ref: D.grading, aside: `over ${D.minimumD10Mm}`, value: d.d10Mm, suffix: 'mm', min: 0, onInput: set(d, 'd10Mm') }),
          numberField({ label: 'D60', value: d.d60Mm, suffix: 'mm', min: 0, onInput: set(d, 'd60Mm') })
        ),
        numberField({
          label: 'Los Angeles abrasion',
          ref: D.abrasion,
          aside: `under ${D.maximumAbrasionPercent}`,
          value: d.abrasionPercent,
          suffix: '%',
          min: 0,
          max: 100,
          onInput: set(d, 'abrasionPercent'),
        }),
        segmented({
          label: 'Stabilised with',
          ref: D.stabilisation,
          value: d.stabiliser,
          options: [{ value: 'none', label: 'None' }, ...Object.entries(D.stabilisers).map(([value, o]) => ({ value, label: o.label }))],
          onChange: set(d, 'stabiliser', { rerender: true }),
        }),
        d.stabiliser !== 'none'
          ? numberField({
              label: `${D.stabilisers[d.stabiliser].label} content`,
              aside: D.stabilisers[d.stabiliser].percent.join(' – '),
              value: d.stabiliserPercent,
              suffix: '%',
              min: 0,
              onInput: set(d, 'stabiliserPercent'),
            })
          : null,
      ],
    });

  function drainageCard() {
    return card(
      'Drainage layer',
      numberField({
        label: 'Annual rainfall',
        value: d.rainfallMm,
        suffix: 'mm',
        min: 0,
        onInput: set(d, 'rainfallMm', { after: showRain }),
      }),
      segmented({
        label: f.subBase === 'granular' ? 'GSB as the drainage layer' : 'Drainage layer below the sub-base',
        ref: D.ref,
        value: drains ? 'yes' : 'no',
        options: [
          { value: 'yes', label: 'Design' },
          { value: 'no', label: 'None' },
        ],
        onChange: (value) => {
          // A bonded slab keeps its 200 – 250 mm of granular layers, now drainage and separation.
          if (bonded) f.gsbMm = Math.max(0, f.gsbMm + (d.layerMm || 0) * (value === 'yes' ? -1 : 1));
          set(d, 'provided', { rerender: true })(value === 'yes');
        },
      }),
      rainHost,
      drains
        ? [
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'Carriageway draining one way', value: d.pavementM, suffix: 'm', min: 0, onInput: set(d, 'pavementM') }),
              numberField({ label: 'Longitudinal joints and edges, Nc', ref: D.ref, value: d.longitudinalJoints, min: 0, step: 1, onInput: set(d, 'longitudinalJoints') })
            ),
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'Concrete shoulder', value: d.concreteShoulderM, suffix: 'm', min: 0, onInput: set(d, 'concreteShoulderM') }),
              numberField({ label: 'Earthen shoulder', value: d.unpavedShoulderM, suffix: 'm', min: 0, onInput: set(d, 'unpavedShoulderM') })
            ),
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'Longitudinal gradient', value: d.gradePercent, suffix: '%', min: 0, onInput: set(d, 'gradePercent') }),
              numberField({ label: 'Camber', value: d.crossFallPercent, suffix: '%', min: 0, onInput: set(d, 'crossFallPercent') })
            ),
            numberField({ label: 'Embankment side slope', ref: D.example, value: d.sideSlope, suffix: 'H : 1V', min: 0, onInput: set(d, 'sideSlope') }),
            materialFold(),
          ]
        : null
    );
  }

  showK();
  showRain();
  showFlexural();

  return h(
    'div',
    { class: 'card-stack' },

    card(
      'Foundation',
      segmented({
        label: 'Sub-base',
        ref: f.subBase === 'dlc' ? RIGID.dlcK.ref : RIGID.subBaseK.ref,
        value: f.subBase,
        options: SUB_BASES.map((o) => ({ value: o.value, label: o.label })),
        onChange: (value) => {
          f.subBase = value;
          f.subBaseMm = { dlc: 150, cementTreated: 150, granular: 250 }[value];
          app.persist();
          app.render();
        },
      }),
      f.subBase === 'dlc'
        ? segmented({
            label: 'PQC on the DLC',
            ref: bonded ? RIGID.bonded.ref : RIGID.dlcK.ref,
            value: bonded ? 'bonded' : 'debonded',
            options: [
              { value: 'debonded', label: 'Debonding layer' },
              { value: 'bonded', label: 'Bonded' },
            ],
            onChange: (value) => {
              f.bonded = value === 'bonded';
              if (f.bonded && !(granularBelowMm(rigid) >= RIGID.bonded.granularMm.min)) {
                f.gsbMm = Math.max(0, RIGID.bonded.granularMm.max - (drains ? d.layerMm || 0 : 0));
              }
              app.persist();
              app.render();
            },
          })
        : null,
      h(
        'div',
        { class: 'field-row' },
        numberField({
          label: `${SUB_BASES.find((o) => o.value === f.subBase).label} thickness`,
          aside: bonded ? `Cl. 6.7.2: ${RIGID.bonded.dlcMm}` : subBaseRange.aside,
          value: f.subBaseMm,
          suffix: 'mm',
          min: subBaseRange.min,
          max: subBaseRange.max,
          step: 10,
          onInput: set(f, 'subBaseMm', { after: showK }),
        }),
        f.subBase !== 'granular' && drains
          ? numberField({
              label: 'Drainage layer thickness',
              ref: D.thickness,
              aside: `min ${D.minimumThicknessMm}`,
              value: d.layerMm,
              suffix: 'mm',
              min: 0,
              step: 10,
              onInput: set(d, 'layerMm', { after: showK }),
            })
          : null,
        f.subBase !== 'granular'
          ? numberField({
              label: drains ? 'GSB separation layer' : 'GSB below',
              ref: bonded ? RIGID.bonded.ref : null,
              aside: bonded ? `${drains ? 'with drainage ' : ''}${RIGID.bonded.granularMm.min} – ${RIGID.bonded.granularMm.max}` : null,
              value: f.gsbMm,
              suffix: 'mm',
              min: 0,
              step: 10,
              onInput: set(f, 'gsbMm', { after: showK }),
            })
          : null
      ),
      bonded
        ? h(
            'div',
            { class: 'field-row' },
            numberField({
              label: 'DLC 7-day compressive strength',
              ref: RIGID.bonded.ref,
              aside: `min ${RIGID.bonded.minimumDlcSevenDayMPa}`,
              value: f.dlc7DayMPa,
              suffix: 'MPa',
              min: 0,
              onInput: set(f, 'dlc7DayMPa', { after: showK }),
            }),
            numberField({
              label: 'DLC 28-day compressive strength',
              ref: RIGID.bonded.ref,
              value: f.dlc28DayMPa,
              suffix: 'MPa',
              min: 0,
              onInput: set(f, 'dlc28DayMPa'),
            })
          )
        : null,
      segmented({
        label: 'k from',
        value: f.kSource,
        options: [
          { value: 'tables', label: 'CBR' },
          { value: 'measured', label: 'Plate load test' },
          { value: 'fwd', label: 'FWD' },
        ],
        onChange: set(f, 'kSource', { rerender: true }),
      }),
      f.kSource === 'measured'
        ? [
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'k measured', ref: RIGID.measuredK.ref, value: f.measuredK, suffix: 'MPa/m', min: 0, onInput: set(f, 'measuredK', { after: showK }) }),
              numberField({ label: 'Plate diameter', ref: RIGID.measuredK.ref, aside: `standard ${RIGID.measuredK.standardPlateMm}`, value: f.plateMm, suffix: 'mm', min: 0, onInput: set(f, 'plateMm', { after: showK }) })
            ),
            h(
              'div',
              { class: 'field-row' },
              numberField({ label: 'CBR soaked', ref: RIGID.measuredK.ref, value: f.soakedCBR, suffix: '%', min: 0, onInput: set(f, 'soakedCBR', { after: showK }) }),
              numberField({ label: 'CBR unsoaked', ref: RIGID.measuredK.ref, value: f.unsoakedCBR, suffix: '%', min: 0, onInput: set(f, 'unsoakedCBR', { after: showK }) })
            ),
          ]
        : f.kSource === 'fwd'
          ? numberField({ label: 'Dynamic k from the FWD', ref: RIGID.measuredK.fwdRef, value: f.fwdDynamicK, suffix: 'MPa/m', min: 0, onInput: set(f, 'fwdDynamicK', { after: showK }) })
          : numberField({
            label: 'Effective subgrade CBR',
            ref: RIGID.subgradeK.ref,
            aside: `min ${RIGID.subgradeK.minimumCBR}`,
            value: f.subgradeCBR,
            suffix: '%',
            min: 1,
            max: 100,
            onInput: set(f, 'subgradeCBR', { after: showK }),
          }),
      kHost
    ),

    card(
      'Concrete',
      numberField({
        label: 'Characteristic compressive strength, fck',
        ref: RIGID.concrete.fckRef,
        aside: 'M40: 40',
        value: slab.fck,
        suffix: 'MPa',
        min: 0,
        onInput: set(slab, 'fck', { after: showFlexural }),
      }),
      segmented({
        label: 'Flexural strength from',
        ref: RIGID.concrete.fckRef,
        value: slab.flexuralFrom === 'fck' ? 'fck' : 'beam',
        options: [
          { value: 'beam', label: 'Beam test' },
          { value: 'fck', label: '0.7 √fck' },
        ],
        onChange: set(slab, 'flexuralFrom', { rerender: true }),
      }),
      slab.flexuralFrom === 'fck'
        ? flexuralHost
        : numberField({
            label: 'Flexural strength, 28 day',
            ref: RIGID.concrete.ref,
            aside: `min ${RIGID.concrete.minimumFlexural28MPa}`,
            value: slab.flexural28MPa,
            suffix: 'MPa',
            min: 0,
            onInput: set(slab, 'flexural28MPa'),
          }),
      segmented({
        label: 'Design strength',
        ref: RIGID.concrete.ref,
        value: slab.ninetyDay ? '90' : '28',
        options: [
          { value: '90', label: '90 day (× 1.1)' },
          { value: '28', label: '28 day' },
        ],
        onChange: (value) => set(slab, 'ninetyDay', { rerender: true })(value === '90'),
      }),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Elastic modulus', value: slab.E, suffix: 'MPa', min: 0, onInput: set(slab, 'E') }),
        numberField({ label: "Poisson's ratio", value: slab.mu, min: 0, max: 0.5, onInput: set(slab, 'mu') })
      )
    ),

    card(
      'Joints and shoulders',
      segmented({ label: 'Shoulder', value: slab.shoulder, options: SHOULDERS, onChange: set(slab, 'shoulder', { rerender: true }) }),
      segmented({
        label: 'Dowel bars at transverse joints',
        ref: RIGID.dowels.ref,
        value: slab.doweled ? 'yes' : 'no',
        options: [
          { value: 'yes', label: 'Doweled' },
          { value: 'no', label: 'Not doweled' },
        ],
        onChange: (value) => set(slab, 'doweled', { rerender: true })(value === 'yes'),
      }),
      segmented({
        label: 'Tie bars at longitudinal joints',
        ref: RIGID.tieBars.ref,
        value: slab.tieBarType,
        options: Object.entries(RIGID.tieBars.steel).map(([value, o]) => ({ value, label: o.label })),
        onChange: set(slab, 'tieBarType', { rerender: true }),
      }),
      h(
        'div',
        { class: 'field-row' },
        selectField({
          label: 'Tie bar diameter',
          ref: RIGID.tieBars.ref,
          value: String(slab.tieBarDiameterMm),
          options: RIGID.tieBars.diametersMm.map((d) => ({ value: String(d), label: `${d} mm` })),
          onChange: (value) => set(slab, 'tieBarDiameterMm')(Number(value)),
        }),
        numberField({
          label: 'Lane width, b',
          ref: RIGID.tieBars.ref,
          aside: `max ${RIGID.joints.maximumSlabWidthM}`,
          value: slab.laneWidthM,
          suffix: 'm',
          min: 0,
          onInput: set(slab, 'laneWidthM'),
        })
      ),
      numberField({
        label: 'Transverse joint spacing',
        ref: RIGID.joints.ref,
        aside: `max ${RIGID.joints.maximumSpacingM}`,
        value: slab.jointSpacingM,
        suffix: 'm',
        min: 0,
        step: 0.1,
        onInput: set(slab, 'jointSpacingM'),
      })
    ),

    drainageCard(),

    card(
      'Temperature differential',
      segmented({
        label: 'From',
        value: temperature.mode,
        options: [
          { value: 'zone', label: 'Zone, Table 1' },
          { value: 'site', label: 'Site value' },
        ],
        onChange: set(temperature, 'mode', { rerender: true }),
      }),
      temperature.mode === 'zone'
        ? selectField({
            label: 'Zone',
            ref: RIGID.temperature.ref,
            value: temperature.zone,
            options: RIGID.temperature.zones.map((z) => ({ value: z.id, label: z.label })),
            onChange: set(temperature, 'zone'),
          })
        : numberField({ label: 'Maximum day-time differential', value: temperature.dayC, suffix: '°C', min: 0, onInput: set(temperature, 'dayC') })
    ),

    card(
      'Slab',
      numberField({
        label: bonded ? 'PQC thickness to check' : 'Thickness to check',
        value: slab.thicknessMm,
        suffix: 'mm',
        min: bonded ? 0 : 150,
        step: bonded ? 5 : 10,
        onInput: set(slab, 'thicknessMm'),
      }),
      segmented({
        label: 'Retexturing allowance on the designed slab',
        ref: RIGID.criterion.ref,
        value: slab.retexture ? 'yes' : 'no',
        options: [
          { value: 'yes', label: `Add ${RIGID.criterion.retexturingMm} mm` },
          { value: 'no', label: 'None' },
        ],
        onChange: (value) => set(slab, 'retexture', { rerender: true })(value === 'yes'),
      })
    ),

    status
  );
}
