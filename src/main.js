/**
 * App shell: state, navigation and rendering.
 *
 * Screens are plain functions that take the app object and return an element.
 * There is no framework and no build step — this file is the whole runtime.
 */

import { h, clear } from './ui/dom.js';
import { closeSheet } from './ui/citations.js';
import { loadProject, saveProject } from './store/trials.js';
import { connectCloud, onCloudChange } from './store/cloud.js';
import { subscribe as onStoreChange } from './store/sync.js';

import renderHome from './ui/screens/home.js';
import renderTraffic from './ui/screens/traffic.js';
import renderLayers from './ui/screens/layers.js';
import renderInputs from './ui/screens/inputs.js';
import renderResults from './ui/screens/results.js';
import renderRates from './ui/screens/rates.js';
import renderTrials from './ui/screens/trials.js';
import renderRural from './ui/screens/rural.js';
import renderRigid from './ui/screens/rigid.js';
import renderCodebook from './ui/screens/codebook.js';

const SCREENS = {
  home: { render: renderHome, title: 'IRC Pavement Design', back: null },
  traffic: { render: renderTraffic, title: 'Design traffic', back: 'home' },
  layers: { render: renderLayers, title: 'Layer combination', back: 'traffic' },
  inputs: { render: renderInputs, title: 'Design inputs', back: 'layers' },
  results: { render: renderResults, title: 'Design result', back: 'inputs' },
  rates: { render: renderRates, title: 'Rates and cost', back: 'results' },
  trials: { render: renderTrials, title: 'Saved trials', back: 'home' },
  rural: { render: renderRural, title: 'Low volume rural road', back: 'traffic' },
  rigid: { render: renderRigid, title: 'Rigid pavement', back: 'home' },
  codebook: { render: renderCodebook, title: 'Code references', back: 'home' },
};

export const defaultState = () => ({
  screen: 'home',
  project: {
    name: '',
    location: '',
    terrain: 'plain',
  },
  traffic: {
    presentCVPD: 1500,
    growthRatePercent: 5,
    yearsToCompletion: 3,
    designLifeYears: 15,
    laneDistributionId: 'dual-two-lane',
    vdfMode: 'indicative',
    vehicleDamageFactor: null,
  },
  trafficResult: null,
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
    airVoidsPercent: 4.5,
    effectiveBinderPercent: 11.5,
  },
  result: null,
  rates: {},
  geometry: {
    carriagewayWidthM: 7,
    lengthKm: 1,
  },
  rigid: {
    slabThicknessMm: 280,
    elasticModulusMPa: 30000,
    poissonRatio: 0.15,
    flexuralStrengthMPa: 4.5,
    modulusOfSubgradeReactionMPaPerM: 80,
    wheelLoadN: 20000,
    tyrePressureMPa: 0.8,
    temperatureDifferentialC: 16,
    slabLengthMm: 4500,
  },
  rigidResult: null,
});

const app = {
  state: defaultState(),
  root: null,
  header: null,

  go(screen) {
    closeSheet();
    this.state.screen = screen;
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
    const { screen, result, trafficResult, rigidResult, ...rest } = this.state;
    saveProject(rest);
  },

  render() {
    const screen = SCREENS[this.state.screen] || SCREENS.home;

    // Back button where there is somewhere to go back to, then the title.
    // The header carries no action button: code references belong on the
    // individual steps, next to the number they justify.
    clear(this.header);
    if (screen.back) {
      this.header.appendChild(
        h(
          'button',
          { class: 'back-button', onclick: () => this.go(screen.back) },
          '‹ Back'
        )
      );
    }
    this.header.appendChild(h('h1', {}, screen.title));

    clear(this.root);
    this.root.appendChild(screen.render(this));
  },
};

function boot() {
  app.header = document.getElementById('app-header');
  app.root = document.getElementById('app-main');

  const saved = loadProject();
  if (saved) {
    app.state = { ...defaultState(), ...saved, screen: 'home' };
  }

  app.render();

  // Screens that show saved work refresh when the cloud changes it. Input
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
