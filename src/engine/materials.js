/**
 * Layer moduli: turning the user's material choices and test values into the
 * elastic properties the structural analysis needs.
 */

import { MODULI } from '../data/ircConstants.js';
import { BEHAVIOUR } from '../data/layerCatalog.js';

/**
 * Subgrade resilient modulus from effective CBR.
 * MR = 10 x CBR for CBR <= 5, otherwise 17.6 x CBR^0.64.
 */
export function subgradeModulus(cbrPercent) {
  const mr =
    cbrPercent <= 5
      ? 10 * cbrPercent
      : 17.6 * Math.pow(cbrPercent, 0.64);
  return Math.min(mr, MODULI.subgrade.capMPa);
}

export function subgradeModulusStep(cbrPercent) {
  const mr = subgradeModulus(cbrPercent);
  const branch = cbrPercent <= 5 ? '10 x CBR' : '17.6 x CBR^0.64';
  return {
    id: 'subgrade-modulus',
    title: 'Subgrade resilient modulus',
    formula: `MR = ${branch}`,
    substitution: `MR = ${branch.replace(/CBR/g, cbrPercent.toString())}`,
    result: `MR = ${mr.toFixed(0)} MPa`,
    value: mr,
    ref: MODULI.subgrade.ref,
    verified: MODULI.subgrade.verified,
    note: MODULI.subgrade.note,
  };
}

/**
 * Modulus of a granular block resting on a support of known modulus.
 * MR(granular) = 0.2 x h^0.45 x MR(support).
 */
export function granularModulus(totalThicknessMm, supportModulusMPa) {
  const { coefficient, exponent } = MODULI.granular;
  return coefficient * Math.pow(totalThicknessMm, exponent) * supportModulusMPa;
}

/**
 * Indicative bituminous mix modulus, interpolated between the tabulated mean
 * annual pavement temperatures.
 */
export function bituminousModulus(binderGrade, temperatureC) {
  const { temperaturesC, byBinder } = MODULI.bituminous;
  const row = byBinder[binderGrade];
  if (!row) throw new Error(`Unknown binder grade: ${binderGrade}`);

  if (temperatureC <= temperaturesC[0]) return row[0];
  if (temperatureC >= temperaturesC[temperaturesC.length - 1]) {
    return row[row.length - 1];
  }
  for (let i = 0; i < temperaturesC.length - 1; i++) {
    const t0 = temperaturesC[i];
    const t1 = temperaturesC[i + 1];
    if (temperatureC >= t0 && temperatureC <= t1) {
      const f = (temperatureC - t0) / (t1 - t0);
      return row[i] + f * (row[i + 1] - row[i]);
    }
  }
  return row[row.length - 1];
}

function poissonFor(behaviour) {
  const nu = MODULI.poissonRatios;
  switch (behaviour) {
    case BEHAVIOUR.BITUMINOUS:
      return nu.bituminous;
    case BEHAVIOUR.CEMENTED:
      return nu.cemented;
    case BEHAVIOUR.SUBGRADE:
      return nu.subgrade;
    default:
      return nu.granular;
  }
}

/**
 * Build the elastic layer stack for analysis.
 *
 * Contiguous granular layers are treated as one block for the purpose of the
 * granular modulus equation — the equation is written in terms of the total
 * granular thickness over its support — and every layer in that block is given
 * the resulting modulus, which is how IRC:37 intends it to be applied.
 *
 * @param {Array<{slotId:string,label:string,behaviour:string,thicknessMm:number}>} slots
 *        Top to bottom, the subgrade last with no thickness.
 * @param {object} context
 * @param {number} context.subgradeCBR
 * @param {string} context.binderGrade
 * @param {number} context.pavementTemperatureC
 * @param {object} [context.overrides] slotId -> modulus in MPa, user supplied.
 */
