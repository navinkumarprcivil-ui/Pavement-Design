/**
 * Two details of a jointed plain concrete pavement — IRC:58-2015:
 *
 *  - PQC bonded to a DLC layer (Cl. 6.7). The slab is designed as if laid on
 *    the granular layer below the DLC; the PQC bonded to the DLC need only
 *    match that slab's flexural stiffness (Eq. 10 – 13).
 *  - Tie bars across longitudinal joints (Cl. 8.2, Eq. 16 / 17).
 *
 * Moduli in MPa and thicknesses in m give stiffness in MN·m.
 */

import { RIGID } from '../data/ircConstants.js';

/** Eq. 10: flexural stiffness of a slab, E h³ / 12 (1 − µ²). */
export function flexuralStiffness(E, hM, mu) {
  return (E * hM ** 3) / (12 * (1 - mu * mu));
}

/**
 * Eq. 11 – 13: depth of the neutral axis below the top of the PQC, and the
 * stiffness of each layer about it. Eq. 13 is taken as printed, E2 times the
 * modular ratio E2 / E1; Appendix-VII's 23.28 MN·m follows from it.
 */
export function bondedStiffness({ h1M, h2M, E1, mu1, E2, mu2 }) {
  const n = E2 / E1;
  const d = (0.5 * h1M ** 2 + n * h2M * (h1M + 0.5 * h2M)) / (h1M + n * h2M);
  const pqc = (E1 * (h1M ** 3 / 12 + h1M * (d - 0.5 * h1M) ** 2)) / (1 - mu1 * mu1);
  const dlc = (E2 * ((n * h2M ** 3) / 12 + n * h2M * (h1M + h2M / 2 - d) ** 2)) / (1 - mu2 * mu2);
  return { d, pqc, dlc, combined: pqc + dlc };
}

const STEP_MM = 5;

/**
 * The thinnest PQC, in 5 mm steps, whose stiffness bonded to the DLC is at
 * least that of the slab designed over the granular layer.
 *
 * @param {object} i
 * @param {number} i.designMm   Slab designed over the granular layer.
 * @param {number} i.dlcMm
 * @param {number} i.E1 @param {number} i.mu1  Concrete.
 * @param {number} i.dlc28MPa   DLC 28-day compressive strength.
 */
export function bondedSlab({ designMm, dlcMm, E1, mu1, dlc28MPa }) {
  const spec = RIGID.bonded;
  const E2 = spec.dlcModulusFactor * dlc28MPa;
  const mu2 = spec.dlcPoissonRatio;
  const required = flexuralStiffness(E1, designMm / 1000, mu1);
  let thicknessMm = null;
  let layers = null;
  for (let mm = STEP_MM; mm <= designMm; mm += STEP_MM) {
    const s = bondedStiffness({ h1M: mm / 1000, h2M: dlcMm / 1000, E1, mu1, E2, mu2 });
    if (s.combined >= required) {
      thicknessMm = mm;
      layers = s;
      break;
    }
  }
  return { thicknessMm, required, E2, mu2, ...layers };
}

/**
 * The monolithic slab as stiff as a given PQC bonded to the DLC, for checking
 * an entered PQC against fatigue: h = [12 (1 − µ²) D / E]^(1/3).
 */
export function equivalentSlab({ pqcMm, dlcMm, E1, mu1, dlc28MPa }) {
  const spec = RIGID.bonded;
  const E2 = spec.dlcModulusFactor * dlc28MPa;
  const mu2 = spec.dlcPoissonRatio;
  const s = bondedStiffness({ h1M: pqcMm / 1000, h2M: dlcMm / 1000, E1, mu1, E2, mu2 });
  const hM = Math.cbrt((12 * (1 - mu1 * mu1) * s.combined) / E1);
  return { thicknessMm: hM * 1000, E2, mu2, ...s };
}

