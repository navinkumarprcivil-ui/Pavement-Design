import { h } from '../dom.js';
import { citationChip } from '../citations.js';
import {
  FLEXIBLE_DESIGN_STEPS,
  WORKED_EXAMPLE,
  RIGID_DESIGN_STEPS,
  RIGID_WORKED_EXAMPLE,
} from '../../data/designSteps.js';

const PROCEDURES = {
  flexible: { example: WORKED_EXAMPLE, steps: FLEXIBLE_DESIGN_STEPS },
  rigid: { example: RIGID_WORKED_EXAMPLE, steps: RIGID_DESIGN_STEPS },
};

/**
 * The design procedure, one step at a time.
 *
 * Steps are collapsed to their titles so the whole sequence is readable at a
 * glance, and one opens at a time — reading it is meant to feel like working
 * through it. The first is open on arrival so the screen is never just a list
 * of closed bars.
 */
export function designStepsScreen(kind) {
  const { example, steps } = PROCEDURES[kind];
  return (app) => renderDesignSteps(app, kind, example, steps);
}

function renderDesignSteps(app, kind, example, steps) {
  if (!app.openDesignStep) app.openDesignStep = {};
  if (!(kind in app.openDesignStep)) app.openDesignStep[kind] = 0;

  const step = (item, index) => {
    const open = app.openDesignStep[kind] === index;

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
            app.openDesignStep[kind] = open ? null : index;
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

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, example.title),
      h(
        'div',
        { class: 'given-list' },
        example.given.map(([label, value]) =>
          h(
            'div',
            { class: 'given-row' },
            h('span', { class: 'given-label' }, label),
            h('span', { class: 'given-value' }, value)
          )
        )
      ),
      citationChip({
        title: example.title,
        ref: example.source,
        verified: true,
      })
    ),

    h('div', { class: 'design-step-list' }, steps.map(step))
  );
}
