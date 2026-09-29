/**
 * IRC design constants, tables and equation coefficients.
 *
 * EVERY value in this file carries a `ref` naming the code, clause and table it
 * comes from, and a `verified` flag. `verified: true` means the value has been
 * read off a copy of the code; `verified: false` means it was entered from
 * engineering references and must be checked against your own copy before the
 * output is used for construction.
 *
 * The IRC:37-2018 and IRC:58-2015 values below were checked clause by clause
 * against the codes; each citation carries the printed page (`page`) it was
 * read on. docs/VERIFICATION.md lists every value with its clause and page.
 * The strains the app computes reproduce the IITPAVE results printed in
 * IRC:37 Annex-II and Annex-III (see tests/annexII.test.js).
 *
 * IRC codes are copyrighted publications of the Indian Roads Congress. Only the
 * numerical parameters needed to compute are held here, alongside the citation
 * telling you where to read the clause in your own copy. No code text, page
 * images or tables are reproduced.
 */

export const CODES = {
  IRC37: {
    id: 'IRC37',
    title: 'Guidelines for the Design of Flexible Pavements',
    designation: 'IRC:37-2018',
    edition: 'Fourth Revision, 2018',
    publisher: 'Indian Roads Congress',
  },
  IRC58: {
    id: 'IRC58',
    title: 'Guidelines for the Design of Plain Jointed Rigid Pavements for Highways',
    designation: 'IRC:58-2015',
    edition: 'Fourth Revision, 2015',
    publisher: 'Indian Roads Congress',
  },
  IRCSP72: {
    id: 'IRCSP72',
    title: 'Guidelines for the Design of Flexible Pavements for Low Volume Rural Roads',
    designation: 'IRC:SP:72-2015',
    edition: 'First Revision, 2015',
    publisher: 'Indian Roads Congress',
  },
  IRCSP62: {
    id: 'IRCSP62',
    title: 'Guidelines for Design and Construction of Cement Concrete Pavements for Low Volume Roads',
    designation: 'IRC:SP:62-2014',
    edition: 'First Revision, 2014',
    publisher: 'Indian Roads Congress',
  },
};

/** Build a citation object for display next to a computed step. */
export function ref(codeId, clause, extra = {}) {
  return {
    code: CODES[codeId].designation,
    codeId,
    clause,
    table: extra.table || null,
    equation: extra.equation || null,
    /** The printed page number in the code, to open it at. */
    page: extra.page ?? null,
    note: extra.note || null,
  };
}

/* ------------------------------------------------------------------ *
 * Road category
 *
 * The category decides the reliability level, the design period and the
 * reliability factor of a cement treated base. Expressways, national and
 * state highways and urban roads are the code's "important roads".
 * ------------------------------------------------------------------ */

export const ROAD_CATEGORIES = {
  ref: ref('IRC37', 'Cl. 3.7 / 4.3.1', { page: '8, 14' }),
  verified: true,
  options: [
    { id: 'expressway', label: 'Expressway', important: true, designPeriodYears: 30 },
    { id: 'nh', label: 'National Highway', important: true, designPeriodYears: 20 },
    { id: 'sh', label: 'State Highway', important: true, designPeriodYears: 20 },
    { id: 'urban', label: 'Urban road', important: true, designPeriodYears: 20 },
    { id: 'mdr', label: 'Major District Road', important: false, designPeriodYears: 15 },
    { id: 'odr', label: 'Other District Road', important: false, designPeriodYears: 15 },
    { id: 'village', label: 'Village Road', important: false, designPeriodYears: 15 },
  ],
};

export function roadCategory(id) {
  return ROAD_CATEGORIES.options.find((o) => o.id === id) || null;
}

/* ------------------------------------------------------------------ *
 * Traffic
 * ------------------------------------------------------------------ */

