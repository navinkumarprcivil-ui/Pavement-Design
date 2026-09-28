/**
 * App shell: state, navigation and rendering.
 *
 * Screens are plain functions that take the app object and return an element.
 * A screen that has actions puts them in the bar pinned to the bottom of the
 * window with `app.setActions`, so the next step is always in reach of a thumb.
 * There is no framework and no build step — this file is the whole runtime.
 */

import { h, clear } from './ui/dom.js';
import { closeSheet } from './ui/citations.js';
import { loadProject, saveProject } from './store/trials.js';
import { connectCloud, onCloudChange } from './store/cloud.js';
import { subscribe as onStoreChange } from './store/sync.js';
import { BINDER_GRADES } from './data/layerCatalog.js';

import renderHome from './ui/screens/home.js';
import renderTraffic from './ui/screens/traffic.js';
import renderLayers from './ui/screens/layers.js';
import renderInputs from './ui/screens/inputs.js';
import renderResults from './ui/screens/results.js';
import renderRates from './ui/screens/rates.js';
import renderTrials from './ui/screens/trials.js';
import renderRural from './ui/screens/rural.js';
import renderRigidTraffic from './ui/screens/rigidTraffic.js';
import renderRigidAxles from './ui/screens/rigidAxles.js';
import renderRigidSlab from './ui/screens/rigidSlab.js';
import renderRigidResult from './ui/screens/rigidResult.js';
import { defaultRigidState, migrateRigid } from './ui/rigidProject.js';
import { designStepsScreen } from './ui/screens/designSteps.js';

const SCREENS = {
  home: { render: renderHome, title: 'IRC Pavement Design', back: null },
  traffic: { render: renderTraffic, title: 'Design traffic', back: 'home' },
  layers: { render: renderLayers, title: 'Layers', back: 'traffic' },
  inputs: { render: renderInputs, title: 'Design inputs', back: 'layers' },
  results: { render: renderResults, title: 'Design result', back: 'inputs' },
  rates: { render: renderRates, title: 'Cost', back: () => (app.state.pavementType === 'rigid' ? 'rigidResult' : 'results') },
  trials: { render: renderTrials, title: 'Compare trials', back: 'home' },
  rural: { render: renderRural, title: 'Low volume rural road', back: 'traffic' },
  rigidTraffic: { render: renderRigidTraffic, title: 'Design traffic', back: 'home' },
  rigidAxles: { render: renderRigidAxles, title: 'Axle loads', back: 'rigidTraffic' },
  rigidSlab: { render: renderRigidSlab, title: 'Slab design', back: 'rigidAxles' },
  rigidResult: { render: renderRigidResult, title: 'Design result', back: 'rigidSlab' },
  // Reached from the header, so it returns to wherever it was opened from.
  designSteps: { render: designStepsScreen('flexible'), title: 'Flexible design steps', back: () => app.designStepsReturn },
  rigidDesignSteps: { render: designStepsScreen('rigid'), title: 'Rigid design steps', back: () => app.designStepsReturn },
};

/** Where each design's steps are offered, in the header. */
const FLEXIBLE_SCREENS = new Set(['traffic', 'layers', 'inputs', 'results']);
const RIGID_SCREENS = new Set(['rigidTraffic', 'rigidAxles', 'rigidSlab', 'rigidResult']);
const SHARED_SCREENS = new Set(['rates', 'trials']);

function designStepsFor(state) {
  const { screen, pavementType } = state;
  if (FLEXIBLE_SCREENS.has(screen)) return 'designSteps';
  if (RIGID_SCREENS.has(screen)) return 'rigidDesignSteps';
  if (SHARED_SCREENS.has(screen)) return pavementType === 'rigid' ? 'rigidDesignSteps' : 'designSteps';
  return null;
}

export const defaultState = () => ({
  screen: 'home',
  project: {
    name: '',
    roadCategory: 'nh',
    terrain: 'plain',
  },
  traffic: {
    presentCVPD: 1500,
    growthRatePercent: 5,
    yearsToCompletion: 2,
    designLifeYears: 20,
    laneDistributionId: 'dual-two-lane',
    directionalSplitPercent: 50,
    vdfMode: 'indicative',
    vehicleDamageFactor: null,
  },
  /** Below 2 msa the designer may take the regular route instead. */
  routeChoice: 'rural',
  combination: {
    bituminousId: 'BC_DBM',
    baseId: 'WMM',
    subBaseId: 'GSB',
    crackReliefId: 'AGG_INTERLAYER',
  },
  thicknesses: {},
  materials: {
    subgradeCBR: 8,
    binderGrade: 'VG40',
    pavementTemperatureC: 35,
  },
  mix: {
    airVoidsPercent: 3.5,
    effectiveBinderPercent: 11.5,
  },
  result: null,
  rates: {},
  geometry: {
    carriagewayWidthM: 7,
    lengthKm: 1,
  },
  pavementType: 'flexible',
  rigid: defaultRigidState(),
  rigidResult: null,
});

