/**
 * Layer moduli: turning the user's material choices and test values into the
 * elastic properties the structural analysis needs.
 */

import { MODULI } from '../data/ircConstants.js';
import { BEHAVIOUR } from '../data/layerCatalog.js';
import { analyze, contactRadius } from './elastic.js';

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

/** The CBR that gives a modulus, by the same relation run backwards. */
export function cbrForModulus(mr) {
  return mr <= 50 ? mr / 10 : Math.pow(mr / 17.6, 1 / 0.64);
}

/**
 * Effective subgrade modulus of a select borrow layer over the embankment:
 * the single layer that deflects as much at the surface under one wheel.
 *
 * @param {object} input
 * @param {number} input.borrowCBR  Select borrow (subgrade) CBR.
 * @param {number} input.embankmentCBR
 * @param {number} [input.borrowMm]  Thickness of the borrow layer.
 * @param {number} [input.iitpaveDeflectionMm]  Read from IITPAVE for the same
 *        system; the app's own analysis stands in until it is entered.
 */
export function effectiveSubgrade({ borrowCBR, embankmentCBR, borrowMm, lowerCBR, lowerMm, iitpaveDeflectionMm }) {
  const spec = MODULI.effectiveSubgrade;
  const thickness = borrowMm || spec.subgradeThicknessMm;
  const raw = (cbr) => (cbr <= 5 ? 10 * cbr : 17.6 * Math.pow(cbr, 0.64));
  const upper = raw(borrowCBR);
  const lower = raw(embankmentCBR);
  // The 500 mm subgrade may be laid as two sub-layers of different CBR (Cl. 6.4.1 (i)).
  const twoSubLayers = lowerCBR > 0 && lowerMm > 0;
  const middle = twoSubLayers ? raw(lowerCBR) : null;
  const nu = spec.poissonRatio;
  const a = contactRadius(spec.wheelLoadN, spec.tyrePressureMPa);
  const [surface] = analyze({
    layers: [
      { h: thickness, E: upper, nu },
      ...(twoSubLayers ? [{ h: lowerMm, E: middle, nu }] : []),
      { h: 0, E: lower, nu },
    ],
    load: { wheelLoadN: spec.wheelLoadN, tyrePressureMPa: spec.tyrePressureMPa },
    points: [{ x: 0, y: 0, z: 0, layerIndex: 0 }],
  });
  const computed = surface.surfaceDeflectionMm;
  const fromIitpave = iitpaveDeflectionMm > 0;
  const deflection = fromIitpave ? iitpaveDeflectionMm : computed;
  const equivalent = (2 * (1 - nu * nu) * spec.tyrePressureMPa * a) / deflection;
  // A stronger foundation below, rock above all, lends the subgrade nothing: only its own CBR is adopted.
  const ownMR = Math.max(upper, middle ?? 0);
  const borrowGoverns = equivalent > ownMR;
  const value = Math.min(borrowGoverns ? ownMR : equivalent, MODULI.subgrade.capMPa);
  const cbr = cbrForModulus(value);

  return {
    value,
    equivalent,
    borrowGoverns,
    deflection,
    computed,
    fromIitpave,
    cbr,
    borrowMR: upper,
    lowerMR: middle,
    twoSubLayers,
    embankmentMR: lower,
    steps: [
      {
        id: 'layer-moduli',
        title: 'Moduli of the select borrow and the embankment',
        formula: 'MR = 10 x CBR (CBR <= 5), 17.6 x CBR^0.64 (CBR > 5)',
        substitution: `Borrow: CBR ${borrowCBR}%;${twoSubLayers ? `  lower sub-layer: CBR ${lowerCBR}%;` : ''}  embankment: CBR ${embankmentCBR}%`,
        result: `${upper.toFixed(1)}${twoSubLayers ? ` and ${middle.toFixed(1)}` : ''} MPa over ${lower.toFixed(1)} MPa`,
        ref: MODULI.subgrade.ref,
        verified: MODULI.subgrade.verified,
      },
      {
        id: 'surface-deflection',
        title: `Surface deflection of the ${twoSubLayers ? 'three' : 'two'}-layer system`,
        formula: `Single wheel of ${spec.wheelLoadN} N at ${spec.tyrePressureMPa} MPa, μ = ${nu}` + (fromIitpave ? '; from IITPAVE' : ''),
        substitution:
          `${thickness} mm of ${upper.toFixed(1)} MPa${twoSubLayers ? ` and ${lowerMm} mm of ${middle.toFixed(1)} MPa` : ''} on ${lower.toFixed(1)} MPa, a = ${a.toFixed(1)} mm` +
          (fromIitpave ? `; this app ${computed.toFixed(3)} mm` : ''),
        result: `δ = ${deflection.toFixed(3)} mm`,
        ref: spec.ref,
        verified: spec.verified,
      },
      {
        id: 'effective-modulus',
        title: 'Effective subgrade modulus',
        formula: `MRS = 2 (1 - μ^2) p a / δ, not more than the borrow's own nor ${MODULI.subgrade.capMPa} MPa`,
        substitution:
          `MRS = 2 x (1 - ${nu}^2) x ${spec.tyrePressureMPa} x ${a.toFixed(1)} / ${deflection.toFixed(3)} = ${equivalent.toFixed(1)}` +
          (borrowGoverns ? `; the subgrade's own ${ownMR.toFixed(1)} MPa governs` : ''),
        result: `MRS = ${value.toFixed(1)} MPa, effective CBR ${cbr.toFixed(1)}%`,
        value,
        ref: spec.ref,
        verified: spec.verified,
      },
    ],
  };
}

