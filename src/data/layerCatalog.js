/**
 * The layer combinations the user picks from, and what each material implies
 * structurally. Adding a new material means adding an entry here — the design
 * engine and the UI both read from this catalogue.
 *
 * Minimum thicknesses of the unbound and cemented layers are the IRC:37-2018
 * values; those of the individual bituminous courses follow the MoRTH
 * specifications, which the code defers to.
 */

import { MINIMUM_THICKNESS, BITUMINOUS_RULES } from './ircConstants.js';

/** How a material behaves in the structural model. */
export const BEHAVIOUR = {
  BITUMINOUS: 'bituminous',
  GRANULAR: 'granular',
  CEMENTED: 'cemented',
  /** Bitumen treated: a fixed modulus, not a fatigue layer of its own. */
  TREATED: 'treated',
  SUBGRADE: 'subgrade',
};

export const BITUMINOUS_OPTIONS = [
  {
    id: 'BC_DBM',
    label: 'BC over DBM',
    short: 'BC + DBM',
    courses: [
      { id: 'BC', label: 'Bituminous Concrete (BC)', minMm: 40, defaultMm: 40 },
      { id: 'DBM', label: 'Dense Bituminous Macadam (DBM)', minMm: 50, defaultMm: 60 },
    ],
  },
  {
    id: 'SDBC_DBM',
    label: 'SDBC over DBM',
    short: 'SDBC + DBM',
    courses: [
      { id: 'SDBC', label: 'Semi Dense Bituminous Concrete (SDBC)', minMm: 25, defaultMm: 30 },
      { id: 'DBM', label: 'Dense Bituminous Macadam (DBM)', minMm: 50, defaultMm: 60 },
    ],
  },
  {
    id: 'BC_ONLY',
    label: 'BC only',
    short: 'BC',
    courses: [
      { id: 'BC', label: 'Bituminous Concrete (BC)', minMm: 40, defaultMm: 50 },
    ],
  },
  {
    id: 'BC_BM',
    label: 'BC over BM',
    short: 'BC + BM',
    belowMsaOnly: true,
    courses: [
      { id: 'BC', label: 'Bituminous Concrete (BC)', minMm: 40, defaultMm: 40 },
      { id: 'BM', label: 'Bituminous Macadam (BM)', minMm: 50, defaultMm: 50 },
    ],
  },
  {
    id: 'SDBC_BM',
    label: 'SDBC over BM',
    short: 'SDBC + BM',
    belowMsaOnly: true,
    courses: [
      { id: 'SDBC', label: 'Semi Dense Bituminous Concrete (SDBC)', minMm: 25, defaultMm: 30 },
      { id: 'BM', label: 'Bituminous Macadam (BM)', minMm: 50, defaultMm: 50 },
    ],
  },
];

/**
 * Whether Table 9.1 admits a bituminous option at this traffic and road
 * category: SDBC and BM only below 20 msa and off national highways and
 * expressways.
 */
export function bituminousAllowed(option, msa, categoryId) {
  const r = BITUMINOUS_RULES;
  const heavy = msa >= r.vg40FromMsa || r.vg40Categories.includes(categoryId);
  const sdbc = option.courses.some((c) => c.id === 'SDBC');
  return !(heavy && (sdbc || option.belowMsaOnly));
}

/**
 * Binders Table 9.1 admits for the bottom bituminous course: VG40 always;
 * VG30 below 20 msa off national highways and expressways; VG10 where snow
 * bound. BM has moduli for VG10 and VG30 only (Table 9.2).
 */
export function bindersAllowed(bottomCourseId, msa, categoryId, snowBound) {
  const r = BITUMINOUS_RULES;
  const heavy = msa >= r.vg40FromMsa || r.vg40Categories.includes(categoryId);
  const allowed = BINDER_GRADES.filter((g) => {
    if (g === 'VG10') return Boolean(snowBound);
    if (g === 'VG30') return !heavy;
    return bottomCourseId !== 'BM';
  });
  return allowed.length ? allowed : ['VG30'];
}

/** The bottom bituminous course of an option, whose mix sets the modulus. */
export const bottomCourse = (option) => option.courses[option.courses.length - 1];

export const BASE_OPTIONS = [
  {
    id: 'WMM',
    label: 'Wet Mix Macadam',
    short: 'WMM',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.unboundBaseMm,
    defaultMm: 250,
  },
  {
    id: 'WBM',
    label: 'Water Bound Macadam',
    short: 'WBM',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.unboundBaseMm,
    defaultMm: 250,
  },
  {
    id: 'CTB',
    label: 'Cement Treated Base',
    short: 'CTB',
    behaviour: BEHAVIOUR.CEMENTED,
    minMm: MINIMUM_THICKNESS.cementTreatedBaseMm,
    defaultMm: 150,
    requiresCrackRelief: true,
  },
  {
    id: 'RAP',
    label: 'Foamed bitumen / emulsion treated RAP',
    short: 'RAP',
    behaviour: BEHAVIOUR.TREATED,
    minMm: MINIMUM_THICKNESS.rapBaseMm,
    defaultMm: 180,
  },
];

export const SUB_BASE_OPTIONS = [
  {
    id: 'GSB',
    label: 'Granular Sub-Base',
    short: 'GSB',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.granularSubBaseMm,
    defaultMm: 200,
  },
  {
    id: 'CTSB',
    label: 'Cement Treated Sub-Base',
    short: 'CTSB',
    behaviour: BEHAVIOUR.CEMENTED,
    minMm: MINIMUM_THICKNESS.cementTreatedSubBaseMm,
    defaultMm: 200,
  },
];

