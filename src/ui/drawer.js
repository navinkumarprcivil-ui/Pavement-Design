/**
 * The side panel: saved work, the design steps, and About.
 *
 * On a wide screen it is docked beside the page; on a phone it slides over it,
 * and while open there the rest of the page is inert so focus stays in it.
 * It is redrawn on every render so its counts and current item are right.
 */

import { h } from './dom.js';
import { listTrials } from '../store/trials.js';
import { listProjects } from '../store/projects.js';
import { MODULES, MODULE_ORDER } from './modules.js';

/** Screens that belong to a design module rather than standing aside from one. */
export const FLOW_SCREENS = new Set([
  'traffic', 'layers', 'ctbAxles', 'inputs', 'results', 'iitpave', 'rural', 'report', 'rates', 'trials',
  'rigidTraffic', 'rigidAxles', 'rigidSlab', 'rigidResult',
]);

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
  `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  home: icon('<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>'),
  designs: icon('<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="16" width="16" height="4" rx="1"/>'),
  projects: icon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  rates: icon('<path d="M7 5h10M7 9h10M7 5c5 0 5 8 0 8l7 6"/>'),
  steps: icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/>'),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
  flexible: icon('<rect x="3" y="5" width="18" height="3" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><path d="M3 18h18"/>'),
  rigid: icon('<rect x="3" y="5" width="18" height="7" rx="1"/><path d="M9 5v7M15 5v7M3 17h18"/>'),
  rural: icon('<path d="M4 20 9 4M20 20 15 4M12 6v2M12 11v2M12 16v2"/>'),
};

const SHELL = ['app-header', 'app-main', 'app-actions'];
const DOCKED = window.matchMedia('(min-width: 1024px)');

let panel = null;
let scrim = null;
let opener = null;

function onKey(event) {
  if (event.key === 'Escape') closeDrawer();
}

export function closeDrawer() {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  for (const id of SHELL) document.getElementById(id)?.removeAttribute('inert');
  document.removeEventListener('keydown', onKey);
  opener?.focus();
  opener = null;
}

// A panel opened on a phone must not leave the page inert once it docks.
DOCKED.addEventListener('change', closeDrawer);

function ensureElements() {
  if (panel) return;
  scrim = h('div', { class: 'drawer-scrim', onclick: closeDrawer });
  panel = h('nav', { class: 'drawer', id: 'app-drawer', 'aria-label': 'Menu' });
  document.body.append(scrim, panel);
}

function content(app) {
  const { screen: current, pavementType } = app.state;
  const inModule = FLOW_SCREENS.has(current);

  const row = ({ label, sub, glyph, count, active, onclick }) =>
    h(
      'button',
      {
        type: 'button',
        class: 'drawer-item',
        'aria-current': active ? 'page' : null,
        onclick: () => {
          closeDrawer();
          if (!active) onclick();
        },
      },
      h('span', { class: 'drawer-icon', html: glyph }),
      h('span', { class: 'drawer-label' }, label, sub ? h('small', {}, sub) : null),
      count != null ? h('span', { class: 'drawer-count' }, String(count)) : null
    );

  const item = (label, screen, glyph, count) =>
    row({ label, glyph, count, active: current === screen, onclick: () => app.open(screen) });

  return [
    h(
      'div',
      { class: 'drawer-head' },
      h('span', { class: 'header-mark', 'aria-hidden': 'true' }),
      h('strong', {}, 'IRC Pavement Design'),
      h('button', { type: 'button', class: 'drawer-close', 'aria-label': 'Close menu', html: ICONS.close, onclick: closeDrawer })
    ),
    h(
      'div',
      { class: 'drawer-body' },
      item('Home', 'home', ICONS.home),
      h('h2', { class: 'drawer-heading' }, 'Codes'),
      MODULE_ORDER.map((type) =>
        row({
          label: MODULES[type].label,
          sub: MODULES[type].code,
          glyph: ICONS[type],
          active: inModule && pavementType === type,
          onclick: () => app.startModule(type),
        })
      ),
      h('h2', { class: 'drawer-heading' }, 'Saved'),
      item('Saved designs', 'trials', ICONS.designs, listTrials().length),
      item('Saved projects', 'projects', ICONS.projects, listProjects().length),
      item('Material rates', 'materialRates', ICONS.rates, Object.keys(app.state.rates || {}).length),
      h('h2', { class: 'drawer-heading' }, 'Design steps'),
      item('Flexible pavement', 'designSteps', ICONS.steps),
      item('Rigid pavement', 'rigidDesignSteps', ICONS.steps)
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'drawer-about',
        'aria-current': current === 'about' ? 'page' : null,
        onclick: () => {
          closeDrawer();
          if (current !== 'about') app.open('about');
        },
      },
      h('img', { class: 'drawer-logo', src: 'assets/iitm-logo.png', alt: '', width: 40, height: 40 }),
      h('span', { class: 'drawer-about-text' }, h('strong', {}, 'About'), h('span', {}, 'Navin Kumar P R'))
    ),
  ];
}

/** Redraw the panel for the current screen. It stays on screen when docked. */
export function renderDrawer(app) {
  ensureElements();
  panel.replaceChildren(...content(app));
}

export function openDrawer(app, trigger) {
  renderDrawer(app);
  opener = trigger || null;
  for (const id of SHELL) document.getElementById(id)?.setAttribute('inert', '');
  document.body.classList.add('drawer-open');
  document.addEventListener('keydown', onKey);
  panel.querySelector('.drawer-item[aria-current="page"], .drawer-item')?.focus();
}