/**
 * Bring a saved project up to the current shape: fill in fields added since it
 * was saved, and drop values the app no longer offers.
 */
function migrate(saved) {
  const defaults = defaultState();
  const state = { ...defaults, ...saved, screen: 'home' };
  for (const [key, value] of Object.entries(defaults)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !['thicknesses', 'rates', 'rigid'].includes(key)) {
      state[key] = { ...value, ...(saved[key] || {}) };
    }
  }
  state.rigid = migrateRigid(saved.rigid);
  if (state.traffic.vdfMode === 'manual') state.traffic.vdfMode = 'survey';
  if (!BINDER_GRADES.includes(state.materials.binderGrade)) {
    state.materials.binderGrade = defaults.materials.binderGrade;
  }
  return state;
}

const app = {
  state: defaultState(),
  root: null,
  header: null,
  actions: null,
  /** Screen the design steps were opened from. Deliberately not persisted. */
  designStepsReturn: 'traffic',
  /** Open/closed state of collapsible sections, for this session only. */
  folds: {},
  entering: false,

  go(screen) {
    closeSheet();
    this.state.screen = screen;
    this.entering = true;
    this.render();
    window.scrollTo({ top: 0 });
  },

  /** Merge a patch into state and re-render. */
  update(patch, { rerender = true } = {}) {
    Object.assign(this.state, patch);
    this.persist();
    if (rerender) this.render();
  },

  /**
   * Merge into a sub-object of state without re-rendering (for live inputs).
   *
   * Mutates in place rather than replacing the object: screens capture these
   * sub-objects when they render and read them again from event handlers, so
   * replacing one would leave those handlers reading a stale copy.
   */
  patch(key, patch, { rerender = false } = {}) {
    Object.assign(this.state[key], patch);
    this.persist();
    if (rerender) this.render();
  },

  persist() {
    const { screen, result, rigidResult, ...rest } = this.state;
    saveProject(rest);
  },

  /** Fill the bottom action bar for the current screen. */
  setActions(...buttons) {
    clear(this.actions);
    const items = buttons.flat().filter(Boolean);
    if (items.length) {
      this.actions.appendChild(h('div', { class: 'action-bar-inner' }, items));
    }
    document.body.classList.toggle('has-actions', items.length > 0);
  },

  render() {
    const screen = SCREENS[this.state.screen] || SCREENS.home;
    const back = typeof screen.back === 'function' ? screen.back() : screen.back;

    clear(this.header);
    this.header.appendChild(
      back
        ? h('button', { class: 'back-button', 'aria-label': 'Back', onclick: () => this.go(back) }, '‹')
        : h('span', { class: 'header-mark', 'aria-hidden': 'true' })
    );
    this.header.appendChild(h('h1', {}, screen.title));
    // Top right: the design procedure, readable from anywhere in its design.
    const stepsScreen = designStepsFor(this.state);
    if (stepsScreen) {
      this.header.appendChild(
        h(
          'button',
          {
            class: 'header-button',
            onclick: () => {
              this.designStepsReturn = this.state.screen;
              this.go(stepsScreen);
            },
          },
          'Design Steps'
        )
      );
    }

    this.setActions();
    clear(this.root);
    this.root.appendChild(screen.render(this));

    if (this.entering) {
      this.entering = false;
      this.root.classList.remove('entering');
      // Restart the entrance animation for the new screen.
      void this.root.offsetWidth;
      this.root.classList.add('entering');
    }
  },
};

function boot() {
  app.header = document.getElementById('app-header');
  app.root = document.getElementById('app-main');
  app.actions = document.getElementById('app-actions');
  app.root.addEventListener('animationend', () => app.root.classList.remove('entering'));

  const saved = loadProject();
  if (saved) app.state = migrate(saved);

  app.render();

  // The comparison refreshes when the cloud changes saved trials. Input
  // screens are left alone so a re-render never interrupts typing.
  const SYNCED_SCREENS = new Set(['trials', 'rural']);
  const refreshIfShowingSavedWork = () => {
    if (SYNCED_SCREENS.has(app.state.screen)) app.render();
  };

  onCloudChange(refreshIfShowingSavedWork);
  onStoreChange((_collection, origin) => {
    if (origin === 'remote') refreshIfShowingSavedWork();
  });

  connectCloud();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export default app;
