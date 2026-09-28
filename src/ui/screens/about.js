import { h, card } from '../dom.js';

const CODES = [
  ['IRC:37-2018', 'Flexible pavements'],
  ['IRC:SP:72-2015', 'Low volume rural roads'],
  ['IRC:58-2015', 'Rigid pavements'],
];

export default function renderAbout() {
  return h(
    'div',
    { class: 'card-stack' },
    h(
      'section',
      { class: 'card about-hero' },
      h(
        'span',
        { class: 'about-logo' },
        h('img', { src: 'assets/iitm-logo.png', alt: 'IIT Madras logo', width: 150, height: 148 })
      ),
      h('span', { class: 'about-role' }, 'Created by'),
      h('h2', { class: 'about-name' }, 'Navin Kumar P R'),
      h('p', {}, 'Transportation Engineering'),
      h('p', {}, 'M.Tech. in Civil Engineering, IIT Madras.')
    ),
    card(
      'IRC Pavement Design',
      h(
        'dl',
        { class: 'about-codes' },
        CODES.map(([code, scope]) => [h('dt', {}, code), h('dd', {}, scope)])
      )
    )
  );
}
