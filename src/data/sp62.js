/**
 * Cement concrete pavements for low volume roads — IRC:SP:62-2014.
 *
 * Read from the code clause by clause; `page` is the printed page number.
 */

import { ref } from './ircConstants.js';

const sp = (clause, page, extra = {}) => ref('IRCSP62', clause, { ...extra, page });

export const SP62 = {
  /** The guidelines cover roads under 450 commercial vehicles a day. */
  scope: { ref: sp('Cl. 2', 3), maximumCVPD: 450, laneWidthM: 3.75 },

  /** Design load: 50 kN on a dual wheel at 310 mm; a tractor wheel at 0.5 MPa. */
  load: {
    ref: sp('Cl. 3.1 / 3.2', 3),
    wheelLoadKN: 50,
    dualSpacingMm: 310,
    truckTyreMPa: 0.8,
    tractorTyreMPa: 0.5,
  },

  designPeriod: { ref: sp('Cl. 3.3 / 3.4', '3, 4'), years: 20 },

  /**
   * Joints: contraction joints carry load by aggregate interlock, without
   * dowels; expansion joints at bridges and culverts take 25 mm plain dowels
   * 450 mm long at 250 mm; a longitudinal joint at mid-width where the slab is
   * wider than 4.5 m.
   */
  joints: {
    ref: sp('Cl. 5.2.3 / 5.2.4 / 5.3', 20),
    longitudinalAboveM: 4.5,
    expansionDowel: { diameterMm: 25, lengthMm: 450, spacingMm: 250 },
  },

  /** Under 50 CVPD load only; 50 – 150 load and curling; over 150 fatigue. */
  cases: { ref: sp('Cl. 3.4 / 4.3', '3, 13'), loadOnlyBelow: 50, fatigueAbove: 150 },

  /** N = 365 A [(1 + r)^n − 1] / r; 10% of it at 100 kN axles by default. */
  repetitions: { ref: sp('Cl. 3.4 / 4.5 (7)', '4, 14', { equation: 'Eq. 3.1' }), heavySharePercent: 10 },

  /** k of the subgrade from soaked CBR (Table 3.1); the minimum CBR is 4. */
  subgradeK: {
    ref: sp('Cl. 3.5', 4, { table: 'Table 3.1' }),
    cbr: [2, 3, 4, 5, 7, 10, 15, 20, 50],
    k: [21, 28, 35, 42, 48, 50, 62, 69, 140],
    minimumCBR: 4,
  },

  /** Effective k over a granular (150 – 250 mm) or cementitious (150 – 200 mm) sub-base (Table 3.2). */
  effectiveK: {
    ref: sp('Cl. 3.6.3', 6, { table: 'Table 3.2' }),
    cbr: [2, 3, 4, 5, 7, 10, 15, 20, 50],
    granular: [25, 34, 42, 50, 58, 60, 74, 83, 170],
    cementitious: [42, 56, 70, 84, 96, 100, 124, 138, 280],
  },

  /** Sub-base by traffic (Cl. 3.6.2): granular pairs and cementitious alternatives, mm. */
  subBase: {
    ref: sp('Cl. 3.6.2', 5),
    bands: [
      { upTo: 50, granular: [75, 100], cementitious: [150], cementitiousUCS: [3] },
      { upTo: 150, granular: [75, 100], cementitious: [100, 100], cementitiousUCS: [3, 1.5] },
      { upTo: 450, granular: [150, 100], cementitious: [100, 100], cementitiousUCS: [3, 1.5] },
    ],
  },

  /** ff = 0.7 √fck; the 90-day flexural strength is 1.10 x the 28-day one. */
  concrete: {
    ref: sp('Cl. 3.7 / 3.8 / 3.9', '6, 7', { equation: 'Eq. 3.3' }),
    flexuralFactor: 0.7,
    ninetyDayFactor: 1.1,
    minimumFck: 30,
    minimumFlexural: 3.8,
    elasticModulusMPa: 30000,
    poissonRatio: 0.15,
    thermalCoefficient: 10e-6,
  },

  /** log10 Nf = SR^−2.222 / 0.523, for 60% reliability. */
  fatigue: { ref: sp('Cl. 3.10', 8, { equation: 'Eq. 3.5' }), exponent: -2.222, divisor: 0.523 },

  /** Westergaard edge stress, with the equivalent radius of a dual wheel. */
  edgeStress: { ref: sp('Cl. 4.2.1.1', '9 – 11', { equation: 'Eq. 4.1, 4.4 – 4.7' }) },

  /** Bradbury curling at the edge, σ = E α t C / 2. */
  curling: { ref: sp('Cl. 4.2.1.2', '11, 12', { equation: 'Eq. 4.8' }) },

  /**
   * Temperature differentials, °C, by zone for 150, 200 and 250 mm slabs
   * (Table 4.1). The linear part through the full depth is 0.667 of it.
   */
  temperature: {
    ref: sp('Cl. 4.2.1.2 / 4.5 (5)', '12, 13', { table: 'Table 4.1' }),
    thicknessesMm: [150, 200, 250],
    linearShare: 0.667,
    zones: [
      { id: 'I', label: 'I · Punjab, Haryana, UP, Rajasthan, Gujarat, North MP, NE and hill states', values: [12.5, 13.1, 14.3] },
      { id: 'II', label: 'II · Bihar, Jharkhand, West Bengal, Assam, East Orissa', values: [15.6, 16.4, 16.6] },
      { id: 'III', label: 'III · Maharashtra, Karnataka, South MP, Chhattisgarh, AP, West Orissa, North TN', values: [17.3, 19.0, 20.3] },
      { id: 'IV', label: 'IV · Kerala, South Tamil Nadu', values: [15.0, 16.4, 17.6] },
      { id: 'V', label: 'V · Coast bounded by hills', values: [14.6, 15.8, 16.2] },
      { id: 'VI', label: 'VI · Coast unbounded by hills', values: [15.5, 17.0, 19.0] },
    ],
  },

  /**
   * The non-linear part of the day-time differential relieves the edge:
   * a compressive 0.0767 MPa per °C of Δt, Δt being a third of the
   * differential (for α = 10⁻⁵, E = 30,000 MPa, μ = 0.15).
   */
  nonLinear: { ref: sp('Appendix II', '38 – 41', { equation: 'Eq. II-22', table: 'Table II-1' }), edgePerDegree: 0.0767, share: 1 / 3 },

  /** At least 150 mm; transverse joints at 2.50 – 4.00 m. */
  slab: { ref: sp('Cl. 2 / 4.3 / 5.2.1', '3, 13, 16'), minimumMm: 150, jointMinM: 2.5, jointMaxM: 4.0 },
};