export const TRAFFIC = {
  /**
   * Cumulative standard axles.
   *   N = 365 * A * D * F * [(1+r)^n - 1] / r        (Eq. 4.5)
   *   A = P(1+r)^x, the traffic in the year of completion   (Eq. 4.6)
   * A is directional on a divided carriageway and two-way otherwise.
   */
  growthEquation: {
    ref: ref('IRC37', 'Cl. 4.6.1', { equation: 'Eq. 4.5 / 4.6', page: 17 }),
    verified: true,
  },

  /** Below this growth rate the code has the design use it anyway. */
  minimumGrowthRate: {
    percent: 5,
    ref: ref('IRC37', 'Cl. 4.2.2', { page: 14 }),
    verified: true,
  },

  /**
   * Lateral distribution factor D. On a divided carriageway it applies to the
   * traffic in one direction, so those options are flagged `directional`.
   */
  laneDistributionFactors: {
    ref: ref('IRC37', 'Cl. 4.5.1', { page: '16, 17' }),
    verified: true,
    options: [
      { id: 'single-lane', label: 'Single lane', value: 1.0, directional: false },
      { id: 'intermediate-lane', label: 'Intermediate lane, 5.5 m', value: 0.75, directional: false },
      { id: 'two-lane-single-cw', label: 'Two lane, two way', value: 0.5, directional: false },
      { id: 'four-lane-single-cw', label: 'Four lane, undivided', value: 0.4, directional: false },
      { id: 'dual-two-lane', label: 'Divided, two lanes each way', value: 0.75, directional: true },
      { id: 'dual-three-lane', label: 'Divided, three lanes each way', value: 0.6, directional: true },
      { id: 'dual-four-lane', label: 'Divided, four lanes each way', value: 0.45, directional: true },
    ],
  },

  /**
   * Indicative vehicle damage factors where no axle load survey exists, by
   * initial two-way commercial traffic. A survey always takes precedence.
   */
  indicativeVDF: {
    ref: ref('IRC37', 'Cl. 4.4.6', { table: 'Table 4.2', page: 16 }),
    verified: true,
    rows: [
      { maxCVPD: 150, plainRolling: 1.7, hilly: 0.6 },
      { maxCVPD: 1500, plainRolling: 3.9, hilly: 1.7 },
      { maxCVPD: Infinity, plainRolling: 5.0, hilly: 2.8 },
    ],
  },

  /** IRC:37 covers 2 msa and above; below that IRC:SP:72 applies. */
  lowVolumeThresholdMsa: {
    value: 2,
    ref: ref('IRC37', 'Cl. 2.1', { page: 3 }),
    verified: true,
  },

  /** Very high density corridors: long-life, or at least 30 years. */
  longLife: {
    thresholdMsa: 300,
    minimumDesignPeriodYears: 30,
    ref: ref('IRC37', 'Cl. 4.3.1', { page: 14 }),
    verified: true,
  },
};

/* ------------------------------------------------------------------ *
 * Standard axle and analysis conditions
 * ------------------------------------------------------------------ */

export const STANDARD_AXLE = {
  ref: ref('IRC37', 'Cl. 3.6.1 / 3.6.3.1', { table: 'Table 3.1', page: '5 – 7, 9' }),
  verified: true,
  axleLoadKN: 80,
  wheelLoadN: 20000,
  tyrePressureMPa: 0.56,
  /** The cement treated base strain is analysed at a higher contact stress. */
  ctbTyrePressureMPa: 0.8,
  dualSpacingMm: 310,
};

/* ------------------------------------------------------------------ *
 * Layer moduli
 * ------------------------------------------------------------------ */

