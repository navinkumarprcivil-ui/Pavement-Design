/**
 * A grid of numeric inputs, one row a test point: what a deflection survey
 * is entered in. Rows can be added, removed, or pasted from a spreadsheet.
 */

import { h, button, fold } from './dom.js';

/**
 * @param {object} app
 * @param {object} options
 * @param {Array<{label:string, get:(row)=>number|null, set:(row, value)=>void}>} options.columns
 * @param {Array<object>} options.rows       Edited in place.
 * @param {() => object} options.blank       A new empty row.
 * @param {(numbers:number[]) => object|null} options.fromLine  A row from one pasted line.
 * @param {string} options.key               Distinguishes this grid's paste fold.
 * @param {() => void} options.onChange      After any edit that does not redraw.
 * @param {boolean} [options.fixed]          Rows stand for points entered elsewhere: none added or removed,
 *                                           and a paste fills them in order.
 * @param {(index:number) => string} [options.rowLabel]
 */
export function dataGrid(app, { columns, rows, blank, fromLine, key, onChange, fixed = false, rowLabel = (i) => String(i + 1) }) {
  const cell = (row, index, column) =>
    h(
      'td',
      {},
      h('input', {
        type: 'number',
        inputmode: 'decimal',
        step: 'any',
        value: column.get(row) ?? '',
        'aria-label': `${column.label}, point ${rowLabel(index)}`,
        oninput: (event) => {
          const raw = event.target.value;
          column.set(row, raw === '' ? null : Number(raw));
          app.persist();
          onChange();
        },
      })
    );

  const paste = h('textarea', { rows: 5, class: 'paste-area', 'aria-label': 'Rows to paste' });

  return h(
    'div',
    { class: 'data-grid-block' },
    h(
      'div',
      { class: 'data-grid-wrap' },
      h(
        'table',
        { class: 'data-grid' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '#'), columns.map((c) => h('th', { scope: 'col' }, c.label)))),
        h(
          'tbody',
          {},
          rows.map((row, index) => h('tr', {}, h('th', { scope: 'row' }, rowLabel(index)), columns.map((c) => cell(row, index, c))))
        )
      )
    ),
    fixed
      ? null
      : h(
      'div',
      { class: 'spectrum-actions grid-actions' },
      rows.length > 1
        ? button(
            'Remove last',
            () => {
              rows.pop();
              app.persist();
              app.render();
            },
            { kind: 'ghost' }
          )
        : null,
      button(
        'Add point',
        () => {
          rows.push(blank());
          app.persist();
          app.render();
        },
        { kind: 'ghost' }
      )
    ),
    fold({
      title: 'Paste from a spreadsheet',
      memory: app.folds,
      key: `${key}-paste`,
      children: [
        paste,
        button(
          'Replace with pasted',
          () => {
            const parsed = paste.value
              .split(/\r?\n/)
              .map((line) => (line.match(/-?\d+(?:\.\d+)?/g) || []).map(Number))
              .filter((nums) => nums.length)
              .map(fromLine)
              .filter(Boolean);
            if (!parsed.length) return;
            if (fixed) parsed.slice(0, rows.length).forEach((values, i) => Object.assign(rows[i], values));
            else rows.splice(0, rows.length, ...parsed);
            app.persist();
            app.render();
          },
          { kind: 'secondary' }
        ),
      ],
    })
  );
}
