/**
 * Minimal DOM helpers and the app's shared controls. Deliberately tiny and
 * framework-free — the app is one page of vanilla ES modules so it runs from a
 * phone browser with no build step and no network.
 */

/**
 * h('div', {class: 'card', onclick: fn}, child, child...)
 * Children may be nodes, strings, arrays, or null (skipped).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') el.innerHTML = value;
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value);
  }

  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child))
    );
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** A titled card. */
export function card(title, ...children) {
  return h(
    'section',
    { class: 'card' },
    title ? h('h2', { class: 'section-title' }, title) : null,
    children
  );
}

/**
 * A labelled numeric input that reports every edit.
 * `aside` is a short value shown against the label, such as a minimum.
 */
export function numberField({ label, aside, value, suffix, min, max, step = 'any', onInput }) {
  const input = h('input', {
    type: 'number',
    inputmode: 'decimal',
    value: value ?? '',
    min,
    max,
    step,
    oninput: (event) => {
      const raw = event.target.value;
      onInput(raw === '' ? null : Number(raw), event.target);
    },
  });

  const control = suffix
    ? h('div', { class: 'input-suffix' }, input, h('span', {}, suffix))
    : input;

  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label, aside ? h('span', { class: 'field-aside' }, aside) : null),
    control
  );
}

export function textField({ label, value, onInput }) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h('input', { type: 'text', value: value ?? '', oninput: (e) => onInput(e.target.value) })
  );
}

export function selectField({ label, value, options, onChange }) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h(
      'select',
      { onchange: (event) => onChange(event.target.value) },
      options.map((opt) =>
        h('option', { value: opt.value, selected: opt.value === value }, opt.label)
      )
    )
  );
}

/** A row of mutually exclusive buttons, for short choices. */
export function segmented({ label, value, options, onChange }) {
  const group = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': label || null },
    options.map((opt) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'segment',
          'aria-checked': String(opt.value === value),
          onclick: () => {
            if (opt.value !== value) onChange(opt.value);
          },
        },
        opt.label
      )
    )
  );
  return label
    ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, label), group)
    : group;
}

/**
 * A collapsible section. Its open state is kept in `memory[key]` so it
 * survives the live re-renders around it.
 */
export function fold({ title, memory, key, children }) {
  const details = h(
    'details',
    { class: 'fold', open: Boolean(memory?.[key]) },
    h('summary', {}, title),
    h('div', { class: 'fold-body' }, children)
  );
  details.addEventListener('toggle', () => {
    if (memory) memory[key] = details.open;
  });
  return details;
}

export function metric(label, value, { tone } = {}) {
  return h(
    'div',
    { class: `metric${tone ? ` ${tone}` : ''}` },
    h('span', { class: 'metric-label' }, label),
    h('span', { class: 'metric-value' }, value)
  );
}

export function badge(kind, text) {
  return h('span', { class: `badge ${kind}` }, text);
}

export function notice(kind, title, body) {
  return h(
    'div',
    { class: `notice ${kind}` },
    title ? h('strong', {}, title) : null,
    body
  );
}

export function button(label, onclick, { kind = 'primary', disabled = false } = {}) {
  return h(
    'button',
    { type: 'button', class: `button ${kind}`, onclick, disabled },
    label
  );
}

/** Format a number of msa for display, or a plain count when it is small. */
export function msa(value) {
  if (!Number.isFinite(value)) return 'unlimited';
  if (value < 0.1) return `${Math.round(value * 1e6).toLocaleString('en-IN')} SA`;
  if (value >= 1000) return `${Math.round(value).toLocaleString('en-IN')} msa`;
  if (value >= 10) return `${value.toFixed(1)} msa`;
  return `${value.toFixed(2)} msa`;
}

/** Format a strain, dimensionless, in microstrain. */
export function micro(value) {
  return `${Math.round(value).toLocaleString('en-IN')} µε`;
}