export const CRACK_RELIEF_OPTIONS = [
  {
    id: 'AGG_INTERLAYER',
    label: 'Aggregate interlayer',
    short: 'AIL',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.crackReliefLayerMm,
    defaultMm: 100,
  },
  {
    // Not a structural layer: it is left out of the analysis.
    id: 'SAMI',
    label: 'SAMI',
    short: 'SAMI',
    behaviour: null,
    minMm: 0,
    defaultMm: 0,
  },
];

/** What the site can supply, which decides the materials a design may use. */
export const SITE_CONDITIONS = [
  { key: 'granular', label: 'Granular aggregates (WMM / GSB quality)' },
  { key: 'cement', label: 'Cement for stabilisation' },
  { key: 'stabilisable', label: 'Aggregates suitable for stabilisation' },
  { key: 'ctsbPlant', label: 'CTSB plant / mix feasible' },
  { key: 'sami', label: 'SAMI product available' },
  { key: 'rehabilitation', label: 'Rehabilitation project' },
  { key: 'coldRecycling', label: 'Cold recycling capability' },
  { key: 'existingBituminous', label: 'Existing bituminous layer present' },
];

export const defaultConditions = () => ({
  granular: true,
  cement: true,
  stabilisable: true,
  ctsbPlant: true,
  sami: false,
  rehabilitation: false,
  coldRecycling: false,
  existingBituminous: false,
});

/** Whether a base, sub-base or crack relief option can be built with what the site has. */
export function feasible(optionId, c) {
  switch (optionId) {
    case 'WMM':
    case 'WBM':
    case 'GSB':
    case 'AGG_INTERLAYER':
      return Boolean(c.granular);
    case 'CTB':
      return Boolean(c.cement && c.stabilisable);
    case 'CTSB':
      return Boolean(c.cement && c.ctsbPlant);
    case 'SAMI':
      return Boolean(c.sami);
    case 'RAP':
      return Boolean(c.coldRecycling && (c.existingBituminous || c.rehabilitation));
    default:
      return true;
  }
}

/** Binder of the bottom bituminous layer, which sets the design modulus. */
export const BINDER_GRADES = ['VG40', 'VG30', 'VG10'];

export function findOption(list, id) {
  return list.find((item) => item.id === id) || null;
}

/**
 * The layer positions implied by a chosen combination, top to bottom, before
 * thicknesses are decided. `slotId` names the position (BASE, SUB_BASE...);
 * `materialId` names what is laid there, which is what a rate belongs to.
 */
export function describeCombination({ bituminousId, baseId, subBaseId, crackReliefId }) {
  const bituminous = findOption(BITUMINOUS_OPTIONS, bituminousId) || BITUMINOUS_OPTIONS[0];
  const base = findOption(BASE_OPTIONS, baseId) || BASE_OPTIONS[0];
  const subBase = findOption(SUB_BASE_OPTIONS, subBaseId) || SUB_BASE_OPTIONS[0];
  const crackRelief = crackReliefId ? findOption(CRACK_RELIEF_OPTIONS, crackReliefId) : null;

  const slots = [];
  for (const course of bituminous.courses) {
    slots.push({
      slotId: course.id,
      materialId: course.id,
      label: course.label,
      behaviour: BEHAVIOUR.BITUMINOUS,
      minMm: course.minMm,
      defaultMm: course.defaultMm,
    });
  }
  if (base.requiresCrackRelief && crackRelief && crackRelief.behaviour) {
    slots.push({
      slotId: 'CRACK_RELIEF',
      materialId: crackRelief.short,
      label: crackRelief.label,
      behaviour: crackRelief.behaviour,
      minMm: crackRelief.minMm,
      defaultMm: crackRelief.defaultMm,
    });
  }
  slots.push({
    slotId: 'BASE',
    materialId: base.short,
    label: `${base.label} (${base.short})`,
    behaviour: base.behaviour,
    minMm: base.minMm,
    defaultMm: base.defaultMm,
  });
  slots.push({
    slotId: 'SUB_BASE',
    materialId: subBase.short,
    label: `${subBase.label} (${subBase.short})`,
    behaviour: subBase.behaviour,
    minMm: subBase.minMm,
    defaultMm: subBase.defaultMm,
  });
  slots.push({
    slotId: 'SUBGRADE',
    label: 'Subgrade',
    behaviour: BEHAVIOUR.SUBGRADE,
    minMm: null,
    defaultMm: null,
  });

  return { bituminous, base, subBase, crackRelief, slots };
}

/** The slots as drawn: a SAMI, which carries no load, shown over the CTB it covers. */
export function displaySlots(slots, combination) {
  const { base, crackRelief } = describeCombination(combination);
  if (!base.requiresCrackRelief || crackRelief?.id !== 'SAMI') return slots;
  const at = slots.findIndex((s) => s.slotId === 'BASE');
  const sami = { slotId: 'SAMI', materialId: null, label: 'SAMI', behaviour: 'membrane', thicknessMm: 0, note: 'not analysed' };
  return at < 0 ? slots : [...slots.slice(0, at), sami, ...slots.slice(at)];
}

/** Human readable name for a combination, used on saved trial cards. */
export function combinationName({ bituminousId, baseId, subBaseId, crackReliefId }) {
  const bituminous = findOption(BITUMINOUS_OPTIONS, bituminousId);
  const base = findOption(BASE_OPTIONS, baseId);
  const crackRelief =
    base?.requiresCrackRelief && crackReliefId
      ? findOption(CRACK_RELIEF_OPTIONS, crackReliefId)
      : null;
  return [bituminous?.short, crackRelief?.short, baseId, subBaseId]
    .filter(Boolean)
    .join(' / ');
}
