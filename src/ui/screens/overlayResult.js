import { h, card, numberField, segmented, fold, keyResult, notice, button, msa } from '../dom.js';
import { stepCard } from '../citations.js';
import { sectionDiagram } from './layers.js';
import { overlayDesignFor, overlayModulusOf, iitpaveKey } from '../overlayProject.js';
import { bituminousModulus } from '../../engine/materials.js';
import { IRC81, IRC115 } from '../../data/overlay.js';
import { MODULI } from '../../data/ircConstants.js';

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
const STAGE_SCREEN = { traffic: 'overlayTraffic', survey: 'overlaySurvey', moduli: 'overlayModuli' };

export default function renderOverlayResult(app) {
  const o = app.state.overlay;
  const host = h('div', { class: 'card-stack' });
  const iitHost = h('div', { class: 'card-stack' });
  const stepsHost = h('div', { class: 'card-stack' });
  const fill = (el, items) => el.replaceChildren(...items.flat().filter(Boolean));

  const show = () => {
    const r = overlayDesignFor(app.state);
    app.state.overlayResult = r.ok ? r : null;
    app.setActions(
      button('Report', () => app.go('report'), { kind: 'secondary', disabled: !r.ok }),
      button('Cost and save', () => app.go('rates'), { disabled: !r.ok })
    );
    if (!r.ok) {
      fill(host, [notice('info', null, r.message), STAGE_SCREEN[r.stage] ? button('Go there', () => app.go(STAGE_SCREEN[r.stage]), { kind: 'secondary' }) : null]);
      fill(iitHost, []);
      fill(stepsHost, []);
      return;
    }
    fill(host, r.method === 'bbd' ? bbdResult(app, r) : fwdResult(app, r));
    // The IITPAVE fields are redrawn with the overlay they belong to, but never under the finger.
    if (r.method === 'fwd' && !iitHost.contains(document.activeElement)) fill(iitHost, [iitpaveCard(app, r, show)]);
    const steps = r.method === 'bbd' ? [...r.traffic.steps, ...r.design.steps] : [...r.traffic.steps, ...r.moduli.steps, ...r.design.steps];
    fill(stepsHost, [card('Calculation steps', steps.map(stepCard))]);
  };

  show();
  return h('div', { class: 'card-stack' }, host, o.method === 'fwd' ? mixCard(app, show) : bbdInputs(app, show), iitHost, stepsHost);
}

/* ---------- IRC:81 ---------- */

function bbdResult(app, r) {
  const d = r.design;
  const provided = r.slots.filter((s) => !s.existing && s.behaviour !== 'subgrade');
  return [
    h(
      'div',
      { class: 'key-results' },
      keyResult('Design traffic', msa(r.traffic.msa).replace(' msa', ''), 'msa', IRC81.traffic.ref),
      keyResult('Characteristic deflection', fmt(d.Dc, 2), 'mm', IRC81.characteristic.ref),
      keyResult('Overlay in BM', fmt(d.overlayBmMm), 'mm', IRC81.overlayChart.ref),
      keyResult(d.structural ? 'Overlay laid' : 'Overlay', d.structural ? fmt(r.overlayMm) : 'None', d.structural ? 'mm' : null, d.structural ? IRC81.minimum.ref : IRC81.noDeficiency.ref)
    ),
    d.structural
      ? null
      : notice('ok', null, `No structural overlay: a thin surfacing for riding quality · ${IRC81.noDeficiency.ref.clause}`),
    r.warnings.length ? h('div', { class: 'warning-list' }, r.warnings.map((w) => notice('warn', null, w))) : null,
    d.structural ? card('Section', sectionDiagram(r.slots)) : null,
    d.structural
      ? card(
          'Equivalent overlays',
          h(
            'div',
            { class: 'key-results' },
            keyResult('BM', fmt(d.provided.bmMm), 'mm', IRC81.equivalence.ref),
            keyResult('DBM or BC', fmt(d.provided.dbmBcMm), 'mm', IRC81.equivalence.ref),
            keyResult('WMM or WBM', fmt(d.provided.granularMm), 'mm', IRC81.equivalence.ref)
          ),
          provided.length ? h('p', { class: 'field-note' }, provided.map((s) => `${s.label} ${s.thicknessMm} mm`).join(' over ')) : null
        )
      : null,
  ];
}

function bbdInputs(app, show) {
  const o = app.state.overlay.overlay;
  return card(
    'Overlay material',
    segmented({
      label: 'Laid as',
      ref: IRC81.minimum.ref,
      value: o.bbdMaterial,
      options: [
        { value: 'dbm', label: 'DBM and BC' },
        { value: 'bm', label: 'BM with a BC surfacing' },
      ],
      onChange: (value) => {
        o.bbdMaterial = value;
        app.persist();
        app.render();
      },
    })
  );
}

/* ---------- IRC:115 ---------- */

