/**
 * IRC design constants, tables and equation coefficients.
 *
 * EVERY value in this file carries a `ref` naming the code, clause and table it
 * comes from, and a `verified` flag. `verified: false` means the value was
 * entered from engineering references rather than read off a controlled copy of
 * the code — it must be checked against your own copy before the output is used
 * for construction. The app surfaces this status on screen; it does not hide it.
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
 * Traffic
 * ------------------------------------------------------------------ */

export const TRAFFIC = {
  /**
   * Cumulative standard axles.
   *   N = 365 * A * D * F * [(1+r)^n - 1] / r
   * with A = P(1+r)^x projected to the year of completion of construction.
   */
  growthEquation: {
    ref: ref('IRC37', 'Cl. 4.7', { equation: 'Eq. 4.1' }),
    verified: false,
  },

  /**
   * Lane distribution factor D: the share of total commercial vehicles that the
   * design lane carries.
   */
  laneDistributionFactors: {
    ref: ref('IRC37', 'Cl. 4.6'),
    verified: false,
    options: [
      {
        id: 'single-lane',
        label: 'Single lane road (carriageway < 5.5 m)',
        value: 1.0,
        note: 'Traffic is channelised; the total of both directions is applied.',
      },
      {
        id: 'two-lane-single-cw',
        label: 'Two-lane single carriageway',
        value: 0.5,
        note: '50% of the total commercial vehicles in both directions.',
      },
      {
        id: 'four-lane-single-cw',
        label: 'Four-lane single carriageway',
        value: 0.4,
        note: '40% of the total commercial vehicles in both directions.',
      },
      {
        id: 'dual-two-lane',
        label: 'Dual carriageway, two lanes each direction',
        value: 0.75,
        note: '75% of the vehicles in the direction of predominant traffic.',
      },
      {
        id: 'dual-three-lane',
        label: 'Dual carriageway, three lanes each direction',
        value: 0.6,
        note: '60% of the vehicles in the direction of predominant traffic.',
      },
      {
        id: 'dual-four-lane',
        label: 'Dual carriageway, four lanes each direction',
        value: 0.45,
        note: '45% of the vehicles in the direction of predominant traffic.',
      },
    ],
  },

  /**
   * Indicative vehicle damage factors where axle load survey data is absent.
   * An axle load survey always takes precedence over these.
   */
  indicativeVDF: {
    ref: ref('IRC37', 'Cl. 4.5', { table: 'Table 4.1' }),
    verified: false,
    rows: [
      { maxCVPD: 150, plainRolling: 1.5, hilly: 0.5 },
      { maxCVPD: 1500, plainRolling: 3.5, hilly: 1.5 },
      { maxCVPD: Infinity, plainRolling: 4.5, hilly: 2.5 },
    ],
  },

  /**
   * Below this design traffic, IRC:37 hands over to the low volume rural roads
   * guidelines. This is the branch the app uses to route a flexible design.
   */
  lowVolumeThresholdMsa: {
    value: 2,
    ref: ref('IRC37', 'Cl. 1.2', {
      note: 'IRC:37 covers design traffic of 2 msa and above; below that IRC:SP:72 applies.',
    }),
    verified: false,
  },

  minimumDesignLifeYears: {
    value: 15,
    ref: ref('IRC37', 'Cl. 4.2'),
    verified: false,
  },
};

/* ------------------------------------------------------------------ *
 * Standard axle and analysis geometry
 * ------------------------------------------------------------------ */

export const STANDARD_AXLE = {
  ref: ref('IRC37', 'Cl. 5.1'),
  verified: false,
  axleLoadKN: 80,
  wheelLoadN: 20000,
  tyrePressureMPa: 0.56,
  dualSpacingMm: 310,
  note:
    'Standard axle 80 kN, dual wheel set, 20 kN per wheel at 0.56 MPa. ' +
    'Responses are examined under the centre of one wheel and at the centre ' +
    'of the dual wheel set.',
};

/* ------------------------------------------------------------------ *
 * Subgrade and granular layer moduli
 * ------------------------------------------------------------------ */

