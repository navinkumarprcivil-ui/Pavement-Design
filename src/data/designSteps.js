/**
 * The flexible and rigid pavement design procedures, step by step.
 *
 * Each is the sequence its code follows, written in plain terms, with the
 * numbers from the code's own worked example carried through every step so
 * the procedure can be read against a case whose answer is already known:
 * Annex-II of IRC:37-2018 for flexible, Appendix-VII of IRC:58-2015 for rigid.
 *
 * Wording here is this app's own. Only numeric values and clause citations are
 * taken from the code; no code text is reproduced. Each step names the clause
 * to open in your own copy.
 */

import { ref } from './ircConstants.js';

/** The case carried through the example column, from Annex-II of IRC:37-2018. */
export const WORKED_EXAMPLE = {
  title: 'Bituminous pavement on a granular base and sub-base',
  source: ref('IRC37', 'Annex-II', { note: 'Worked example II.3', page: '70 – 72' }),
  given: [
    ['Carriageway', 'Four lane divided'],
    ['Traffic at completion', '5,000 CVPD, both ways'],
    ['Growth rate', '6% a year'],
    ['Design life', '20 years'],
    ['Vehicle damage factor', '5.2'],
    ['Effective subgrade CBR', '7%'],
    ['Mix volumetrics', '3.0% air voids, 11.5% effective bitumen by volume'],
  ],
};

