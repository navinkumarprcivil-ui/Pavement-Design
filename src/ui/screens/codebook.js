import { h, notice } from '../dom.js';
import { formatCitation, openSheet } from '../citations.js';
import { CODES, CONSTANT_GROUPS } from '../../data/ircConstants.js';

export default function renderCodebook(app) {
  const unverified = CONSTANT_GROUPS.filter((g) => g.entry.verified === false);

  const groupRow = (group) => {
    const { key, entry } = group;
    return h(
      'div',
      { class: 'step' },
      h(
        'div',
        { class: 'check-head' },
        h('strong', {}, key),
        h(
          'span',
          { class: `badge ${entry.verified ? 'pass' : 'info'}` },
          entry.verified ? 'Verified' : 'Check it'
        )
      ),
      entry.ref
        ? h('p', { class: 'muted', style: { margin: '4px 0 0' } }, formatCitation(entry.ref))
        : null,
      entry.note ? h('p', { class: 'muted', style: { margin: '4px 0 0' } }, entry.note) : null,
      h(
        'button',
        {
          class: 'citation',
          onclick: () => openConstantDetail(group),
        },
        'Show the values used'
      )
    );
  };

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'Code references'),
      h(
        'p',
        { class: 'screen-intro' },
        'Every number this app computes with, and the clause it comes from.'
      )
    ),

    notice(
      'info',
      'The codes themselves are not included',
      'IRC codes are copyrighted publications of the Indian Roads Congress. ' +
        'This app holds only the parameters needed to compute, together with ' +
        'the citation telling you where to read the clause in your own copy. ' +
        'No code text, tables or pages are reproduced.'
    ),

    unverified.length
      ? notice(
          'warn',
          `${unverified.length} groups still need checking`,
          'These values were entered from engineering references rather than ' +
            'read off a controlled copy of the code. Check each against your ' +
            'own copy before using a design for construction.'
        )
      : null,

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Codes used'),
      Object.values(CODES).map((code) =>
        h(
          'div',
          { class: 'step' },
          h('h4', {}, code.designation),
          h('p', { class: 'muted', style: { margin: 0 } }, code.title),
          h('p', { class: 'muted', style: { margin: 0 } }, `${code.edition} · ${code.publisher}`)
        )
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Constants and relations'),
      CONSTANT_GROUPS.map(groupRow)
    ),

    h('button', { class: 'button secondary', onclick: () => app.go('home') }, 'Back')
  );
}

function openConstantDetail({ key, entry }) {
  openSheet(
    key,
    entry.ref ? h('p', { class: 'muted', style: { marginTop: 0 } }, formatCitation(entry.ref)) : null,
    entry.note ? h('p', {}, entry.note) : null,
    h('div', { class: 'formula' }, describeValues(entry)),
    h(
      'div',
      { class: `notice ${entry.verified ? 'info' : 'warn'}`, style: { marginTop: '14px' } },
      entry.verified
        ? 'These values have been checked against a controlled copy of the code.'
        : 'Not yet checked against a controlled copy of the code. Confirm before use.'
    )
  );
}

/** Render the numeric content of a constant group for inspection. */
function describeValues(entry) {
  const skip = new Set(['ref', 'verified', 'note', 'options', 'rows']);
  const lines = [];

  if (entry.options) {
    for (const option of entry.options) {
      lines.push(`${option.label}: ${option.value}`);
    }
  }
  if (entry.rows) {
    for (const row of entry.rows) {
      const limit = row.maxCVPD === Infinity ? 'above' : `up to ${row.maxCVPD}`;
      lines.push(
        `${limit} CVPD — plain/rolling ${row.plainRolling}, hilly ${row.hilly}`
      );
    }
  }
  if (entry.byBinder) {
    lines.push(`Temperatures (°C): ${entry.temperaturesC.join(', ')}`);
    for (const [binder, values] of Object.entries(entry.byBinder)) {
      lines.push(`${binder}: ${values.join(', ')} MPa`);
    }
  }
  if (entry.coefficients) {
    for (const [reliability, value] of Object.entries(entry.coefficients)) {
      lines.push(`${reliability}% reliability: k = ${value}`);
    }
  }

  for (const [key, value] of Object.entries(entry)) {
    if (skip.has(key)) continue;
    if (value == null || typeof value === 'object') continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.length ? lines.join('\n') : 'No numeric values in this group.';
}
