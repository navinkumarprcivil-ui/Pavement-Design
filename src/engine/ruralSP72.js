/**
 * Low volume rural roads — IRC:SP:72-2015.
 *
 * IRC:SP:72 is a catalogue method: design traffic category crossed with
 * subgrade CBR gives a pavement composition straight from a table. Those tables
 * are the copyrighted content of the code, so this module does NOT ship them.
 *
 * Instead it provides the catalogue *structure* and lets you enter the values
 * once from your own copy of the code. Entries are stored on the device and
 * reused for every later design. Anything not yet entered is reported as
 * missing rather than guessed at.
 */

import { CODES, ref } from '../data/ircConstants.js';

const STORAGE_KEY = 'pavement-design.sp72-catalogue.v1';

/**
 * Traffic categories, in cumulative standard axles. The band limits are
 * defaults you can correct against your copy of the code; they are not
 * treated as authoritative.
 */
export const TRAFFIC_CATEGORIES = [
  { id: 'T1', label: 'T1', minEsal: 10000, maxEsal: 30000 },
  { id: 'T2', label: 'T2', minEsal: 30000, maxEsal: 60000 },
  { id: 'T3', label: 'T3', minEsal: 60000, maxEsal: 100000 },
  { id: 'T4', label: 'T4', minEsal: 100000, maxEsal: 200000 },
  { id: 'T5', label: 'T5', minEsal: 200000, maxEsal: 300000 },
  { id: 'T6', label: 'T6', minEsal: 300000, maxEsal: 600000 },
  { id: 'T7', label: 'T7', minEsal: 600000, maxEsal: 1000000 },
  { id: 'T8', label: 'T8', minEsal: 1000000, maxEsal: 2000000 },
];

export const CBR_BANDS = [
  { id: 'cbr-2', label: 'CBR 2%', min: 2, max: 3 },
  { id: 'cbr-3', label: 'CBR 3-4%', min: 3, max: 5 },
  { id: 'cbr-5', label: 'CBR 5-6%', min: 5, max: 7 },
  { id: 'cbr-7', label: 'CBR 7-9%', min: 7, max: 10 },
  { id: 'cbr-10', label: 'CBR 10-15%', min: 10, max: 15 },
  { id: 'cbr-15', label: 'CBR above 15%', min: 15, max: Infinity },
];

export const CATALOGUE_REF = ref('IRCSP72', 'Cl. 6', {
  table: 'Design catalogue',
  note:
    'Enter the composition from your own copy of IRC:SP:72-2015. ' +
    'The code tables are not reproduced in this app.',
});

export function categoriseTraffic(cumulativeEsal) {
  const category = TRAFFIC_CATEGORIES.find(
    (c) => cumulativeEsal >= c.minEsal && cumulativeEsal < c.maxEsal
  );
  if (category) return { category, withinScope: true };

  if (cumulativeEsal < TRAFFIC_CATEGORIES[0].minEsal) {
    return {
      category: TRAFFIC_CATEGORIES[0],
      withinScope: false,
      message:
        `Design traffic of ${Math.round(cumulativeEsal).toLocaleString('en-IN')} ` +
        'standard axles is below the lowest catalogue category. The lowest ' +
        'category has been used; confirm against the code.',
    };
  }
  return {
    category: TRAFFIC_CATEGORIES[TRAFFIC_CATEGORIES.length - 1],
    withinScope: false,
    message:
      'Design traffic exceeds the range of IRC:SP:72. Design this road to ' +
      'IRC:37-2018 instead.',
  };
}

export function categoriseCBR(cbrPercent) {
  return (
    CBR_BANDS.find((b) => cbrPercent >= b.min && cbrPercent < b.max) ||
    CBR_BANDS[CBR_BANDS.length - 1]
  );
}

function readCatalogue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCatalogue(catalogue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogue));
    return true;
  } catch {
    return false;
  }
}

const cellKey = (trafficId, cbrId) => `${trafficId}|${cbrId}`;

/**
 * One catalogue cell: the pavement composition for a traffic/CBR pair.
 * @typedef {{surfacingMm:number, baseMm:number, subBaseMm:number, note?:string}} Composition
 */

export function getComposition(trafficId, cbrId) {
  return readCatalogue()[cellKey(trafficId, cbrId)] || null;
}

export function setComposition(trafficId, cbrId, composition) {
  const catalogue = readCatalogue();
  if (composition == null) {
    delete catalogue[cellKey(trafficId, cbrId)];
  } else {
    catalogue[cellKey(trafficId, cbrId)] = {
      ...composition,
      enteredAt: new Date().toISOString(),
    };
  }
  return writeCatalogue(catalogue);
}

export function catalogueCoverage() {
  const catalogue = readCatalogue();
  const total = TRAFFIC_CATEGORIES.length * CBR_BANDS.length;
  return { entered: Object.keys(catalogue).length, total };
}

/**
 * Design a low volume rural road.
 *
 * @param {object} input
 * @param {number} input.cumulativeEsal
 * @param {number} input.subgradeCBR
 */
export function designRuralRoad({ cumulativeEsal, subgradeCBR }) {
  const { category, withinScope, message } = categoriseTraffic(cumulativeEsal);
  const band = categoriseCBR(subgradeCBR);
  const composition = getComposition(category.id, band.id);

  const steps = [
    {
      id: 'traffic-category',
      title: 'Design traffic category',
      formula: 'Cumulative standard axles placed in the catalogue traffic bands',
      substitution: `${Math.round(cumulativeEsal).toLocaleString('en-IN')} standard axles`,
      result: `Category ${category.label} (${category.minEsal.toLocaleString('en-IN')} to ${category.maxEsal.toLocaleString('en-IN')})`,
      ref: CATALOGUE_REF,
      verified: false,
      warning: withinScope ? null : message,
    },
    {
      id: 'cbr-band',
      title: 'Subgrade CBR band',
      formula: 'Subgrade CBR placed in the catalogue CBR bands',
      substitution: `CBR = ${subgradeCBR}%`,
      result: band.label,
      ref: CATALOGUE_REF,
      verified: false,
    },
  ];

  if (!composition) {
    return {
      code: CODES.IRCSP72.designation,
      category,
      band,
      composition: null,
      steps,
      missing: true,
      message:
        `The catalogue entry for ${category.label} at ${band.label} has not been ` +
        'entered yet. Open the catalogue and enter it from your copy of ' +
        'IRC:SP:72-2015 — it will be reused for every later design.',
    };
  }

  const total =
    (composition.surfacingMm || 0) +
    (composition.baseMm || 0) +
    (composition.subBaseMm || 0);

  steps.push({
    id: 'composition',
    title: 'Pavement composition from the catalogue',
    formula: 'Read directly from the design catalogue',
    substitution: `${category.label} x ${band.label}`,
    result: `Total ${total} mm (surfacing ${composition.surfacingMm} + base ${composition.baseMm} + sub-base ${composition.subBaseMm})`,
    ref: CATALOGUE_REF,
    verified: false,
  });

  return {
    code: CODES.IRCSP72.designation,
    category,
    band,
    composition,
    totalThicknessMm: total,
    steps,
    missing: false,
    slots: [
      { slotId: 'SURFACING', label: 'Surfacing', thicknessMm: composition.surfacingMm || 0 },
      { slotId: 'BASE', label: 'Base', thicknessMm: composition.baseMm || 0 },
      { slotId: 'SUB_BASE', label: 'Sub-base', thicknessMm: composition.subBaseMm || 0 },
    ],
  };
}