export function buildLayerStack(slots, context) {
  const { subgradeCBR, binderGrade, pavementTemperatureC, overrides = {} } = context;
  const steps = [];

  const subgradeMR = overrides.SUBGRADE ?? subgradeModulus(subgradeCBR);
  steps.push(subgradeModulusStep(subgradeCBR));

  const layers = slots.map((slot) => ({
    ...slot,
    E: null,
    nu: poissonFor(slot.behaviour),
  }));

  // Subgrade sits last.
  layers[layers.length - 1].E = subgradeMR;

  // Work upward, so each layer's support modulus is already known.
  let index = layers.length - 2;
  while (index >= 0) {
    const layer = layers[index];

    if (overrides[layer.slotId] != null) {
      layer.E = overrides[layer.slotId];
      steps.push({
        id: `modulus-${layer.slotId}`,
        title: `${layer.label} modulus (user supplied)`,
        formula: 'Entered directly',
        substitution: '',
        result: `E = ${layer.E.toFixed(0)} MPa`,
        value: layer.E,
        ref: null,
        verified: true,
      });
      index -= 1;
      continue;
    }

    if (layer.behaviour === BEHAVIOUR.BITUMINOUS) {
      layer.E = bituminousModulus(binderGrade, pavementTemperatureC);
      steps.push({
        id: `modulus-${layer.slotId}`,
        title: `${layer.label} resilient modulus`,
        formula: 'Indicative value for the binder grade and pavement temperature',
        substitution: `${binderGrade} at ${pavementTemperatureC} deg C`,
        result: `E = ${layer.E.toFixed(0)} MPa`,
        value: layer.E,
        ref: MODULI.bituminous.ref,
        verified: MODULI.bituminous.verified,
      });
      index -= 1;
      continue;
    }

    if (layer.behaviour === BEHAVIOUR.CEMENTED) {
      const isBase = layer.slotId === 'BASE';
      layer.E = isBase
        ? MODULI.cemented.ctbModulusMPa
        : MODULI.cemented.ctsbModulusMPa;
      steps.push({
        id: `modulus-${layer.slotId}`,
        title: `${layer.label} modulus`,
        formula: 'Indicative value for a cement treated layer',
        substitution: MODULI.cemented.note,
        result: `E = ${layer.E.toFixed(0)} MPa`,
        value: layer.E,
        ref: MODULI.cemented.ref,
        verified: MODULI.cemented.verified,
      });
      index -= 1;
      continue;
    }

    // Granular: gather the contiguous granular block this layer belongs to.
    let blockTop = index;
    while (
      blockTop - 1 >= 0 &&
      layers[blockTop - 1].behaviour === BEHAVIOUR.GRANULAR
    ) {
      blockTop -= 1;
    }
    const block = layers.slice(blockTop, index + 1);
    const totalThickness = block.reduce((sum, l) => sum + l.thicknessMm, 0);
    const support = layers[index + 1].E;
    const modulus = granularModulus(totalThickness, support);

    for (const l of block) l.E = modulus;

    steps.push({
      id: `modulus-granular-${blockTop}`,
      title:
        block.length > 1
          ? `Granular layers (${block.map((l) => l.label).join(' + ')})`
          : `${layer.label} modulus`,
      formula: 'MR(granular) = 0.2 x h^0.45 x MR(support)',
      substitution:
        `MR = 0.2 x ${totalThickness.toFixed(0)}^0.45 x ${support.toFixed(0)}`,
      result: `MR = ${modulus.toFixed(0)} MPa`,
      value: modulus,
      ref: MODULI.granular.ref,
      verified: MODULI.granular.verified,
      warning:
        totalThickness < MODULI.granular.minThicknessMm ||
        totalThickness > MODULI.granular.maxThicknessMm
          ? `Total granular thickness of ${totalThickness.toFixed(0)} mm is outside ` +
            `the ${MODULI.granular.minThicknessMm}-${MODULI.granular.maxThicknessMm} mm ` +
            'range over which this relation is established.'
          : null,
    });

    index = blockTop - 1;
  }

  return { layers, steps };
}