export const MODULI = {
  /** Subgrade resilient modulus from effective CBR. */
  subgrade: {
    ref: ref('IRC37', 'Cl. 6.2', { equation: 'Eq. 6.1 / 6.2' }),
    verified: false,
    note:
      'MR = 10 x CBR for CBR <= 5%; MR = 17.6 x CBR^0.64 for CBR > 5%. ' +
      'CBR is the effective CBR of the 500 mm of subgrade below the sub-base, ' +
      'at the design moisture content and 97% of MDD.',
    capMPa: 100,
  },

  /** Granular (unbound) layer modulus, from the supporting layer modulus. */
  granular: {
    ref: ref('IRC37', 'Cl. 7.3', { equation: 'Eq. 7.1' }),
    verified: false,
    note:
      'MR(granular) = 0.2 x h^0.45 x MR(support), h in mm, valid for total ' +
      'granular thickness of roughly 150-450 mm.',
    coefficient: 0.2,
    exponent: 0.45,
    minThicknessMm: 150,
    maxThicknessMm: 450,
  },

  /**
   * Indicative resilient moduli of bituminous mixes, MPa, by binder grade and
   * mean annual pavement temperature. Laboratory-measured values for the actual
   * mix always take precedence.
   */
  bituminous: {
    ref: ref('IRC37', 'Cl. 8.2', { table: 'Table 8.1' }),
    verified: false,
    temperaturesC: [20, 25, 30, 35, 40],
    byBinder: {
      VG10: [2300, 2000, 1450, 1000, 800],
      VG30: [3500, 3000, 2500, 1700, 1250],
      VG40: [6000, 5000, 4000, 3000, 2000],
      'Modified (PMB/CRMB)': [5700, 4700, 3800, 2800, 1900],
    },
    poissonRatio: 0.35,
  },

  /** Cement treated / cementitious layers. */
  cemented: {
    ref: ref('IRC37', 'Cl. 7.4'),
    verified: false,
    ctbModulusMPa: 5000,
    ctsbModulusMPa: 600,
    poissonRatio: 0.25,
    note:
      'Cement treated base taken as 5000 MPa for a 7-day UCS in the 4.5-7 MPa ' +
      'range; cement treated sub-base taken as 600 MPa.',
  },

  poissonRatios: {
    ref: ref('IRC37', 'Cl. 5.3'),
    verified: false,
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
   * Fatigue of the bituminous layer, driven by horizontal tensile strain at its
   * underside:
   *   Nf = C * k1 * 1e-4 * (1/eps_t)^3.89 * (1/MR)^0.854
   *   C  = 10^M,  M = 4.84 * (Vbe / (Va + Vbe) - 0.69)
   */
  bituminousFatigue: {
    ref: ref('IRC37', 'Cl. 6.4', { equation: 'Eq. 6.2 / 6.3' }),
    verified: false,
    strainExponent: 3.89,
    modulusExponent: 0.854,
    coefficients: {
      80: 1.6064e-4,
      90: 0.5161e-4,
    },
    mixFactor: { slope: 4.84, offset: 0.69 },
    note:
      'Reliability of 80% is normally used for design traffic below 20 msa and ' +
      '90% at or above 20 msa. Va is air void content and Vbe the volume of ' +
      'effective binder, both per cent by volume of the mix.',
  },

  /**
   * Subgrade rutting, driven by vertical compressive strain at the top of the
   * subgrade:  Nr = k * (1/eps_v)^4.5337
   */
  subgradeRutting: {
    ref: ref('IRC37', 'Cl. 6.5', { equation: 'Eq. 6.4 / 6.5' }),
    verified: false,
    strainExponent: 4.5337,
    coefficients: {
      80: 4.1656e-8,
      90: 1.41e-8,
    },
    note:
      'Rut depth of 20 mm in the design period. Reliability is selected on the ' +
      'same basis as the fatigue check.',
  },

  /**
   * Fatigue of a cement treated base, driven by tensile strain at its underside.
   *   Nf = RF * 1.0957e-4 * (1/eps_t)^(1/0.804)   [see note]
   * Held separately so it can be corrected without touching the rest.
   */
  cementedFatigue: {
    ref: ref('IRC37', 'Cl. 6.6'),
    verified: false,
    reliabilityFactors: { 80: 1.0, 90: 0.5 },
    coefficient: 1.0957e-4,
    strainExponent: 1 / 0.804,
    note:
      'UNVERIFIED — the cement treated base fatigue relation must be checked ' +
      'against IRC:37-2018 before this check is relied upon. The structural ' +
      'analysis feeding it is exact; only this criterion is provisional.',
  },

  reliabilityThresholdMsa: {
    value: 20,
    ref: ref('IRC37', 'Cl. 6.1'),
    verified: false,
    note: 'Below 20 msa design at 80% reliability; at or above 20 msa use 90%.',
  },
};

/* ------------------------------------------------------------------ *
 * Minimum thickness and constructability rules
 * ------------------------------------------------------------------ */

export const MINIMUM_THICKNESS = {
  ref: ref('IRC37', 'Cl. 9'),
  verified: false,
  granularSubBaseMm: 150,
  granularBaseMm: 150,
  wetMixMacadamMm: 250,
  waterBoundMacadamMm: 225,
  cementTreatedBaseMm: 100,
  cementTreatedSubBaseMm: 150,
  bituminousCourseMm: 40,
  crackReliefLayerMm: 100,
  note:
    'A cement treated base requires a crack relief interlayer (an aggregate ' +
    'interlayer of about 100 mm, or a stress absorbing membrane interlayer) ' +
    'between it and the bituminous layer.',
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

/**
 * Every constant table in this module, for the "code references" screen and the
 * verification banner.
 */
export const CONSTANT_GROUPS = [
  { key: 'Traffic growth', entry: TRAFFIC.growthEquation },
  { key: 'Lane distribution factor', entry: TRAFFIC.laneDistributionFactors },
  { key: 'Indicative VDF', entry: TRAFFIC.indicativeVDF },
  { key: 'Low volume threshold', entry: TRAFFIC.lowVolumeThresholdMsa },
  { key: 'Standard axle', entry: STANDARD_AXLE },
  { key: 'Subgrade modulus', entry: MODULI.subgrade },
  { key: 'Granular modulus', entry: MODULI.granular },
  { key: 'Bituminous modulus', entry: MODULI.bituminous },
  { key: 'Cemented modulus', entry: MODULI.cemented },
  { key: 'Bituminous fatigue', entry: CRITERIA.bituminousFatigue },
  { key: 'Subgrade rutting', entry: CRITERIA.subgradeRutting },
  { key: 'Cemented fatigue', entry: CRITERIA.cementedFatigue },
  { key: 'Minimum thicknesses', entry: MINIMUM_THICKNESS },
];

export function unverifiedCount() {
  return CONSTANT_GROUPS.filter((g) => g.entry.verified === false).length;
}
