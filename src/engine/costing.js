/**
 * Money and number formats for the cost screens and the report. Quantities
 * and amounts are worked out in quantities.js.
 */

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
