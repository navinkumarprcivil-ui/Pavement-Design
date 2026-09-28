/**
 * Axle load spectrum editors, shared by the rigid slab and the cement treated
 * base: the mix of axle types, and the share of each type in each load class.
 */

import { h, card, numberField, fold, button } from './dom.js';
import { RIGID } from '../data/ircConstants.js';

export const AXLES = [
  { id: 'single', label: 'Rear single' },
  { id: 'tandem', label: 'Tandem' },
  { id: 'tridem', label: 'Tridem' },
];

/** Class mid-points to start a spectrum from, at the IRC:58 class widths. */
function classes(from, to, width) {
  const rows = [];
  for (let load = to; load >= from; load -= width) rows.push({ loadKN: load, percent: null });
  return rows;
}

export const defaultSpectrum = () => ({
  single: classes(80, 200, RIGID.traffic.classWidthKN.single),
  tandem: classes(160, 400, RIGID.traffic.classWidthKN.tandem),
  tridem: classes(230, 560, RIGID.traffic.classWidthKN.tridem),
});

/** Front axles are whatever the three rear categories leave of 100%. */
export function frontAxlePercent(mix) {
  return 100 - (mix.single || 0) - (mix.tandem || 0) - (mix.tridem || 0);
}

export function spectrumTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
}

/**
 * Rows from text pasted out of a spreadsheet. A line with two numbers is a
 * load and a share; with three, a class range and a share, taken at the
 * range's mid-point.
 */
export function parseSpectrum(text) {
  return text
    .split(/\r?\n/)
    .map((line) => (line.match(/\d+(?:\.\d+)?/g) || []).map(Number))
    .filter((nums) => nums.length >= 2)
    .map((nums) =>
      nums.length >= 3
        ? { loadKN: (nums[0] + nums[1]) / 2, percent: nums[2] }
        : { loadKN: nums[0], percent: nums[1] }
    );
}

/**
 * The share of each axle type, and axles per vehicle.
 *
 * @param {object} traffic  Holds `axleMix` and `axlesPerVehicle`; edited in place.
 * @param {() => void} onChange
 */
export function axleMixCard(app, traffic, onChange = () => {}) {
  const mix = traffic.axleMix;
  const frontHost = h('span', {});
  const showFront = () => frontHost.replaceChildren(`${frontAxlePercent(mix).toFixed(1)}%`);

  const mixField = (axle) =>
    numberField({
      label: axle.label,
      value: mix[axle.id],
      suffix: '%',
      min: 0,
      max: 100,
      onInput: (value) => {
        mix[axle.id] = value ?? 0;
        app.persist();
        showFront();
        onChange();
      },
    });

  showFront();

  return card(
    'Axle mix, % of all axles',
    h('div', { class: 'field-row keep' }, mixField(AXLES[0]), mixField(AXLES[1])),
    h(
      'div',
      { class: 'field-row keep' },
      mixField(AXLES[2]),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Front'), h('div', { class: 'readout' }, frontHost))
    ),
    numberField({
      label: 'Axles per commercial vehicle',
      value: traffic.axlesPerVehicle,
      min: 1,
      onInput: (value) => {
        traffic.axlesPerVehicle = value;
        app.persist();
        onChange();
      },
    })
  );
}

/**
 * One axle type's load classes and their shares.
 *
 * @param {object} spectrum  {single, tandem, tridem} row lists; edited in place.
 * @param {string} foldKey   Distinguishes this editor's paste fold from others'.
 */
export function spectrumCard(app, spectrum, axle, foldKey, onChange = () => {}) {
  const rows = spectrum[axle.id];
  const total = h('strong', {});
  const showTotal = () => {
    const sum = spectrumTotal(rows);
    total.textContent = `${sum.toFixed(1)}%`;
    total.className = Math.abs(sum - 100) <= 0.5 ? 'total-ok' : 'total-off';
  };

  const paste = h('textarea', { rows: 5, class: 'paste-area', 'aria-label': `${axle.label} spectrum` });

  const row = (entry, index) =>
    h(
      'div',
      { class: 'spectrum-row' },
      numberField({
        label: index === 0 ? 'Load, kN' : null,
        value: entry.loadKN,
        min: 0,
        onInput: (value) => {
          entry.loadKN = value;
          app.persist();
          onChange();
        },
      }),
      numberField({
        label: index === 0 ? 'Share, %' : null,
        value: entry.percent,
        min: 0,
        max: 100,
        onInput: (value) => {
          entry.percent = value;
          app.persist();
          showTotal();
          onChange();
        },
      }),
      h(
        'button',
        {
          type: 'button',
          class: 'row-remove',
          'aria-label': 'Remove class',
          onclick: () => {
            rows.splice(index, 1);
            app.persist();
            app.render();
          },
        },
        '×'
      )
    );

  showTotal();

  return card(
    `${axle.label} axles`,
    h('div', { class: 'spectrum-rows' }, rows.map(row)),
    h('div', { class: 'spectrum-total' }, h('span', {}, 'Total'), total),
    h(
      'div',
      { class: 'spectrum-actions' },
      button(
        'Add class',
        () => {
          const width = RIGID.traffic.classWidthKN[axle.id];
          const lowest = rows.length ? Math.min(...rows.map((r) => r.loadKN || 0)) : width * 10;
          rows.push({ loadKN: Math.max(width, lowest - width), percent: null });
          app.persist();
          app.render();
        },
        { kind: 'ghost' }
      )
    ),
    fold({
      title: 'Paste from a spreadsheet',
      memory: app.folds,
      key: `${foldKey}-${axle.id}`,
      children: [
        paste,
        button(
          'Replace with pasted',
          () => {
            const parsed = parseSpectrum(paste.value);
            if (!parsed.length) return;
            spectrum[axle.id] = parsed;
            app.persist();
            app.render();
          },
          { kind: 'secondary' }
        ),
      ],
    })
  );
}
