import { h, card, numberField, segmented, selectField, metric, notice, button } from '../dom.js';
import { stepper } from '../stepper.js';
import { SUB_BASES, SHOULDERS, rigidFoundation, runRigid } from '../rigidProject.js';
import { RIGID } from '../../data/ircConstants.js';

export default function renderRigidSlab(app) {
  const rigid = app.state.rigid;
  const { foundation: f, slab, temperature } = rigid;

  const kHost = h('div', {});
  const status = h('div', {});

  const showK = () => {
    const result = rigidFoundation(rigid);
    kHost.replaceChildren(
      h(
        'div',
        { class: 'metric-grid' },
        result.subgradeK != null ? metric('Subgrade k', `${result.subgradeK.toFixed(1)} MPa/m`) : null,
        metric('Effective k', result.k > 0 ? `${result.k.toFixed(1)} MPa/m` : '—')
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

  showK();

  return h(
    'div',
    { class: 'card-stack' },
    stepper(app),

    card(
      'Foundation',
      segmented({
        label: 'Sub-base',
        value: f.subBase,
        options: SUB_BASES.map((o) => ({ value: o.value, label: o.label })),
        onChange: (value) => {
          f.subBase = value;
          f.subBaseMm = { dlc: 150, cementTreated: 150, granular: 250 }[value];
          app.persist();
          app.render();
        },
      }),
      h(
        'div',
        { class: 'field-row' },
        numberField({
          label: `${SUB_BASES.find((o) => o.value === f.subBase).label} thickness`,
          aside: subBaseRange.aside,
          value: f.subBaseMm,
          suffix: 'mm',
          min: subBaseRange.min,
          max: subBaseRange.max,
          step: 10,
          onInput: set(f, 'subBaseMm', { after: showK }),
        }),
        f.subBase !== 'granular'
          ? numberField({ label: 'GSB below', value: f.gsbMm, suffix: 'mm', min: 0, step: 10, onInput: set(f, 'gsbMm') })
          : null
      ),
      segmented({
        label: 'k from',
        value: f.kSource,
        options: [
          { value: 'tables', label: 'CBR' },
          { value: 'measured', label: 'Plate load test' },
        ],
        onChange: set(f, 'kSource', { rerender: true }),
      }),
      f.kSource === 'measured'
        ? numberField({ label: 'Effective k of the foundation', value: f.measuredK, suffix: 'MPa/m', min: 0, onInput: set(f, 'measuredK', { after: showK }) })
        : numberField({
            label: 'Effective subgrade CBR',
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
        label: 'Flexural strength, 28 day',
        aside: `min ${RIGID.concrete.minimumFlexural28MPa}`,
        value: slab.flexural28MPa,
        suffix: 'MPa',
        min: 0,
        onInput: set(slab, 'flexural28MPa'),
      }),
      segmented({
        label: 'Design strength',
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
        value: slab.doweled ? 'yes' : 'no',
        options: [
          { value: 'yes', label: 'Doweled' },
          { value: 'no', label: 'Not doweled' },
        ],
        onChange: (value) => set(slab, 'doweled', { rerender: true })(value === 'yes'),
      })
    ),

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
            value: temperature.zone,
            options: RIGID.temperature.zones.map((z) => ({ value: z.id, label: z.label })),
            onChange: set(temperature, 'zone'),
          })
        : numberField({ label: 'Maximum day-time differential', value: temperature.dayC, suffix: '°C', min: 0, onInput: set(temperature, 'dayC') })
    ),

    card(
      'Slab',
      numberField({ label: 'Thickness to check', value: slab.thicknessMm, suffix: 'mm', min: 150, step: 10, onInput: set(slab, 'thicknessMm') }),
      segmented({
        label: 'Retexturing allowance on the designed slab',
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
