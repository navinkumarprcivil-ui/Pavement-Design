/**
 * Low volume rural roads, flexible — IRC:SP:72-2015.
 *
 * Read from the code clause by clause; `page` is the printed page number.
 * The design catalogues (Figs. 4 and 6) are held as the layer thicknesses of
 * each cell, the numbers a design needs; the figures themselves are not
 * reproduced.
 */

import { ref } from './ircConstants.js';

const sp = (clause, page, extra = {}) => ref('IRCSP72', clause, { ...extra, page });

export const SP72 = {
  /** Only commercial vehicles of 3 t gross laden weight and more count. */
  commercialVehicle: { ref: sp('Cl. 3.1.2 / 3.4.3', '8, 11'), minimumTonnes: 3 },

  growth: { ref: sp('Cl. 3.2.3', 9), defaultPercent: 6 },

  designLife: { ref: sp('Cl. 3.3', 9), years: 10 },

  /**
   * Annual repetitions of a vehicle type with harvesting seasons (Fig. 1):
   * N = 365 T + s·n·T·(0.6 t), T lean-season traffic, n the peak rise over it,
   * t the length of a season in days and s the number of seasons.
   */
  harvest: { ref: sp('Cl. 3.4.1', '9 – 11', { note: 'Fig. 1' }), peakShare: 0.6, seasons: 2 },

  /** Axle equivalency factor (W/Ws)^4, Ws = 80 kN single or 148 kN tandem. */
  equivalency: { ref: sp('Cl. 3.4.3', 12), exponent: 4, singleKN: 80, tandemKN: 148 },

  /** Total both ways on single and intermediate lanes; 75% on two lanes. */
  lane: {
    ref: sp('Cl. 3.4.3 / 3.4.4', '13, 14'),
    options: [
      { id: 'single', label: 'Single lane', value: 1 },
      { id: 'intermediate', label: 'Intermediate lane', value: 1 },
      { id: 'two', label: 'Two lane', value: 0.75 },
    ],
  },

  /** Indicative VDFs, standard axles per commercial vehicle. */
  vdf: {
    ref: sp('Cl. 3.4.4', '13, 14'),
    hcv: { laden: 2.86, unladen: 0.31 },
    mcv: { laden: 0.34, unladen: 0.02 },
  },

  /** N = T0 x 365 x [(1 + r)^n − 1] / r x L */
  cumulative: { ref: sp('Cl. 3.4.4', 14) },

  /** Cumulative ESAL for 10 years where the HCV/MCV split is unknown. */
  appendixA: {
    ref: sp('Cl. 3.4.5 / Appendix A', '14, 37'),
    cvpd: [25, 35, 50, 75, 100, 125, 300],
    esal: [19380, 60969, 96482, 149952, 192961, 257225, 663120],
  },

  /** Traffic categories T1 – T9, cumulative ESAL; the upper limit is inclusive. */
  categories: {
    ref: sp('Cl. 3.5 / 8 (ii)', '14, 15, 31'),
    list: [
      { id: 'T1', min: 10000, max: 30000 },
      { id: 'T2', min: 30000, max: 60000 },
      { id: 'T3', min: 60000, max: 100000 },
      { id: 'T4', min: 100000, max: 200000 },
      { id: 'T5', min: 200000, max: 300000 },
      { id: 'T6', min: 300000, max: 600000 },
      { id: 'T7', min: 600000, max: 1000000 },
      { id: 'T8', min: 1000000, max: 1500000 },
      { id: 'T9', min: 1500000, max: 2000000 },
    ],
  },

  /** Subgrade strength classes by CBR; new roads are designed for at least 5%. */
  subgradeClasses: {
    ref: sp('Cl. 4.3', '19, 20'),
    list: [
      { id: 'S1', label: 'Very poor', min: 0, max: 2 },
      { id: 'S2', label: 'Poor', min: 3, max: 4 },
      { id: 'S3', label: 'Fair', min: 5, max: 6 },
      { id: 'S4', label: 'Good', min: 7, max: 9 },
      { id: 'S5', label: 'Very good', min: 10, max: 15 },
    ],
    minimumNewRoadCBR: 5,
    replacementMm: 300,
  },

  /** Quick estimate of soaked CBR from classification tests (Appendix B). */
  quickCBR: {
    ref: sp('Cl. 4.2.1.1 / Appendix B', '16, 38'),
    plastic: { numerator: 75, wpiFactor: 0.728 },
    nonPlastic: { coefficient: 28.091, exponent: 0.3581 },
  },

  minimumSubBaseMm: { ref: sp('Cl. 5.1.1 / 7.1.4', '20, 29'), value: 100 },
  cementTreatedSubBaseUCS: { ref: sp('Cl. 5.1.1 / 7.1.2', '20, 28'), sevenDayMPa: 1.7 },
  soilCementBase: { ref: sp('Cl. 7.2.3 / 7.2.4', 29), sevenDayMPa: 3, minimumMm: 100 },
  granularSubBase: { ref: sp('Cl. 7.1.1', 28), soakedCBR: 20, exceptionalCBR: 15 },

  /** Gravel base: at least 100 mm, soaked CBR 80; else 75 mm WBM Gr III on top and 25 mm more sub-base. */
  gravelBase: {
    ref: sp('Cl. 6.2', 26),
    minimumMm: 100,
    soakedCBR: 80,
    wbmSubstituteMm: 75,
    addToSubBaseMm: 25,
  },

  /** Surface gravel over a gravel base, in addition to the design thickness. */
  surfaceGravel: { ref: sp('Cl. 6.3', 26), minMm: 40, maxMm: 50 },

  /** Gravel roads carry up to 60,000 ESAL, and up to 1,00,000 where the CBR is above 5. */
  gravelRoadLimit: { ref: sp('Cl. 6.1.2 / 8 (iii)', '25, 31, 32'), anyCBR: 60000, aboveCBR5: 100000 },

  /**
   * Part of a gravel base as an equivalent sub-base, keeping a 100 mm base
   * (Table 4): rows by design base thickness, columns by sub-base CBR.
   */
  baseToSubBase: {
    ref: sp('Cl. 6.2', 26, { table: 'Table 4', note: 'Fig. 5' }),
    keptBaseMm: 100,
    subBaseCBR: [15, 20, 25, 30, 40, 50],
    designBaseMm: [150, 175, 200, 225, 250, 275],
    subBaseMm: [
      [100, 100, 100, 100, 75, 75],
      [150, 150, 150, 150, 125, 125],
      [200, 200, 175, 175, 150, 150],
      [250, 250, 225, 225, 200, 200],
      [300, 275, 250, 250, 225, 225],
      [350, 325, 300, 300, 275, 275],
    ],
  },

  /** Bituminous surface treatment over a gravel road, by rainfall and category (Table 5). */
  surfacingWarrant: {
    ref: sp('Cl. 7.3.2', 30, { table: 'Table 5' }),
    rainfall: [
      { id: 'over1500', label: 'Over 1500 mm', bt: ['T2', 'T3', 'T4'] },
      { id: '1000to1500', label: '1000 – 1500 mm', bt: ['T3', 'T4'] },
      { id: 'under1000', label: 'Under 1000 mm', bt: ['T4'] },
    ],
  },

  /** Surface dressing preferred up to T4; 20 mm premix carpet an alternative from T5. */
  surfacingType: {
    ref: sp('Cl. 7.3.1 / 7.3.3', '30, 31'),
    premixCarpetMm: 20,
    premixFrom: 'T5',
  },

  /** Frost: black-topped sections at least 450 mm, as 300 mm sub-base and 150 mm base. */
  frost: {
    ref: sp('Cl. 8 (x)', 32),
    totalMm: 450,
    subBaseMm: 300,
    baseMm: 150,
  },

  /** Frost: gravel base for gravel roads, T1 – T3 by class; null means a flexible pavement is needed. */
  frostGravel: {
    ref: sp('Cl. 8 (xi)', 32),
    S1: [250, null, null],
    S2: [225, null, null],
    S3: [200, 325, 425],
    S4: [175, 300, 400],
    S5: [150, 275, 375],
  },

  /** Up to T5 at most 150 mm of added WBM in two layers; T6 – T7 at most 225 mm in three. */
  overlay: {
    ref: sp('Cl. 2.2.3', 7),
    limits: [
      { upTo: 'T5', mm: 150, layers: 2 },
      { upTo: 'T7', mm: 225, layers: 3 },
    ],
  },

  /** Top of subgrade at least 300 mm above ground and 600 mm above the highest water table. */
  drainage: { ref: sp('Cl. 9.1', 34), aboveGroundMm: 300, aboveWaterTableMm: 600, extendedSubBaseMm: 100 },

  catalogueGranular: { ref: sp('Cl. 8', '22, 31', { note: 'Fig. 4' }) },
  catalogueCemented: { ref: sp('Cl. 8 (vi)', '31, 33', { note: 'Fig. 6' }) },
};

