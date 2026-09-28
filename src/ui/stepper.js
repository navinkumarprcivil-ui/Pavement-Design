/**
 * Progress through the flexible design, shown at the top of each step. Steps
 * already reachable can be tapped to jump straight to them.
 */

import { h } from './dom.js';
import { listTrials } from '../store/trials.js';

const FLEXIBLE_STEPS = [
  { screen: 'traffic', label: 'Traffic' },
  { screen: 'layers', label: 'Layers' },
  { screen: 'inputs', label: 'Inputs' },
  { screen: 'results', label: 'Result' },
  { screen: 'rates', label: 'Cost' },
  { screen: 'trials', label: 'Compare' },
];

function reachable(app, screen) {
  switch (screen) {
    case 'traffic':
    case 'layers':
    case 'inputs':
      return true;
    case 'results':
    case 'rates':
      return Boolean(app.state.result);
    case 'trials':
      return listTrials().length > 0;
    default:
      return false;
  }
}

export function stepper(app) {
  const current = FLEXIBLE_STEPS.findIndex((s) => s.screen === app.state.screen);

  return h(
    'nav',
    { class: 'stepper', 'aria-label': 'Design steps' },
    FLEXIBLE_STEPS.map((step, index) => {
      const state = index < current ? 'done' : index === current ? 'current' : 'todo';
      const enabled = index !== current && reachable(app, step.screen);
      return h(
        'button',
        {
          type: 'button',
          class: `stepper-step ${state}`,
          disabled: !enabled,
          'aria-current': index === current ? 'step' : null,
          onclick: () => app.go(step.screen),
        },
        h('span', { class: 'stepper-bar' }),
        h('span', { class: 'stepper-label' }, step.label)
      );
    })
  );
}