function fwdResult(app, r) {
  const d = r.design;
  const e = d.existing;
  const w = d.withOverlay;
  return [
    h(
      'div',
      { class: 'key-results' },
      keyResult('Design traffic', msa(r.traffic.msa).replace(' msa', ''), 'msa', IRC115.traffic.ref),
      keyResult('Remaining life', msa(e.lifeMsa).replace(' msa', ''), 'msa', IRC115.fatigue.ref),
      keyResult('Overlay', d.overlayMm > 0 ? fmt(d.overlayMm) : 'None', d.overlayMm > 0 ? 'mm' : null, IRC115.procedure.ref),
      w ? keyResult('Life with overlay', msa(w.lifeMsa).replace(' msa', ''), 'msa', IRC115.rutting.ref) : null
    ),
    !d.needed && !(d.overlayMm > 0)
      ? notice('ok', null, 'The pavement carries the design traffic as it stands: no structural overlay')
      : w && !w.safe
        ? notice('danger', null, 'The overlay does not carry the design traffic')
        : null,
    r.warnings.length ? h('div', { class: 'warning-list' }, r.warnings.map((x) => notice('warn', null, x))) : null,
    card('Section', sectionDiagram(r.slots)),
    card(
      'Strains and lives',
      h(
        'div',
        { class: 'data-grid-wrap' },
        h(
          'table',
          { class: 'data-grid read' },
          h('thead', {}, h('tr', {}, ['', 'εt, µε', 'εv, µε', 'Fatigue, msa', 'Rutting, msa', 'Source'].map((c) => h('th', { scope: 'col' }, c)))),
          h(
            'tbody',
            {},
            [
              ['As it stands', e],
              w ? [`With ${d.overlayMm} mm`, w] : null,
            ]
              .filter(Boolean)
              .map(([label, x]) =>
                h(
                  'tr',
                  {},
                  h('th', { scope: 'row' }, label),
                  h('td', {}, fmt(x.tensile * 1e6, 1)),
                  h('td', {}, fmt(x.vertical * 1e6, 1)),
                  h('td', {}, fmt(x.fatigueMsa, 1)),
                  h('td', {}, fmt(x.ruttingMsa, 1)),
                  h('td', {}, x.fromIitpave ? 'IITPAVE' : 'App')
                )
              )
          )
        )
      )
    ),
  ];
}

function mixCard(app, show) {
  const o = app.state.overlay.overlay;
  const set = (key, { rerender = false } = {}) => (value) => {
    o[key] = value;
    app.persist();
    if (rerender) app.render();
    else show();
  };
  return card(
    'Overlay mix',
    segmented({
      label: 'Mix',
      ref: MODULI.bituminous.ref,
      value: o.mix,
      options: [
        { value: 'BC', label: 'Bituminous concrete' },
        { value: 'DBM', label: 'Dense bituminous macadam' },
      ],
      onChange: set('mix', { rerender: true }),
    }),
    segmented({
      label: 'Binder',
      ref: MODULI.bituminous.ref,
      value: o.binderGrade,
      options: [
        { value: 'VG30', label: 'VG30' },
        { value: 'VG40', label: 'VG40' },
      ],
      onChange: set('binderGrade', { rerender: true }),
    }),
    h(
      'div',
      { class: 'field-row' },
      numberField({
        label: 'Mix modulus',
        ref: IRC115.overlayModulus.ref,
        aside: `Table 9.2: ${bituminousModulus(o.binderGrade, 35)}`,
        value: o.modulusMPa,
        suffix: 'MPa',
        min: 0,
        onInput: set('modulusMPa'),
      }),
      numberField({ label: 'Overlay to check', ref: IRC115.procedure.ref, value: o.trialMm, suffix: 'mm', min: 0, onInput: set('trialMm') })
    )
  );
}

/** The layer systems as IITPAVE takes them, and the strains read from it. */
function iitpaveCard(app, r, show) {
  const o = app.state.overlay.overlay;
  const f = app.state.overlay.fwd;
  const E = r.moduli.design;
  const layers = (overlayMm) =>
    [
      overlayMm > 0 ? [String(overlayMm), fmt(overlayModulusOf(app.state)), f.nu.bituminous] : null,
      [String(f.bituminousMm), fmt(E.bituminous), f.nu.bituminous],
      [String(f.granularMm), fmt(E.granular), f.nu.granular],
      ['∞', fmt(E.subgrade, 1), f.nu.subgrade],
    ].filter(Boolean);
  const layerTable = (rows) =>
    h(
      'div',
      { class: 'data-grid-wrap' },
      h(
        'table',
        { class: 'data-grid read' },
        h('thead', {}, h('tr', {}, ['h, mm', 'E, MPa', 'μ'].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', {}, rows.map((row) => h('tr', {}, row.map((v) => h('td', {}, String(v))))))
      )
    );
  // Values show only while they belong to the layers above them; typing keys them to those layers.
  const strainFields = (target, key) => {
    const current = target.key === key;
    const field = (label, name) =>
      numberField({
        label,
        value: current ? target[name] : null,
        suffix: 'µε',
        min: 0,
        onInput: (value) => {
          if (target.key !== key) Object.assign(target, { tensile: null, vertical: null, key });
          target[name] = value;
          app.persist();
          show();
        },
      });
    return h('div', { class: 'field-row' }, field('εt, bottom of bituminous', 'tensile'), field('εv, top of subgrade', 'vertical'));
  };
  const base = iitpaveKey(app.state, E);
  const h2 = r.design.overlayMm;
  return card(
    'IITPAVE',
    h('h3', { class: 'sub-title' }, 'As it stands'),
    layerTable(layers(0)),
    strainFields(o.iitpave.existing, base),
    h2 > 0
      ? [
          h('h3', { class: 'sub-title' }, `With ${h2} mm`),
          layerTable(layers(h2)),
          strainFields(o.iitpave.overlaid, `${base}|${Math.round(overlayModulusOf(app.state))}|${h2}`),
        ]
      : null,
    h('p', { class: 'field-note' }, 'Dual wheel 20 kN each, 0.56 MPa, 310 mm apart; under a wheel and between the wheels')
  );
}