/** The working of a bonded slab, as calculation steps. */
export function bondedSteps(b, { designMm, pqcMm, dlcMm, E1, mu1, dlc28MPa, checking }) {
  const spec = RIGID.bonded;
  const f = (x, digits = 2) => x.toFixed(digits);
  return [
    {
      title: 'DLC modulus',
      formula: `E2 = ${spec.dlcModulusFactor} × fck (28 day);  µ2 = ${spec.dlcPoissonRatio}`,
      substitution: `E2 = ${spec.dlcModulusFactor} × ${dlc28MPa}`,
      result: `E2 = ${Math.round(b.E2).toLocaleString('en-IN')} MPa`,
      ref: spec.ref,
    },
    {
      title: 'Neutral axis of the bonded section',
      formula: 'd = [0.5 h1² + (E2/E1) h2 (h1 + 0.5 h2)] / [h1 + (E2/E1) h2]',
      substitution: `h1 = ${pqcMm / 1000} m, h2 = ${dlcMm / 1000} m, E2/E1 = ${f(b.E2 / E1, 4)}`,
      result: `d = ${f(b.d, 4)} m`,
      ref: spec.ref,
    },
    {
      title: 'Flexural stiffness of the PQC and the DLC',
      formula: 'D1 = E1 [h1³/12 + h1 (d − 0.5 h1)²] / (1 − µ1²);  D2 = E2 [(E2/E1) h2³/12 + (E2/E1) h2 (h1 + h2/2 − d)²] / (1 − µ2²)',
      substitution: `µ1 = ${mu1}, µ2 = ${b.mu2}`,
      result: `D1 = ${f(b.pqc)} MN·m, D2 = ${f(b.dlc)} MN·m, together ${f(b.combined)} MN·m`,
      ref: spec.ref,
    },
    checking
      ? {
          title: 'Equivalent monolithic slab',
          formula: 'h = [12 (1 − µ1²) (D1 + D2) / E1]^(1/3)',
          substitution: `D1 + D2 = ${f(b.combined)} MN·m`,
          result: `h = ${f(b.thicknessMm, 1)} mm, checked for fatigue`,
          ref: spec.ref,
        }
      : {
          title: 'Stiffness of the slab designed over the granular layer',
          formula: 'D = E1 h³ / 12 (1 − µ1²)',
          substitution: `h = ${designMm / 1000} m`,
          result: `D = ${f(b.required)} MN·m ≤ ${f(b.combined)} MN·m with ${pqcMm} mm PQC`,
          ref: spec.ref,
        },
  ];
}

/** Round to the nearest 10 mm, as Table 6 and Appendix-IX do. */
const nearest10 = (mm) => Math.round(mm / 10) * 10;

/**
 * Tie bars for a longitudinal joint.
 *
 * @param {object} i
 * @param {number} i.slabMm
 * @param {number} i.laneWidthM   b, from the joint to the free edge.
 * @param {'plain'|'deformed'} i.type
 * @param {number} i.diameterMm
 */
export function tieBars({ slabMm, laneWidthM, type, diameterMm }) {
  const spec = RIGID.tieBars;
  const steel = spec.steel[type] || spec.steel.deformed;
  const W = (slabMm / 1000) * spec.concreteUnitWeightKNm3 * 1000; // N/m²
  const areaPerM = (laneWidthM * spec.friction * W) / steel.allowableMPa; // mm² per m of joint
  const barArea = (Math.PI * diameterMm ** 2) / 4;
  const perimeter = Math.PI * diameterMm;
  const spacingCalc = (barArea / areaPerM) * 1000;
  const spacingMm = Math.min(nearest10(spacingCalc), spec.maximumSpacingMm);
  const bondLength = (2 * steel.allowableMPa * barArea) / (steel.bondMPa * perimeter);
  const lengthCalc = bondLength + spec.paintingAllowanceMm + spec.placementAllowanceMm;
  const lengthMm = nearest10(lengthCalc);

  const warnings = [];
  if (diameterMm > spec.maximumDiameterMm) warnings.push(`Tie bars over ${spec.maximumDiameterMm} mm diameter restrain warping · Cl. 8.2.4`);
  if (nearest10(spacingCalc) > spec.maximumSpacingMm) warnings.push(`Tie bar spacing held to ${spec.maximumSpacingMm} mm · Cl. 8.2.4`);

  const f = (x, digits = 1) => x.toFixed(digits);
  return {
    type,
    diameterMm,
    areaPerM,
    barArea,
    perimeter,
    spacingCalc,
    spacingMm,
    bondLength,
    lengthCalc,
    lengthMm,
    warnings,
    steps: [
      {
        title: 'Steel across the longitudinal joint',
        formula: 'As = b f W / Sst',
        substitution: `${laneWidthM} × ${spec.friction} × ${slabMm / 1000} × ${spec.concreteUnitWeightKNm3 * 1000} / ${steel.allowableMPa}`,
        result: `As = ${f(areaPerM)} mm² per m`,
        ref: spec.ref,
      },
      {
        title: 'Tie bar spacing',
        formula: `A = π d² / 4;  spacing = 1000 A / As, not over ${spec.maximumSpacingMm} mm`,
        substitution: `${type} bar, d = ${diameterMm} mm, A = ${f(barArea)} mm²;  1000 × ${f(barArea)} / ${f(areaPerM)} = ${f(spacingCalc)} mm`,
        result: `${spacingMm} mm c/c`,
        ref: spec.ref,
      },
      {
        title: 'Tie bar length',
        formula: `L = 2 Sst A / (B P) + ${spec.paintingAllowanceMm} + ${spec.placementAllowanceMm} mm`,
        substitution: `2 × ${steel.allowableMPa} × ${f(barArea)} / (${steel.bondMPa} × ${f(perimeter)}) = ${f(bondLength)} mm`,
        result: `L = ${f(lengthCalc)} mm, say ${lengthMm} mm`,
        ref: spec.example,
      },
    ],
  };
}

