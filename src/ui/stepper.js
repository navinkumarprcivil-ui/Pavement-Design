/**
 * Progress through the design, as numbered tabs at the top of each step.
 * Steps already reachable can be tapped to jump straight to them.
 */

import { h } from './dom.js';
import { listTrials } from '../store/trials.js';
import { hasCTB } from './ctbProject.js';
import { currentDesign } from './currentDesign.js';

const FLEXIBLE_STEPS = [
  { screen: 'traffic', label: 'Traffic' },
  { screen: 'layers', label: 'Composition' },
  { screen: 'ctbAxles', label: 'Axle loads', when: hasCTB },
  { screen: 'inputs', label: 'Inputs' },
  { screen: 'results', label: 'Result' },
  { screen: 'iitpave', label: 'IITPAVE' },
  { screen: 'report', label: 'Report' },
  { screen: 'rates', label: 'Cost' },
  { screen: 'trials', label: 'Compare' },
];

const RIGID_STEPS = [
  { screen: 'rigidTraffic', label: 'Traffic' },
  { screen: 'rigidAxles', label: 'Axle loads' },
  { screen: 'rigidSlab', label: 'Slab' },
  { screen: 'rigidResult', label: 'Result' },
  { screen: 'report', label: 'Report' },
  { screen: 'rates', label: 'Cost' },
  { screen: 'trials', label: 'Compare' },
];

const RURAL_STEPS = [
  { screen: 'ruralTraffic', label: 'Traffic' },
  { screen: 'rural', label: 'Design' },
  { screen: 'report', label: 'Report' },
  { screen: 'rates', label: 'Cost' },
  { screen: 'trials', label: 'Compare' },
];

const RURAL_RIGID_STEPS = [
  { screen: 'lvRigidTraffic', label: 'Traffic' },
  { screen: 'lvRigidSlab', label: 'Slab' },
  { screen: 'report', label: 'Report' },
  { screen: 'rates', label: 'Cost' },
  { screen: 'trials', label: 'Compare' },
];

export const STEPS = { flexible: FLEXIBLE_STEPS, rigid: RIGID_STEPS, rural: RURAL_STEPS, ruralRigid: RURAL_RIGID_STEPS };

/** The design result the cost step needs, for each kind of design. */
export const RESULT_KEY = { flexible: 'result', rigid: 'rigidResult', rural: 'ruralResult', ruralRigid: 'lvRigidResult' };

function reachable(app, screen) {
  switch (screen) {
    case 'results':
    case 'iitpave':
      return Boolean(app.state.result);
    case 'rigidResult':
      return Boolean(app.state.rigidResult);
    case 'report':
    case 'rates':
      return Boolean(currentDesign(app));
    case 'trials':
      return listTrials().length > 0;
    default:
      return true;
  }
}

export function stepper(app) {
  const steps = (STEPS[app.state.pavementType] || FLEXIBLE_STEPS).filter((s) => !s.when || s.when(app.state));
  const current = steps.findIndex((s) => s.screen === app.state.screen);

  const nav = h(
    'nav',
    { class: 'stepper', 'aria-label': 'Design steps' },
    steps.map((step, index) => {
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
        h('span', { class: 'stepper-num', 'aria-hidden': 'true' }, String(index + 1)),
        h('span', { class: 'stepper-label' }, step.label)
      );
    })
  );

  // Keep the current step in view where the tabs scroll sideways.
  requestAnimationFrame(() => {
    const active = nav.querySelector('[aria-current="step"]');
    if (active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    }
  });

  return nav;
}
