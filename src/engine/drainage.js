/**
 * The drainage layer below the sub-base of a concrete pavement — IRC:58-2015
 * Cl. 6.5 and Appendix-VI.
 *
 * Water entering by the joints and cracks (Eq. 9) is carried out along the
 * resultant slope of the layer, from the crown to the embankment face; the
 * layer must pass it, Q = K I A (VI-VIII).
 */

import { RIGID } from '../data/ircConstants.js';

const round = (x, digits) => Number(x.toFixed(digits));

/**
 * @param {object} i
 * @param {number} i.pavementM          Concrete carriageway draining one way.
 * @param {number} i.concreteShoulderM  Concrete (paved) shoulder.
 * @param {number} i.unpavedShoulderM   Earthen shoulder.
 * @param {number} i.longitudinalJoints Nc, longitudinal joints and edges.
 * @param {number} i.jointSpacingM      Cs, transverse joints.
 * @param {number} i.gradePercent       Longitudinal gradient.
 * @param {number} i.crossFallPercent   Camber.
 * @param {number} i.sideSlope          Embankment side slope, horizontal per vertical.
 * @param {number} i.depthMm            Surface to the top of the drainage layer.
 * @param {number} i.layerMm            Drainage layer thickness.
 * @param {number} [i.permeability]     K of the material, m/day, from tests.
 */
export function drainageLayer(i) {
  const spec = RIGID.drainage;
  const g = i.gradePercent / 100;
  const c = i.crossFallPercent / 100;

  const shoulderM = i.concreteShoulderM + i.unpavedShoulderM;
  const widthM = i.pavementM + shoulderM + i.sideSlope * (i.depthMm / 1000);
  const alongM = widthM * (g / c);
  const pathM = Math.hypot(widthM, alongM);
  const dropM = alongM * g + widthM * c;
  const slope = dropM / pathM;

  const infiltrationWidthM = i.pavementM + shoulderM;
  const jointLengthM = i.pavementM + i.concreteShoulderM;
  const qi =
    spec.crackInfiltration *
      (i.longitudinalJoints / infiltrationWidthM + jointLengthM / (infiltrationWidthM * i.jointSpacingM)) +
    spec.surfaceInfiltration;

  const flow = pathM * qi;
  const conductance = flow / slope;
  const requiredK = conductance / (i.layerMm / 1000);
  const specifiedK = Math.max(requiredK, spec.minimumPermeability);
  const permeability = i.permeability > 0 ? i.permeability : null;
  const thicknessForK = permeability
    ? Math.max(spec.minimumThicknessMm, Math.ceil(((conductance / permeability) * 1000) / 10) * 10)
    : null;

  const checks = {
    thickness: i.layerMm >= spec.minimumThicknessMm,
    permeability: permeability == null ? null : permeability >= specifiedK,
  };

  return {
    widthM,
    alongM,
    pathM,
    dropM,
    slope,
    infiltrationWidthM,
    jointLengthM,
    qi,
    flow,
    conductance,
    requiredK,
    specifiedK,
    permeability,
    thicknessForK,
    checks,
    ok: checks.thickness && checks.permeability !== false,
    steps: drainageSteps(i, { widthM, alongM, pathM, dropM, slope, infiltrationWidthM, jointLengthM, qi, flow, conductance, requiredK, specifiedK, permeability, thicknessForK }),
  };
}

