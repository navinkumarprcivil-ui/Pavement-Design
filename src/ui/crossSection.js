/**
 * The cross-section of the design on the go, as the report draws it: layers
 * to their widths, shoulders, joints and bars, with a numbered legend.
 * Schematic: widths to one scale, depths to another.
 */

import { h } from './dom.js';
import { crossSection } from '../engine/crossSection.js';
import { currentDesign } from './currentDesign.js';
import { isBonded, hasDrainage } from './rigidProject.js';

export const LAYER_COLOURS = {
  bituminous: '#3c4552',
  granular: '#c9a227',
  cemented: '#8fa3b8',
  treated: '#5b4a3a',
  membrane: '#1f252d',
  concrete: '#d3d8de',
  subgrade: '#a9805a',
};

export const DARK_TEXT = new Set(['granular', 'concrete', 'cemented']);

const EARTH = '#a9805a';
const SHOULDER_EARTH = '#8c9a5b';

/** The section model for the design on the go, or null when there is none. */
export function sectionFor(app) {
  const design = currentDesign(app);
  if (!design) return null;
  const { state } = app;
  const g = state.geometry;
  const input = { type: design.type, slots: design.slots, geometry: { ...g } };
  if (design.type === 'rigid') {
    const { rigid, rigidResult: r } = state;
    const d = rigid.drainage;
    input.geometry.pavedShoulderM = g.pavedShoulderM ?? d.concreteShoulderM;
    input.geometry.earthenShoulderM = g.earthenShoulderM ?? d.unpavedShoulderM;
    input.rigid = {
      shoulder: rigid.slab.shoulder,
      widenedM: rigid.slab.widenedM,
      laneWidthM: rigid.slab.laneWidthM,
      jointSpacingM: rigid.slab.jointSpacingM,
      drainage: hasDrainage(rigid),
      separation: rigid.foundation.subBase === 'dlc' && !isBonded(rigid),
      dowels: r.dowels ? { diameterMm: r.dowels.diameterMm, lengthMm: r.dowels.lengthMm, spacingMm: r.dowels.spacingMm } : null,
      tieBars: { diameterMm: r.tieBars.diameterMm, lengthMm: r.tieBars.lengthMm, spacingMm: r.tieBars.spacingMm },
    };
  }
  if (design.type === 'ruralRigid') {
    input.lvRigid = { jointSpacingM: state.lvRigid.slab.jointM };
  }
  return crossSection(input);
}

