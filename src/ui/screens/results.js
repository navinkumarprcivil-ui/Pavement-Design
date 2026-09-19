import { h, notice, msa } from '../dom.js';
import { stepCard, citationChip } from '../citations.js';
import { sectionDiagram } from './layers.js';
import { combinationName } from '../../data/layerCatalog.js';
import { saveTrial } from '../../store/trials.js';

/** Poisson's ratios, grouped so identical values are stated once. */
function poissonSummary(layers) {
  const byValue = new Map();
  for (const layer of layers) {
    const key = layer.nu.toFixed(2);
    if (!byValue.has(key)) byValue.set(key, []);
    byValue.get(key).push(layer.label.replace(/\s*\(.*\)\s*/, ''));
  }
  if (byValue.size === 1) {
    return `Poisson's ratio: ${[...byValue.keys()][0]} for every layer.`;
  }
  const parts = [...byValue.entries()].map(
    ([value, labels]) => `${value} for ${labels.join(', ')}`
  );
  return `Poisson's ratio: ${parts.join('; ')}.`;
}

function checkCard(check) {
  const provisional = check.provisional === true;
  return h(
    'div',
    { class: 'check', 'data-safe': String(provisional ? true : check.safe) },
    h(
      'div',
      { class: 'check-head' },
      h('strong', {}, check.title),
      h(
        'span',
        { class: `badge ${provisional ? 'info' : check.safe ? 'pass' : 'fail'}` },
        provisional ? 'Provisional' : check.safe ? 'Safe' : 'Unsafe'
      )
    ),
    h(
      'div',
      { class: 'metric-grid' },
      h(
        'div',
        { class: 'metric' },
        h('span', { class: 'metric-label' }, check.strainLabel),
        h('span', { class: 'metric-value' }, `${check.strainMicro.toFixed(1)} µε`)
      ),
      h(
        'div',
        { class: 'metric' },
        h('span', { class: 'metric-label' }, 'Allowable traffic'),
        h('span', { class: 'metric-value' }, msa(check.allowableMsa))
      )
    ),
    check.formula ? h('div', { class: 'formula' }, check.formula) : null,
    check.substitution ? h('div', { class: 'formula' }, check.substitution) : null,
    h(
      'div',
      { class: 'step-result' },
      provisional
        ? 'Reported for information; this criterion is not yet verified.'
        : check.safe
          ? `Allowable ${msa(check.allowableMsa)} is at or above the design traffic of ${msa(check.demandMsa)}.`
          : `Allowable ${msa(check.allowableMsa)} is below the design traffic of ${msa(check.demandMsa)}.`
    ),
    citationChip(check)
  );
}

export default function renderResults(app) {
  const result = app.state.result;
  if (!result) {
    return h(
      'div',
      { class: 'empty-state' },
      'No design has been run yet.',
      h('div', { style: { height: '12px' } }),
      h('button', { class: 'button', onclick: () => app.go('inputs') }, 'Go to inputs')
    );
  }

  const { combination, trafficResult } = app.state;

  const save = () => {
    saveTrial({
      name: combinationName(combination),
      combination: { ...combination },
      thicknesses: { ...app.state.thicknesses },
      materials: { ...app.state.materials },
      mix: { ...app.state.mix },
      designTrafficMsa: result.designTrafficMsa,
      totalThicknessMm: result.totalThicknessMm,
      governingLifeMsa: result.governingLifeMsa,
      safe: result.safe,
      reliability: result.reliability,
      slots: result.slots.map((s) => ({
        slotId: s.slotId,
        label: s.label,
        thicknessMm: s.thicknessMm,
        behaviour: s.behaviour,
      })),
      projectName: app.state.project.name,
    });
    app.go('rates');
  };

  return h(
    'div',
    { class: 'card-stack' },

    h(
      'div',
      {},
      h('span', { class: 'step-label' }, 'Step 4 of 4'),
      h('h2', { class: 'screen-title' }, 'Design result')
    ),

    h(
      'div',
      { class: `verdict ${result.safe ? 'safe' : 'unsafe'}` },
      h('h3', {}, result.safe ? 'Section is safe' : 'Section is not safe'),
      h(
        'p',
        { style: { margin: 0 } },
        result.safe
          ? `This section carries ${msa(result.governingLifeMsa)} against a design ` +
            `traffic of ${msa(result.designTrafficMsa)}, at ${result.reliability}% reliability.`
          : `This section carries only ${msa(result.governingLifeMsa)} against a design ` +
            `traffic of ${msa(result.designTrafficMsa)}. Thicken the section or ` +
            'improve the materials, then check it again.'
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Section'),
      sectionDiagram(result.slots),
      h(
        'div',
        { class: 'metric-grid', style: { marginTop: '12px' } },
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Total thickness'),
          h('span', { class: 'metric-value' }, `${result.totalThicknessMm} mm`)
        ),
        h(
          'div',
          { class: 'metric' },
          h('span', { class: 'metric-label' }, 'Governing life'),
          h('span', { class: 'metric-value' }, msa(result.governingLifeMsa))
        )
      )
    ),

    result.thicknessWarnings.length
      ? notice(
          'warn',
          'Check against the minimum thickness requirements',
          h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } },
            result.thicknessWarnings.map((w) => h('li', {}, w))
          )
        )
      : null,

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Performance checks'),
      result.checks.map(checkCard)
    ),

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Layer moduli'),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Layer'),
              h('th', {}, 'Thickness'),
              h('th', {}, 'E (MPa)')
            )
          ),
          h(
            'tbody',
            {},
            result.layers.map((layer) =>
              h(
                'tr',
                {},
                h('td', {}, layer.label),
                h(
                  'td',
                  { class: 'numeric' },
                  layer.behaviour === 'subgrade' ? '—' : `${layer.thicknessMm} mm`
                ),
                h('td', { class: 'numeric' }, layer.E.toFixed(0))
              )
            )
          )
        )
      ),
      h('p', { class: 'muted' }, poissonSummary(result.layers)),
      result.modulusSteps.map(stepCard)
    ),

    trafficResult
      ? h(
          'div',
          { class: 'card' },
          h('h2', { class: 'section-title' }, 'Design traffic working'),
          trafficResult.steps.map(stepCard)
        )
      : null,

    h(
      'div',
      { class: 'card' },
      h('h2', { class: 'section-title' }, 'Computed strains'),
      h('p', { class: 'muted', style: { marginTop: 0 } },
        'From an exact layered elastic analysis under the IRC standard axle: ' +
          '20 kN per wheel at 0.56 MPa, dual wheels at 310 mm centres. ' +
          'Responses are taken under one wheel and between the pair, and the ' +
          'worse of the two governs.'
      ),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'data' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', {}, 'Point'),
              h('th', {}, 'Horiz. µε'),
              h('th', {}, 'Vert. µε')
            )
          ),
          h(
            'tbody',
            {},
            result.responses.map((r) =>
              h(
                'tr',
                {},
                h(
                  'td',
                  {},
                  `${r.x === 0 ? 'Under a wheel' : 'Between wheels'} at ${r.z.toFixed(0)} mm`
                ),
                h('td', { class: 'numeric' }, (r.maxHorizontalStrain * 1e6).toFixed(1)),
                h('td', { class: 'numeric' }, (-r.epsZZ * 1e6).toFixed(1))
              )
            )
          )
        )
      )
    ),

    h(
      'div',
      { class: 'button-row' },
      h(
        'button',
        { class: 'button secondary', onclick: () => app.go('inputs') },
        'Change and retry'
      ),
      h('button', { class: 'button', onclick: save }, 'Save trial and add rates')
    )
  );
}