export const MODULI = {
  /** Subgrade resilient modulus from effective CBR, capped for design. */
  subgrade: {
    ref: ref('IRC37', 'Cl. 6.3 / 6.4.2', { equation: 'Eq. 6.1 / 6.2', page: '19, 20' }),
    verified: true,
    capMPa: 100,
  },

  /**
   * A select borrow subgrade over a weaker embankment is replaced by one
   * layer giving the same surface deflection under a single wheel.
   */
  effectiveSubgrade: {
    ref: ref('IRC37', 'Cl. 6.4.1', { equation: 'Eq. 6.3', page: 20 }),
    verified: true,
    wheelLoadN: 40000,
    tyrePressureMPa: 0.56,
    poissonRatio: 0.35,
    subgradeThicknessMm: 500,
  },

  /** Effective CBR floor for roads above a traffic volume. */
  minimumCBR: {
    percent: 5,
    aboveCVPD: 450,
    ref: ref('IRC37', 'Cl. 6.4.3', { page: 20 }),
    verified: true,
  },

  /**
   * Unbound granular layer modulus from its thickness and its support:
   * MR = 0.2 x h^0.45 x MR(support). A granular base on a granular sub-base is
   * treated as one layer of their combined thickness on the subgrade.
   */
  granular: {
    ref: ref('IRC37', 'Cl. 7.2.3', { equation: 'Eq. 7.1', page: 22 }),
    verified: true,
    coefficient: 0.2,
    exponent: 0.45,
  },

  /** A granular base on a cement treated sub-base takes a fixed modulus. */
  granularOverCTSB: {
    ref: ref('IRC37', 'Cl. 8.1', { table: 'Table 11.1', page: '24, 34' }),
    verified: true,
    naturalGravelMPa: 300,
    crushedRockMPa: 350,
  },

  /** The aggregate crack relief layer over a cement treated base. */
  crackReliefAggregate: {
    ref: ref('IRC37', 'Cl. 8.3', { table: 'Table 11.1', page: '26, 34' }),
    verified: true,
    modulusMPa: 450,
  },

  /**
   * Indicative maximum resilient moduli of bituminous mixes, MPa, by binder
   * and average annual pavement temperature. The whole bituminous layer takes
   * the modulus of the bottom (DBM) mix, whose binder is VG40 or VG30; the
   * code does not recommend modified binder in DBM.
   */
  bituminous: {
    ref: ref('IRC37', 'Cl. 9.2 / 11.1.2', { table: 'Table 9.2', page: '29, 30, 33' }),
    verified: true,
    temperaturesC: [20, 25, 30, 35, 40],
    byBinder: {
      VG10: [2300, 2000, 1450, 1000, 800],
      VG30: [3500, 3000, 2500, 2000, 1250],
      VG40: [6000, 5000, 4000, 3000, 2000],
    },
  },

  /** Cement treated base and sub-base. */
  cemented: {
    ref: ref('IRC37', 'Cl. 7.3.2 / 8.2.1', { table: 'Table 11.1', page: '23, 25, 34' }),
    verified: true,
    ctbModulusMPa: 5000,
    ctsbModulusMPa: 600,
  },

  /** Reclaimed asphalt base treated with foamed bitumen or bitumen emulsion. */
  rapBase: {
    ref: ref('IRC37', 'Cl. 8.4', { page: 27 }),
    verified: true,
    modulusMPa: 800,
    poissonRatio: 0.35,
  },

  poissonRatios: {
    ref: ref('IRC37', 'Cl. 6.3 / 7.2.3 / 11.1.4', { table: 'Table 11.1', page: 34 }),
    verified: true,
    granular: 0.35,
    subgrade: 0.35,
    bituminous: 0.35,
    cemented: 0.25,
  },
};

/* ------------------------------------------------------------------ *
 * Performance criteria
 * ------------------------------------------------------------------ */

