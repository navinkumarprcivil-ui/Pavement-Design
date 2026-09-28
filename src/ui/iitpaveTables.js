/** An IITPAVE analysis drawn as the entries IITPAVE asks for, with a copy of them. */

import { h, button } from './dom.js';
import { caseText } from './iitpave.js';

export function stackTable(c) {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Layer'), h('th', {}, 'E, MPa'), h('th', {}, 'μ'), h('th', {}, 'h, mm'))),
      h(
        'tbody',
        {},
        c.layers.map((l) =>
          h(
            'tr',
            {},
            h('td', {}, l.label),
            h('td', { class: 'numeric' }, l.E.toFixed(1)),
            h('td', { class: 'numeric' }, l.nu.toFixed(2)),
            h('td', { class: 'numeric' }, l.h == null ? '∞' : String(l.h))
          )
        )
      )
    )
  );
}

export function loadTable(c) {
  const rows = [
    ['No. of layers', String(c.layers.length)],
    c.wheelLoadN != null ? ['Wheel load', `${Math.round(c.wheelLoadN).toLocaleString('en-IN')} N`] : null,
    ['Tyre pressure', `${c.tyrePressureMPa.toFixed(2)} MPa`],
    ['Wheel set', c.dualSpacingMm > 0 ? `Dual, ${c.dualSpacingMm} mm c/c` : 'Single'],
    ['Analysis points', c.points.map((p) => `z ${p.z.toFixed(0)}, r ${p.r.toFixed(0)}`).join(' · ')],
  ].filter(Boolean);
  return h(
    'div',
    { class: 'table-scroll' },
    h('table', { class: 'data kv' }, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))))
  );
}

export function copyButton(c) {
  const copy = button(
    'Copy inputs',
    async () => {
      try {
        await navigator.clipboard.writeText(caseText(c));
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Copy failed';
      }
      setTimeout(() => (copy.textContent = 'Copy inputs'), 1600);
    },
    { kind: 'ghost' }
  );
  return h('div', { class: 'card-actions' }, copy);
}

/** The entries in the order IITPAVE asks for them. */
export function entryGuide(c) {
  const items = [
    ['No. of layers', String(c.layers.length)],
    ['Elastic moduli', `${c.layers.map((l) => l.E.toFixed(1)).join(', ')} MPa`],
    ["Poisson's ratios", c.layers.map((l) => l.nu.toFixed(2)).join(', ')],
    ['Thicknesses', `${c.layers.filter((l) => l.h != null).map((l) => l.h).join(', ')} mm`],
    c.wheelLoadN != null ? ['Wheel load', `${Math.round(c.wheelLoadN)} N`] : null,
    ['Tyre pressure', `${c.tyrePressureMPa.toFixed(2)} MPa`],
    ['Analysis points', `${c.points.length}: ${c.points.map((p) => `z ${p.z.toFixed(0)}, r ${p.r.toFixed(0)} mm`).join(' · ')}`],
    ['Wheel set', c.dualSpacingMm > 0 ? `2, dual at ${c.dualSpacingMm} mm c/c` : '1, single'],
  ].filter(Boolean);
  return h(
    'ol',
    { class: 'entry-guide' },
    items.map(([k, v]) => h('li', {}, h('span', {}, k), h('strong', {}, v)))
  );
}
