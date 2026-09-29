/**
 * Worked examples: a sample problem for each kind of pavement, with its data
 * entered in full and the design carried through. Where a code works an
 * example of its own, that example's numbers are used, and the values it
 * prints from IITPAVE or KGPBACK are entered as such; the rest is sample data.
 *
 * Each example fills a fresh project; opening one shows its design.
 */

import { flexibleResult } from './flexibleProject.js';
import { sectionKey } from './iitpave.js';
import { runRigid } from './rigidProject.js';

/** IRC:58 Table VII.1, at the mid-point of each class; the lowest class at the mid-point below it. */
const APPENDIX_VII_SPECTRUM = {
  single: [
    [190, 18.15], [180, 17.43], [170, 18.27], [160, 12.98], [150, 2.98], [140, 1.62],
    [130, 2.62], [120, 2.65], [110, 2.65], [100, 3.25], [90, 3.25], [80, 14.15],
  ],
  tandem: [
    [390, 14.5], [370, 10.5], [350, 3.63], [330, 2.5], [310, 2.69], [290, 1.26],
    [270, 3.9], [250, 5.19], [230, 6.3], [210, 6.4], [190, 8.9], [170, 34.23],
  ],
  tridem: [
    [545, 5.23], [515, 4.85], [485, 3.44], [455, 7.12], [425, 10.11], [395, 12.01],
    [365, 15.57], [335, 13.28], [305, 4.55], [275, 3.16], [245, 3.1], [215, 17.58],
  ],
};

/** IRC:115 Appendix IV: bowls normalised to 40 kN, pavement temperature, and the KGPBACK moduli. */
const APPENDIX_IV = [
  [0.481, 0.294, 0.216, 0.163, 0.134, 0.107, 0.08, 35, 1214.1, 197.4, 70.8],
  [0.478, 0.317, 0.231, 0.186, 0.156, 0.13, 0.106, 35, 1022.7, 254.8, 57.3],
  [0.481, 0.34, 0.242, 0.201, 0.17, 0.139, 0.105, 36, 1458.2, 214.6, 55.0],
  [0.5, 0.321, 0.233, 0.198, 0.151, 0.13, 0.093, 36, 1295.5, 195.4, 60.6],
  [0.477, 0.324, 0.24, 0.19, 0.159, 0.138, 0.109, 36, 1240.5, 245.1, 55.4],
  [0.485, 0.319, 0.23, 0.194, 0.152, 0.141, 0.101, 37, 991.9, 250.1, 57.2],
  [0.473, 0.315, 0.229, 0.191, 0.149, 0.131, 0.097, 37, 1040.3, 252.4, 60.6],
  [0.46, 0.301, 0.223, 0.188, 0.151, 0.13, 0.093, 38, 1313.0, 245.5, 60.1],
  [0.48, 0.365, 0.251, 0.19, 0.17, 0.152, 0.108, 38, 1669.4, 200.5, 53.7],
  [0.487, 0.327, 0.245, 0.187, 0.161, 0.148, 0.102, 38, 1247.1, 229.4, 56.1],
];

/** Sample Benkelman beam survey: rebound deflection mm, pavement temperature °C, field moisture %. */
const BBD_SURVEY = [
  [1.12, 32, 9.5], [1.05, 33, 10.2], [1.31, 34, 11.0], [0.98, 36, 9.8], [1.22, 37, 10.5],
  [1.18, 38, 12.0], [1.4, 38, 12.4], [1.09, 39, 11.2], [1.27, 40, 10.9], [1.15, 40, 11.6],
];

const project = (state, fields) => Object.assign(state.project, { location: '', client: '', designer: '', facility: 'main', ...fields });