export const CRITERIA = {
  /**
   * Fatigue of the bottom bituminous layer:
   *   Nf = k * C * (1/eps_t)^3.89 * (1/MR)^0.854,  C = 10^[4.84 (Vbe/(Va+Vbe) - 0.69)]
   * Va and Vbe are those of the bottom layer: 3.5% air voids for a single DBM
   * layer and 3.0% for the bottom of two (Cl. 9.2).
   */
  bituminousFatigue: {
    ref: ref('IRC37', 'Cl. 3.6.2 / 9.2', { equation: 'Eq. 3.3 / 3.4', page: '6, 31' }),
    verified: true,
    strainExponent: 3.89,
    modulusExponent: 0.854,
    coefficients: {
      80: 1.6064e-4,
      90: 0.5161e-4,
    },
    mixFactor: { slope: 4.84, offset: 0.69 },
  },

  /** Subgrade rutting (20 mm):  Nr = k * (1/eps_v)^4.5337 */
  subgradeRutting: {
    ref: ref('IRC37', 'Cl. 3.6.1', { equation: 'Eq. 3.1 / 3.2', page: 5 }),
    verified: true,
    strainExponent: 4.5337,
    coefficients: {
      80: 4.1656e-8,
      90: 1.41e-8,
    },
  },

  /**
   * Fatigue of a cement treated base, strain in microstrain:
   *   N = RF * [(113000 / E^0.804 + 191) / eps_t]^12
   * RF is 1 on important roads and above 10 msa, 2 otherwise. The strain is
   * analysed at 0.80 MPa contact stress.
   */
  cementedFatigue: {
    ref: ref('IRC37', 'Cl. 3.6.3.1', { equation: 'Eq. 3.5', page: 7 }),
    verified: true,
    numerator: 113000,
    modulusExponent: 0.804,
    constant: 191,
    exponent: 12,
    reliabilityFactorThresholdMsa: 10,
  },

  /** Cumulative fatigue damage of a CTB, which needs the axle load spectrum. */
  cementedDamage: {
    ref: ref('IRC37', 'Cl. 3.6.3.2', { equation: 'Eq. 3.6 / 3.7', page: '7, 8' }),
    verified: true,
    intercept: 0.972,
    slope: 0.0825,
    allowableDamage: 1,
    tyrePressureMPa: 0.8,
    /** A tandem counts as two single axles at half its load, a tridem as three at a third. */
    singleAxlesPer: { single: 1, tandem: 2, tridem: 3 },
  },

  /** Modulus of rupture of the CTB: a share of the 28-day UCS, up to a cap per material. */
  ctbRupture: {
    ref: ref('IRC37', 'Cl. 8.2.2', { page: 26 }),
    verified: true,
    ucsShare: 0.2,
    materials: [
      { id: 'aggregate', label: 'Cement stabilised aggregate', short: 'Stabilised aggregate', maxMPa: 1.4 },
      { id: 'limeFlyash', label: 'Lime-flyash-soil', short: 'Lime-flyash-soil', maxMPa: 1.05 },
      { id: 'soilCement', label: 'Soil-cement', short: 'Soil-cement', maxMPa: 0.7 },
    ],
  },

  /** 90% on important roads, and on others from 20 msa; 80% below. */
  reliability: {
    thresholdMsa: 20,
    ref: ref('IRC37', 'Cl. 3.7', { page: 8 }),
    verified: true,
  },

  /** The sub-base is checked for rutting under construction traffic. */
  constructionTraffic: {
    minimumRepetitions: 10000,
    ref: ref('IRC37', 'Cl. 7.2.2', { page: '21, 22' }),
    verified: true,
    /** Dumper loads and trips to start from, as in the Annex-II examples. */
    dumper: { rearTandemKN: 240, frontKN: 80, subBaseTrips: 200, ctbTrips: 70 },
    /** Equivalence of a dumper's axles to standard axles, as the examples work it. */
    vdf: {
      ref: ref('IRC37', 'Annex-II', { note: 'Example II.2', page: 69 }),
      singleAxleKN: 80,
      singleWheelAxleKN: 65,
      exponent: 4,
    },
  },

  /** A freshly laid CTB carries the dumpers bringing the layer above it. */
  ctbConstruction: {
    ref: ref('IRC37', 'Cl. 8.2.1', { note: 'Annex-II, Example II.4', page: '25, 76' }),
    verified: true,
    /** 7-day flexural strength as a share of the 28-day modulus of rupture. */
    sevenDayShare: 0.7,
  },
};