/**
 * Layer kinds in the catalogues. `bt` is the bituminous surfacing, whose type
 * follows Cl. 7.3.3.
 */
export const SP72_LAYERS = {
  bt: { label: 'Bituminous surfacing', short: 'Surfacing', behaviour: 'bituminous' },
  bm: { label: 'Bituminous macadam', short: 'BM', behaviour: 'bituminous' },
  surfaceGravel: { label: 'Surface gravel', short: 'Surface gravel', behaviour: 'granular' },
  wbm3: { label: 'WBM Grade III', short: 'WBM III', behaviour: 'granular' },
  base: { label: 'Base, gravel / CRMB / WBM (CBR ≥ 100)', short: 'Base', behaviour: 'granular' },
  gravel: { label: 'Gravel base (CBR ≥ 80)', short: 'Gravel base', behaviour: 'granular' },
  gsb: { label: 'Granular sub-base (CBR ≥ 20)', short: 'GSB', behaviour: 'granular' },
  improved: { label: 'Improved subgrade (CBR ≥ 10)', short: 'Improved subgrade', behaviour: 'granular' },
  crackRelief: { label: 'Crack relief aggregate layer', short: 'Crack relief', behaviour: 'granular' },
  ctb: { label: 'Cement treated base (7-day UCS ≥ 3 MPa)', short: 'CTB', behaviour: 'cemented' },
  ctsb: { label: 'Cement treated sub-base (7-day UCS ≥ 1.7 MPa)', short: 'CTSB', behaviour: 'cemented' },
};