export const FLEXIBLE_DESIGN_STEPS = [
  {
    title: 'Work out the design traffic',
    what:
      'Count the commercial vehicles, grow them over the design life, and ' +
      'convert to standard axles. This one number decides everything after it.',
    example:
      'Half of 5,000 CVPD runs in each direction. With a lane distribution ' +
      'factor of 0.75, a VDF of 5.2 and 20 years at 6% growth, the design ' +
      'traffic is 131 msa.',
    ref: ref('IRC37', 'Cl. 4.6.1', { equation: 'Eq. 4.5 / 4.6', page: 17 }),
  },
  {
    title: 'Find the effective subgrade strength',
    what:
      'Convert the subgrade CBR to a resilient modulus. Where the prepared ' +
      'top soil differs from the embankment below it, treat the two as a ' +
      'two-layer system, match its surface deflection with a single ' +
      'equivalent layer, and cap the result at 100 MPa.',
    example:
      'An effective CBR of 7% gives a subgrade modulus of 62 MPa, below the ' +
      '100 MPa cap, so it is used as it stands.',
    ref: ref('IRC37', 'Cl. 6.3 / 6.4', { equation: 'Eq. 6.1 – 6.3', page: '19, 20' }),
  },
  {
    title: 'Choose the reliability level',
    what:
      'Heavier roads are designed to a lower chance of early failure. From ' +
      '20 msa upwards, and on expressways, national and state highways and ' +
      'urban roads, use the 90% models; below that, 80%.',
    example: 'At 131 msa the 90% reliability models apply.',
    ref: ref('IRC37', 'Cl. 3.7', { page: 8 }),
  },
  {
    title: 'Choose the binder and the surfacing',
    what:
      'Design traffic sets the binder grade and whether the surface course ' +
      'needs a modified binder. The binder in turn fixes the stiffness of ' +
      'the bituminous layer at the design temperature.',
    example:
      'Above 50 msa the surface course takes a modified binder or SMA/GGRB, ' +
      'and the DBM below it takes VG40 — giving a mix modulus of 3,000 MPa.',
    ref: ref('IRC37', 'Cl. 9.1 / 9.2', { table: 'Table 9.1 / 9.2', page: '27 – 31' }),
  },
  {
    title: 'Pick a trial section',
    what:
      'Choose a thickness for each layer. This is a guess to be tested, not ' +
      'the answer — but it must respect the minimum thickness of each layer.',
    example:
      '190 mm of bituminous layers (40 mm surfacing, 70 mm DBM, 80 mm bottom ' +
      'rich DBM) over 250 mm WMM and 230 mm GSB, so 480 mm of granular layers.',
    ref: ref('IRC37', 'Cl. 11.1.3', { page: 33 }),
  },
  {
    title: 'Work out the layer moduli',
    what:
      'The granular layers take their stiffness from their own thickness and ' +
      'from whatever supports them, so this must be redone whenever a ' +
      'thickness changes.',
    example:
      '0.2 x 480^0.45 x 62 gives 200 MPa for the whole granular layer, over a ' +
      '62 MPa subgrade, under a 3,000 MPa bituminous layer.',
    ref: ref('IRC37', 'Cl. 7.2.3', { equation: 'Eq. 7.1', page: 22 }),
  },
  {
    title: 'Work out the two allowable strains',
    what:
      'The design traffic buys a strain budget under two failure modes: ' +
      'rutting of the subgrade, and fatigue cracking of the bituminous ' +
      'layer. The fatigue budget also depends on the mix volumetrics.',
    example:
      'At 131 msa and 90% reliability the subgrade may take 0.000301 vertical ' +
      'strain, and the bituminous layer 0.000150 tensile strain.',
    ref: ref('IRC37', 'Cl. 3.6.1 / 3.6.2', { equation: 'Eq. 3.2 / 3.4', page: '5, 6' }),
  },
  {
    title: 'Analyse the trial section',
    what:
      'Put a standard axle on the section and compute what the strains ' +
      'actually are: vertical at the top of the subgrade, horizontal tensile ' +
      'at the underside of the bituminous layer. The code does this in ' +
      'IITPAVE, and the design rests on its values; the app runs the same ' +
      'analysis as a check on them.',
    example:
      'The trial section gives 0.000243 at the subgrade and 0.000146 at the ' +
      'bottom of the bituminous layer.',
    ref: ref('IRC37', 'Cl. 11.1.4 / Annex-I', { note: 'The code performs this step in IITPAVE.', page: '33, 53' }),
  },
  {
    title: 'Compare, then adjust and repeat',
    what:
      'Both actual strains must come in under their allowable values. If ' +
      'either fails, change a thickness and go back to the moduli — every ' +
      'number downstream moves with it.',
    example:
      '0.000243 is under 0.000301 and 0.000146 is under 0.000150, so both ' +
      'checks pass and the trial section stands.',
    ref: ref('IRC37', 'Cl. 11.1.6', { page: 33 }),
  },
  {
    title: 'Check the sub-base carries the construction plant',
    what:
      'Before anything is surfaced, loaded tippers run on the bare sub-base. ' +
      'Check it against that traffic separately, or it ruts before the road ' +
      'is built.',
    example:
      'A tipper with an 80 kN front axle and a 240 kN rear tandem does 12.41 ' +
      'standard axles a pass; 200 passes are taken as 10,000 standard axles, ' +
      'the floor for this check.',
    ref: ref('IRC37', 'Cl. 7.2.2', { page: '21, 22' }),
  },
];

/** The case carried through the rigid steps, from Appendix-VII of IRC:58-2015. */
export const RIGID_WORKED_EXAMPLE = {
  title: 'Jointed plain concrete pavement on a DLC sub-base',
  source: ref('IRC58', 'Appendix-VII', { note: 'Illustrative example of thickness design', page: '82 – 88' }),
  given: [
    ['Carriageway', 'Four lane divided National Highway'],
    ['Traffic at completion', '3,000 CVPD each way'],
    ['Growth rate', '7.5% a year'],
    ['Design period', '30 years'],
    ['Axle mix', 'Front 45%, rear single 15%, tandem 25%, tridem 15%'],
    ['Axles per vehicle', '2.35'],
    ['Travelling at night', '60%'],
    ['Wheel base under 4.5 m', '55%'],
    ['Transverse joint spacing', '4.5 m'],
    ['Effective subgrade CBR', '8%'],
    ['Day-time temperature differential', '16.8 °C'],
  ],
};