/* ------------------------------------------------------------------ *
 * Minimum thicknesses
 * ------------------------------------------------------------------ */

export const MINIMUM_THICKNESS = {
  ref: ref('IRC37', 'Cl. 7.2.2 / 7.3.1 / 8.1 / 8.2.1 / 8.4 / 9.2', { page: '21 – 27, 32' }),
  verified: true,
  granularSubBaseMm: 150,
  unboundBaseMm: 150,
  crackReliefLayerMm: 100,
  cementTreatedBaseMm: 100,
  cementTreatedSubBaseMm: 200,
  rapBaseMm: 100,
  /** Bituminous layers over a CTB, above this design traffic. */
  bituminousOverCTB: { mm: 100, aboveMsa: 20 },
};

/**
 * Practical construction increments. Design thicknesses are rounded up to these
 * so the answer is something that can actually be laid.
 */
export const THICKNESS_INCREMENTS = {
  bituminousMm: 5,
  granularMm: 10,
  cementedMm: 10,
};

/* ------------------------------------------------------------------ *
 * Rigid pavements — IRC:58-2015
 *
 * Checked against the code's clauses and against its illustrative design in
 * Appendix-VII, whose stresses, allowable repetitions and fatigue damage the
 * engine reproduces.
 * ------------------------------------------------------------------ */

