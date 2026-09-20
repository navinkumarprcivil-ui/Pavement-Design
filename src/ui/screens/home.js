import { h } from '../dom.js';

export default function renderHome(app) {
  const choice = (label, pavementType, screen) =>
    h(
      'button',
      {
        class: 'choice-card',
        onclick: () => {
          app.state.pavementType = pavementType;
          app.go(screen);
        },
      },
      h('h3', {}, label)
    );

  return h(
    'div',
    { class: 'card-stack' },
    h('h2', { class: 'screen-title' }, 'What are you designing?'),
    choice('Flexible Pavement Design', 'flexible', 'traffic'),
    choice('Rigid Pavement Design', 'rigid', 'rigid')
  );
}