export const RIGID_DESIGN_STEPS = [
  {
    title: 'Build the foundation and find its k',
    what:
      'Get the modulus of subgrade reaction from the subgrade CBR, then the ' +
      'effective k of the whole foundation once the granular sub-base and ' +
      'the DLC are on it. A polythene sheet separates the slab from the DLC ' +
      'unless the two are to act bonded.',
    example:
      'CBR 8% gives k = 50.3 MPa/m. With 150 mm GSB and 150 mm DLC of 7 MPa ' +
      '7-day strength, the combined foundation gives k = 285 MPa/m by ' +
      'interpolation. Debonding layer: 125 micron polythene.',
    ref: ref('IRC58', 'Cl. 5.7.3.4 / 5.7.4.4', { table: 'Table 2 / Table 4', page: '9, 11, 12' }),
  },
  {
    title: 'Fix the design flexural strength',
    what:
      'Specify the concrete by its 28-day flexural strength and design with ' +
      'the 90-day value, taken as 1.1 times the 28-day one.',
    example:
      'M40 concrete, 4.5 MPa at 28 days, so 4.5 x 1.1 = 4.95 MPa for design. ' +
      'E = 30,000 MPa, µ = 0.15, unit weight 24 kN/m³.',
    ref: ref('IRC58', 'Cl. 5.8.2 / 5.8.4.1', { page: '12, 13' }),
  },
  {
    title: 'Count the axles over the design period',
    what:
      'Grow the two-way commercial traffic over the design period, convert ' +
      'vehicles to axles, take the predominant direction, then the share ' +
      'that runs along the slab edge.',
    example:
      '6,000 CVPD at 7.5% for 30 years is 226.4 million vehicles. At 2.35 ' +
      'axles each that is 532.1 million axles; half go each way, 266.1 million, ' +
      'and 25% of those on a multi-lane road gives 66.5 million design axles.',
    ref: ref('IRC58', 'Cl. 5.5.2.3 / 5.5.2.7', { equation: 'Eq. 1', page: '5, 6' }),
  },
  {
    title: 'Split them into the two six-hour periods',
    what:
      'Bottom-up cracking is checked with the day-time traffic, top-down with ' +
      'the night-time traffic. Each 12-hour period is analysed as two six-hour ' +
      'ones. Top-down only counts vehicles short enough to have both axles on ' +
      'one slab.',
    example:
      'Day: 40% of 66.5 million, halved, is 13.30 million for bottom-up. ' +
      'Night: 60%, halved, is 19.96 million; 55% have a wheel base under ' +
      '4.5 m, giving 10.98 million for top-down.',
    ref: ref('IRC58', 'Cl. 5.5.2.4 / 6.3.3', { page: '5, 18' }),
  },
  {
    title: 'Share them across the axle load spectrum',
    what:
      'Split each total by axle type, then by load class using the axle load ' +
      'survey. Stresses are worked out at the mid-point of each class. Front ' +
      'axles do no bottom-up damage and are left out of that check.',
    example:
      'Rear single axles are 15%: 1.996 million for bottom-up and 1.646 million ' +
      'for top-down. The heaviest single class, 185–195 kN, is 18.15% of them: ' +
      '362,191 repetitions at 190 kN.',
    ref: ref('IRC58', 'Cl. 5.2 / 5.5.2.6', { page: '4, 6' }),
  },
  {
    title: 'Take the temperature differentials',
    what:
      'Use the maximum day-time differential for the region for bottom-up ' +
      'cracking. For top-down, the night-time differential is half the ' +
      'day-time one plus 5 °C.',
    example: 'Bihar: 16.8 °C by day, so 16.8 / 2 + 5 = 13.4 °C at night.',
    ref: ref('IRC58', 'Cl. 5.6.1.1 / 5.6.2.3', { table: 'Table 1', page: '6 – 8' }),
  },
  {
    title: 'Pick a trial slab and find l',
    what:
      'Choose a trial thickness and work out the radius of relative ' +
      'stiffness, l = [Eh³ / 12k(1 − µ²)]^0.25. It enters every stress ' +
      'equation.',
    example:
      'h = 0.28 m on k = 285 MPa/m gives l = 0.666 m. The appendix prints ' +
      '0.78758 m here, but 0.666 m is the value that reproduces its stresses.',
    ref: ref('IRC58', 'Appendix-V', { page: '73 – 75' }),
  },
  {
    title: 'Stress for bottom-up cracking',
    what:
      'For each rear single and tandem axle class, compute the edge stress ' +
      'under the load and the day-time differential. The equation depends on ' +
      'the axle type, whether a tied concrete shoulder is provided, and the ' +
      'band k falls in.',
    example:
      'Tied shoulders, k above 150 MPa/m: a 190 kN single axle gives 2.503 MPa, ' +
      'a 390 kN tandem 2.118 MPa.',
    ref: ref('IRC58', 'Cl. 6.2.7 / Appendix-V', { equation: 'Eq. V.1 – V.12', page: '18, 73, 74' }),
  },
  {
    title: 'Stress for top-down cracking',
    what:
      'For each rear axle class, compute the stress at the top of the slab ' +
      'under the night-time differential. One slab carries the whole single ' +
      'axle, half a tandem or a third of a tridem. The joint factor B is 0.66 ' +
      'with dowel bars and 0.90 without.',
    example:
      'With dowels: 190 kN single 2.399 MPa, 390 kN tandem 2.427 MPa, ' +
      '545 kN tridem 2.353 MPa.',
    ref: ref('IRC58', 'Cl. 6.2.7 / Appendix-V', { equation: 'Eq. V.13', page: '18, 74, 75' }),
  },
  {
    title: 'Allowable repetitions for each class',
    what:
      'Divide each stress by the design flexural strength. Below a stress ' +
      'ratio of 0.45 the concrete takes unlimited repetitions; above it the ' +
      'fatigue equation gives the number allowed. Damage is expected over ' +
      'allowed.',
    example:
      '2.503 / 4.95 = 0.506, allowing 588,331 repetitions against 362,191 ' +
      'expected: damage 0.616 from that one class.',
    ref: ref('IRC58', 'Cl. 5.8.6.1', { equation: 'Eq. 5 / 6', page: '13, 14' }),
  },
  {
    title: 'Sum the damage and settle the thickness',
    what:
      'Add the damage of every class, for bottom-up and top-down together. ' +
      'The total must not exceed 1. If it does, thicken the slab and repeat ' +
      'from l.',
    example:
      '280 mm: 0.976 + 0.274 + 0.445 + 0.036 = 1.731, not adequate. 290 mm: ' +
      '0.527, adequate. With two retexturings over 30 years, 300 mm.',
    ref: ref('IRC58', 'Cl. 6.3.4.1', { equation: 'Eq. 7 / 8', page: 19 }),
  },
  {
    title: 'Without shoulders or dowels',
    what:
      'Without a tied concrete shoulder the bottom-up equations for a free ' +
      'edge apply, and without dowels B rises to 0.90, so the slab must be ' +
      'thicker. Dowels are needed on heavy traffic regardless. A lane widened ' +
      'by 0.5–0.6 m relieves the edge about as much as a tied shoulder.',
    example:
      '330 mm gives 0.935 bottom-up and 0.654 top-down, 1.589 in all, so 340 mm ' +
      'is needed. A widened outer lane takes the 290 mm of option i.',
    ref: ref('IRC58', 'Cl. 6.2.5 / 6.6.1', { page: '17, 21' }),
  },
  {
    title: 'Bonded to the DLC',
    what:
      'A slab bonded to a DLC of at least 10 MPa 7-day strength acts with it. ' +
      'Design the unbonded slab first, then find a thinner slab whose ' +
      'stiffness, added to the DLC\'s about the common neutral axis, is at ' +
      'least that of the unbonded one.',
    example:
      '250 mm GSB gives k = 72 MPa/m and a 300 mm unbonded slab: 69.05 MN·m. ' +
      'A 235 mm slab on 150 mm DLC (E 13,600 MPa, µ 0.20) has its neutral axis ' +
      'at 0.16 m and gives 46.65 + 23.28 = 69.93 MN·m, so it is adequate.',
    ref: ref('IRC58', 'Cl. 6.7', { equation: 'Eq. 10 – 13', page: '22, 23' }),
  },
];