function drainageSteps(i, r) {
  const spec = RIGID.drainage;
  const f = (x, digits = 2) => round(x, digits).toString();
  const steps = [
    {
      title: 'Width of the drainage layer',
      formula: 'B = pavement + shoulders + side slope × depth of the layer',
      substitution: `${i.pavementM} + ${i.concreteShoulderM} + ${i.unpavedShoulderM} + ${i.sideSlope} × ${i.depthMm / 1000}`,
      result: `B = ${f(r.widthM)} m`,
      ref: spec.example,
    },
    {
      title: 'Flow path and its gradient',
      formula: 'AC = B × gradient / camber;  AD = √(B² + AC²);  I = (AC × gradient + B × camber) / AD',
      substitution: `AC = ${f(r.alongM)} m, drop ${f(r.dropM, 3)} m`,
      result: `AD = ${f(r.pathM)} m, I = ${f(r.slope, 4)}`,
      ref: spec.example,
    },
    {
      title: 'Infiltration through the joints',
      formula: 'qi = Ic [Nc / Wp + Wc / (Wp Cs)] + Kp',
      substitution: `Ic = ${spec.crackInfiltration}, Nc = ${i.longitudinalJoints}, Wp = ${f(r.infiltrationWidthM)} m, Wc = ${f(r.jointLengthM)} m, Cs = ${i.jointSpacingM} m, Kp = ${spec.surfaceInfiltration}`,
      result: `qi = ${f(r.qi, 4)} m³/day/m²`,
      ref: spec.ref,
    },
    {
      title: 'Water to carry along the path',
      formula: 'Q = AD × qi;  K A = Q / I',
      substitution: `${f(r.pathM)} × ${f(r.qi, 4)} = ${f(r.flow, 3)} m³/day per m`,
      result: `K A = ${f(r.conductance)} m³/day`,
      ref: spec.example,
    },
    {
      title: 'Permeability of the layer',
      formula: `K = K A / t, not less than ${spec.minimumPermeability} m/day`,
      substitution: `${f(r.conductance)} / ${i.layerMm / 1000} = ${Math.round(r.requiredK)} m/day`,
      result: `K ≥ ${Math.round(r.specifiedK)} m/day`,
      ref: spec.ref,
    },
  ];
  if (r.permeability) {
    steps.push({
      title: 'Thickness for the material tested',
      formula: `t = K A / K, not less than ${spec.minimumThicknessMm} mm`,
      substitution: `${f(r.conductance)} / ${r.permeability}`,
      result: `t ≥ ${r.thicknessForK} mm`,
      ref: spec.thickness,
    });
  }
  return steps;
}

/**
 * Warnings on the drainage material: the grading (Cu = D60 / D10, D10), Los
 * Angeles abrasion and the stabiliser content.
 */
export function drainageMaterial({ d10Mm, d60Mm, abrasionPercent, stabiliser, stabiliserPercent }) {
  const spec = RIGID.drainage;
  const warnings = [];
  const cu = d10Mm > 0 && d60Mm > 0 ? d60Mm / d10Mm : null;
  if (cu != null) {
    if (cu < spec.uniformity.min || cu > spec.uniformity.max) {
      warnings.push(`Cu ${cu.toFixed(1)} outside ${spec.uniformity.min} – ${spec.uniformity.max} for a drainage layer · Appendix-VI, VI-III`);
    }
    if (cu < spec.uniformity.stabiliseBelow && stabiliser === 'none') {
      warnings.push(`Cu under ${spec.uniformity.stabiliseBelow}: stabilise the drainage layer with cement or bitumen · Appendix-VI, VI-III`);
    }
  }
  if (d10Mm > 0 && d10Mm <= spec.minimumD10Mm) {
    warnings.push(`D10 of ${d10Mm} mm; highly permeable layers have D10 over ${spec.minimumD10Mm} mm · Appendix-VI, VI-III`);
  }
  if (abrasionPercent >= spec.maximumAbrasionPercent) {
    warnings.push(`Los Angeles abrasion to be less than ${spec.maximumAbrasionPercent}% · Cl. 6.5.3`);
  }
  const range = spec.stabilisers[stabiliser]?.percent;
  if (range && Number.isFinite(stabiliserPercent) && (stabiliserPercent < range[0] || stabiliserPercent > range[1])) {
    warnings.push(`${spec.stabilisers[stabiliser].label} content ${range[0]} – ${range[1]}% · Cl. 5.7.3.9 / 6.5.2`);
  }
  return { cu, warnings };
}