/** Lighter shades for successive layers of one kind, so they stay apart. */
function shade(hex, step) {
  if (!step) return hex;
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * Math.min(0.45, 0.16 * step));
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) el.setAttribute(key, String(value));
  for (const child of children.flat()) {
    if (child == null) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

const m = (v) => `${Number(v.toFixed(2))} m`;

/**
 * The drawing and its legend.
 *
 * @param {object} model  From sectionFor().
 */
export function crossSectionFigure(model) {
  if (!model || !(model.pavedM > 0) || !model.layers.length) return null;

  const W = 480;
  const top = 34;
  const totalMm = model.layers.reduce((sum, l) => sum + l.thicknessMm, 0);
  const perMm = Math.min(0.3, 130 / totalMm);
  const band = (mm) => Math.max(13, mm * perMm);

  // Depths of each layer's top and bottom, in drawing units.
  let y = top;
  const drawn = model.layers.map((layer, i) => {
    const same = model.layers.slice(0, i).filter((l) => l.behaviour === layer.behaviour).length;
    const d = { ...layer, n: i + 1, y1: y, y2: y + band(layer.thicknessMm), fill: shade(LAYER_COLOURS[layer.behaviour] || '#ccc', same) };
    y = d.y2;
    return d;
  });
  const bottom = y + 26;
  const H = bottom + 6;

  // The embankment slopes run out from the edge of the formation at the
  // surface; the margin leaves room for them to the foot of the drawing.
  const run = 0.45;
  const x0 = 6 + (bottom - top) * run;
  const px = (W - 2 * x0) / model.formationM;
  const pavedLeft = x0 + model.earthenM * px;
  const pavedRight = pavedLeft + model.pavedM * px;
  const formLeft = x0;
  const formRight = x0 + model.formationM * px;
  const leftAt = (yy) => formLeft - (yy - top) * run;
  const rightAt = (yy) => formRight + (yy - top) * run;
  const poly = (points) => svg('polygon', { points: points.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ') });

  // Embankment below the pavement.
  const embankment = poly([[leftAt(top), top], [rightAt(top), top], [rightAt(bottom), bottom], [leftAt(bottom), bottom]]);
  embankment.setAttribute('fill', EARTH);
  const shapes = [embankment];

  // Earthen shoulders: from the paved edge out to the slope, down to the first layer that runs to the formation.
  const firstFormation = drawn.find((l) => l.extent === 'formation');
  const shoulderBottom = firstFormation ? firstFormation.y1 : drawn[drawn.length - 1].y2;
  if (model.earthenM > 0) {
    for (const [a, b, out] of [[pavedLeft, formLeft, leftAt], [pavedRight, formRight, rightAt]]) {
      const p = poly([[a, top], [b, top], [out(shoulderBottom), shoulderBottom], [a, shoulderBottom]]);
      p.setAttribute('fill', SHOULDER_EARTH);
      shapes.push(p);
    }
  }

  // Layer numbers sit in the widest panel, clear of the joints and bars.
  const stops = [0, ...model.joints.map((j) => j.x), model.pavedM];
  let cx = pavedLeft + (model.pavedM * px) / 2;
  let widest = 0;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i] - stops[i - 1] > widest) {
      widest = stops[i] - stops[i - 1];
      cx = pavedLeft + ((stops[i] + stops[i - 1]) / 2) * px;
    }
  }

  for (const l of drawn) {
    const p =
      l.extent === 'formation'
        ? poly([[leftAt(l.y1), l.y1], [rightAt(l.y1), l.y1], [rightAt(l.y2), l.y2], [leftAt(l.y2), l.y2]])
        : poly([[pavedLeft, l.y1], [pavedRight, l.y1], [pavedRight, l.y2], [pavedLeft, l.y2]]);
    p.setAttribute('fill', l.fill);
    p.setAttribute('stroke', '#1b232c');
    p.setAttribute('stroke-width', '0.6');
    shapes.push(p);
    shapes.push(
      svg(
        'text',
        {
          x: cx,
          y: (l.y1 + l.y2) / 2 + 4,
          'text-anchor': 'middle',
          'font-size': 11,
          'font-weight': 700,
          fill: DARK_TEXT.has(l.behaviour) ? '#10161d' : '#f5f8fb',
        },
        String(l.n)
      )
    );
  }

  // IRC:SP:72 shoulders of sub-base quality material.
  if (model.shoulderLayer) {
    const t = band(model.shoulderLayer.thicknessMm);
    for (const [a, b] of [[formLeft, pavedLeft], [pavedRight, formRight]]) {
      const r = poly([[a, top], [b, top], [b, top + t], [a, top + t]]);
      r.setAttribute('fill', LAYER_COLOURS.granular);
      r.setAttribute('stroke', '#1b232c');
      r.setAttribute('stroke-width', '0.6');
      shapes.push(r);
    }
  }

  // A debonding sheet between the slab and the DLC.
  const slab = drawn.find((l) => l.behaviour === 'concrete');
  if (model.membrane && slab) {
    shapes.push(svg('line', { x1: pavedLeft, x2: pavedRight, y1: slab.y2, y2: slab.y2, stroke: '#0d1117', 'stroke-width': 2.4 }));
  }

  // Longitudinal joints through the slab, with tie bars across them.
  if (slab) {
    const barPx = model.tieBars ? Math.max(10, (model.tieBars.lengthMm / 1000) * px) : 0;
    for (const j of model.joints) {
      const x = pavedLeft + j.x * px;
      shapes.push(svg('line', { x1: x, x2: x, y1: slab.y1, y2: slab.y2, stroke: '#1b232c', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
      if (j.tied && barPx) {
        const yy = (slab.y1 + slab.y2) / 2;
        shapes.push(svg('line', { x1: x - barPx / 2, x2: x + barPx / 2, y1: yy, y2: yy, stroke: '#b3261e', 'stroke-width': 2 }));
      }
    }
  }

  // Widths along the top.
  const marks = [];
  const segment = (a, b, text) => {
    if (!(b - a > 0.5)) return;
    marks.push(svg('line', { x1: a, x2: a, y1: 8, y2: top - 2, stroke: '#5a6775', 'stroke-width': 0.7 }));
    marks.push(svg('line', { x1: b, x2: b, y1: 8, y2: top - 2, stroke: '#5a6775', 'stroke-width': 0.7 }));
    marks.push(svg('line', { x1: a, x2: b, y1: 14, y2: 14, stroke: '#5a6775', 'stroke-width': 0.7 }));
    if (b - a >= 26) {
      marks.push(svg('text', { x: (a + b) / 2, y: 11, 'text-anchor': 'middle', 'font-size': 10, fill: '#16202c' }, text));
    }
  };
  const edges = [];
  if (model.earthenM > 0) edges.push([formLeft, pavedLeft, m(model.earthenM)]);
  let x = pavedLeft;
  if (model.shoulderM > 0) {
    edges.push([x, x + model.shoulderM * px, m(model.shoulderM)]);
    x += model.shoulderM * px;
  }
  const cw = model.carriagewayM + 2 * model.widenedM;
  edges.push([x, x + cw * px, m(cw)]);
  x += cw * px;
  if (model.shoulderM > 0) {
    edges.push([x, x + model.shoulderM * px, m(model.shoulderM)]);
    x += model.shoulderM * px;
  }
  if (model.earthenM > 0) edges.push([x, formRight, m(model.earthenM)]);
  edges.forEach(([a, b, text]) => segment(a, b, text));

  const drawing = svg(
    'svg',
    {
      xmlns: SVG,
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      class: 'r-xsec',
      role: 'img',
      'aria-label': 'Pavement cross-section',
      'font-family': 'Arial, sans-serif',
    },
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }),
    shapes,
    marks
  );

  const swatch = (colour) => h('span', { class: 'r-swatch', style: { background: colour } }, '');
  const rows = [
    ...drawn.map((l) => [
      String(l.n),
      h('span', {}, swatch(l.fill), ` ${l.label}`),
      `${l.thicknessMm} mm`,
      l.extent === 'formation' ? m(model.formationM) : m(model.pavedM),
    ]),
    model.membrane ? ['', `Polythene sheet, ${model.membrane.micron} micron or more, between slab and DLC`, '—', m(model.membrane.widthM)] : null,
    model.shoulderLayer
      ? ['', h('span', {}, swatch(LAYER_COLOURS.granular), ' Shoulder, sub-base quality material'), `${model.shoulderLayer.thicknessMm} mm`, `2 × ${m(model.shoulderLayer.widthM)}`]
      : null,
    model.earthenM > 0 && !model.shoulderLayer ? ['', h('span', {}, swatch(SHOULDER_EARTH), ' Earthen shoulder'), '—', `2 × ${m(model.earthenM)}`] : null,
  ].filter(Boolean);

  return { drawing, rows };
}