export const RIGID = {
  /** The guidelines apply above this many commercial vehicles a day. */
  scope: {
    ref: ref('IRC58', 'Cl. 2.1 / 6.2.5 / 7.2.6', { page: '2, 17, 27' }),
    verified: true,
    minimumCVPD: 450,
  },

  concrete: {
    ref: ref('IRC58', 'Cl. 5.8.1 / 5.8.2 / 5.8.4.1 / Appendix-V', { page: '12, 13, 74' }),
    verified: true,
    elasticModulusMPa: 30000,
    poissonRatio: 0.15,
    unitWeightKNPerM3: 24,
    /** Design flexural strength may be the 90-day value, 1.1 x the 28-day one. */
    ninetyDayFactor: 1.1,
    minimumFlexural28MPa: 4.5,
  },

  traffic: {
    ref: ref('IRC58', 'Cl. 5.2 / 5.5.2.1 / 5.5.2.3 / 5.5.2.4 / 6.3.3', { page: '4, 5, 18' }),
    verified: true,
    minimumGrowthRatePercent: 5,
    /** 25% of two-way traffic on two-lane roads, of the predominant direction on divided roads. */
    laneShare: 0.25,
    /** Each 12-hour period is analysed as two 6-hour periods. */
    sixHourShare: 0.5,
    /** Share with wheel base under the joint spacing, when no survey says otherwise. */
    defaultShortWheelBaseShare: 0.5,
    /** Load class widths for the axle load spectrum, kN. */
    classWidthKN: { single: 10, tandem: 20, tridem: 30 },
  },

  /**
   * Maximum day-time temperature differential by zone, °C, against slab
   * thickness (Table 1). The last column covers 300 to 400 mm.
   */
  temperature: {
    ref: ref('IRC58', 'Cl. 5.6.1.1', { table: 'Table 1', page: '6, 7' }),
    verified: true,
    thicknessesMm: [150, 200, 250, 300],
    zones: [
      { id: 'I', label: 'I · Hilly regions', values: [12.5, 13.1, 14.3, 15.8] },
      { id: 'II', label: 'II · Punjab, UP, Gujarat, Rajasthan, Haryana, North MP', values: [12.5, 13.1, 14.3, 15.8] },
      { id: 'III', label: 'III · Bihar, Jharkhand, West Bengal, Assam, East Orissa', values: [15.6, 16.4, 16.6, 16.8] },
      { id: 'IV', label: 'IV · Maharashtra, Karnataka, South MP, Chhattisgarh, AP, West Orissa, North TN', values: [17.3, 19.0, 20.3, 21.0] },
      { id: 'V', label: 'V · Kerala, South Tamil Nadu', values: [15.0, 16.4, 17.6, 18.1] },
      { id: 'VI', label: 'VI · Coast bounded by hills', values: [14.6, 15.8, 16.2, 17.0] },
      { id: 'VII', label: 'VII · Coast unbounded by hills', values: [15.5, 17.0, 19.0, 19.2] },
    ],
  },

  /** Night-time differential = day-time / 2, plus 5 °C of built-in curl. */
  nightTemperature: {
    ref: ref('IRC58', 'Cl. 5.6.1.1 / 5.6.2.1 / 5.6.2.3', { page: '6 – 8' }),
    verified: true,
    dayFraction: 0.5,
    addC: 5,
  },

  /** k of a homogeneous subgrade from its soaked CBR (Table 2). */
  subgradeK: {
    ref: ref('IRC58', 'Cl. 5.7.3.4 / 5.7.3.6', { table: 'Table 2', page: '9, 10' }),
    verified: true,
    cbr: [2, 3, 4, 5, 7, 10, 15, 20, 50, 100],
    k: [21, 28, 35, 42, 48, 55, 62, 69, 140, 220],
    minimumCBR: 8,
  },

  /** Effective k over untreated granular and cement treated sub-bases (Table 3). */
  subBaseK: {
    ref: ref('IRC58', 'Cl. 5.7.4.4', { table: 'Table 3', page: '11, 12' }),
    verified: true,
    subgradeK: [28, 56, 84],
    granular: { thicknessesMm: [150, 225, 300], k: [[39, 44, 53], [63, 75, 88], [92, 102, 119]] },
    cementTreated: { thicknessesMm: [100, 150, 200], k: [[76, 108, 141], [127, 173, 225]] },
  },

  /** Effective k over a DLC sub-base; the GSB below it is ignored (Table 4). */
  dlcK: {
    ref: ref('IRC58', 'Cl. 5.7.4.1 / 5.7.4.4', { table: 'Table 4', page: '11, 12' }),
    verified: true,
    subgradeK: [21, 28, 42, 48, 55, 62],
    thicknessesMm: [100, 150],
    k: [[56, 97, 166, 208, 278, 300], [97, 138, 208, 277, 300, 300]],
    maximumK: 300,
    minimumThicknessMm: 150,
  },

  /**
   * Maximum edge stress for bottom-up cracking (Appendix-V, Eq. V.1 – V.12):
   *   S = a + b (γh²/kl²) + c (Ph/kl⁴) + d ΔT
   * P in kN, h and l in m, k in MPa/m, γ in kN/m³. Bands are on k.
   */
  bottomUpStress: {
    ref: ref('IRC58', 'Cl. 6.2.7 / Appendix-V', { equation: 'Eq. V.1 – V.12', page: '18, 73, 74' }),
    verified: true,
    kBands: [80, 150],
    single: {
      tied: [[0.008, -6.12, 2.36, 0.0266], [0.08, -9.69, 2.09, 0.0409], [0.042, 3.26, 1.62, 0.0522]],
      untied: [[-0.149, -2.6, 3.13, 0.0297], [-0.119, -2.99, 2.78, 0.0456], [-0.238, 7.02, 2.41, 0.0585]],
    },
    tandem: {
      tied: [[-0.188, 0.93, 1.025, 0.0207], [-0.174, 1.21, 0.87, 0.0364], [-0.21, 3.88, 0.73, 0.0506]],
      untied: [[-0.223, 2.73, 1.335, 0.0229], [-0.276, 5.78, 1.14, 0.0404], [-0.3, 9.88, 0.965, 0.0543]],
    },
  },

  /**
   * Maximum stress at the top of the slab for top-down cracking (Eq. V.13):
   *   S = a + b B (Ph/kl⁴) + c (h²/kl²) + d ΔT
   * P is the whole rear single axle, half a tandem, a third of a tridem.
   */
  topDownStress: {
    ref: ref('IRC58', 'Cl. 6.2.7 / Appendix-V', { equation: 'Eq. V.13', page: '18, 74, 75' }),
    verified: true,
    coefficients: [-0.219, 1.686, 168.48, 0.1089],
    beta: { doweled: 0.66, undoweled: 0.9 },
    axleShare: { single: 1, tandem: 0.5, tridem: 1 / 3 },
  },

  /**
   * Allowable repetitions from the stress ratio SR:
   *   SR < 0.45            unlimited
   *   0.45 ≤ SR ≤ 0.55     N = [4.2577 / (SR − 0.4325)]^3.268
   *   SR > 0.55            log10 N = (0.9718 − SR) / 0.0828
   * The code prints the last condition as SR < 0.55; it can only mean > 0.55.
   */
  fatigue: {
    ref: ref('IRC58', 'Cl. 5.8.6.1', { equation: 'Eq. 5 / 6', page: '13, 14' }),
    verified: true,
    endurance: 0.45,
    middle: { upper: 0.55, numerator: 4.2577, offset: 0.4325, exponent: 3.268 },
    upper: { constant: 0.9718, divisor: 0.0828 },
  },

  /** CFD(BUC) + CFD(TDC) ≤ 1; 10 mm may be added for retexturing and grinding. */
  criterion: {
    ref: ref('IRC58', 'Cl. 6.3.4.1', { equation: 'Eq. 7 / 8', page: 19 }),
    verified: true,
    maximumCFD: 1,
    retexturingMm: 10,
  },

  /**
   * PQC bonded to a DLC layer (Cl. 6.7): the slab designed over the granular
   * layer below the DLC is replaced by a thinner PQC whose flexural stiffness
   * bonded to the DLC is at least the designed slab's (Eq. 10 – 13). The DLC
   * modulus is 1000 × its 28-day compressive strength.
   */
  bonded: {
    ref: ref('IRC58', 'Cl. 6.7.2 / 6.7.3', { equation: 'Eq. 10 – 13', page: '22, 23' }),
    verified: true,
    dlcModulusFactor: 1000,
    dlcPoissonRatio: 0.2,
    minimumDlcSevenDayMPa: 10,
    dlc28DayMPa: 13.6,
    dlcMm: 150,
    granularMm: { min: 200, max: 250 },
    example: ref('IRC58', 'Appendix-VII, Option IV', { page: 89 }),
  },

  /**
   * Tie bars across longitudinal joints (Cl. 8.2, IRC:15): steel to hold the
   * slab against friction, As = b f W / Sst, and the length to develop the
   * bar twice over in bond, L = 2 Sst A / (B P), plus 100 mm for loss of bond
   * to painting and 50 mm for placement (Appendix-IX).
   */
  tieBars: {
    ref: ref('IRC58', 'Cl. 8.2', { equation: 'Eq. 16 / 17', table: 'Table 6', page: '28, 29' }),
    verified: true,
    friction: 1.5,
    concreteUnitWeightKNm3: 24,
    steel: {
      plain: { label: 'Plain', allowableMPa: 125, bondMPa: 1.75 },
      deformed: { label: 'Deformed', allowableMPa: 200, bondMPa: 2.46 },
    },
    paintingAllowanceMm: 100,
    placementAllowanceMm: 50,
    maximumDiameterMm: 16,
    maximumSpacingMm: 750,
    diametersMm: [8, 10, 12, 16],
    laneWidthM: 3.5,
    example: ref('IRC58', 'Appendix-IX', { page: '92, 93' }),
  },

  /** Dowel bars by slab thickness: [slab, diameter, length, spacing] mm (Table 5). */
  dowels: {
    ref: ref('IRC58', 'Cl. 7.2.6', { table: 'Table 5', page: 27 }),
    verified: true,
    minimumSlabMm: 200,
    rows: [
      [200, 25, 360, 300],
      [230, 30, 400, 300],
      [250, 32, 450, 300],
      [280, 36, 450, 300],
      [300, 38, 500, 300],
      [350, 38, 500, 300],
    ],
  },
};
