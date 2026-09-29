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
import { openDrawer, closeDrawer, renderDrawer, ICONS, FLOW_SCREENS } from './ui/drawer.js';
import { stepper } from './ui/stepper.js';
import { MODULES } from './ui/modules.js';
import { loadProject, saveProject } from './store/trials.js';
import { getProject, saveProjectRecord, freeName, PROJECT_FILE } from './store/projects.js';
import { connectCloud, onCloudChange } from './store/cloud.js';
import { subscribe as onStoreChange } from './store/sync.js';
import { BINDER_GRADES, defaultConditions } from './data/layerCatalog.js';

import renderHome from './ui/screens/home.js';
import renderTraffic from './ui/screens/traffic.js';
import renderLayers from './ui/screens/layers.js';
import renderInputs from './ui/screens/inputs.js';
import renderResults from './ui/screens/results.js';
import renderRates from './ui/screens/rates.js';
import renderTrials from './ui/screens/trials.js';
import renderRural from './ui/screens/rural.js';
import renderRuralTraffic from './ui/screens/ruralTraffic.js';
import renderLvRigidTraffic from './ui/screens/lvRigidTraffic.js';
import renderLvRigidSlab from './ui/screens/lvRigidSlab.js';
import renderRigidTraffic from './ui/screens/rigidTraffic.js';
import renderRigidAxles from './ui/screens/rigidAxles.js';
import renderCtbAxles from './ui/screens/ctbAxles.js';
import renderIitpave from './ui/screens/iitpave.js';
import renderRigidSlab from './ui/screens/rigidSlab.js';
import renderRigidResult from './ui/screens/rigidResult.js';
import { defaultRigidState, migrateRigid } from './ui/rigidProject.js';
import { defaultCtbState, defaultConstructionState, hasCTB } from './ui/ctbProject.js';
import { defaultAxleSurvey } from './ui/spectrum.js';
import { defaultLayeredSubgrade, defaultNarratives } from './ui/flexibleProject.js';
import { defaultRuralState, migrateRural, defaultLvRigidState, migrateLvRigid } from './ui/lowVolumeProject.js';
import { designStepsScreen } from './ui/screens/designSteps.js';
import renderProjects from './ui/screens/projects.js';
import renderMaterialRates from './ui/screens/materialRates.js';
import renderAbout from './ui/screens/about.js';
import renderReport from './ui/screens/report.js';

/** The step a design's result is shown on, for each kind of design. */
const RESULT_SCREEN = { flexible: 'results', rigid: 'rigidResult', rural: 'rural', ruralRigid: 'lvRigidSlab' };

/**
 * `title` heads the page. Screens of a design module carry the module's name in
 * the header and its steps above the title; the others carry the app's name.
 */
