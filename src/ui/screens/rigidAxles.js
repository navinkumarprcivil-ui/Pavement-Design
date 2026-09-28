import { h, card, numberField, fold, button } from '../dom.js';
import { AXLES, frontAxlePercent, spectrumTotal, parseSpectrum } from '../rigidProject.js';
import { RIGID } from '../../data/ircConstants.js';

export default function renderRigidAxles(app) {
  const rigid = app.state.rigid;
  const mix = rigid.traffic.axleMix;

  app.setActions(button('Continue to slab', () => app.go('rigidSlab')));

  const frontHost = h('span', {});
  const showFront = () => frontHost.replaceChildren(`${frontAxlePercent(mix).toFixed(1)}%`);

  const mixField = (axle) =>
    numberField({
      label: axle.label,
      value: mix[axle.id],
      suffix: '%',
      min: 0,
      max: 100,
      onInput: (value) => {
        mix[axle.id] = value ?? 0;
        app.persist();
        showFront();
      },
    });

  const spectrumCard = (axle) => {
    const rows = rigid.spectrum[axle.id];
    const total = h('strong', {});
    const showTotal = () => {
      const sum = spectrumTotal(rows);
      total.textContent = `${sum.toFixed(1)}%`;
      total.className = Math.abs(sum - 100) <= 0.5 ? 'total-ok' : 'total-off';
    };

    const paste = h('textarea', { rows: 5, class: 'paste-area', 'aria-label': `${axle.label} spectrum` });

    const row = (entry, index) =>
      h(
        'div',
        { class: 'spectrum-row' },
        numberField({
          label: index === 0 ? 'Load, kN' : null,
          value: entry.loadKN,
          min: 0,
          onInput: (value) => {
            entry.loadKN = value;
            app.persist();
          },
        }),
        numberField({
          label: index === 0 ? 'Share, %' : null,
          value: entry.percent,
          min: 0,
          max: 100,
          onInput: (value) => {
            entry.percent = value;
            app.persist();
            showTotal();
          },
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'row-remove',
            'aria-label': 'Remove class',
            onclick: () => {
              rows.splice(index, 1);
              app.persist();
              app.render();
            },
          },
          '×'
        )
      );

    showTotal();

    return card(
      `${axle.label} axles`,
      h('div', { class: 'spectrum-rows' }, rows.map(row)),
      h('div', { class: 'spectrum-total' }, h('span', {}, 'Total'), total),
      h(
        'div',
        { class: 'spectrum-actions' },
        button(
          'Add class',
          () => {
            const width = RIGID.traffic.classWidthKN[axle.id];
            const lowest = rows.length ? Math.min(...rows.map((r) => r.loadKN || 0)) : width * 10;
            rows.push({ loadKN: Math.max(width, lowest - width), percent: null });
            app.persist();
            app.render();
          },
          { kind: 'ghost' }
        )
      ),
      fold({
        title: 'Paste from a spreadsheet',
        memory: app.folds,
        key: `rigid-paste-${axle.id}`,
        children: [
          paste,
          button(
            'Replace with pasted',
            () => {
              const parsed = parseSpectrum(paste.value);
              if (!parsed.length) return;
              rigid.spectrum[axle.id] = parsed;
              app.persist();
              app.render();
            },
            { kind: 'secondary' }
          ),
        ],
      })
    );
  };

  showFront();

  return h(
    'div',
    { class: 'card-stack' },
    card(
      'Axle mix, % of all axles',
      h('div', { class: 'field-row keep' }, mixField(AXLES[0]), mixField(AXLES[1])),
      h(
        'div',
        { class: 'field-row keep' },
        mixField(AXLES[2]),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Front'), h('div', { class: 'readout' }, frontHost))
      ),
      numberField({
        label: 'Axles per commercial vehicle',
        value: rigid.traffic.axlesPerVehicle,
        min: 1,
        onInput: (value) => {
          rigid.traffic.axlesPerVehicle = value;
          app.persist();
        },
      })
    ),
    AXLES.map(spectrumCard)
  );
}
