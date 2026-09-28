import { h, button } from '../dom.js';
import { AXLES, axleMixCard, spectrumCard } from '../spectrum.js';

export default function renderRigidAxles(app) {
  const rigid = app.state.rigid;

  app.setActions(button('Continue to slab', () => app.go('rigidSlab')));

  return h(
    'div',
    { class: 'card-stack' },
    axleMixCard(app, rigid.traffic),
    AXLES.map((axle) => spectrumCard(app, rigid.spectrum, axle, 'rigid-paste'))
  );
}
