import { h, card, metric, badge, button, msa } from '../dom.js';
import { formatCompactCurrency, formatCurrency } from '../../engine/costing.js';
import { MODULES } from '../modules.js';
import { listTrials, deleteTrial, setChosenTrial } from '../../store/trials.js';
import { migrateRigid } from '../rigidProject.js';
import { defaultCtbState, defaultConstructionState } from '../ctbProject.js';
import { migrateRural, migrateLvRigid } from '../lowVolumeProject.js';

/** Safe before unsafe, then cheapest, then thinnest. */
function rank(a, b) {
  if (a.safe !== b.safe) return a.safe ? -1 : 1;
  const ac = a.cost?.costPerKm > 0 ? a.cost.costPerKm : Infinity;
  const bc = b.cost?.costPerKm > 0 ? b.cost.costPerKm : Infinity;
  if (ac !== bc) return ac - bc;
  return a.totalThicknessMm - b.totalThicknessMm;
}

/** Trials picked for the side-by-side table, for this session; the last three picked. */
let picked = [];
const MAX_COMPARED = 3;

const layerKey = (s) => s.materialId || s.label;

/** The comparison table: one column a trial, rows that differ marked. */
export function comparisonRows(trials) {
  // Layers in the order they are first met, top down.
  const layers = [];
  for (const t of trials) {
    for (const s of t.slots.filter((x) => x.thicknessMm > 0)) {
      if (!layers.some((l) => l.key === layerKey(s))) layers.push({ key: layerKey(s), label: layerKey(s) });
    }
  }
  const lifeOrCfd = (t) =>
    t.pavementType === 'rigid' || t.pavementType === 'ruralRigid'
      ? Number.isFinite(t.cfd) ? `CFD ${t.cfd.toFixed(2)}` : '—'
      : t.pavementType === 'rural'
        ? '—'
        : msa(t.governingLifeMsa);
  const traffic = (t) =>
    t.pavementType === 'rural' && t.esal != null
      ? `${Math.round(t.esal).toLocaleString('en-IN')} ESAL`
      : t.designTrafficMsa != null
        ? msa(t.designTrafficMsa)
        : '—';
  const rows = [
    ['Code', (t) => (MODULES[t.pavementType] || MODULES.flexible).code],
    ['Project', (t) => t.projectName || '—'],
    ...layers.map((l) => [
      l.label,
      (t) => {
        const s = t.slots.find((x) => x.thicknessMm > 0 && layerKey(x) === l.key);
        return s ? `${s.thicknessMm} mm` : '—';
      },
    ]),
    ['Total', (t) => `${t.totalThicknessMm} mm`],
    ['Design traffic', traffic],
    ['Life or CFD', lifeOrCfd],
    ['Verdict', (t) => (t.safe ? 'Safe' : 'Not safe')],
    ['Per km', (t) => (t.cost?.costPerKm > 0 ? formatCurrency(t.cost.costPerKm) : '—')],
    ['Per m²', (t) => (t.cost?.costPerSqm > 0 ? formatCurrency(t.cost.costPerSqm) : '—')],
  ];
  return rows.map(([label, cell]) => {
    const cells = trials.map(cell);
    return { label, cells, differs: new Set(cells).size > 1 };
  });
}

function comparison(trials) {
  const rows = comparisonRows(trials);
  return card(
    'Side by side',
    h(
      'div',
      { class: 'compare-scroll' },
      h(
        'table',
        { class: 'compare-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), trials.map((t) => h('th', {}, t.name)))),
        h(
          'tbody',
          {},
          rows.map((r) =>
            h(
              'tr',
              { class: r.differs ? 'differs' : null },
              h('th', { scope: 'row' }, r.label),
              r.cells.map((c, i) =>
                h('td', { class: r.label === 'Verdict' ? (trials[i].safe ? 'pass' : 'fail') : null }, c)
              )
            )
          )
        )
      )
    )
  );
}

export default function renderTrials(app) {
  const trials = listTrials();

  const trialStart = { rigid: 'rigidSlab', rural: 'rural', ruralRigid: 'lvRigidSlab' }[app.state.pavementType] || 'layers';
  app.setActions(button('New trial', () => app.go(trialStart)));

  if (!trials.length) {
    return h(
      'div',
      { class: 'card-stack' },
      h('div', { class: 'empty-state' }, h('p', {}, 'No trials saved yet.'))
    );
  }

  const sorted = [...trials].sort(rank);
  picked = picked.filter((id) => trials.some((t) => t.id === id));
  const compared = picked.map((id) => trials.find((t) => t.id === id));
  const togglePick = (trial) => {
    picked = picked.includes(trial.id) ? picked.filter((id) => id !== trial.id) : [...picked, trial.id].slice(-MAX_COMPARED);
    app.render();
  };
  const cheapest = sorted.find((t) => t.safe && t.cost?.costPerKm > 0) || null;

  /** Load a saved trial back into the design, to adjust it. */
  const edit = (trial) => {
    if (trial.pavementType === 'rural') {
      app.state.pavementType = 'rural';
      if (trial.rural) app.state.rural = migrateRural(structuredClone(trial.rural));
      app.persist();
      app.go('rural');
      return;
    }
    if (trial.pavementType === 'ruralRigid') {
      app.state.pavementType = 'ruralRigid';
      if (trial.lvRigid) app.state.lvRigid = migrateLvRigid(structuredClone(trial.lvRigid));
      app.persist();
      app.go('lvRigidSlab');
      return;
    }
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
    if (trial.ctb) app.state.ctb = { ...defaultCtbState(), ...structuredClone(trial.ctb) };
    if (trial.construction) app.state.construction = { ...defaultConstructionState(), ...trial.construction };
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
        trial.pavementType === 'rigid' || trial.pavementType === 'ruralRigid'
          ? metric('CFD', Number.isFinite(trial.cfd) ? trial.cfd.toFixed(2) : '—')
          : trial.pavementType === 'rural'
            ? metric('Traffic', trial.esal != null ? `${Math.round(trial.esal).toLocaleString('en-IN')} ESAL` : msa(trial.designTrafficMsa))
            : metric('Life', msa(trial.governingLifeMsa)),
        metric('Per km', trial.cost?.costPerKm > 0 ? formatCompactCurrency(trial.cost.costPerKm) : '—')
      ),
      h(
        'div',
        { class: 'trial-actions two' },
        button(picked.includes(trial.id) ? 'Comparing' : 'Compare', () => togglePick(trial), { kind: picked.includes(trial.id) ? 'chosen' : 'ghost' }),
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
    compared.length >= 2 ? comparison(compared) : null,
    sorted.map(row)
  );
}