const SCREENS = {
  home: { render: renderHome, title: 'New pavement design', back: null },
  traffic: { render: renderTraffic, title: 'Design traffic', back: 'home' },
  layers: { render: renderLayers, title: 'Pavement composition', back: 'traffic' },
  ctbAxles: { render: renderCtbAxles, title: 'Axle load spectrum', back: 'layers' },
  inputs: { render: renderInputs, title: 'Design inputs', back: () => (hasCTB(app.state) ? 'ctbAxles' : 'layers') },
  iitpave: { render: renderIitpave, title: 'IITPAVE', back: 'inputs' },
  results: { render: renderResults, title: 'Design result', back: 'iitpave' },
  report: { render: renderReport, title: 'Design report', back: () => RESULT_SCREEN[app.state.pavementType] },
  rates: { render: renderRates, title: 'Cost', back: () => 'report' },
  trials: { render: renderTrials, title: 'Compare trials', back: 'home' },
  ruralTraffic: { render: renderRuralTraffic, title: 'Design traffic', back: 'home' },
  rural: { render: renderRural, title: 'Pavement design', back: 'ruralTraffic' },
  lvRigidTraffic: { render: renderLvRigidTraffic, title: 'Design traffic', back: 'home' },
  lvRigidSlab: { render: renderLvRigidSlab, title: 'Slab design', back: 'lvRigidTraffic' },
  rigidTraffic: { render: renderRigidTraffic, title: 'Design traffic', back: 'home' },
  rigidAxles: { render: renderRigidAxles, title: 'Axle load spectrum', back: 'rigidTraffic' },
  rigidSlab: { render: renderRigidSlab, title: 'Slab design', back: 'rigidAxles' },
  rigidResult: { render: renderRigidResult, title: 'Design result', back: 'rigidSlab' },
  // Reached from the header or the side panel, so they return to wherever
  // they were opened from.
  designSteps: { render: designStepsScreen('flexible'), title: 'Flexible design steps', back: () => app.returnTo },
  rigidDesignSteps: { render: designStepsScreen('rigid'), title: 'Rigid design steps', back: () => app.returnTo },
  projects: { render: renderProjects, title: 'Saved projects', back: () => app.returnTo },
  materialRates: { render: renderMaterialRates, title: 'Material rates', back: () => app.returnTo },
  about: { render: renderAbout, title: 'About', back: () => app.returnTo },
};

/** Screens opened alongside a design rather than as a step of one. */
const ASIDE_SCREENS = new Set(['designSteps', 'rigidDesignSteps', 'projects', 'materialRates', 'about']);

/** The design procedure offered in the header: IRC:37 and IRC:58 have one. */
function designStepsFor(state) {
  if (!FLOW_SCREENS.has(state.screen)) return null;
  return { flexible: 'designSteps', rigid: 'rigidDesignSteps' }[state.pavementType] || null;
}

export const defaultState = () => ({
  screen: 'home',
  project: {
    name: '',
    location: '',
    client: '',
    designer: '',
    constructionType: 'greenfield',
    facility: 'main',
    roadCategory: 'nh',
    terrain: 'plain',
  },
  traffic: {
    /** 'calculate' from the counts, or 'direct' when the design traffic is known. */
    mode: 'calculate',
    designMsa: null,
    completionCVPD: null,
    presentCVPD: 1500,
    growthRatePercent: 5,
    yearsToCompletion: 2,
    designLifeYears: 20,
    laneDistributionId: 'dual-two-lane',
    directionalSplitPercent: 50,
    vdfMode: 'indicative',
    vehicleDamageFactor: null,
    axleSurvey: defaultAxleSurvey(),
    /** Stage construction (IRC:37 Cl. 4.3.2). */
    stage: { enabled: false, stage1Years: null, stage1Msa: null },
  },
  combination: {
    bituminousId: 'BC_DBM',
    baseId: 'WMM',
    subBaseId: 'GSB',
    crackReliefId: 'AGG_INTERLAYER',
  },
  thicknesses: {},
  /** What the site can supply; it limits the compositions offered. */
  conditions: defaultConditions(),
  /** Strength and axle loads of a cement treated base, for its cumulative damage. */
  ctb: defaultCtbState(),
  /** Dumpers on the sub-base and on the CTB while the layers above are laid. */
  construction: defaultConstructionState(),
  materials: {
    subgradeCBR: 8,
    binderGrade: 'VG40',
    pavementTemperatureC: 35,
    /** From the mix design; blank takes the table value. */
    bituminousModulusMPa: null,
    layeredSubgrade: defaultLayeredSubgrade(),
    /** Snow bound and frost affected: VG10 allowed, modulus at 20 °C, 450 mm in all (Cl. 9.1 / 13.2). */
    snowBound: false,
    /** CTSB of 7-day UCS 1.5 - 3 MPa ('standard', 600 MPa) or 0.75 - 1.5 MPa ('low', 400 MPa). */
    ctsbStrength: 'standard',
    /** Granular base on a CTSB: 'crushed' rock, 350 MPa, or natural 'gravel', 300 MPa. */
    granularOverCtsb: 'crushed',
    /** Long-life design where it applies; null takes it, false declines it. */
    longLife: null,
  },
  /** 80 or 90 chosen by the designer; null takes the code's. */
  reliabilityChoice: null,
  /** The designer's own paragraphs, placed in the report. */
  narratives: defaultNarratives(),
  /** Outputs read from IITPAVE for the section last designed. */
  iitpave: { key: '', values: {}, stresses: {} },
  mix: {
    airVoidsPercent: 3.5,
    effectiveBinderPercent: 11.5,
  },
  result: null,
  rates: {},
  geometry: {
    carriagewayWidthM: 7,
    lengthKm: 1,
    /** Each side; blank on a rigid design takes the drainage inputs. */
    pavedShoulderM: null,
    earthenShoulderM: null,
  },
  pavementType: 'flexible',
  rigid: defaultRigidState(),
  rigidResult: null,
  /** Low volume roads: IRC:SP:72 flexible and IRC:SP:62 rigid. */
  rural: defaultRuralState(),
  ruralResult: null,
  lvRigid: defaultLvRigidState(),
  lvRigidResult: null,
  /** The saved project these inputs were opened from or last saved as. */
  projectId: null,
});

