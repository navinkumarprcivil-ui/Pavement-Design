import { h, notice } from '../dom.js';
import { listTrials } from '../../store/trials.js';
import { unverifiedCount } from '../../data/ircConstants.js';

export default function renderHome(app) {
  const trials = listTrials();

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('h2', { class: 'screen-title' }, 'What are you designing?'),
      h(
        'p',
        { class: 'screen-intro' },
        'Pick the pavement type. For a flexible pavement the app decides from ' +
          'your traffic inputs whether it is designed to IRC:37 or as a low ' +
          'volume rural road to IRC:SP:72.'
      )
    ),

    h(
      'button',
      {
        class: 'choice-card',
        onclick: () => {
          app.state.pavementType = 'flexible';
          app.go('traffic');
        },
      },
      h('h3', {}, 'Flexible pavement (bituminous)'),
      h(
        'p',
        {},
        'Bituminous surfacing over a granular or cement treated base and ' +
          'sub-base. Designed by the mechanistic-empirical method of ' +
          'IRC:37-2018, or routed to IRC:SP:72-2015 for light traffic.'
      )
    ),

    h(
      'button',
      {
        class: 'choice-card',
        onclick: () => {
          app.state.pavementType = 'rigid';
          app.go('rigid');
        },
      },
      h('h3', {}, 'Rigid pavement (concrete)'),
      h(
        'p',
        {},
        'Plain jointed concrete slab on a sub-base. Westergaard slab stresses ' +
          'and warping stress are implemented; the IRC:58 fatigue damage ' +
          'procedure is not yet.'
      )
    ),

    h(
      'button',
      {
        class: 'choice-card',
        onclick: () => app.go('trials'),
      },
      h('h3', {}, `Saved trials${trials.length ? ` (${trials.length})` : ''}`),
      h(
        'p',
        {},
        trials.length
          ? 'Compare the sections you have designed and mark the one to build.'
          : 'Nothing saved yet. Designs you save will be listed here for comparison.'
      )
    ),

    notice(
      'warn',
      'Check the code constants before you rely on a result',
      `${unverifiedCount()} groups of IRC constants in this app were entered from ` +
        'engineering references rather than a controlled copy of the code. Every ' +
        'computed step carries the clause it came from — tap the reference on any ' +
        'step, or open Codes above, and confirm against your own copy.'
    ),

    notice(
      'info',
      'About the IRC codes',
      'IRC codes are copyrighted publications of the Indian Roads Congress and ' +
        'are not included in this app. The app cites the clause, table and ' +
        'equation for every step so you can read it in your own copy.'
    )
  );
}