export function subgradeModulusStep(cbrPercent) {
  const mr = subgradeModulus(cbrPercent);
  const branch = cbrPercent <= 5 ? '10 x CBR' : '17.6 x CBR^0.64';
  const capped = mr === MODULI.subgrade.capMPa;
  return {
    id: 'subgrade-modulus',
    title: 'Subgrade resilient modulus',
    formula: `MR = ${branch}, not more than ${MODULI.subgrade.capMPa} MPa`,
    substitution: `MR = ${branch.replace(/CBR/g, cbrPercent.toString())}`,
    result: `MR = ${mr.toFixed(0)} MPa${capped ? ' (capped)' : ''}`,
    value: mr,
    ref: MODULI.subgrade.ref,
    verified: MODULI.subgrade.verified,
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
 * Indicative bituminous mix modulus, interpolated between the tabulated average
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

/** A fixed-value modulus step, for the layers the code gives a single value. */
function fixedModulusStep(layer, title, source) {
  return {
    id: `modulus-${layer.slotId}`,
    title,
    formula: 'Design value',
    substitution: '',
    result: `E = ${layer.E.toFixed(0)} MPa`,
    value: layer.E,
    ref: source.ref,
    verified: source.verified,
  };
}

/**
 * Build the elastic layer stack for analysis.
 *
 * Contiguous granular layers are treated as one block for the purpose of the
 * granular modulus equation — the equation is written in terms of the total
 * granular thickness over its support — and every layer in that block is given
 * the resulting modulus, which is how IRC:37 intends it to be applied.
 *
 * Two granular layers take a fixed value instead: the aggregate crack relief
 * layer sandwiched over a cement treated base, and a granular base resting on
 * a cement treated sub-base.
 *
 * @param {Array<{slotId:string,label:string,behaviour:string,thicknessMm:number}>} slots
 *        Top to bottom, the subgrade last with no thickness.
 * @param {object} context
 * @param {number} context.subgradeCBR
 * @param {string} context.binderGrade
 * @param {number} context.pavementTemperatureC
 * @param {object} [context.overrides] slotId -> modulus in MPa, user supplied.
 * @param {number} [context.bituminousModulusMPa]  Mix modulus from the mix
 *        design, in place of the table value.
 * @param {object} [context.layeredSubgrade]  {borrowCBR, embankmentCBR,
 *        borrowMm}: a select borrow subgrade over the embankment.
 */
/**
 * The design subgrade modulus: entered, the effective modulus of a select
 * borrow over the embankment, or from the CBR.
 */
export function subgradeFor(context) {
  const layered = context.layeredSubgrade;
  if (context.overrides?.SUBGRADE != null) return { value: context.overrides.SUBGRADE, steps: [] };
  if (layered?.borrowCBR > 0 && layered?.embankmentCBR > 0) {
    const effective = effectiveSubgrade(layered);
    return { value: effective.value, steps: effective.steps };
  }
  return { value: subgradeModulus(context.subgradeCBR), steps: [subgradeModulusStep(context.subgradeCBR)] };
}

/** Design modulus of the bottom bituminous mix from Table 9.2: DBM (or BC) by temperature, BM at 35 °C. */
export function bottomMixModulus(courseId, binderGrade, temperatureC) {
  if (courseId === 'BM') {
    return MODULI.bituminousMacadam.byBinder[binderGrade] ?? MODULI.bituminousMacadam.byBinder.VG30;
  }
  return bituminousModulus(binderGrade, temperatureC);
}

export function buildLayerStack(slots, context) {
  const { binderGrade, pavementTemperatureC, overrides = {} } = context;
  const steps = [];

  const subgrade = subgradeFor(context);
  const subgradeMR = subgrade.value;
  steps.push(...subgrade.steps);

  // The whole bituminous layer takes the modulus of its bottom mix (Cl. 9.2).
  const bottom = [...slots].reverse().find((s) => s.behaviour === BEHAVIOUR.BITUMINOUS);
  const bm = bottom?.slotId === 'BM';
  const tableModulus = bottomMixModulus(bottom?.slotId, binderGrade, pavementTemperatureC);
  const tableSource = bm ? MODULI.bituminousMacadam : MODULI.bituminous;
  const tableLabel = bm ? `BM with ${binderGrade} at 35 deg C` : `${binderGrade} at ${pavementTemperatureC} deg C`;

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

    if (layer.behaviour === BEHAVIOUR.BITUMINOUS && context.bituminousModulusMPa > 0) {
      // The design value is the smaller of the mix design's and the table's (Cl. 9.2).
      layer.E = Math.min(context.bituminousModulusMPa, tableModulus);
      steps.push({
        id: `modulus-${layer.slotId}`,
        title: `${layer.label} resilient modulus`,
        formula: 'Smaller of the mix design value and the table value',
        substitution: `min(${context.bituminousModulusMPa}, ${tableModulus.toFixed(0)} for ${tableLabel})`,
        result: `E = ${layer.E.toFixed(0)} MPa`,
        value: layer.E,
        ref: tableSource.ref,
        verified: tableSource.verified,
      });
      index -= 1;
      continue;
    }

    if (layer.behaviour === BEHAVIOUR.BITUMINOUS) {
      layer.E = tableModulus;
      steps.push({
        id: `modulus-${layer.slotId}`,
        title: `${layer.label} resilient modulus`,
        formula: bm ? 'Table value for bituminous macadam and its binder' : 'Table value for the binder grade and pavement temperature',
        substitution: tableLabel,
        result: `E = ${layer.E.toFixed(0)} MPa`,
        value: layer.E,
        ref: tableSource.ref,
        verified: tableSource.verified,
      });
      index -= 1;
      continue;
    }

    if (layer.behaviour === BEHAVIOUR.CEMENTED) {
      const isBase = layer.slotId === 'BASE';
      const low = !isBase && context.ctsbStrength === 'low';
      layer.E = isBase
        ? MODULI.cemented.ctbModulusMPa
        : low
          ? MODULI.lowStrengthCTSB.modulusMPa
          : MODULI.cemented.ctsbModulusMPa;
      steps.push(
        fixedModulusStep(
          layer,
          low ? `${layer.label} modulus, 7-day UCS 0.75 - 1.5 MPa` : `${layer.label} modulus`,
          low ? MODULI.lowStrengthCTSB : MODULI.cemented
        )
      );
      index -= 1;
      continue;
    }

    if (layer.behaviour === BEHAVIOUR.TREATED) {
      layer.E = MODULI.rapBase.modulusMPa;
      steps.push(fixedModulusStep(layer, `${layer.label} modulus`, MODULI.rapBase));
      index -= 1;
      continue;
    }

    if (layer.slotId === 'CRACK_RELIEF') {
      layer.E = MODULI.crackReliefAggregate.modulusMPa;
      steps.push(fixedModulusStep(layer, `${layer.label} modulus`, MODULI.crackReliefAggregate));
      index -= 1;
      continue;
    }

    const below = layers[index + 1];
    if (below.behaviour === BEHAVIOUR.CEMENTED && below.slotId === 'SUB_BASE') {
      const gravel = context.granularOverCtsb === 'gravel';
      layer.E = gravel ? MODULI.granularOverCTSB.naturalGravelMPa : MODULI.granularOverCTSB.crushedRockMPa;
      steps.push(
        fixedModulusStep(
          layer,
          `${layer.label} on a cement treated sub-base, ${gravel ? 'natural gravel' : 'crushed rock'}`,
          MODULI.granularOverCTSB
        )
      );
      index -= 1;
      continue;
    }

    // Granular: gather the contiguous granular block this layer belongs to.
    let blockTop = index;
    while (
      blockTop - 1 >= 0 &&
      layers[blockTop - 1].behaviour === BEHAVIOUR.GRANULAR &&
      layers[blockTop - 1].slotId !== 'CRACK_RELIEF'
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
    });

    index = blockTop - 1;
  }

  return { layers, steps };
}
