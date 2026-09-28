/**
 * The low volume road codes offered where the traffic is low enough: IRC:SP:72
 * beside IRC:37 for a flexible pavement, IRC:SP:62 beside IRC:58 for a rigid
 * one. Choosing one moves the design into that code's own steps.
 */

import { h, segmented } from './dom.js';

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.label
 * @param {string} o.current  The module the design is in now.
 * @param {{value: string, label: string}} o.regular
 * @param {{value: string, label: string}} o.low
 */
export function lowVolumeChoice(app, { label, current, regular, low }) {
  return h(
    'div',
    { class: 'low-volume-choice' },
    segmented({
      label,
      value: current,
      options: [low, regular],
      onChange: (value) => app.switchModule(value),
    })
  );
}
