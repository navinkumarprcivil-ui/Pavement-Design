/**
 * IRC design constants, tables and equation coefficients.
 *
 * EVERY value in this file carries a `ref` naming the code, clause and table it
 * comes from, and a `verified` flag. `verified: true` means the value has been
 * read off a copy of the code; `verified: false` means it was entered from
 * engineering references and must be checked against your own copy before the
 * output is used for construction.
 *
 * The IRC:37-2018 values below were checked clause by clause against the code,
 * and the strains the app computes with them reproduce the IITPAVE results
 * printed in its Annex-II and Annex-III (see tests/annexII.test.js).
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
};

/** Build a citation object for display next to a computed step. */
export function ref(codeId, clause, extra = {}) {
  return {
    code: CODES[codeId].designation,
    codeId,
    clause,
    table: extra.table || null,
    equation: extra.equation || null,
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
  ref: ref('IRC37', 'Cl. 3.7 / 4.3.1'),
  verified: true,
  options: [
    { id: 'expressway', label: 'Expressway', important: true, designPeriodYears: 30 },
    { id: 'nh', label: 'National Highway', important: true, designPeriodYears: 20 },
    { id: 'sh', label: 'State Highway', important: true, designPeriodYears: 20 },
    { id: 'urban', label: 'Urban road', important: true, designPeriodYears: 20 },
    { id: 'mdr', label: 'Major District Road', important: false, designPeriodYears: 15 },
    { id: 'other', label: 'Other road', important: false, designPeriodYears: 15 },
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
    ref: ref('IRC37', 'Cl. 4.6.1', { equation: 'Eq. 4.5 / 4.6' }),
    verified: true,
  },

  /** Below this growth rate the code has the design use it anyway. */
  minimumGrowthRate: {
    percent: 5,
    ref: ref('IRC37', 'Cl. 4.2.2'),
    verified: true,
  },

  /**
   * Lateral distribution factor D. On a divided carriageway it applies to the
   * traffic in one direction, so those options are flagged `directional`.
   */
  laneDistributionFactors: {
    ref: ref('IRC37', 'Cl. 4.5.1'),
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
    ref: ref('IRC37', 'Cl. 4.4.6', { table: 'Table 4.2' }),
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
    ref: ref('IRC37', 'Cl. 2.1'),
    verified: true,
  },

  /** Very high density corridors: long-life, or at least 30 years. */
  longLife: {
    thresholdMsa: 300,
    minimumDesignPeriodYears: 30,
    ref: ref('IRC37', 'Cl. 4.3.1'),
    verified: true,
  },
};

/* ------------------------------------------------------------------ *
 * Standard axle and analysis conditions
 * ------------------------------------------------------------------ */

export const STANDARD_AXLE = {
  ref: ref('IRC37', 'Cl. 3.6.1', { table: 'Table 3.1' }),
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
    ref: ref('IRC37', 'Cl. 6.3 / 6.4.2', { equation: 'Eq. 6.1 / 6.2' }),
    verified: true,
    capMPa: 100,
  },

  /** Effective CBR floor for roads above a traffic volume. */
  minimumCBR: {
    percent: 5,
    aboveCVPD: 450,
    ref: ref('IRC37', 'Cl. 6.4.3'),
    verified: true,
  },

  /**
   * Unbound granular layer modulus from its thickness and its support:
   * MR = 0.2 x h^0.45 x MR(support). A granular base on a granular sub-base is
   * treated as one layer of their combined thickness on the subgrade.
   */
  granular: {
    ref: ref('IRC37', 'Cl. 7.2.3', { equation: 'Eq. 7.1' }),
    verified: true,
    coefficient: 0.2,
    exponent: 0.45,
  },

  /** A granular base on a cement treated sub-base takes a fixed modulus. */
  granularOverCTSB: {
    ref: ref('IRC37', 'Cl. 8.1', { table: 'Table 11.1' }),
    verified: true,
    naturalGravelMPa: 300,
    crushedRockMPa: 350,
  },

  /** The aggregate crack relief layer over a cement treated base. */
  crackReliefAggregate: {
    ref: ref('IRC37', 'Cl. 8.3', { table: 'Table 11.1' }),
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
    ref: ref('IRC37', 'Cl. 9.2', { table: 'Table 9.2' }),
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
    ref: ref('IRC37', 'Cl. 7.3.2 / 8.2.1', { table: 'Table 11.1' }),
    verified: true,
    ctbModulusMPa: 5000,
    ctsbModulusMPa: 600,
  },

  poissonRatios: {
    ref: ref('IRC37', 'Cl. 11', { table: 'Table 11.1' }),
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
    ref: ref('IRC37', 'Cl. 3.6.2', { equation: 'Eq. 3.3 / 3.4' }),
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
    ref: ref('IRC37', 'Cl. 3.6.1', { equation: 'Eq. 3.1 / 3.2' }),
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
    ref: ref('IRC37', 'Cl. 3.6.3.1', { equation: 'Eq. 3.5' }),
    verified: true,
    numerator: 113000,
    modulusExponent: 0.804,
    constant: 191,
    exponent: 12,
    reliabilityFactorThresholdMsa: 10,
  },

  /** Cumulative fatigue damage of a CTB, which needs the axle load spectrum. */
  cementedDamage: {
    ref: ref('IRC37', 'Cl. 3.6.3.2', { equation: 'Eq. 3.6 / 3.7' }),
    verified: true,
  },

  /** 90% on important roads, and on others from 20 msa; 80% below. */
  reliability: {
    thresholdMsa: 20,
    ref: ref('IRC37', 'Cl. 3.7'),
    verified: true,
  },

  /** The sub-base is checked for rutting under construction traffic. */
  constructionTraffic: {
    minimumRepetitions: 10000,
    ref: ref('IRC37', 'Cl. 7.2.2'),
    verified: true,
  },
};

