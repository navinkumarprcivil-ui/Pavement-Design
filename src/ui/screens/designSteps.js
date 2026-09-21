import { h } from '../dom.js';
import { citationChip } from '../citations.js';
import { FLEXIBLE_DESIGN_STEPS, WORKED_EXAMPLE } from '../../data/designSteps.js';

/**
 * The design procedure, one step at a time.
 *
 * Steps are collapsed to their titles so the whole sequence is readable at a
 * glance, and one opens at a time — reading it is meant to feel like working
 * through it. The first is open on arrival so the screen is never just a list
 * of closed bars.
 */
export default function renderDesignSteps(app) {
  if (app.state.openDesignStep == null) app.state.openDesignStep = 0;

  const step = (item, index) => {
    const open = app.state.openDesignStep === index;

    return h(
      'div',
      { class: `design-step${open ? ' open' : ''}` },
      h(
        'button',
        {
          class: 'design-step-head',
          type: 'button',
          'aria-expanded': String(open),
          onclick: () => {
            app.state.openDesignStep = open ? null : index;
            app.render();
          },
        },
        h('span', { class: 'design-step-number' }, String(index + 1)),
        h('span', { class: 'design-step-title' }, item.title),
        h('span', { class: 'design-step-chevron' }, open ? '−' : '+')
      ),

      open
        ? h(
            'div',
            { class: 'design-step-body' },
            h('p', {}, item.what),
            item.example
              ? h(
                  'div',
                  { class: 'design-step-example' },
                  h('span', { class: 'design-step-example-label' }, 'In the example'),
                  h('p', {}, item.example)
                )
              : null,
            citationChip({ title: item.title, ref: item.ref, verified: true })
          )
        : null
    );
  };

  return h(
    'div',
    { class: 'card-stack' },

    h('h2', { class: 'screen-title' }, 'Design steps'),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, WORKED_EXAMPLE.title),
      h(
        'div',
        { class: 'given-list' },
        WORKED_EXAMPLE.given.map(([label, value]) =>
          h(
            'div',
            { class: 'given-row' },
            h('span', { class: 'given-label' }, label),
            h('span', { class: 'given-value' }, value)
          )
        )
      ),
      citationChip({
        title: WORKED_EXAMPLE.title,
        ref: WORKED_EXAMPLE.source,
        verified: true,
      })
    ),

    h('div', { class: 'design-step-list' }, FLEXIBLE_DESIGN_STEPS.map(step))
  );
}
