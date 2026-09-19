/**
 * The layer combinations the user picks from, and what each material implies
 * structurally. Adding a new material means adding an entry here — the design
 * engine and the UI both read from this catalogue.
 */

import { MINIMUM_THICKNESS } from './ircConstants.js';

/** How a material behaves in the structural model. */
export const BEHAVIOUR = {
  BITUMINOUS: 'bituminous',
  GRANULAR: 'granular',
  CEMENTED: 'cemented',
  SUBGRADE: 'subgrade',
};

export const LAYER_POSITIONS = [
  {
    id: 'bituminous',
    label: 'Bituminous layer',
    description: 'Surfacing and binder course',
    fixed: false,
  },
  {
    id: 'base',
    label: 'Base layer',
    description: 'The main load spreading layer',
    fixed: false,
  },
  {
    id: 'subBase',
    label: 'Sub-base layer',
    description: 'Drainage and load spreading over the subgrade',
    fixed: false,
  },
  {
    id: 'subgrade',
    label: 'Subgrade soil',
    description: 'Fixed — the prepared formation, characterised by its CBR',
    fixed: true,
  },
];

export const BITUMINOUS_OPTIONS = [
  {
    id: 'BC_DBM',
    label: 'BC over DBM',
    short: 'BC + DBM',
    description:
      'Bituminous Concrete wearing course over Dense Bituminous Macadam binder course. The usual choice for a highway.',
    courses: [
      { id: 'BC', label: 'Bituminous Concrete (BC)', minMm: 40, defaultMm: 40 },
      { id: 'DBM', label: 'Dense Bituminous Macadam (DBM)', minMm: 50, defaultMm: 60 },
    ],
  },
  {
    id: 'BC_ONLY',
    label: 'BC only',
    short: 'BC',
    description:
      'A single bituminous course. Suited to lighter traffic where a binder course is not warranted.',
    courses: [
      { id: 'BC', label: 'Bituminous Concrete (BC)', minMm: 40, defaultMm: 50 },
    ],
  },
  {
    id: 'SDBC_DBM',
    label: 'SDBC over DBM',
    short: 'SDBC + DBM',
    description:
      'Semi Dense Bituminous Concrete wearing course over DBM.',
    courses: [
      { id: 'SDBC', label: 'Semi Dense Bituminous Concrete (SDBC)', minMm: 25, defaultMm: 30 },
      { id: 'DBM', label: 'Dense Bituminous Macadam (DBM)', minMm: 50, defaultMm: 60 },
    ],
  },
];

export const BASE_OPTIONS = [
  {
    id: 'WMM',
    label: 'Wet Mix Macadam (WMM)',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.wetMixMacadamMm,
    defaultMm: 250,
    description: 'Graded aggregate mixed with water and laid by paver. The standard granular base.',
  },
  {
    id: 'WBM',
    label: 'Water Bound Macadam (WBM)',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.waterBoundMacadamMm,
    defaultMm: 250,
    description: 'Coarse aggregate keyed with screening and binding material, laid in 75 mm compacted courses.',
  },
  {
    id: 'CTB',
    label: 'Cement Treated Base (CTB)',
    behaviour: BEHAVIOUR.CEMENTED,
    minMm: MINIMUM_THICKNESS.cementTreatedBaseMm,
    defaultMm: 150,
    requiresCrackRelief: true,
    description:
      'Aggregate bound with cement. Stiff and strong, but it cracks — a crack relief interlayer is required above it.',
  },
];

export const SUB_BASE_OPTIONS = [
  {
    id: 'GSB',
    label: 'Granular Sub-Base (GSB)',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.granularSubBaseMm,
    defaultMm: 200,
    description: 'Well graded granular material. Also serves as the drainage layer.',
  },
  {
    id: 'CTSB',
    label: 'Cement Treated Sub-Base (CTSB)',
    behaviour: BEHAVIOUR.CEMENTED,
    minMm: MINIMUM_THICKNESS.cementTreatedSubBaseMm,
    defaultMm: 200,
    description: 'Soil or aggregate stabilised with cement. Stiffer than GSB but not free draining.',
  },
];

export const CRACK_RELIEF_OPTIONS = [
  {
    id: 'AGG_INTERLAYER',
    label: 'Aggregate interlayer',
    behaviour: BEHAVIOUR.GRANULAR,
    minMm: MINIMUM_THICKNESS.crackReliefLayerMm,
    defaultMm: 100,
    description: 'About 100 mm of granular material between the cemented base and the bituminous layer.',
  },
  {
    id: 'SAMI',
    label: 'SAMI (stress absorbing membrane interlayer)',
    behaviour: null,
    minMm: 0,
    defaultMm: 0,
    description: 'A membrane interlayer. It is not modelled as a structural layer, only as crack relief.',
  },
];

export const BINDER_GRADES = ['VG10', 'VG30', 'VG40', 'Modified (PMB/CRMB)'];

export function findOption(list, id) {
  return list.find((item) => item.id === id) || null;
}

/**
 * The layer positions implied by a chosen combination, top to bottom, before
 * thicknesses are decided.
 */
export function describeCombination({ bituminousId, baseId, subBaseId, crackReliefId }) {
  const bituminous = findOption(BITUMINOUS_OPTIONS, bituminousId);
  const base = findOption(BASE_OPTIONS, baseId);
  const subBase = findOption(SUB_BASE_OPTIONS, subBaseId);
  const crackRelief = crackReliefId ? findOption(CRACK_RELIEF_OPTIONS, crackReliefId) : null;

  const slots = [];
  for (const course of bituminous.courses) {
    slots.push({
      slotId: course.id,
      label: course.label,
      behaviour: BEHAVIOUR.BITUMINOUS,
      minMm: course.minMm,
      defaultMm: course.defaultMm,
    });
  }
  if (base.requiresCrackRelief && crackRelief && crackRelief.behaviour) {
    slots.push({
      slotId: 'CRACK_RELIEF',
      label: crackRelief.label,
      behaviour: crackRelief.behaviour,
      minMm: crackRelief.minMm,
      defaultMm: crackRelief.defaultMm,
    });
  }
  slots.push({
    slotId: 'BASE',
    label: base.label,
    behaviour: base.behaviour,
    minMm: base.minMm,
    defaultMm: base.defaultMm,
  });
  slots.push({
    slotId: 'SUB_BASE',
    label: subBase.label,
    behaviour: subBase.behaviour,
    minMm: subBase.minMm,
    defaultMm: subBase.defaultMm,
  });
  slots.push({
    slotId: 'SUBGRADE',
    label: 'Subgrade soil',
    behaviour: BEHAVIOUR.SUBGRADE,
    minMm: null,
    defaultMm: null,
  });

  return { bituminous, base, subBase, crackRelief, slots };
}

/** Human readable name for a combination, used on saved trial cards. */
export function combinationName({ bituminousId, baseId, subBaseId }) {
  const bituminous = findOption(BITUMINOUS_OPTIONS, bituminousId);
  return [bituminous?.short, baseId, subBaseId].filter(Boolean).join(' / ');
}
