import { h } from '../dom.js';

export default function renderHome(app) {
  const choice = (label, pavementType, screen) =>
    h(
      'button',
      {
        type: 'button',
        class: 'choice-card',
        onclick: () => {
          app.state.pavementType = pavementType;
          app.persist();
          app.go(screen);
        },
      },
      h(
        'span',
        { class: `choice-glyph ${pavementType}`, 'aria-hidden': 'true' },
        h('span'),
        h('span'),
        h('span')
      ),
      h('span', { class: 'choice-label' }, label),
      h('span', { class: 'choice-chevron', 'aria-hidden': 'true' }, '›')
    );

  return h(
    'div',
    { class: 'card-stack' },
    h('h2', { class: 'screen-title' }, 'What are you designing?'),
    choice('Flexible Pavement Design', 'flexible', 'traffic'),
    choice('Rigid Pavement Design', 'rigid', 'rigidTraffic'),
    h(
      'button',
      { type: 'button', class: 'credit-line', onclick: () => app.open('about') },
      'Created by ',
      h('strong', {}, 'Navin Kumar P R')
    )
  );
}