/* ------------------------------------------------------------------ *
 * Minimum thicknesses
 * ------------------------------------------------------------------ */

export const MINIMUM_THICKNESS = {
  ref: ref('IRC37', 'Cl. 7.2.2 / 7.3.1 / 8.1 / 8.2.1 / 9.2'),
  verified: true,
  granularSubBaseMm: 150,
  unboundBaseMm: 150,
  crackReliefLayerMm: 100,
  cementTreatedBaseMm: 100,
  cementTreatedSubBaseMm: 200,
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
 * Every value here reproduces the illustrative thickness design of
 * Appendix-VII: its stresses, allowable repetitions and fatigue damage.
 * ------------------------------------------------------------------ */

export const RIGID = {
  concrete: {
    ref: ref('IRC58', 'Appendix-VII'),
    verified: true,
    elasticModulusMPa: 30000,
    poissonRatio: 0.15,
    unitWeightKNPerM3: 24,
    /** Design flexural strength is the 90-day value, 1.1 x the 28-day one. */
    ninetyDayFactor: 1.1,
  },

  traffic: {
    ref: ref('IRC58', 'Appendix-VII'),
    verified: true,
    /** Share of the predominant direction's axles in the design lane, multi-lane. */
    laneShare: 0.25,
    /** Each 12-hour period is analysed as two 6-hour periods. */
    sixHourShare: 0.5,
  },

  /** Night-time differential = day-time differential / 2 + 5 °C. */
  nightTemperature: {
    ref: ref('IRC58', 'Appendix-VII'),
    verified: true,
    dayFraction: 0.5,
    addC: 5,
  },

  /**
   * Maximum edge stress for bottom-up cracking (Appendix-V, Eq. V.1 – V.12):
   *   S = a + b (γh²/kl²) + c (Ph/kl⁴) + d ΔT
   * P in kN, h and l in m, k in MPa/m, γ in kN/m³. Bands are on k.
   */
  bottomUpStress: {
    ref: ref('IRC58', 'Appendix-V', { equation: 'Eq. V.1 – V.12' }),
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
    ref: ref('IRC58', 'Appendix-V', { equation: 'Eq. V.13' }),
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
   * The middle branch reproduces Tables VII.2 and VII.3. No stress ratio in the
   * example exceeds 0.55, so the upper branch is not yet read off the code.
   */
  fatigue: {
    ref: ref('IRC58', 'Appendix-VII', { table: 'Table VII.2 / VII.3' }),
    verified: false,
    endurance: 0.45,
    middle: { upper: 0.55, numerator: 4.2577, offset: 0.4325, exponent: 3.268 },
    upper: { constant: 0.9718, divisor: 0.0828 },
  },
};