/*
 * Catalogue cells, T1 to T9 for each subgrade class, top layer first. A
 * leading 'bt' marks a black-topped section. Fig. 4: gravel and granular
 * bases and sub-bases. Fig. 6: cement treated bases and sub-bases.
 */
const L = (...layers) => layers;

export const FIG4 = {
  S1: [
    L(['gravel', 200], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['gravel', 150], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 175], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 250], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 200], ['improved', 225]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 225], ['improved', 200]),
    L(['bt'], ['bm', 50], ['base', 225], ['gsb', 250], ['improved', 200]),
  ],
  S2: [
    L(['gravel', 200]),
    L(['gravel', 275]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 175]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 100], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 150], ['improved', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 150], ['improved', 200]),
    L(['bt'], ['bm', 50], ['base', 225], ['gsb', 200], ['improved', 100]),
  ],
  S3: [
    L(['gravel', 175]),
    L(['gravel', 250]),
    L(['gravel', 275]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 150]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 175]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 100], ['improved', 100]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 200], ['improved', 100]),
    L(['bt'], ['bm', 50], ['base', 225], ['gsb', 200]),
  ],
  S4: [
    L(['gravel', 150]),
    L(['gravel', 175]),
    L(['gravel', 225]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 150]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 175]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 200]),
    L(['bt'], ['bm', 50], ['base', 225], ['gsb', 150]),
  ],
  S5: [
    L(['gravel', 125]),
    L(['gravel', 150]),
    L(['gravel', 175]),
    L(['bt'], ['wbm3', 75], ['base', 150]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 125]),
    L(['bt'], ['wbm3', 75], ['base', 75], ['gsb', 150]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 125]),
    L(['bt'], ['wbm3', 75], ['base', 150], ['gsb', 175]),
    L(['bt'], ['bm', 50], ['base', 225], ['gsb', 125]),
  ],
};

const C = (ctb, ctsb) => L(['bt'], ['ctb', ctb], ['ctsb', ctsb]);
const CR = (relief, ctb, ctsb) => L(['bt'], ['crackRelief', relief], ['ctb', ctb], ['ctsb', ctsb]);
const CRB = (relief, ctb, ctsb) => L(['bt'], ['bm', 50], ['crackRelief', relief], ['ctb', ctb], ['ctsb', ctsb]);

export const FIG6 = {
  S1: [C(150, 100), C(150, 110), C(150, 120), C(150, 125), C(150, 130), CR(75, 150, 125), CR(125, 150, 100), CR(125, 150, 125), CRB(75, 150, 125)],
  S2: [C(100, 100), C(100, 100), C(100, 125), C(100, 125), C(100, 150), CR(75, 125, 100), CR(75, 150, 100), CR(75, 150, 125), CRB(75, 100, 125)],
  S3: [C(100, 100), C(100, 100), C(100, 100), C(100, 110), C(100, 125), CR(75, 100, 100), CR(75, 125, 100), CR(75, 125, 125), CRB(75, 100, 100)],
  S4: [C(100, 100), C(100, 100), C(100, 100), C(100, 110), C(100, 125), CR(75, 100, 100), CR(75, 100, 100), CR(75, 125, 100), CR(75, 140, 100)],
  S5: [C(100, 100), C(100, 100), C(100, 100), C(100, 100), C(100, 100), CR(75, 100, 100), CR(75, 100, 100), CR(75, 100, 100), CR(75, 125, 100)],
};

/** Fig. 6 surfacing: surface dressing up to T5, open-graded premix carpet from T6. */
export const FIG6_PREMIX_FROM = 'T6';