/**
 * Bearing stress on the concrete under the dowel nearest the heaviest wheel,
 * at a contraction and at an expansion joint (Cl. 7.2, Appendix-VIII).
 *
 * @param {object} i
 * @param {number} i.diameterMm  @param {number} i.spacingMm  Dowels, Table 5.
 * @param {number} i.lMm          Radius of relative stiffness.
 * @param {number} i.axleKN       Heaviest single axle.
 * @param {boolean} i.tiedShoulder
 * @param {number} i.fck          Characteristic cube strength, MPa.
 */
export function dowelBearing({ diameterMm, spacingMm, lMm, axleKN, tiedShoulder, fck }) {
  const spec = RIGID.dowelBearing;
  const wheelKN = axleKN / 2;
  const acrossKN = wheelKN * (1 - (tiedShoulder ? spec.shoulderShare : 0)) * spec.dowelShare;
  // Dowels within l of the load carry it, falling linearly to nothing at l.
  const shares = [];
  for (let x = 0; x < lMm; x += spacingMm) shares.push((lMm - x) / lMm);
  const sum = shares.reduce((a, b) => a + b, 0);
  const PtKN = acrossKN / sum;
  const I = (Math.PI * diameterMm ** 4) / 64;
  const EI = spec.steelModulusMPa * I;
  const kmds = spec.dowelSupportMPaPerM / 1000; // N/mm³
  const beta = Math.pow((kmds * diameterMm) / (4 * EI), 0.25);
  const at = (z) => (kmds * (2 + beta * z) * PtKN * 1000) / (4 * beta ** 3 * EI);
  const allowable = ((101.6 - diameterMm) * fck) / 95.25;
  const joints = Object.entries(spec.jointMm).map(([id, z]) => ({ id, z, stress: at(z), safe: at(z) <= allowable }));
  const worst = joints.reduce((a, b) => (b.stress > a.stress ? b : a));
  const f = (x, d = 2) => x.toFixed(d);
  return {
    wheelKN,
    acrossKN,
    dowels: shares.length,
    sum,
    PtKN,
    beta,
    I,
    allowable,
    joints,
    stress: worst.stress,
    safe: joints.every((j) => j.safe),
    steps: [
      {
        title: 'Load on the dowels',
        formula: `Wheel = axle / 2${tiedShoulder ? `, less ${spec.shoulderShare * 100}% to the tied shoulder` : ''}; ${spec.dowelShare * 100}% of it across the joint`,
        substitution: `${axleKN} / 2 = ${f(wheelKN, 1)} kN${tiedShoulder ? ` × ${1 - spec.shoulderShare}` : ''} × ${spec.dowelShare}`,
        result: `${f(acrossKN)} kN`,
        ref: spec.example,
      },
      {
        title: 'Dowels sharing it',
        formula: 'Dowels within l of the load, their shares falling linearly to nothing at l',
        substitution: `l = ${f(lMm, 1)} mm, ${spacingMm} mm apart: ${shares.length} dowels, Σ = ${f(sum)}`,
        result: `Pt = ${f(acrossKN)} / ${f(sum)} = ${f(PtKN)} kN`,
        ref: spec.ref,
      },
      {
        title: 'Bearing stress under the dowel',
        formula: 'β = [kmds d / 4 E I]^(1/4);  Fbmax = kmds (2 + β z) Pt / (4 β³ E I)',
        substitution: `d = ${diameterMm} mm, I = ${Math.round(I).toLocaleString('en-IN')} mm⁴, β = ${f(beta, 4)} /mm; z = ${joints.map((j) => j.z).join(' and ')} mm`,
        result: joints.map((j) => `${f(j.stress)} MPa at ${j.z} mm`).join(', '),
        ref: spec.ref,
      },
      {
        title: 'Allowable bearing stress',
        formula: 'Fb = (101.6 − d) fck / 95.25',
        substitution: `(101.6 − ${diameterMm}) × ${fck} / 95.25`,
        result: `Fb = ${f(allowable)} MPa ${worst.stress <= allowable ? '≥' : '<'} ${f(worst.stress)} MPa`,
        ref: spec.ref,
      },
    ],
  };
}
