/**
 * Bill of quantities for a length of road, measured off its cross-section:
 * each layer at its own width, the coats between the layers, and for a
 * concrete road its separation sheet, bars and joints.
 *
 * Rates are whatever the user enters; an item without one is still measured
 * and costed at zero.
 */

/** Rate keys for the items that are not layers, with their units. */
export const EXTRA_ITEMS = [
  { id: 'Prime coat', unit: 'm²' },
  { id: 'Tack coat', unit: 'm²' },
  { id: 'Separation membrane', unit: 'm²' },
  { id: 'Dowel bars', unit: 't' },
  { id: 'Tie bars', unit: 't' },
  { id: 'Slab reinforcement', unit: 't' },
  { id: 'Joint sealing', unit: 'm' },
  { id: 'Shoulder', unit: 'm³' },
];

const STEEL_KG_PER_M3 = 7850;

/** Mass of steel bars, tonnes. */
export function barTonnes(count, diameterMm, lengthMm) {
  const area = (Math.PI * (diameterMm / 1000) ** 2) / 4;
  return (count * area * (lengthMm / 1000) * STEEL_KG_PER_M3) / 1000;
}

/**
 * @param {object} model   From crossSection().
 * @param {Object<string,number>} rates  Rate per unit, by material or item id.
 * @param {number} lengthKm
 */
export function billOfQuantities(model, rates, lengthKm) {
  const L = Math.max(0, lengthKm || 0) * 1000;
  const items = [];
  const add = (item, unit, quantity, key, detail) => {
    if (!(quantity > 0)) return;
    const rate = rates[key];
    items.push({ item, unit, quantity, key, detail, rate: rate ?? 0, rateMissing: rate == null, amount: quantity * (rate ?? 0) });
  };

  for (const l of model.layers.filter((x) => !x.existing)) {
    add(`${l.label}, ${l.thicknessMm} mm`, 'm³', (l.thicknessMm / 1000) * l.widthM * L, l.materialId, `${l.widthM.toFixed(2)} m wide`);
  }

  // Coats: a prime coat on a granular layer under the bituminous layers, a
  // tack coat on every bituminous or cemented surface a bituminous course is
  // laid on, the old surface under an overlay among them.
  const bituminous = model.layers.filter((l) => l.behaviour === 'bituminous' && !l.existing);
  if (bituminous.length) {
    const lowest = model.layers.indexOf(bituminous[bituminous.length - 1]);
    const below = model.layers[lowest + 1];
    const width = bituminous[0].widthM;
    const onOld = below?.existing && below.behaviour === 'bituminous';
    if (below?.behaviour === 'granular' && !below.existing) add('Prime coat', 'm²', width * L, 'Prime coat', `on the ${below.label}`);
    const tacks = bituminous.length - 1 + (below && (onOld || ['cemented', 'treated'].includes(below.behaviour)) ? 1 : 0);
    if (tacks > 0) add('Tack coat', 'm²', tacks * width * L, 'Tack coat', `${tacks} surface${tacks > 1 ? 's' : ''}`);
  }

  if (model.membrane) {
    add(`Separation membrane, polythene ${model.membrane.micron} micron`, 'm²', model.membrane.widthM * L, 'Separation membrane', null);
  }

  const joints = model.transverseSpacingM > 0 ? Math.floor(L / model.transverseSpacingM) : 0;
  const slabWidth = model.carriagewayM + 2 * model.widenedM;
  if (model.dowels && joints > 0) {
    const d = model.dowels;
    const perJoint = Math.floor((slabWidth * 1000) / d.spacingMm);
    add(
      `Dowel bars, ${d.diameterMm} mm × ${d.lengthMm} mm at ${d.spacingMm} mm`,
      't',
      barTonnes(joints * perJoint, d.diameterMm, d.lengthMm),
      'Dowel bars',
      `${joints} joints × ${perJoint} bars`
    );
  }
  const tied = model.joints.filter((j) => j.tied).length;
  if (model.tieBars && tied > 0) {
    const t = model.tieBars;
    const perJoint = Math.floor((L * 1000) / t.spacingMm);
    add(
      `Tie bars, ${t.diameterMm} mm × ${t.lengthMm} mm at ${t.spacingMm} mm`,
      't',
      barTonnes(tied * perJoint, t.diameterMm, t.lengthMm),
      'Tie bars',
      `${tied} joint${tied > 1 ? 's' : ''} × ${perJoint} bars`
    );
  }
  if (model.mesh && L > 0) {
    // Bars each way, per m² of slab: the steel area per m of each spacing.
    const { barMm, longitudinalMm, transverseMm } = model.mesh;
    const bar = (Math.PI * (barMm / 1000) ** 2) / 4;
    const perSqm = bar / (longitudinalMm / 1000) + bar / (transverseMm / 1000);
    add(
      `Slab reinforcement, Ø${barMm} at ${longitudinalMm} × ${transverseMm} mm`,
      't',
      (perSqm * slabWidth * L * STEEL_KG_PER_M3) / 1000,
      'Slab reinforcement',
      `${slabWidth.toFixed(2)} m wide, laps extra`
    );
  }
  const sealed = joints * model.pavedM + model.joints.length * L;
  if (model.transverseSpacingM > 0) {
    add('Joint cutting and sealing', 'm', sealed, 'Joint sealing', `${joints} transverse, ${model.joints.length} longitudinal`);
  }

  if (model.shoulderLayer) {
    const s = model.shoulderLayer;
    add(`Shoulders, sub-base quality material, ${s.thicknessMm} mm`, 'm³', (s.thicknessMm / 1000) * 2 * s.widthM * L, 'Shoulder', `2 × ${s.widthM.toFixed(2)} m`);
  }

  items.forEach((item, i) => (item.no = i + 1));
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const area = model.pavedM * L;
  return {
    items,
    total,
    costPerKm: lengthKm > 0 ? total / lengthKm : 0,
    costPerSqm: area > 0 ? total / area : 0,
    anyRateMissing: items.some((i) => i.rateMissing),
  };
}
