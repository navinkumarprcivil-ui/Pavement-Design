import { h, card, numberField, segmented, metric, notice, button, fold } from '../dom.js';
import { stepCard } from '../citations.js';
import { dataGrid } from '../dataGrid.js';
import { fwdSurvey, newBbdPoint, newFwdPoint, overlayTrafficFor } from '../overlayProject.js';
import { designBbd, chartRange, seasonalChart } from '../../engine/overlay.js';
import { IRC81, IRC115 } from '../../data/overlay.js';

const yesNo = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

export default function renderOverlaySurvey(app) {
  return app.state.overlay.method === 'bbd' ? bbdScreen(app) : fwdScreen(app);
}

/* ---------- Benkelman beam, IRC:81 ---------- */

function bbdScreen(app) {
  const b = app.state.overlay.bbd;
  const summary = h('div', { class: 'card-stack' });
  app.setActions(button('Design the overlay', () => app.go('overlayResult')));

  const t = IRC81.temperature;
  const tempApplies = !b.coldArea && !b.severelyCracked && b.bituminousMm >= t.minimumBituminousMm;
  const dry = b.season === 'dry';

  const show = () => {
    const traffic = overlayTrafficFor(app.state);
    const d = designBbd({ ...b, roadCategory: app.state.project.roadCategory, designMsa: traffic.ok ? traffic.msa : null });
    const counted = b.points.filter((p) => p.deflectionMm > 0).length;
    summary.replaceChildren(
      d.Dc != null || d.ok
        ? h(
            'section',
            { class: 'card result-card' },
            h(
              'div',
              { class: 'headline' },
              h('span', { class: 'headline-label' }, 'Characteristic deflection'),
              h('span', { class: 'headline-value' }, `${d.Dc.toFixed(2)} mm`)
            ),
            h(
              'div',
              { class: 'metric-grid three' },
              metric('Points', String(d.n ?? counted)),
              metric('Mean', `${d.mean.toFixed(3)} mm`),
              metric('Std deviation', `${d.sd.toFixed(3)} mm`)
            ),
            d.warnings?.length ? h('div', { class: 'warning-list' }, d.warnings.map((w) => notice('warn', null, w))) : null,
            fold({ title: 'Working', memory: app.folds, key: 'bbd-survey-working', children: d.steps.map(stepCard) })
          )
        : notice('info', null, d.message)
    );
  };

  const set = (key, { rerender = false } = {}) => (value) => {
    b[key] = value;
    app.persist();
    if (rerender) app.render();
    else show();
  };

  const range = chartRange(b.soil, b.rainfall);
  const columns = [
    { label: 'Rebound deflection, mm', get: (r) => r.deflectionMm, set: (r, v) => (r.deflectionMm = v) },
    tempApplies ? { label: 'Pavement temperature, °C', get: (r) => r.temperatureC, set: (r, v) => (r.temperatureC = v) } : null,
    dry ? { label: 'Field moisture, %', get: (r) => r.moisturePercent, set: (r, v) => (r.moisturePercent = v) } : null,
  ].filter(Boolean);

  const screen = h(
    'div',
    { class: 'card-stack' },
    card(
      'Pavement',
      numberField({ label: 'Bituminous layers', ref: t.ref, aside: `min ${t.minimumBituminousMm} mm for temperature correction`, value: b.bituminousMm, suffix: 'mm', min: 0, onInput: set('bituminousMm', { rerender: true }) }),
      segmented({
        label: 'Severely cracked or stripped',
        ref: t.ref,
        value: b.severelyCracked ? 'yes' : 'no',
        options: yesNo,
        onChange: (v) => set('severelyCracked', { rerender: true })(v === 'yes'),
      }),
      segmented({
        label: 'Cold or high area',
        ref: t.cold.ref,
        value: b.coldArea ? 'yes' : 'no',
        options: yesNo,
        onChange: (v) => set('coldArea', { rerender: true })(v === 'yes'),
      })
    ),
    card(
      'Season',
      segmented({
        label: 'Measured',
        ref: IRC81.seasonal.ref,
        value: b.season,
        options: [
          { value: 'monsoon', label: 'After the monsoon' },
          { value: 'dry', label: 'In the dry months' },
        ],
        onChange: set('season', { rerender: true }),
      }),
      dry
        ? [
            segmented({
              label: 'Subgrade soil',
              ref: IRC81.seasonal.ref,
              value: b.soil,
              options: [
                { value: 'sandy', label: 'Sandy or gravelly' },
                { value: 'clayLow', label: 'Clay, PI < 15' },
                { value: 'clayHigh', label: 'Clay, PI > 15' },
              ],
              onChange: set('soil', { rerender: true }),
            }),
            segmented({
              label: 'Annual rainfall',
              ref: IRC81.seasonal.ref,
              value: b.rainfall,
              options: [
                { value: 'low', label: 'Up to 1300 mm' },
                { value: 'high', label: 'Over 1300 mm' },
              ],
              onChange: set('rainfall', { rerender: true }),
            }),
            h('p', { class: 'field-note' }, `${seasonalChart(b.soil, b.rainfall).figure}: moisture ${range[0]} – ${range[1]}%`),
          ]
        : null
    ),
    card(
      'Rebound deflections',
      dataGrid(app, {
        columns,
        rows: b.points,
        blank: newBbdPoint,
        key: 'bbd-points',
        fromLine: (nums) => ({
          deflectionMm: nums[0] ?? null,
          temperatureC: tempApplies ? nums[1] ?? null : null,
          moisturePercent: dry ? nums[tempApplies ? 2 : 1] ?? null : null,
        }),
        onChange: show,
      })
    ),
    summary
  );

  show();
  return screen;
}

