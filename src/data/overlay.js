/**
 * Overlays on flexible pavements: IRC:81-1997 (Benkelman beam) and
 * IRC:115-2014 (falling weight deflectometer).
 *
 * Read from the codes clause by clause; `page` is the printed page number.
 * The design charts of IRC:81 (Fig. 9, and the seasonal correction curves of
 * Figs. 2 - 7) are held as numbers read off the curves at regular steps, the
 * values a design needs; the charts themselves are not reproduced. How they
 * were read, and how closely, is set out in docs/VERIFICATION.md.
 */

import { ref } from './ircConstants.js';

const bbd = (clause, page, extra = {}) => ref('IRC81', clause, { ...extra, page });
const fwd = (clause, page, extra = {}) => ref('IRC115', clause, { ...extra, page });

/** Indicative VDF by initial commercial vehicles per day, the same in both codes (Table 4). */
const INDICATIVE_VDF = [
  { upToCVPD: 150, plainRolling: 1.5, hilly: 0.5 },
  { upToCVPD: 1500, plainRolling: 3.5, hilly: 1.5 },
  { upToCVPD: Infinity, plainRolling: 4.5, hilly: 2.5 },
];

export const IRC81 = {
  /** Good, fair and poor sections; over 20% cracking is a failed section. */
  classification: { ref: bbd('Cl. 4.2.1', 4, { table: 'Table 1' }), failedCrackingPercent: 20 },

  /** At least ten points in each lane of a section, not more than 50 m apart. */
  survey: { ref: bbd('Cl. 4.3.1', 5), minimumPoints: 10, maximumSpacingM: 50 },

  /** A value more than a third of the mean off the mean calls for readings 25 m either side. */
  variability: { ref: bbd('Cl. 4.3.2', 5), fractionOfMean: 1 / 3, extraAtM: 25 },

  /** CGRA static rebound test: 8170 kg rear axle on dual tyres at 5.60 kg/cm². */
  load: { ref: bbd('Cl. 4.3.3', 5), axleKg: 8170, tyrePressureKgCm2: 5.6 },

  /**
   * To 35 °C at 0.01 mm per °C, added below 35 °C and taken off above it; only
   * on 40 mm or more of bituminous layer, and not on severely cracked or
   * stripped surfacing, nor in cold or high areas (Cl. 4.4.4).
   */
  temperature: {
    ref: bbd('Cl. 4.4.1 / 4.4.3', '7, 8'),
    standardC: 35,
    mmPerDegree: 0.01,
    minimumBituminousMm: 40,
    cold: { ref: bbd('Cl. 4.4.4', 8), altitudeM: 1000, averageDayC: 20, months: 4 },
  },

  /**
   * Seasonal (moisture) correction factor by subgrade soil, field moisture
   * content and annual rainfall, 1300 mm dividing low from high: Figs. 2 - 7,
   * read every 0.5% of moisture content from 4%.
   */
  seasonal: {
    ref: bbd('Cl. 4.5.1 / 4.5.2 / 4.5.4', '9, 13', { note: 'Figs. 2 - 7' }),
    rainfallDividingMm: 1300,
    plasticityDividing: 15,
    charts: [
      { figure: 'Fig. 2', page: 10, soil: 'sandy', rainfall: 'low', fromPercent: 4, stepPercent: 0.5,
        factors: [1.323, 1.238, 1.17, 1.119, 1.083, 1.06, 1.044, 1.034, 1.027, 1.022, 1.018, 1.014, 1.012, 1.011, 1.007] },
      { figure: 'Fig. 3', page: 10, soil: 'sandy', rainfall: 'high', fromPercent: 4, stepPercent: 0.5,
        factors: [1.38, 1.334, 1.292, 1.252, 1.217, 1.185, 1.158, 1.134, 1.114, 1.096, 1.08, 1.067, 1.056, 1.046, 1.037, 1.03, 1.023, 1.017, 1.011] },
      { figure: 'Fig. 4', page: 11, soil: 'clayLow', rainfall: 'low', fromPercent: 4, stepPercent: 0.5,
        factors: [1.683, 1.635, 1.586, 1.538, 1.491, 1.446, 1.405, 1.366, 1.331, 1.3, 1.272, 1.248, 1.227, 1.208, 1.193, 1.179, 1.167, 1.157, 1.148, 1.14, 1.133, 1.126, 1.119, 1.113, 1.107, 1.1, 1.094, 1.088, 1.082, 1.075, 1.069, 1.063, 1.057, 1.051, 1.044, 1.037, 1.029] },
      { figure: 'Fig. 5', page: 11, soil: 'clayLow', rainfall: 'high', fromPercent: 4, stepPercent: 0.5,
        factors: [1.864, 1.795, 1.728, 1.666, 1.608, 1.555, 1.507, 1.464, 1.426, 1.392, 1.362, 1.337, 1.314, 1.294, 1.277, 1.262, 1.248, 1.236, 1.225, 1.214, 1.204, 1.194, 1.184, 1.175, 1.165, 1.156, 1.148, 1.139, 1.131, 1.124, 1.118, 1.112, 1.107, 1.102, 1.098, 1.094, 1.089] },
      { figure: 'Fig. 6', page: 12, soil: 'clayHigh', rainfall: 'low', fromPercent: 4, stepPercent: 0.5,
        factors: [1.894, 1.809, 1.727, 1.65, 1.579, 1.514, 1.457, 1.406, 1.361, 1.322, 1.289, 1.261, 1.236, 1.215, 1.197, 1.18, 1.166, 1.152, 1.14, 1.128, 1.116, 1.105, 1.094, 1.084, 1.074, 1.065, 1.056, 1.049, 1.042, 1.036, 1.03, 1.024, 1.017] },
      { figure: 'Fig. 7', page: 12, soil: 'clayHigh', rainfall: 'high', fromPercent: 4, stepPercent: 0.5,
        factors: [2.086, 1.951, 1.835, 1.735, 1.649, 1.576, 1.513, 1.46, 1.414, 1.375, 1.341, 1.311, 1.286, 1.264, 1.244, 1.226, 1.21, 1.195, 1.181, 1.168, 1.156, 1.145, 1.134, 1.124, 1.114, 1.105, 1.096, 1.087, 1.078, 1.069, 1.059, 1.049, 1.038] },
    ],
  },

  /** Traffic: Eq. 1, with the lane distribution of Cl. 5.4.2 and the VDF of Table 4. */
  traffic: {
    ref: bbd('Cl. 5.4.1', 14, { equation: 'Eq. 1' }),
    growth: { ref: bbd('Cl. 5.2', 14), defaultPercent: 7.5 },
    designLife: { ref: bbd('Cl. 5.3', 14), majorYears: 10, minimumYears: 5 },
    lanes: {
      ref: bbd('Cl. 5.4.2', '15, 16'),
      options: [
        { id: 'single', label: 'Single lane', factor: 2, basis: 'both' },
        { id: 'two-lane', label: 'Two lane single carriageway', factor: 0.75, basis: 'both' },
        { id: 'four-lane', label: 'Four lane single carriageway', factor: 0.4, basis: 'both' },
        { id: 'dual-two-lane', label: 'Dual two lane carriageway', factor: 0.75, basis: 'direction' },
        { id: 'dual-three-lane', label: 'Dual three lane carriageway', factor: 0.6, basis: 'direction' },
      ],
    },
    vdf: { ref: bbd('Cl. 5.4.3', 16, { table: 'Table 4' }), rows: INDICATIVE_VDF },
  },

  /** Characteristic deflection: mean + 2 SD on NH and SH, mean + 1 SD on other roads. */
  characteristic: { ref: bbd('Cl. 6.1', 17, { equation: 'Eqs. 2 - 5' }), majorRoads: ['expressway', 'nh', 'sh'] },

  /**
   * Fig. 9: bituminous macadam overlay against characteristic deflection, one
   * curve per design traffic, msa. Each curve is [deflection mm, overlay mm]
   * from where it leaves the axis to 6 mm of deflection, every 5 mm of overlay.
   */
  overlayChart: {
    ref: bbd('Cl. 7.1 - 7.3', '17, 19, 20', { note: 'Fig. 9' }),
    maxDeflectionMm: 6,
    curves: {
      '0.1': [[2.997, 0], [3.047, 5], [3.096, 10], [3.143, 15], [3.191, 20], [3.238, 25], [3.287, 30], [3.339, 35], [3.392, 40], [3.449, 45], [3.509, 50], [3.573, 55], [3.642, 60], [3.716, 65], [3.795, 70], [3.88, 75], [3.972, 80], [4.07, 85], [4.175, 90], [4.288, 95], [4.408, 100], [4.537, 105], [4.675, 110], [4.822, 115], [4.978, 120], [5.146, 125], [5.324, 130], [5.515, 135], [5.72, 140], [5.94, 145], [6, 145.8]],
      '0.5': [[1.992, 0], [2.017, 5], [2.044, 10], [2.073, 15], [2.104, 20], [2.135, 25], [2.168, 30], [2.202, 35], [2.238, 40], [2.275, 45], [2.314, 50], [2.356, 55], [2.4, 60], [2.447, 65], [2.498, 70], [2.552, 75], [2.61, 80], [2.673, 85], [2.741, 90], [2.814, 95], [2.893, 100], [2.978, 105], [3.069, 110], [3.166, 115], [3.27, 120], [3.38, 125], [3.496, 130], [3.618, 135], [3.747, 140], [3.882, 145], [4.024, 150], [4.171, 155], [4.325, 160], [4.486, 165], [4.656, 170], [4.836, 175], [5.029, 180], [5.239, 185], [5.471, 190], [5.734, 195], [6, 199.0]],
      '1': [[1.686, 0], [1.697, 5], [1.714, 10], [1.737, 15], [1.762, 20], [1.79, 25], [1.819, 30], [1.849, 35], [1.879, 40], [1.911, 45], [1.944, 50], [1.979, 55], [2.017, 60], [2.057, 65], [2.1, 70], [2.147, 75], [2.197, 80], [2.252, 85], [2.31, 90], [2.373, 95], [2.439, 100], [2.509, 105], [2.583, 110], [2.66, 115], [2.741, 120], [2.825, 125], [2.912, 130], [3.003, 135], [3.098, 140], [3.197, 145], [3.301, 150], [3.413, 155], [3.532, 160], [3.661, 165], [3.803, 170], [3.959, 175], [4.132, 180], [4.325, 185], [4.539, 190], [4.776, 195], [5.036, 200], [5.316, 205], [5.611, 210], [5.909, 215], [6, 216.0]],
      '2': [[1.402, 0], [1.414, 5], [1.43, 10], [1.447, 15], [1.467, 20], [1.488, 25], [1.511, 30], [1.536, 35], [1.563, 40], [1.591, 45], [1.622, 50], [1.655, 55], [1.69, 60], [1.728, 65], [1.768, 70], [1.811, 75], [1.857, 80], [1.905, 85], [1.957, 90], [2.012, 95], [2.069, 100], [2.13, 105], [2.193, 110], [2.26, 115], [2.329, 120], [2.402, 125], [2.478, 130], [2.558, 135], [2.642, 140], [2.73, 145], [2.823, 150], [2.922, 155], [3.027, 160], [3.139, 165], [3.26, 170], [3.391, 175], [3.533, 180], [3.687, 185], [3.855, 190], [4.037, 195], [4.234, 200], [4.447, 205], [4.675, 210], [4.915, 215], [5.164, 220], [5.415, 225], [5.658, 230], [5.88, 235], [6, 236.3]],
      '5': [[1.122, 0], [1.138, 5], [1.148, 10], [1.155, 15], [1.162, 20], [1.168, 25], [1.177, 30], [1.187, 35], [1.201, 40], [1.218, 45], [1.238, 50], [1.262, 55], [1.288, 60], [1.319, 65], [1.352, 70], [1.388, 75], [1.426, 80], [1.467, 85], [1.51, 90], [1.555, 95], [1.602, 100], [1.651, 105], [1.702, 110], [1.755, 115], [1.809, 120], [1.867, 125], [1.926, 130], [1.989, 135], [2.056, 140], [2.127, 145], [2.202, 150], [2.282, 155], [2.369, 160], [2.462, 165], [2.563, 170], [2.672, 175], [2.789, 180], [2.916, 185], [3.052, 190], [3.197, 195], [3.353, 200], [3.519, 205], [3.695, 210], [3.88, 215], [4.075, 220], [4.278, 225], [4.489, 230], [4.708, 235], [4.937, 240], [5.175, 245], [5.426, 250], [5.694, 255], [6, 259.1]],
      '10': [[0.976, 0], [0.996, 5], [1.009, 10], [1.017, 15], [1.023, 20], [1.028, 25], [1.034, 30], [1.041, 35], [1.05, 40], [1.062, 45], [1.077, 50], [1.095, 55], [1.115, 60], [1.138, 65], [1.163, 70], [1.19, 75], [1.219, 80], [1.25, 85], [1.282, 90], [1.315, 95], [1.35, 100], [1.386, 105], [1.423, 110], [1.461, 115], [1.501, 120], [1.543, 125], [1.588, 130], [1.635, 135], [1.685, 140], [1.739, 145], [1.798, 150], [1.862, 155], [1.932, 160], [2.009, 165], [2.094, 170], [2.186, 175], [2.288, 180], [2.399, 185], [2.52, 190], [2.652, 195], [2.793, 200], [2.945, 205], [3.106, 210], [3.275, 215], [3.453, 220], [3.637, 225], [3.826, 230], [4.018, 235], [4.213, 240], [4.409, 245], [4.608, 250], [4.811, 255], [5.023, 260], [5.251, 265], [5.507, 270], [5.808, 275], [6, 277.9]],
      '20': [[0.8, 0], [0.803, 10], [0.81, 15], [0.82, 20], [0.832, 25], [0.846, 30], [0.862, 35], [0.879, 40], [0.897, 45], [0.916, 50], [0.936, 55], [0.957, 60], [0.979, 65], [1.001, 70], [1.023, 75], [1.047, 80], [1.071, 85], [1.096, 90], [1.122, 95], [1.149, 100], [1.177, 105], [1.207, 110], [1.238, 115], [1.272, 120], [1.308, 125], [1.346, 130], [1.388, 135], [1.432, 140], [1.48, 145], [1.533, 150], [1.589, 155], [1.65, 160], [1.716, 165], [1.788, 170], [1.865, 175], [1.948, 180], [2.038, 185], [2.135, 190], [2.239, 195], [2.35, 200], [2.469, 205], [2.596, 210], [2.73, 215], [2.873, 220], [3.023, 225], [3.182, 230], [3.349, 235], [3.523, 240], [3.705, 245], [3.895, 250], [4.094, 255], [4.3, 260], [4.517, 265], [4.743, 270], [4.982, 275], [5.236, 280], [5.509, 285], [5.805, 290], [6, 293.8]],
      '100': [[0.537, 0], [0.54, 5], [0.544, 10], [0.548, 15], [0.552, 20], [0.557, 25], [0.563, 30], [0.57, 35], [0.578, 40], [0.586, 45], [0.595, 50], [0.605, 55], [0.617, 60], [0.629, 65], [0.642, 70], [0.656, 75], [0.671, 80], [0.688, 85], [0.705, 90], [0.724, 95], [0.743, 100], [0.764, 105], [0.787, 110], [0.81, 115], [0.835, 120], [0.862, 125], [0.89, 130], [0.92, 135], [0.952, 140], [0.986, 145], [1.022, 150], [1.061, 155], [1.101, 160], [1.145, 165], [1.191, 170], [1.241, 175], [1.293, 180], [1.349, 185], [1.409, 190], [1.473, 195], [1.541, 200], [1.613, 205], [1.691, 210], [1.773, 215], [1.86, 220], [1.954, 225], [2.053, 230], [2.158, 235], [2.27, 240], [2.388, 245], [2.514, 250], [2.647, 255], [2.789, 260], [2.939, 265], [3.099, 270], [3.268, 275], [3.449, 280], [3.643, 285], [3.851, 290], [4.076, 295], [4.321, 300], [4.588, 305], [4.884, 310], [5.214, 315], [5.586, 320], [6, 325.4]],
    },
  },

  /** Other overlay materials against 1 cm of bituminous macadam. */
  equivalence: { ref: bbd('Cl. 7.4', 20), granularCm: 1.5, dbmCm: 0.7 },

  /** Least overlay: 50 mm of BM with a 50 mm DBM or 40 mm BC surfacing. */
  minimum: { ref: bbd('Cl. 7.5', 20), bmMm: 50, dbmMm: 50, bcMm: 40 },

  /** No structural deficiency: a thin surfacing for riding quality. */
  noDeficiency: { ref: bbd('Cl. 7.6', 20) },

  /** Profile correction comes first and is no part of the overlay. */
  profile: { ref: bbd('Cl. 7.8', 20) },
};

