/**
 * Cost of a designed section, from per-cubic-metre layer rates.
 *
 * Quantities are taken as thickness x carriageway width x length. Rates are
 * whatever the user enters — a schedule of rates, a quoted rate, anything —
 * so nothing here is tied to a particular state or year.
 */

export const DEFAULT_GEOMETRY = {
  carriagewayWidthM: 7,
  lengthKm: 1,
};

/**
 * Rates belong to materials, not positions: a base of WMM and a base of CTB
 * are priced differently, so trials with different bases compare fairly.
 *
 * @param {Array<{slotId:string,materialId:string,label:string,thicknessMm:number}>} slots
 * @param {Object<string,number>} rates  materialId -> rate per cubic metre
 * @param {{carriagewayWidthM:number,lengthKm:number}} geometry
 */
export function costSection(slots, rates, geometry = DEFAULT_GEOMETRY) {
  const { carriagewayWidthM, lengthKm } = geometry;
  const lengthM = lengthKm * 1000;
  const plan = carriagewayWidthM * lengthM;

  const lines = slots
    .filter((slot) => slot.thicknessMm > 0)
    .map((slot) => {
      const thicknessM = slot.thicknessMm / 1000;
      const volumeCum = thicknessM * plan;
      const key = slot.materialId ?? slot.slotId;
      const rate = rates[key] ?? 0;
      return {
        slotId: slot.slotId,
        materialId: key,
        label: slot.label,
        thicknessMm: slot.thicknessMm,
        volumeCum,
        rate,
        amount: volumeCum * rate,
        rateMissing: rates[key] == null,
      };
    });

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const totalVolume = lines.reduce((sum, line) => sum + line.volumeCum, 0);

  return {
    lines,
    total,
    totalVolume,
    costPerKm: lengthKm > 0 ? total / lengthKm : 0,
    costPerSqm: plan > 0 ? total / plan : 0,
    geometry,
    anyRateMissing: lines.some((line) => line.rateMissing),
  };
}

export function formatCurrency(value) {
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Short Indian-style amount for tight spaces: ₹1.86 Cr, ₹42.5 L. */
export function formatCompactCurrency(value) {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`;
  return formatCurrency(value);
}
