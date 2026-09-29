import { h, button } from '../dom.js';
import { EXAMPLES } from '../examples.js';

/** The home page glyph each kind of design is drawn with. */
const GLYPH = { flexible: 'flexible', rigid: 'rigid', rural: 'rural', ruralRigid: 'rigid', overlay: 'overlay' };

export default function renderExamples(app) {
  return h(
    'div',
    { class: 'card-stack example-list' },
    EXAMPLES.map((example) =>
      h(
        'section',
        { class: 'card example-card' },
        h(
          'div',
          { class: 'example-head' },
          h('span', { class: `choice-glyph ${GLYPH[example.type]}`, 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
          h('div', { class: 'example-titles' }, h('h2', { class: 'section-title' }, example.title), h('span', { class: 'example-source' }, example.source))
        ),
        h('ul', { class: 'example-data' }, example.data.map((line) => h('li', {}, line))),
        h('div', { class: 'example-actions' }, button('Open the design', () => app.openExample(example)))
      )
    )
  );
}
