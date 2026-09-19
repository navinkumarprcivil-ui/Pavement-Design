/**
 * Citation chips and the code reference sheet.
 *
 * Tapping the citation on any computed step opens a sheet naming the code,
 * clause, table and equation the step came from, with the formula, the numbers
 * substituted into it, and the result — so you can open your own copy of the
 * code at that clause and check the step.
 *
 * The app never reproduces code text, tables or pages. It tells you where to
 * look.
 */

import { h, clear } from './dom.js';
import { CODES } from '../data/ircConstants.js';

let sheetHost = null;

function ensureHost() {
  if (!sheetHost) {
    sheetHost = document.createElement('div');
    document.body.appendChild(sheetHost);
  }
  return sheetHost;
}

export function closeSheet() {
  if (sheetHost) clear(sheetHost);
}

export function openSheet(title, ...content) {
  const host = clear(ensureHost());
  const backdrop = h(
    'div',
    {
      class: 'sheet-backdrop',
      onclick: (event) => {
        if (event.target === backdrop) closeSheet();
      },
    },
    h(
      'div',
      { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'sheet-handle' }),
      h('h3', {}, title),
      content,
      h(
        'button',
        { class: 'button secondary', style: { marginTop: '16px' }, onclick: closeSheet },
        'Close'
      )
    )
  );
  host.appendChild(backdrop);
}

export function formatCitation(ref) {
  if (!ref) return 'No citation';
  return [ref.code, ref.clause, ref.table, ref.equation]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The citation chip shown under a computed step.
 * @param {object} step  A step object carrying {ref, formula, substitution, result}
 */
export function citationChip(step) {
  if (!step?.ref) return null;
  return h(
    'button',
    {
      class: 'citation',
      type: 'button',
      onclick: () => openCitation(step),
    },
    'Code reference: ',
    formatCitation(step.ref)
  );
}

export function openCitation(step) {
  const ref = step.ref;
  const code = CODES[ref.codeId];

  openSheet(
    formatCitation(ref),
    h('p', { class: 'muted', style: { marginTop: 0 } }, code ? code.title : ''),

    h('h4', { style: { marginBottom: '4px' } }, 'What this step computes'),
    h('p', { style: { marginTop: 0 } }, step.title || ''),

    step.formula
      ? [
          h('h4', { style: { marginBottom: '4px' } }, 'Relation used'),
          h('div', { class: 'formula' }, step.formula),
        ]
      : null,

    step.substitution
      ? [
          h('h4', { style: { marginBottom: '4px' } }, 'Values substituted'),
          h('div', { class: 'formula' }, step.substitution),
        ]
      : null,

    step.result
      ? [
          h('h4', { style: { marginBottom: '4px' } }, 'Result'),
          h('div', { class: 'formula' }, step.result),
        ]
      : null,

    ref.note ? h('p', { class: 'muted' }, ref.note) : null,
    step.note ? h('p', { class: 'muted' }, step.note) : null,

    h(
      'div',
      { class: `notice ${step.verified === false ? 'warn' : 'info'}`, style: { marginTop: '14px' } },
      step.verified === false
        ? h(
            'span',
            {},
            h('strong', {}, 'Check this against your copy of the code'),
            `Open ${ref.code} at ${[ref.clause, ref.table, ref.equation]
              .filter(Boolean)
              .join(', ')} and confirm the values used here. They were entered ` +
              'from engineering references, not read off a controlled copy of the code.'
          )
        : h(
            'span',
            {},
            h('strong', {}, 'Where to read this'),
            `Open ${ref.code} at ${[ref.clause, ref.table, ref.equation]
              .filter(Boolean)
              .join(', ')}.`
          )
    )
  );
}

/** Render a computed step with its working and citation. */
export function stepCard(step) {
  return h(
    'div',
    { class: 'step' },
    h('h4', {}, step.title),
    step.formula ? h('div', { class: 'formula' }, step.formula) : null,
    step.substitution ? h('div', { class: 'formula' }, step.substitution) : null,
    step.result ? h('div', { class: 'step-result' }, step.result) : null,
    step.warning
      ? h('div', { class: 'notice warn', style: { marginTop: '8px' } }, step.warning)
      : null,
    citationChip(step)
  );
}
