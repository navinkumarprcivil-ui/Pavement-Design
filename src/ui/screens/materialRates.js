import { h, card, numberField } from '../dom.js';
import {
  BITUMINOUS_OPTIONS,
  BASE_OPTIONS,
  CRACK_RELIEF_OPTIONS,
  SUB_BASE_OPTIONS,
} from '../../data/layerCatalog.js';
import { SUB_BASES } from '../rigidProject.js';

/** Every material a design can lay, keyed as the costing keys its rate. */
function materialGroups() {
  const unique = (items) => items.filter((m, i) => items.findIndex((n) => n.id === m.id) === i);
  const named = (option) => ({ id: option.short, label: `${option.label} (${option.short})` });
  return [
    {
      title: 'Bituminous',
      items: unique(BITUMINOUS_OPTIONS.flatMap((o) => o.courses).map((c) => ({ id: c.id, label: c.label }))),
    },
    {
      title: 'Base',
      items: [...BASE_OPTIONS, ...CRACK_RELIEF_OPTIONS.filter((o) => o.behaviour)].map(named),
    },
    {
      title: 'Sub-base',
      items: unique([
        ...SUB_BASE_OPTIONS.map(named),
        ...SUB_BASES.map((o) => ({ id: o.materialId, label: `${o.name} (${o.materialId})` })),
      ]),
    },
    { title: 'Concrete', items: [{ id: 'PQC', label: 'Pavement Quality Concrete (PQC)' }] },
    {
      title: 'Low volume roads',
      items: [
        { id: 'Surfacing', label: 'Bituminous surfacing' },
        { id: 'Base', label: 'Granular base' },
      ],
    },
  ];
}

export default function renderMaterialRates(app) {
  const field = ({ id, label }) =>
    numberField({
      label,
      value: app.state.rates[id] ?? '',
      suffix: '₹/m³',
      min: 0,
      onInput: (value) => {
        const rates = { ...app.state.rates };
        if (value == null) delete rates[id];
        else rates[id] = value;
        app.state.rates = rates;
        app.persist();
      },
    });

  return h(
    'div',
    { class: 'card-stack' },
    materialGroups().map((group) => card(group.title, group.items.map(field)))
  );
}
