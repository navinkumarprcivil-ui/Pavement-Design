import { h } from '../dom.js';
import { MODULES, MODULE_ORDER } from '../modules.js';

export default function renderHome(app) {
  const choice = (type) =>
    h(
      'button',
      { type: 'button', class: 'choice-card', onclick: () => app.startModule(type) },
      h('span', { class: `choice-glyph ${type}`, 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      h(
        'span',
        { class: 'choice-text' },
        h('span', { class: 'choice-label' }, MODULES[type].label),
        h('span', { class: 'choice-code' }, MODULES[type].code)
      ),
      h('span', { class: 'choice-chevron', 'aria-hidden': 'true' }, '›')
    );

  return h(
    'div',
    { class: 'card-stack' },
    h('div', { class: 'choice-grid' }, MODULE_ORDER.map(choice)),
    h(
      'button',
      { type: 'button', class: 'credit-line', onclick: () => app.open('about') },
      'Created by ',
      h('strong', {}, 'Navin Kumar P R')
    )
  );
}
