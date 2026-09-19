/**
 * Minimal DOM helpers. Deliberately tiny and framework-free — the app is one
 * page of vanilla ES modules so it runs from a phone browser with no build
 * step and no network.
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

/** A labelled numeric input that writes back into `target[key]`. */
export function numberField({
  label,
  hint,
  value,
  suffix,
  min,
  max,
  step = 'any',
  onInput,
}) {
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
    'div',
    { class: 'field' },
    h('label', {}, label),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null
  );
}

export function selectField({ label, hint, value, options, onChange }) {
  const select = h(
    'select',
    {
      onchange: (event) => onChange(event.target.value),
    },
    options.map((opt) =>
      h(
        'option',
        { value: opt.value, selected: opt.value === value },
        opt.label
      )
    )
  );

  return h(
    'div',
    { class: 'field' },
    h('label', {}, label),
    select,
    hint ? h('span', { class: 'hint' }, hint) : null
  );
}

/** A radio group rendered as tappable cards. */
export function optionGroup({ name, value, options, onChange }) {
  return h(
    'div',
    { class: 'option-group' },
    options.map((opt) => {
      const selected = opt.id === value;
      const radio = h('input', {
        type: 'radio',
        name,
        value: opt.id,
        checked: selected,
        onchange: () => onChange(opt.id),
      });
      return h(
        'label',
        { class: 'option', 'data-selected': String(selected) },
        radio,
        h(
          'div',
          { class: 'option-body' },
          h('strong', {}, opt.label),
          opt.description ? h('span', {}, opt.description) : null
        )
      );
    })
  );
}

export function notice(kind, title, body) {
  return h(
    'div',
    { class: `notice ${kind}` },
    title ? h('strong', {}, title) : null,
    body
  );
}

/** Format a number of msa for display. */
export function msa(value) {
  if (!Number.isFinite(value)) return 'unlimited';
  if (value >= 1000) return `${Math.round(value).toLocaleString('en-IN')} msa`;
  if (value >= 10) return `${value.toFixed(1)} msa`;
  return `${value.toFixed(2)} msa`;
}