export const IRC115 = {
  /** 300 mm plate; 40 kN target load, deflections scaled linearly to it. */
  load: { ref: fwd('Cl. 4.3 / 4.4 / 6.1.2', '5, 15'), plateDiameterMm: 300, targetKN: 40, toleranceKN: 4 },

  /** Good, fair and poor sections (Table 1). */
  classification: { ref: fwd('Cl. 5.3.5', 9, { table: 'Table 1' }) },

  /** The functional loss is made up before a structural overlay. */
  functional: { ref: fwd('Cl. 5.3.3', 8) },

  /** No measurement above 45 °C of pavement temperature. */
  maxTemperatureC: { ref: fwd('Cl. 5.4.7 (xiv)', 13), value: 45 },

  /** Deflections fall with distance from the plate; three drops are averaged. */
  checks: { ref: fwd('Cl. 6.1.1', 14) },

  /** Surface curvature index D0 - D300, for homogeneous sections. */
  sci: { ref: fwd('Cl. 6.2.2', 15) },

  /** A homogeneous sub-section: 1 km or more, twelve test points or more. */
  homogeneous: { ref: fwd('Cl. 6.2.4', 16), minimumKm: 1, minimumPoints: 12 },

  /** Subgrade modulus from the DCP value, mm per blow (Eq. 2). */
  dcp: { ref: fwd('Cl. 5.5.4', 14, { equation: 'Eq. 2' }), coefficient: 357.87, exponent: -0.6445 },

  /**
   * Bituminous modulus to 35 °C: E35 = λ E_T, λ = (1 - 0.238 ln 35) / (1 - 0.238 ln T).
   * Not on thin (< 40 mm) layers or poor sections, nor in cold areas.
   */
  temperature: {
    ref: fwd('Cl. 6.4.1 / 6.4.2', '16, 17', { equation: 'Eqs. 4, 5' }),
    standardC: 35,
    coefficient: 0.238,
    developedC: [25, 40],
    extendedC: [20, 45],
    minimumBituminousMm: 40,
    cold: { ref: fwd('Cl. 6.4.3', 17) },
  },

  /** Winter and summer moduli to the monsoon (Eqs. 6 - 9), and where they hold. */
  seasonal: {
    ref: fwd('Cl. 6.5.2', '17, 18', { equation: 'Eqs. 6 - 9' }),
    subgradeWinter: { a: 3.351, b: 0.7688, c: -28.9 },
    subgradeSummer: { a: 0.8554, c: -8.461 },
    granularSummer: { a2: -0.0003, a1: 0.9584, c: -32.989 },
    granularWinter: { a: 10.5523, b: 0.624, c: -113.857 },
    limits: { subgradeMonsoon: 20, subgradeMeasured: 30, granularMonsoon: 60, granularWinter: 80, granularSummer: 100 },
  },

  /** Traffic: Eqs. 10 and 11, lane distribution of Cl. 7.4.2, VDF of Table 4. */
  traffic: {
    ref: fwd('Cl. 7.4.1', 19, { equation: 'Eqs. 10, 11' }),
    growth: { ref: fwd('Cl. 7.2', 18), minimumPercent: 5 },
    designLife: { ref: fwd('Cl. 7.3', '18, 19'), years: 10, minimumYears: 5 },
    lanes: {
      ref: fwd('Cl. 7.4.2', '19, 20'),
      options: [
        { id: 'single', label: 'Single lane', factor: 1, basis: 'both' },
        { id: 'two-lane', label: 'Two lane single carriageway', factor: 0.5, basis: 'both' },
        { id: 'four-lane', label: 'Four lane single carriageway', factor: 0.4, basis: 'both' },
        { id: 'dual-two-lane', label: 'Dual two lane carriageway', factor: 0.75, basis: 'direction' },
        { id: 'dual-three-lane', label: 'Dual three lane carriageway', factor: 0.6, basis: 'direction' },
        { id: 'dual-four-lane', label: 'Dual four lane carriageway', factor: 0.45, basis: 'direction' },
      ],
    },
    vdf: { ref: fwd('Cl. 7.4.3.3', 21, { table: 'Table 4' }), rows: INDICATIVE_VDF },
  },

  /** Performance criteria at 90% reliability (Eqs. 16, 17). */
  fatigue: { ref: fwd('Cl. 8.3.1', 22, { equation: 'Eq. 16' }), k: 0.711e-4, strainExponent: 3.89, modulusExponent: 0.854 },
  rutting: { ref: fwd('Cl. 8.3.2', 22, { equation: 'Eq. 17' }), k: 1.41e-8, strainExponent: 4.5337 },

  /**
   * The design procedure: a three layer system, moduli to 35 °C and to the
   * monsoon, the 15th percentile of each, remaining life from the strains, and
   * an overlay found by trial.
   */
  procedure: { ref: fwd('Cl. 8.4', '22 – 24'), percentile: 15 },

  /** Back-calculation: fit to the measured bowl by the sum of squared relative errors. */
  backcalculation: {
    ref: fwd('Cl. 6.3.1 / App. III', '16, 28 – 30'),
    objective: { ref: fwd('App. III.7', 29, { equation: 'Eq. III.1' }) },
    ranges: {
      ref: fwd('App. III.8.4', 30, { equation: 'Eq. III.2' }),
      subgradeDefault: [20, 100],
      subgradeFactor: 1.2,
      subgradeSpread: [0.8, 1.2],
      subgradeSensorsFromMm: 1200,
      granular: [100, 500],
      bituminousGood: [750, 3000],
      bituminousDistressed: [400, 1500],
    },
    poisson: { ref: fwd('App. IV', 32), bituminous: 0.5, granular: 0.4, subgrade: 0.4 },
  },

  /** The overlay mix modulus, from IRC:37. */
  overlayModulus: { ref: fwd('Cl. 8.4 (x)', 23) },
};