/** The inputs a saved project keeps. Material rates are app-wide, not per project. */
function projectInputs(state) {
  const { screen, result, rigidResult, ruralResult, lvRigidResult, rates, projectId, ...inputs } = state;
  return structuredClone(inputs);
}

/**
 * A comparable form of saved data: keys sorted, and the empty values the cloud
 * drops on a round trip dropped here too.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const item = canonical(value[key]);
    const empty = item == null || (typeof item === 'object' && !Object.keys(item).length);
    if (!empty) out[key] = item;
  }
  return out;
}

const sameInputs = (a, b) =>
  JSON.stringify(canonical(projectInputs(a))) === JSON.stringify(canonical(projectInputs(b)));

/**
 * Bring a saved project up to the current shape: fill in fields added since it
 * was saved, and drop values the app no longer offers.
 */
function migrate(saved) {
  const defaults = defaultState();
  const state = { ...defaults, ...saved, screen: 'home' };
  for (const [key, value] of Object.entries(defaults)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !['thicknesses', 'rates', 'rigid', 'rural', 'lvRigid'].includes(key)) {
      state[key] = { ...value, ...(saved[key] || {}) };
    }
  }
  state.rigid = migrateRigid(saved.rigid);
  state.rural = migrateRural(saved.rural);
  state.lvRigid = migrateLvRigid(saved.lvRigid);
  delete state.routeChoice;
  if (state.traffic.vdfMode === 'manual') state.traffic.vdfMode = 'survey';
  state.traffic.axleSurvey = { ...defaults.traffic.axleSurvey, ...(state.traffic.axleSurvey || {}) };
  state.traffic.stage = { ...defaults.traffic.stage, ...(state.traffic.stage || {}) };
  if (state.project.roadCategory === 'other') state.project.roadCategory = 'odr';
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
  /** Design screen the aside screens return to. Deliberately not persisted. */
  returnTo: 'home',
  /** Open/closed state of collapsible sections, for this session only. */
  folds: {},
  entering: false,

  go(screen) {
    closeSheet();
    closeDrawer();
    this.state.screen = screen;
    this.entering = true;
    this.render();
    window.scrollTo({ top: 0 });
  },

  /** Go to a screen, remembering the design screen an aside was opened from. */
  open(screen) {
    if (ASIDE_SCREENS.has(screen) && !ASIDE_SCREENS.has(this.state.screen)) {
      this.returnTo = this.state.screen;
    }
    this.go(screen);
  },

  /** True when the inputs differ from the saved project, or from a fresh one. */
  isUnsaved() {
    const saved = getProject(this.state.projectId);
    return !sameInputs(this.state, saved ? migrate(saved.state) : defaultState());
  },

  /** Save the inputs over the project they came from, or with `copy` as a new project. */
  storeProject({ copy = false } = {}) {
    const saved = copy ? null : getProject(this.state.projectId);
    if (copy) this.state.project.name = freeName(this.state.project.name.trim());
    const record = saveProjectRecord({
      id: saved?.id,
      name: this.state.project.name.trim(),
      pavementType: this.state.pavementType,
      state: projectInputs(this.state),
    });
    this.state.projectId = record.id;
    this.persist();
  },

  /** The current inputs, or a saved project's, as the contents of a project file. */
  projectFile(record = null) {
    const state = record ? record.state : projectInputs(this.state);
    return {
      ...PROJECT_FILE,
      exportedAt: new Date().toISOString(),
      name: record ? record.name : this.state.project.name.trim(),
      pavementType: record ? record.pavementType : this.state.pavementType,
      state,
    };
  },

  /**
   * Keep a project read from a file as a new saved project. Only the inputs
   * the app knows are taken; opening it fills in anything missing.
   * Returns the record, or throws with what is wrong with the file.
   */
  importProjectFile(data) {
    if (!data || data.app !== PROJECT_FILE.app || data.kind !== PROJECT_FILE.kind || !data.state || typeof data.state !== 'object') {
      throw new Error('Not a project file from this app');
    }
    if (!MODULES[data.pavementType]) throw new Error('The file names a design this app does not have');
    const known = projectInputs(defaultState());
    const state = {};
    const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
    for (const [key, value] of Object.entries(known)) {
      if (!(key in data.state)) continue;
      const given = data.state[key];
      // Only values of the shape the app keeps there; the rest take their defaults.
      if (kind(value) === kind(given) || value === null || given === null) state[key] = given;
    }
    state.pavementType = data.pavementType;
    const name = freeName(String(data.name || state.project?.name || 'Imported project').trim() || 'Imported project');
    state.project = { ...known.project, ...(state.project || {}), name };
    return saveProjectRecord({ name, pavementType: data.pavementType, state });
  },

  openProject(record) {
    this.state = migrate({ ...record.state, rates: this.state.rates, projectId: record.id });
    this.persist();
    this.go(MODULES[this.state.pavementType]?.start || 'traffic');
  },

  /** Start a design module from its first step. */
  startModule(type) {
    this.state.pavementType = type;
    this.persist();
    this.go(MODULES[type].start);
  },

  /**
   * Move the design between a code and its low volume one from the traffic
   * step, carrying the traffic already entered across.
   */
  switchModule(type) {
    const s = this.state;
    if (type === 'rural' && s.pavementType === 'flexible') {
      if (s.traffic.mode === 'direct') {
        Object.assign(s.rural.traffic, { mode: 'direct', designEsal: (s.traffic.designMsa || 0) * 1e6 });
      } else {
        Object.assign(s.rural.traffic, { cvpd: s.traffic.presentCVPD, yearsToOpening: s.traffic.yearsToCompletion });
      }
    }
    if (type === 'ruralRigid' && s.pavementType === 'rigid') {
      Object.assign(s.lvRigid.traffic, { presentCVPD: s.rigid.traffic.twoWayCVPD, yearsToCompletion: s.rigid.traffic.yearsToCompletion });
    }
    this.startModule(type);
  },

  newProject() {
    this.state = { ...defaultState(), rates: this.state.rates };
    this.persist();
    this.go('home');
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
    const { screen, result, rigidResult, ruralResult, lvRigidResult, ...rest } = this.state;
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

  /** The header: menu, back, the module or app name, and the design steps. */
  renderHeader() {
    const screen = SCREENS[this.state.screen] || SCREENS.home;
    const back = typeof screen.back === 'function' ? screen.back() : screen.back;
    const flow = FLOW_SCREENS.has(this.state.screen);

    clear(this.header);
    this.header.appendChild(
      h('button', {
        class: 'menu-button',
        'aria-label': 'Menu',
        'aria-controls': 'app-drawer',
        html: ICONS.menu,
        onclick: (event) => openDrawer(this, event.currentTarget),
      })
    );
    if (back) {
      this.header.appendChild(h('button', { class: 'back-button', 'aria-label': 'Back', onclick: () => this.go(back) }, '‹'));
    }
    const module = flow ? MODULES[this.state.pavementType] : null;
    this.header.appendChild(
      h(
        'h1',
        {},
        h('span', { class: 'title-long' }, module ? module.label : 'IRC Pavement Design'),
        h('span', { class: 'title-short' }, module ? module.short : 'IRC Pavement Design')
      )
    );
    // Top right: the design procedure, readable from anywhere in its design.
    const stepsScreen = designStepsFor(this.state);
    if (stepsScreen) {
      this.header.appendChild(h('button', { class: 'header-button', onclick: () => this.open(stepsScreen) }, 'Design Steps'));
    }
  },

  /** The steps of the design and the page title, above the screen. */
  pageHead() {
    const screen = SCREENS[this.state.screen] || SCREENS.home;
    const flow = FLOW_SCREENS.has(this.state.screen);
    return h(
      'div',
      { class: 'page-head' },
      flow ? stepper(this) : null,
      h(
        'div',
        { class: 'page-heading' },
        flow ? h('span', { class: 'page-eyebrow' }, MODULES[this.state.pavementType].code) : null,
        h('h2', { class: 'page-title' }, screen.title)
      )
    );
  },

  /**
   * Redraw everything around the screen, for a screen whose edits change the
   * module it belongs to (traffic decides between IRC:37 and IRC:SP:72).
   */
  refreshChrome() {
    this.renderHeader();
    const head = this.root.querySelector(':scope > .page-head');
    if (head) head.replaceWith(this.pageHead());
    renderDrawer(this);
  },

  /**
   * Keep the page at least as tall as it is now: an edit that shortens the page
   * would otherwise pull it up under the finger. The hold goes as soon as
   * letting go moves nothing on screen.
   */
  holdHeight() {
    this.root.style.minHeight = `${this.root.offsetHeight}px`;
    requestAnimationFrame(() => this.releaseHeight());
  },

  releaseHeight() {
    const held = this.root.style.minHeight;
    if (!held) return;
    const y = window.scrollY;
    this.root.style.minHeight = '';
    // Shorter than the scroll position allows: the page would jump, so keep holding.
    if (window.scrollY !== y) {
      this.root.style.minHeight = held;
      window.scrollTo(0, y);
    }
  },

  render() {
    const screen = SCREENS[this.state.screen] || SCREENS.home;
    if (this.entering) this.root.style.minHeight = '';
    else this.holdHeight();

    this.setActions();
    const body = screen.render(this);
    // After the screen, which may settle the module it belongs to.
    this.renderHeader();
    clear(this.root);
    this.root.append(this.pageHead(), body);
    renderDrawer(this);

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

  // Typing redraws the results as it goes; hold the page height so it never moves.
  app.root.addEventListener('input', () => app.holdHeight(), true);
  let releasing = false;
  window.addEventListener(
    'scroll',
    () => {
      if (releasing || !app.root.style.minHeight) return;
      releasing = true;
      requestAnimationFrame(() => {
        releasing = false;
        app.releaseHeight();
      });
    },
    { passive: true }
  );

  const saved = loadProject();
  if (saved) app.state = migrate(saved);

  app.render();

  // The comparison refreshes when the cloud changes saved trials. Input
  // screens are left alone so a re-render never interrupts typing.
  const SYNCED_SCREENS = new Set(['trials', 'projects']);
  const refreshIfShowingSavedWork = () => {
    if (document.activeElement?.matches('input, textarea, select')) return;
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
