import { h, metric, badge, button, msa } from '../dom.js';
import { stepper } from '../stepper.js';
import { formatCompactCurrency } from '../../engine/costing.js';
import { listTrials, deleteTrial, setChosenTrial } from '../../store/trials.js';
import { migrateRigid } from '../rigidProject.js';

/** Safe before unsafe, then cheapest, then thinnest. */
function rank(a, b) {
  if (a.safe !== b.safe) return a.safe ? -1 : 1;
  const ac = a.cost?.costPerKm > 0 ? a.cost.costPerKm : Infinity;
  const bc = b.cost?.costPerKm > 0 ? b.cost.costPerKm : Infinity;
  if (ac !== bc) return ac - bc;
  return a.totalThicknessMm - b.totalThicknessMm;
}

export default function renderTrials(app) {
  const trials = listTrials();

  const rigidFlow = app.state.pavementType === 'rigid';
  app.setActions(button('New trial', () => app.go(rigidFlow ? 'rigidSlab' : 'layers')));

  if (!trials.length) {
    return h(
      'div',
      { class: 'card-stack' },
      stepper(app),
      h('div', { class: 'empty-state' }, h('p', {}, 'No trials saved yet.'))
    );
  }

  const sorted = [...trials].sort(rank);
  const cheapest = sorted.find((t) => t.safe && t.cost?.costPerKm > 0) || null;

  /** Load a saved trial back into the design, to adjust it. */
  const edit = (trial) => {
    if (trial.pavementType === 'rigid') {
      app.state.pavementType = 'rigid';
      app.state.rigid = migrateRigid(structuredClone(trial.rigid));
      app.state.rigidResult = null;
      app.persist();
      app.go('rigidSlab');
      return;
    }
    app.state.pavementType = 'flexible';
    app.state.combination = { ...trial.combination };
    app.state.thicknesses = { ...trial.thicknesses };
    app.state.materials = { ...app.state.materials, ...trial.materials };
    app.state.mix = { ...app.state.mix, ...trial.mix };
    app.state.result = null;
    app.persist();
    app.go('inputs');
  };

  const row = (trial, index) =>
    h(
      'article',
      {
        class: 'trial-card',
        'data-chosen': String(Boolean(trial.chosen)),
        'data-safe': String(Boolean(trial.safe)),
      },
      h(
        'div',
        { class: 'trial-head' },
        h('span', { class: 'trial-rank' }, String(index + 1)),
        h('h3', {}, trial.name),
        h(
          'div',
          { class: 'trial-badges' },
          trial.chosen ? badge('chosen', 'Chosen') : null,
          cheapest && cheapest.id === trial.id ? badge('pass', 'Lowest cost') : null,
          trial.safe ? null : badge('fail', 'Not safe')
        )
      ),
      h(
        'div',
        { class: 'layer-strip' },
        trial.slots
          .filter((s) => s.thicknessMm > 0)
          .map((s) =>
            h(
              'span',
              { class: `layer-chip ${s.behaviour}` },
              h('span', {}, s.materialId || s.label),
              h('strong', {}, String(s.thicknessMm))
            )
          )
      ),
      h(
        'div',
        { class: 'metric-grid three' },
        metric('Total', `${trial.totalThicknessMm} mm`),
        trial.pavementType === 'rigid'
          ? metric('CFD', Number.isFinite(trial.cfd) ? trial.cfd.toFixed(2) : '—')
          : metric('Life', msa(trial.governingLifeMsa)),
        metric('Per km', trial.cost?.costPerKm > 0 ? formatCompactCurrency(trial.cost.costPerKm) : '—')
      ),
      h(
        'div',
        { class: 'trial-actions' },
        button('Edit', () => edit(trial), { kind: 'ghost' }),
        button(trial.chosen ? 'Chosen' : 'Choose', () => {
          setChosenTrial(trial.chosen ? null : trial.id);
          app.render();
        }, { kind: trial.chosen ? 'chosen' : 'ghost' }),
        button('Delete', () => {
          if (window.confirm(`Delete ${trial.name}?`)) {
            deleteTrial(trial.id);
            app.render();
          }
        }, { kind: 'ghost danger' })
      )
    );

  return h(
    'div',
    { class: 'card-stack' },
    stepper(app),
    sorted.map(row)
  );
}