export const EXAMPLES = [
  {
    id: 'flexible',
    type: 'flexible',
    title: 'Flexible pavement, granular base and sub-base',
    source: 'IRC:37-2018 Annex-II, II.3',
    data: ['5000 CVPD, 6%, 20 years, VDF 5.2', 'Effective CBR 7%', 'BC 40 + DBM 150, WMM 250, GSB 230'],
    screen: 'results',
    apply(state) {
      state.pavementType = 'flexible';
      project(state, { name: 'Example · IRC:37 Annex-II', constructionType: 'greenfield', roadCategory: 'nh', terrain: 'plain' });
      Object.assign(state.traffic, {
        mode: 'calculate',
        presentCVPD: 5000,
        growthRatePercent: 6,
        yearsToCompletion: 0,
        designLifeYears: 20,
        laneDistributionId: 'dual-two-lane',
        directionalSplitPercent: 50,
        vdfMode: 'survey',
        vehicleDamageFactor: 5.2,
      });
      state.combination = { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB', crackReliefId: 'AGG_INTERLAYER' };
      state.thicknesses = { BC: 40, DBM: 150, BASE: 250, SUB_BASE: 230 };
      Object.assign(state.materials, { subgradeCBR: 7, binderGrade: 'VG40', pavementTemperatureC: 35 });
      state.mix = { airVoidsPercent: 3, effectiveBinderPercent: 11.5 };
    },
    /** The strains the code prints from IITPAVE (Fig. II.4), entered for the section. */
    finish(state) {
      const first = flexibleResult(state);
      state.iitpave = { key: sectionKey(first), values: { bituminous: 146, subgrade: 243 }, stresses: {} };
      state.result = flexibleResult(state);
    },
  },
  {
    id: 'rigid',
    type: 'rigid',
    title: 'Rigid pavement, tied shoulders and dowels',
    source: 'IRC:58-2015 Appendix-VII, option (i)',
    data: ['6000 CVPD, 7.5%, 30 years', 'CBR 8%, 150 DLC on 150 GSB', 'Axle load spectrum of Table VII.1'],
    screen: 'rigidResult',
    apply(state) {
      state.pavementType = 'rigid';
      project(state, { name: 'Example · IRC:58 Appendix-VII', constructionType: 'greenfield', roadCategory: 'nh', terrain: 'plain' });
      const r = state.rigid;
      Object.assign(r.traffic, {
        twoWayCVPD: 6000,
        growthRatePercent: 7.5,
        yearsToCompletion: 0,
        designPeriodYears: 30,
        carriageway: 'divided',
        directionalSplitPercent: 50,
        nightSharePercent: 60,
        shortWheelBasePercent: 55,
        axlesPerVehicle: 2.35,
        axleMix: { single: 15, tandem: 25, tridem: 15 },
      });
      r.spectrum = Object.fromEntries(
        Object.entries(APPENDIX_VII_SPECTRUM).map(([axle, rows]) => [axle, rows.map(([loadKN, percent]) => ({ loadKN, percent }))])
      );
      Object.assign(r.foundation, { subgradeCBR: 8, cbrFrom: 'test', subBase: 'dlc', subBaseMm: 150, gsbMm: 150, kSource: 'tables', bonded: false });
      Object.assign(r.slab, {
        shoulder: 'tied',
        doweled: true,
        flexuralFrom: 'beam',
        flexural28MPa: 4.5,
        ninetyDay: true,
        retexture: true,
        laneWidthM: 3.5,
        jointSpacingM: 4.5,
        reinforced: false,
      });
      r.temperature = { mode: 'zone', zone: 'III', dayC: 16.8 };
      state.geometry.carriagewayWidthM = 7;
      state.geometry.pavedShoulderM = 1.5;
    },
    finish(state) {
      const outcome = runRigid(state.rigid, 'design');
      if (outcome.ok) {
        state.rigidResult = outcome;
        state.rigid.slab.thicknessMm = outcome.adoptedMm;
      }
    },
  },
  {
    id: 'rural',
    type: 'rural',
    title: 'Low volume road, flexible',
    source: 'IRC:SP:72-2015 Appendix D',
    data: ['6 HCV and 38 MCV a day, half laden', '6%, 10 years, single lane', 'Subgrade CBR 5%'],
    screen: 'rural',
    apply(state) {
      state.pavementType = 'rural';
      project(state, { name: 'Example · IRC:SP:72 Appendix D', constructionType: 'greenfield', roadCategory: 'odr', terrain: 'plain' });
      Object.assign(state.rural.traffic, {
        mode: 'counts',
        hcv: 6,
        mcv: 38,
        ladenPercent: 50,
        vdfMode: 'indicative',
        yearsToOpening: 0,
        growthPercent: 6,
        designLifeYears: 10,
        laneId: 'single',
      });
      state.rural.traffic.harvest.enabled = false;
      Object.assign(state.rural.design, { subgradeCBR: 5, baseType: 'granular', rainfall: 'under1000', frost: false, surfacing: 'auto', gravelCBR80Available: true });
      state.geometry.carriagewayWidthM = 3.75;
      state.geometry.earthenShoulderM = 1;
    },
  },
  {
    id: 'ruralRigid',
    type: 'ruralRigid',
    title: 'Low volume road, concrete',
    source: 'IRC:SP:62-2014 Appendix I',
    data: ['45 CVPD, 5%, 20 years', 'Subgrade CBR 4%, granular sub-base', 'M30, zone I, joints 3.75 m, tractors'],
    screen: 'lvRigidSlab',
    apply(state) {
      state.pavementType = 'ruralRigid';
      project(state, { name: 'Example · IRC:SP:62 Appendix I', constructionType: 'greenfield', roadCategory: 'odr', terrain: 'plain' });
      Object.assign(state.lvRigid.traffic, { presentCVPD: 45, growthPercent: 5, yearsToCompletion: 0, designYears: 20 });
      Object.assign(state.lvRigid.slab, {
        subgradeCBR: 4,
        subBase: 'granular',
        strengthMode: 'fck',
        fck: 30,
        temperature: { mode: 'zone', zone: 'I', deltaC: null },
        jointM: 3.75,
        tractor: true,
        trialMm: null,
      });
      state.geometry.carriagewayWidthM = 3.75;
      state.geometry.earthenShoulderM = 1;
    },
  },
  {
    id: 'overlayFwd',
    type: 'overlay',
    title: 'Overlay by falling weight deflectometer',
    source: 'IRC:115-2014 Appendix IV',
    data: ['100 msa', '170 mm bituminous on 575 mm granular', 'Ten bowls measured in January, KGPBACK moduli'],
    screen: 'overlayResult',
    apply(state) {
      state.pavementType = 'overlay';
      project(state, { name: 'Example · IRC:115 Appendix IV', constructionType: 'overlay', roadCategory: 'nh', terrain: 'plain' });
      const o = state.overlay;
      o.method = 'fwd';
      Object.assign(o.traffic, { mode: 'direct', designMsa: 100 });
      Object.assign(o.fwd, { bituminousMm: 170, granularMm: 575, condition: 'good', coldArea: false, season: 'winter' });
      o.fwd.points = APPENDIX_IV.map((row) => ({ loadKN: 40, deflections: row.slice(0, 7), temperatureC: row[7] }));
      o.fwd.kgpback = APPENDIX_IV.map((row) => ({ bituminous: row[8], granular: row[9], subgrade: row[10] }));
      Object.assign(o.overlay, { mix: 'BC', binderGrade: 'VG30', modulusMPa: 1695, trialMm: null });
    },
  },
  {
    id: 'overlayBbd',
    type: 'overlay',
    title: 'Overlay by Benkelman beam',
    source: 'IRC:81-1997, sample data',
    data: ['1800 CVPD, 7.5%, 10 years, two lane', '75 mm bituminous, ten points', 'Dry months, clay PI < 15, rainfall up to 1300 mm'],
    screen: 'overlayResult',
    apply(state) {
      state.pavementType = 'overlay';
      project(state, { name: 'Example · IRC:81 Benkelman beam', constructionType: 'overlay', roadCategory: 'sh', terrain: 'plain' });
      const o = state.overlay;
      o.method = 'bbd';
      Object.assign(o.traffic, {
        mode: 'calculate',
        presentCVPD: 1800,
        growthRatePercent: 7.5,
        yearsToCompletion: 1,
        designLifeYears: 10,
        laneId: 'two-lane',
        vdfMode: 'indicative',
      });
      Object.assign(o.bbd, { bituminousMm: 75, severelyCracked: false, coldArea: false, season: 'dry', soil: 'clayLow', rainfall: 'low' });
      o.bbd.points = BBD_SURVEY.map(([deflectionMm, temperatureC, moisturePercent]) => ({ deflectionMm, temperatureC, moisturePercent }));
      o.overlay.bbdMaterial = 'dbm';
    },
  },
];
