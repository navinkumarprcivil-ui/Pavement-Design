import { h, msa, notice } from '../dom.js';
import { formatCurrency } from '../../engine/costing.js';
import { listTrials, deleteTrial, setChosenTrial } from '../../store/trials.js';

export default function renderTrials(app) {
  const trials = listTrials();

  if (!trials.length) {
    return h(
      'div',
      { class: 'empty-state' },
      h('p', {}, 'No trials saved yet.'),
      h(
        'p',
        { class: 'muted' },
        'Design a section and save it. Save as many as you like, then compare ' +
          'them here and mark the one to build.'
      ),
      h('button', { class: 'button', onclick: () => app.go('home') }, 'Start a design')
    );
  }

  const cheapest = trials
    .filter((t) => t.safe && t.cost?.total > 0)
    .reduce((best, t) => (!best || t.cost.total < best.cost.total ? t : best), null);

  const card = (trial) =>
    h(
      'div',
      { class: 'trial-card', 'data-chosen': String(Boolean(trial.chosen)) },
      h(
        'div',
        { class: 'trial-head' },
        h('h3', {}, trial.name),
        h(
          'span',
          { class: `badge ${trial.safe ? 'pass' : 'fail'}` },
          trial.safe ? 'Safe' : 'Unsafe'
        )
      ),
      trial.projectName
        ? h('p', { class: 'muted', style: { margin: '2px 0 0' } }, trial.projectName)
        : null,
      h(
        'div',
        { class: 'metric-grid', style: { marginTop: '10px' } },
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Total thickness'),
          h('span', { class: 'metric-value' }, `${trial.totalThicknessMm} mm`)
        ),
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Governing life'),
          h('span', { class: 'metric-value' }, msa(trial.governingLifeMsa))
        ),
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Design traffic'),
          h('span', { class: 'metric-value' }, msa(trial.designTrafficMsa))
        ),
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Cost'),
          h(
            'span',
            { class: 'metric-value' },
            trial.cost?.total ? formatCurrency(trial.cost.total) : '—'
          )
        )
      ),
      h(
        'p',
        { class: 'muted', style: { marginBottom: 0 } },
        trial.slots
          .filter((s) => s.thicknessMm > 0)
          .map((s) => `${s.label} ${s.thicknessMm}`)
          .join(' · ') + ' mm'
      ),
      cheapest && cheapest.id === trial.id && !trial.chosen
        ? h(
            'p',
            { class: 'muted', style: { marginBottom: 0 } },
            'Lowest cost among the safe trials.'
          )
        : null,
      h(
        'div',
        { class: 'button-row', style: { marginTop: '12px' } },
        h(
          'button',
          {
            class: 'button secondary',
            onclick: () => {
              setChosenTrial(trial.chosen ? null : trial.id);
              app.render();
            },
          },
          trial.chosen ? 'Chosen to build' : 'Mark as chosen'
        ),
        h(
          'button',
          {
            class: 'button danger',
            onclick: () => {
              deleteTrial(trial.id);
              app.render();
            },
          },
          'Delete'
        )
      )
    );

  const sorted = [...trials].sort((a, b) => {
    if (a.chosen !== b.chosen) return a.chosen ? -1 : 1;
    if (a.safe !== b.safe) return a.safe ? -1 : 1;
    const ac = a.cost?.total ?? Infinity;
    const bc = b.cost?.total ?? Infinity;
    if (ac !== bc) return ac - bc;
    return a.totalThicknessMm - b.totalThicknessMm;
  });

  return h(
    'div',
    { class: 'card-stack' },
    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'Saved trials'),
      h(
        'p',
        { class: 'screen-intro' },
        'Safe trials first, then cheapest. Mark the one you intend to build.'
      )
    ),

    trials.some((t) => t.cost?.total)
      ? null
      : notice(
          'info',
          'Add rates to compare on cost',
          'Trials without rates can only be compared on thickness. Open a ' +
            'design and add layer rates to cost it.'
        ),

    sorted.map(card),

    h(
      'button',
      { class: 'button secondary', onclick: () => app.go('home') },
      'Design another section'
    )
  );
}
