import { h, card, numberField, segmented, selectField, keyResult, notice, button } from '../dom.js';
import { stepCard } from '../citations.js';
import { sectionDiagram } from './layers.js';
import { lvRigidDesignFor } from '../lowVolumeProject.js';
import { SP62 } from '../../data/sp62.js';

export default function renderLvRigidSlab(app) {
  const s = app.state.lvRigid.slab;
  const host = h('div', { class: 'card-stack' });

  const show = () => {
    const r = lvRigidDesignFor(app.state);
    app.state.lvRigidResult = r.ok ? r : null;
    if (!r.ok) {
      app.setActions();
      host.replaceChildren(notice('danger', null, r.message));
      return;
    }
    const { design } = r;
    const e = design.adopted;

    app.setActions(
      button('Report', () => app.go('report'), { kind: 'secondary' }),
      button('Cost and save', () => app.go('rates'))
    );

    const governing =
      design.case === 3
        ? keyResult('CFD', e.fatigue.cfd < 0.01 ? e.fatigue.cfd.toExponential(1) : e.fatigue.cfd.toFixed(2), null, SP62.repetitions.ref)
        : keyResult('Stress / f90', `${e.total.toFixed(2)} / ${design.strength.f90.toFixed(2)}`, 'MPa', SP62.cases.ref);

    host.replaceChildren(
      ...[
        h(
          'section',
          { class: `verdict ${design.safe ? 'safe' : 'unsafe'}` },
          h('h2', {}, design.safe ? 'Safe' : 'Not safe'),
          h('p', {}, `${e.thicknessMm} mm slab · case ${design.case}` + (design.trial ? '' : ' · designed'))
        ),
        h(
          'div',
          { class: 'key-results' },
          keyResult('Slab', String(e.thicknessMm), 'mm', SP62.slab.ref),
          keyResult('Designed', design.designedMm ? String(design.designedMm) : '—', 'mm', SP62.slab.ref),
          keyResult('Effective k', design.k.toFixed(1), 'MPa/m', SP62.effectiveK.ref),
          governing
        ),
        design.warnings.length ? h('div', { class: 'warning-list' }, design.warnings.map((w) => notice('warn', null, w))) : null,
        card('Section', sectionDiagram(design.slots)),
        card('Calculation steps', design.steps.map(stepCard))
      ].filter(Boolean)
    );
  };

  const set = (key, { rerender = false, target = s } = {}) => (value) => {
    target[key] = value;
    app.persist();
    if (rerender) app.render();
    else show();
  };

  const screen = h(
    'div',
    { class: 'card-stack' },
    card(
      'Foundation',
      segmented({
        label: 'Sub-base',
        ref: SP62.subBase.ref,
        value: s.subBase,
        options: [
          { value: 'granular', label: 'WBM / WMM over GSB' },
          { value: 'cementitious', label: 'Cementitious' },
          { value: 'measured', label: 'Measured k' },
        ],
        onChange: set('subBase', { rerender: true }),
      }),
      s.subBase === 'measured'
        ? numberField({ label: 'Effective k', ref: SP62.subgradeK.ref, value: s.measuredK, suffix: 'MPa/m', min: 0, onInput: set('measuredK') })
        : numberField({ label: 'Subgrade soaked CBR', ref: SP62.subgradeK.ref, value: s.subgradeCBR, suffix: '%', min: 1, onInput: (v) => v != null && set('subgradeCBR')(v) })
    ),

    card(
      'Concrete',
      segmented({
        label: 'Strength from',
        ref: SP62.concrete.ref,
        value: s.strengthMode,
        options: [
          { value: 'fck', label: 'Cube strength' },
          { value: 'flexural', label: 'Flexural strength' },
        ],
        onChange: set('strengthMode', { rerender: true }),
      }),
      s.strengthMode === 'flexural'
        ? numberField({ label: '28-day flexural strength', ref: SP62.concrete.ref, value: s.flexural28, suffix: 'MPa', min: 0, onInput: set('flexural28') })
        : numberField({ label: 'Characteristic cube strength, fck', ref: SP62.concrete.ref, value: s.fck, suffix: 'MPa', min: 0, onInput: set('fck') })
    ),

    card(
      'Slab',
      segmented({
        label: 'Temperature differential',
        ref: SP62.temperature.ref,
        value: s.temperature.mode,
        options: [
          { value: 'zone', label: 'By zone' },
          { value: 'site', label: 'Site value' },
        ],
        onChange: set('mode', { rerender: true, target: s.temperature }),
      }),
      s.temperature.mode === 'site'
        ? numberField({ label: 'Differential, top to bottom', value: s.temperature.deltaC, suffix: '°C', min: 0, onInput: set('deltaC', { target: s.temperature }) })
        : selectField({
            label: 'Zone',
            ref: SP62.temperature.ref,
            value: s.temperature.zone,
            options: SP62.temperature.zones.map((z) => ({ value: z.id, label: z.label })),
            onChange: set('zone', { target: s.temperature }),
          }),
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Joint spacing', ref: SP62.slab.ref, value: s.jointM, suffix: 'm', min: SP62.slab.jointMinM, max: SP62.slab.jointMaxM, onInput: (v) => v > 0 && set('jointM')(v) }),
        numberField({ label: 'Trial thickness', ref: SP62.slab.ref, value: s.trialMm, suffix: 'mm', min: SP62.slab.minimumMm, onInput: set('trialMm') })
      ),
      segmented({
        label: 'Tractor-trailer wheel',
        ref: SP62.load.ref,
        value: s.tractor ? 'yes' : 'no',
        options: [
          { value: 'yes', label: `Check at ${SP62.load.tractorTyreMPa} MPa` },
          { value: 'no', label: 'Truck dual wheel only' },
        ],
        onChange: (value) => set('tractor', { rerender: true })(value === 'yes'),
      })
    ),

    host
  );

  show();
  return screen;
}
