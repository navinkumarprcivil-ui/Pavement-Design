/**
 * The flexible pavement design procedure, step by step.
 *
 * This is the sequence the mechanistic-empirical design of IRC:37-2018
 * follows, written in plain terms, with the numbers from the worked example
 * for a bituminous pavement on a granular base and sub-base (Annex-II of the
 * code) carried through every step so the procedure can be read against a case
 * whose answer is already known.
 *
 * Wording here is this app's own. Only numeric values and clause citations are
 * taken from the code; no code text is reproduced. Each step names the clause
 * to open in your own copy.
 */

import { ref } from './ircConstants.js';

/** The case carried through the example column, from Annex-II of IRC:37-2018. */
export const WORKED_EXAMPLE = {
  title: 'Bituminous pavement on a granular base and sub-base',
  source: ref('IRC37', 'Annex-II', { note: 'Worked example II.3' }),
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
    ref: ref('IRC37', 'Cl. 4.7', { equation: 'Eq. 4.1' }),
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
    ref: ref('IRC37', 'Cl. 6.3', { equation: 'Eq. 6.1 / 6.2 / 6.3' }),
  },
  {
    title: 'Choose the reliability level',
    what:
      'Heavier roads are designed to a lower chance of early failure. From ' +
      '20 msa upwards, and on expressways, national and state highways and ' +
      'urban roads, use the 90% models; below that, 80%.',
    example: 'At 131 msa the 90% reliability models apply.',
    ref: ref('IRC37', 'Cl. 6.1'),
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
    ref: ref('IRC37', 'Cl. 9'),
  },
  {
    title: 'Pick a trial section',
    what:
      'Choose a thickness for each layer. This is a guess to be tested, not ' +
      'the answer — but it must respect the minimum thickness of each layer.',
    example:
      '190 mm of bituminous layers (40 mm surfacing, 70 mm DBM, 80 mm bottom ' +
      'rich DBM) over 250 mm WMM and 230 mm GSB, so 480 mm of granular layers.',
    ref: ref('IRC37', 'Cl. 11'),
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
    ref: ref('IRC37', 'Cl. 7.4', { equation: 'Eq. 7.1' }),
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
    ref: ref('IRC37', 'Cl. 3.5 / 3.6', { equation: 'Eq. 3.2 / 3.4' }),
  },
  {
    title: 'Analyse the trial section',
    what:
      'Put a standard axle on the section and compute what the strains ' +
      'actually are: vertical at the top of the subgrade, horizontal tensile ' +
      'at the underside of the bituminous layer. This app does that ' +
      'calculation itself; the code does it with IITPAVE.',
    example:
      'The trial section gives 0.000243 at the subgrade and 0.000146 at the ' +
      'bottom of the bituminous layer.',
    ref: ref('IRC37', 'Annex-I', { note: 'The code performs this step in IITPAVE.' }),
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
    ref: ref('IRC37', 'Cl. 11'),
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
    ref: ref('IRC37', 'Cl. 7.3'),
  },
];