/* ---------- Falling weight deflectometer, IRC:115 ---------- */

function fwdScreen(app) {
  const f = app.state.overlay.fwd;
  const summary = h('div', { class: 'card-stack' });
  app.setActions(button('Continue to moduli', () => app.go('overlayModuli')));

  const show = () => {
    const s = fwdSurvey(app.state);
    const scis = s.points.map((p) => p.sci).filter((v) => v != null);
    summary.replaceChildren(
      s.points.length
        ? h(
            'section',
            { class: 'card result-card' },
            h(
              'div',
              { class: 'headline' },
              h('span', { class: 'headline-label' }, 'Complete bowls'),
              h('span', { class: 'headline-value' }, String(s.points.length))
            ),
            h(
              'div',
              { class: 'metric-grid three' },
              metric('D0, mean', `${(s.points.reduce((t, p) => t + p.normalised[0], 0) / s.points.length).toFixed(3)} mm`),
              scis.length ? metric('SCI, mean', `${(scis.reduce((a, v) => a + v, 0) / scis.length).toFixed(3)} mm`) : metric('SCI', '—'),
              metric('Load', `${IRC115.load.targetKN} kN`)
            ),
            s.warnings.length ? h('div', { class: 'warning-list' }, s.warnings.map((w) => notice('warn', null, w))) : null
          )
        : notice('info', null, 'Enter the deflection bowls')
    );
  };

  const set = (key, { rerender = false } = {}) => (value) => {
    f[key] = value;
    app.persist();
    if (rerender) app.render();
    else show();
  };

  const radii = f.radii;
  const columns = [
    { label: 'Load, kN', get: (r) => r.loadKN, set: (r, v) => (r.loadKN = v) },
    ...radii.map((radius, i) => ({
      label: `D${radius}, mm`,
      get: (r) => r.deflections?.[i] ?? null,
      set: (r, v) => {
        if (!Array.isArray(r.deflections)) r.deflections = [];
        r.deflections[i] = v;
      },
    })),
    { label: 'Temp, °C', get: (r) => r.temperatureC, set: (r, v) => (r.temperatureC = v) },
  ];
  const n = radii.length;

  const sensorField = (i) =>
    numberField({
      label: `Sensor ${i + 1}`,
      value: radii[i],
      suffix: 'mm',
      min: 0,
      onInput: (value) => {
        radii[i] = value;
        app.persist();
      },
    });

  const screen = h(
    'div',
    { class: 'card-stack' },
    card(
      'Pavement',
      h(
        'div',
        { class: 'field-row' },
        numberField({ label: 'Bituminous layers', ref: IRC115.procedure.ref, value: f.bituminousMm, suffix: 'mm', min: 0, onInput: set('bituminousMm') }),
        numberField({ label: 'Granular layers', ref: IRC115.procedure.ref, value: f.granularMm, suffix: 'mm', min: 0, onInput: set('granularMm') })
      ),
      segmented({
        label: 'Condition',
        ref: IRC115.classification.ref,
        value: f.condition,
        options: [
          { value: 'good', label: 'Good' },
          { value: 'fair', label: 'Fair' },
          { value: 'poor', label: 'Poor' },
        ],
        onChange: set('condition', { rerender: true }),
      }),
      segmented({
        label: 'Measured in',
        ref: IRC115.seasonal.ref,
        value: f.season,
        options: [
          { value: 'monsoon', label: 'Monsoon recession' },
          { value: 'winter', label: 'Winter' },
          { value: 'summer', label: 'Summer' },
        ],
        onChange: set('season', { rerender: true }),
      }),
      segmented({
        label: 'Cold or high area',
        ref: IRC115.temperature.cold.ref,
        value: f.coldArea ? 'yes' : 'no',
        options: yesNo,
        onChange: (v) => set('coldArea', { rerender: true })(v === 'yes'),
      })
    ),
    card(
      'Poisson ratio',
      h(
        'div',
        { class: 'field-row three' },
        ['bituminous', 'granular', 'subgrade'].map((layer) =>
          numberField({
            label: layer[0].toUpperCase() + layer.slice(1),
            ref: IRC115.backcalculation.poisson.ref,
            value: f.nu[layer],
            min: 0,
            max: 0.5,
            onInput: (value) => {
              f.nu[layer] = value;
              app.persist();
            },
          })
        )
      )
    ),
    card(
      'Sensors',
      h('div', { class: 'field-row keep sensors' }, radii.map((_, i) => sensorField(i))),
      h(
        'div',
        { class: 'spectrum-actions grid-actions' },
        radii.length > 3
          ? button(
              'Remove sensor',
              () => {
                radii.pop();
                for (const p of f.points) p.deflections?.splice(radii.length);
                app.persist();
                app.render();
              },
              { kind: 'ghost' }
            )
          : null,
        button(
          'Add sensor',
          () => {
            radii.push(null);
            app.persist();
            app.render();
          },
          { kind: 'ghost' }
        )
      )
    ),
    card(
      'Deflection bowls',
      dataGrid(app, {
        columns,
        rows: f.points,
        blank: () => newFwdPoint(n),
        key: 'fwd-points',
        fromLine: (nums) => {
          if (nums.length >= n + 2) return { loadKN: nums[0], deflections: nums.slice(1, n + 1), temperatureC: nums[n + 1] };
          if (nums.length === n + 1) return { loadKN: null, deflections: nums.slice(0, n), temperatureC: nums[n] };
          if (nums.length === n) return { loadKN: null, deflections: nums.slice(0, n), temperatureC: null };
          return null;
        },
        onChange: show,
      })
    ),
    summary
  );

  show();
  return screen;
}
