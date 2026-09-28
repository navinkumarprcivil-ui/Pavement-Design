/**
 * Concrete pavements for low volume roads — IRC:SP:62-2014.
 *
 * Edge stress from a 50 kN dual wheel by Westergaard's equation with the
 * equivalent radius of the dual (Cl. 4.2.1.1), curling by Bradbury's equation
 * on the linear part of the differential less the relief of its non-linear
 * part (Cl. 4.2.1.2, Appendix II), and, by traffic (Cl. 4.3):
 *   under 50 CVPD     load stress against the 90-day flexural strength
 *   50 to 150 CVPD    load and curling stress against it
 *   over 150 CVPD     fatigue of the combined stress, Eq. 3.5
 * The slab is the thinnest, in 10 mm steps from 150 mm, that passes.
 */

import { CODES } from '../data/ircConstants.js';
import { SP62 } from '../data/sp62.js';

const STEP_MM = 10;
const MAX_MM = 400;

const inr = (value, digits = 0) =>
  Number(value).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function interpolate(xs, ys, x) {
  if (x <= xs[0]) return { value: ys[0], outside: x < xs[0] };
  const last = xs.length - 1;
  if (x >= xs[last]) return { value: ys[last], outside: x > xs[last] };
  const i = xs.findIndex((xi) => xi >= x);
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return { value: ys[i - 1] + t * (ys[i] - ys[i - 1]), outside: false };
}

/** Which of the three design cases the traffic falls in. */
export function designCase(cvpd) {
  const c = SP62.cases;
  if (cvpd < c.loadOnlyBelow) return 1;
  if (cvpd <= c.fatigueAbove) return 2;
  return 3;
}

/** Cumulative commercial vehicles over the design period, and the heavy axles among them. */
export function sp62Repetitions({ cvpd, growthPercent, years, heavySharePercent }) {
  const r = growthPercent / 100;
  const F = r > 0 ? (Math.pow(1 + r, years) - 1) / r : years;
  const N = 365 * cvpd * F;
  return { N, F, heavy: (N * heavySharePercent) / 100 };
}

/** Effective k of the foundation. */
export function sp62K({ subgradeCBR, subBase, measuredK }) {
  if (subBase === 'measured') return { subgradeK: null, k: measuredK, outside: false };
  const sub = interpolate(SP62.subgradeK.cbr, SP62.subgradeK.k, subgradeCBR);
  const t = SP62.effectiveK;
  const eff = interpolate(t.cbr, subBase === 'cementitious' ? t.cementitious : t.granular, subgradeCBR);
  return { subgradeK: sub.value, k: eff.value, outside: sub.outside };
}

/** 28- and 90-day flexural strength. */
export function sp62Flexural({ mode, fck, flexural28 }) {
  const c = SP62.concrete;
  const f28 = mode === 'flexural' ? flexural28 : c.flexuralFactor * Math.sqrt(fck);
  return { f28, f90: c.ninetyDayFactor * f28 };
}

export function radiusOfRelativeStiffness(hMm, kMPaPerM) {
  const c = SP62.concrete;
  const k = kMPaPerM / 1000;
  return Math.pow((c.elasticModulusMPa * hMm ** 3) / (12 * (1 - c.poissonRatio ** 2) * k), 0.25);
}

/** Radius of the circle equal to a dual wheel's two contact areas and the area between them, Eq. 4.4 – 4.7. */
export function dualRadius(wheelN, tyreMPa, spacingMm) {
  const Pd = wheelN / 2;
  return Math.sqrt((0.8521 * Pd) / (tyreMPa * Math.PI) + (spacingMm / Math.PI) * Math.sqrt(Pd / (0.5227 * tyreMPa)));
}

export const singleRadius = (wheelN, tyreMPa) => Math.sqrt(wheelN / (Math.PI * tyreMPa));

/** Westergaard's edge stress, Eq. 4.1, MPa. P in N, h and a in mm, k in MPa/m. */
export function westergaardEdge(P, hMm, kMPaPerM, a) {
  const { elasticModulusMPa: E, poissonRatio: mu } = SP62.concrete;
  const k = kMPaPerM / 1000;
  const l = radiusOfRelativeStiffness(hMm, kMPaPerM);
  return (
    ((3 * (1 + mu) * P) / (Math.PI * (3 + mu) * hMm ** 2)) *
    (Math.log((E * hMm ** 3) / (100 * k * a ** 4)) + 1.84 - (4 * mu) / 3 + (1 - mu) / 2 + (1.18 * (1 + 2 * mu) * a) / l)
  );
}

/** Bradbury's coefficient for a slab dimension L over the radius of relative stiffness l. */
export function bradburyC(ratio) {
  const x = ratio / Math.sqrt(8);
  return 1 - (2 * Math.cos(x) * Math.cosh(x) * (Math.tan(x) + Math.tanh(x))) / (Math.sin(2 * x) + Math.sinh(2 * x));
}

/** Differential for a slab: the column of Table 4.1 for the next listed thickness up. */
export function temperatureDifferential(temperature, hMm) {
  if (temperature.mode === 'site') return { value: temperature.deltaC, outside: false };
  const t = SP62.temperature;
  const zone = t.zones.find((z) => z.id === temperature.zone) || t.zones[0];
  const col = t.thicknessesMm.findIndex((mm) => mm >= hMm);
  return { value: zone.values[col === -1 ? zone.values.length - 1 : col], outside: col === -1, zone };
}

/**
 * Stresses at one thickness.
 * @param {object} i  {thicknessMm, k, f90, jointM, temperature, cvpd, heavyRepetitions, tractor}
 */
export function evaluateSP62(i) {
  const c = SP62.concrete;
  const L = SP62.load;
  const h = i.thicknessMm;
  const P = L.wheelLoadKN * 1000;
  const l = radiusOfRelativeStiffness(h, i.k);
  const aDual = dualRadius(P, L.truckTyreMPa, L.dualSpacingMm);
  const truck = westergaardEdge(P, h, i.k, aDual);
  const aSingle = singleRadius(P, L.tractorTyreMPa);
  const tractor = i.tractor ? westergaardEdge(P, h, i.k, aSingle) : null;
  const kase = designCase(i.cvpd);

  let curling = null;
  let dT = null;
  let C = null;
  if (kase > 1) {
    dT = temperatureDifferential(i.temperature, h).value;
    C = bradburyC((i.jointM * 1000) / l);
    const linear = SP62.temperature.linearShare * dT;
    const bending = (c.elasticModulusMPa * c.thermalCoefficient * linear * C) / 2;
    const relief = SP62.nonLinear.edgePerDegree * SP62.nonLinear.share * dT;
    curling = { linear, bending, relief, net: Math.max(0, bending - relief) };
  }

  // Loads: the truck's dual wheel, and a tractor's single wheel where asked for.
  const load = tractor != null ? Math.max(truck, tractor) : truck;
  const total = load + (curling ? curling.net : 0);
  const SR = total / i.f90;

  let fatigue = null;
  if (kase === 3) {
    const fatigueStress = truck + curling.net;
    const sr = fatigueStress / i.f90;
    const logN = Math.pow(sr, SP62.fatigue.exponent) / SP62.fatigue.divisor;
    const allowable = Math.pow(10, logN);
    fatigue = { stress: fatigueStress, SR: sr, logN, allowable, cfd: i.heavyRepetitions / allowable };
  }

  const safe = kase === 3 ? fatigue.cfd <= 1 : total < i.f90;
  return { thicknessMm: h, l, aDual, aSingle, truck, tractor, load, curling, dT, C, total, SR, fatigue, case: kase, safe };
}

/** Cemented layers counted as sub-base for costing and the section. */
function subBaseSlots(subBase, band) {
  if (subBase === 'cementitious') {
    return band.cementitious.map((mm, n) => ({
      slotId: `SB${n}`,
      materialId: n === 0 ? 'Cementitious base' : 'Cementitious sub-base',
      label: `Cementitious ${n === 0 ? 'granular layer' : 'natural material'}, 7-day UCS ≥ ${band.cementitiousUCS[n]} MPa`,
      thicknessMm: mm,
      behaviour: 'cemented',
    }));
  }
  if (subBase === 'granular') {
    return [
      { slotId: 'SB0', materialId: 'WBM III / WMM', label: 'WBM Grade III / WMM', thicknessMm: band.granular[0], behaviour: 'granular' },
      { slotId: 'SB1', materialId: 'GSB', label: 'Granular sub-base', thicknessMm: band.granular[1], behaviour: 'granular' },
    ];
  }
  return [];
}

/**
 * The design.
 * @param {object} d
 * @param {number} d.presentCVPD  @param {number} d.growthPercent  @param {number} d.yearsToCompletion
 * @param {number} d.designYears  @param {number} d.heavySharePercent
 * @param {number} d.subgradeCBR  @param {'granular'|'cementitious'|'measured'} d.subBase  @param {number} [d.measuredK]
 * @param {'fck'|'flexural'} d.strengthMode  @param {number} d.fck  @param {number} d.flexural28
 * @param {object} d.temperature  {mode: 'zone'|'site', zone, deltaC}
 * @param {number} d.jointM  @param {boolean} d.tractor
 * @param {number|null} d.trialMm  A thickness to adopt in place of the designed one.
 */
export function designSP62(d) {
  const steps = [];
  const warnings = [];
  const growth = d.growthPercent ?? 5;
  const cvpd = (d.presentCVPD || 0) * Math.pow(1 + growth / 100, d.yearsToCompletion || 0);
  const kase = designCase(cvpd);

  if (cvpd >= SP62.scope.maximumCVPD) warnings.push(`${SP62.scope.maximumCVPD} CVPD or more: IRC:58 applies · ${SP62.scope.ref.clause}`);

  if (d.yearsToCompletion > 0) {
    steps.push({
      id: 'cvpd',
      title: 'Commercial vehicles after completion',
      formula: 'A = P (1 + r)^x',
      substitution: `A = ${inr(d.presentCVPD)} x (1 + ${growth / 100})^${d.yearsToCompletion}`,
      result: `A = ${inr(cvpd, 1)} CVPD`,
      ref: SP62.repetitions.ref,
    });
  }
  steps.push({
    id: 'case',
    title: 'Design case',
    formula: 'Under 50 CVPD: load; 50 – 150: load and curling; over 150: fatigue',
    substitution: `A = ${inr(cvpd, 1)} CVPD`,
    result: ['', 'Case 1, wheel load stress', 'Case 2, wheel load and curling stress', 'Case 3, fatigue'][kase],
    ref: SP62.cases.ref,
  });

  let reps = null;
  if (kase === 3) {
    reps = sp62Repetitions({ cvpd, growthPercent: growth, years: d.designYears || SP62.designPeriod.years, heavySharePercent: d.heavySharePercent ?? SP62.repetitions.heavySharePercent });
    steps.push({
      id: 'repetitions',
      title: 'Commercial vehicles over the design period',
      formula: 'N = 365 A [(1 + r)^n − 1] / r',
      substitution: `N = 365 x ${inr(cvpd, 1)} x ${reps.F.toFixed(3)}`,
      result: `N = ${inr(reps.N)}`,
      ref: SP62.repetitions.ref,
    });
    steps.push({
      id: 'heavy',
      title: '100 kN axle repetitions',
      formula: 'n = share x N',
      substitution: `${d.heavySharePercent ?? SP62.repetitions.heavySharePercent}% x ${inr(reps.N)}`,
      result: `n = ${inr(reps.heavy)}`,
      ref: SP62.repetitions.ref,
    });
  }

  // Foundation.
  const band = SP62.subBase.bands.find((b) => cvpd < b.upTo || b.upTo === SP62.scope.maximumCVPD) || SP62.subBase.bands.at(-1);
  const found = sp62K(d);
  if (d.subBase !== 'measured') {
    if (d.subgradeCBR < SP62.subgradeK.minimumCBR) warnings.push(`Subgrade CBR under the ${SP62.subgradeK.minimumCBR}% minimum · ${SP62.subgradeK.ref.clause}`);
    if (found.outside) warnings.push('Subgrade CBR outside Table 3.1; the nearest value is used');
    steps.push({
      id: 'k-subgrade',
      title: 'Modulus of subgrade reaction',
      formula: 'k from soaked CBR',
      substitution: `CBR = ${d.subgradeCBR}%`,
      result: `k = ${found.subgradeK.toFixed(1)} MPa/m`,
      ref: SP62.subgradeK.ref,
    });
    steps.push({
      id: 'k-effective',
      title: 'Effective k over the sub-base',
      formula: d.subBase === 'cementitious' ? 'Twice the subgrade k' : '20% over the subgrade k',
      substitution: `CBR = ${d.subgradeCBR}%, ${d.subBase === 'cementitious' ? 'cementitious' : 'granular'} sub-base`,
      result: `k = ${found.k.toFixed(1)} MPa/m`,
      ref: SP62.effectiveK.ref,
    });
    steps.push({
      id: 'sub-base',
      title: 'Sub-base',
      formula: `For up to ${band.upTo} CVPD`,
      substitution: d.subBase === 'cementitious' ? 'Cementitious' : 'Granular',
      result:
        d.subBase === 'cementitious'
          ? band.cementitious.map((mm, n) => `${mm} mm at UCS ${band.cementitiousUCS[n]} MPa`).join(' over ')
          : `${band.granular[0]} mm WBM III / WMM over ${band.granular[1]} mm GSB`,
      ref: SP62.subBase.ref,
    });
  } else {
    steps.push({ id: 'k-effective', title: 'Effective k', formula: 'Measured', substitution: '', result: `k = ${d.measuredK} MPa/m`, ref: SP62.subgradeK.ref });
  }

  // Concrete.
  const strength = sp62Flexural({ mode: d.strengthMode, fck: d.fck, flexural28: d.flexural28 });
  const c = SP62.concrete;
  steps.push({
    id: 'flexural',
    title: 'Flexural strength',
    formula: d.strengthMode === 'flexural' ? 'f90 = 1.10 x f28' : 'f28 = 0.7 √fck;  f90 = 1.10 x f28',
    substitution: d.strengthMode === 'flexural' ? `f90 = 1.10 x ${strength.f28}` : `f28 = 0.7 x √${d.fck} = ${strength.f28.toFixed(3)}`,
    result: `f90 = ${strength.f90.toFixed(2)} MPa`,
    ref: c.ref,
  });
  if (d.strengthMode !== 'flexural' && d.fck < c.minimumFck) warnings.push(`Characteristic strength under M${c.minimumFck} · ${c.ref.clause}`);
  if (strength.f28 < c.minimumFlexural) warnings.push(`28-day flexural strength under ${c.minimumFlexural} MPa · ${c.ref.clause}`);

  const s = SP62.slab;
  if (d.jointM < s.jointMinM || d.jointM > s.jointMaxM) warnings.push(`Joint spacing outside ${s.jointMinM} – ${s.jointMaxM} m · ${s.ref.clause}`);

  const at = (h) =>
    evaluateSP62({
      thicknessMm: h,
      k: found.k,
      f90: strength.f90,
      jointM: d.jointM,
      temperature: d.temperature,
      cvpd,
      heavyRepetitions: reps?.heavy ?? 0,
      tractor: d.tractor,
    });

  let designed = null;
  for (let h = s.minimumMm; h <= MAX_MM; h += STEP_MM) {
    const e = at(h);
    if (e.safe) {
      designed = e;
      break;
    }
  }
  const trial = d.trialMm >= s.minimumMm ? at(d.trialMm) : null;
  if (d.trialMm > 0 && d.trialMm < s.minimumMm) warnings.push(`Slab under the ${s.minimumMm} mm minimum · ${s.ref.clause}`);
  const adopted = trial || designed || at(MAX_MM);
  if (!designed) warnings.push(`No slab up to ${MAX_MM} mm passes`);

  const e = adopted;
  steps.push({
    id: 'edge-load',
    title: 'Edge stress from the wheel load',
    formula: 'Westergaard: σe = 3(1+μ)P / [π(3+μ)h²] [ln(Eh³/100ka⁴) + 1.84 − 4μ/3 + (1−μ)/2 + 1.18(1+2μ)a/l]',
    substitution:
      `P = ${SP62.load.wheelLoadKN} kN dual at ${SP62.load.dualSpacingMm} mm, ${SP62.load.truckTyreMPa} MPa -> a = ${e.aDual.toFixed(1)} mm; ` +
      `h = ${e.thicknessMm} mm, k = ${found.k.toFixed(1)}, l = ${e.l.toFixed(1)} mm`,
    result: `σe = ${e.truck.toFixed(3)} MPa` + (e.tractor != null ? `; tractor wheel at ${SP62.load.tractorTyreMPa} MPa (a = ${e.aSingle.toFixed(1)} mm): ${e.tractor.toFixed(3)} MPa` : ''),
    ref: SP62.edgeStress.ref,
  });
  if (e.curling) {
    steps.push({
      id: 'curling',
      title: 'Curling stress at the edge',
      formula: 'σt = E α t C / 2 − 0.0767 ΔT/3;  t = 0.667 ΔT;  C from L/l (Bradbury)',
      substitution:
        `ΔT = ${e.dT} °C, t = ${e.curling.linear.toFixed(2)} °C, L/l = ${((d.jointM * 1000) / e.l).toFixed(2)}, C = ${e.C.toFixed(3)}; ` +
        `${e.curling.bending.toFixed(3)} − ${e.curling.relief.toFixed(3)}`,
      result: `σt = ${e.curling.net.toFixed(3)} MPa`,
      ref: SP62.curling.ref,
    });
  }
  if (e.case < 3) {
    steps.push({
      id: 'check',
      title: e.case === 1 ? 'Wheel load stress against the flexural strength' : 'Total stress against the flexural strength',
      formula: 'σ < f90',
      substitution: `${e.total.toFixed(3)} against ${strength.f90.toFixed(2)} MPa`,
      result: e.safe ? `Safe at ${e.thicknessMm} mm` : `Not safe at ${e.thicknessMm} mm`,
      ref: SP62.cases.ref,
    });
  } else {
    const f = e.fatigue;
    steps.push({
      id: 'fatigue',
      title: 'Allowable repetitions',
      formula: 'log10 Nf = SR^−2.222 / 0.523;  SR = σ / f90',
      substitution: `SR = ${f.stress.toFixed(3)} / ${strength.f90.toFixed(2)} = ${f.SR.toFixed(3)}`,
      result: `Nf = ${f.allowable < 1e12 ? inr(f.allowable) : f.allowable.toExponential(2)}`,
      ref: SP62.fatigue.ref,
    });
    steps.push({
      id: 'cfd',
      title: 'Cumulative fatigue damage',
      formula: 'CFD = n / Nf ≤ 1',
      substitution: `${inr(reps.heavy)} / ${f.allowable < 1e12 ? inr(f.allowable) : f.allowable.toExponential(2)}`,
      result: `CFD = ${f.cfd < 0.01 ? f.cfd.toExponential(2) : f.cfd.toFixed(2)} · ${e.safe ? 'Safe' : 'Not safe'} at ${e.thicknessMm} mm`,
      ref: SP62.repetitions.ref,
    });
  }

  const slots = [
    { slotId: 'PQC', materialId: 'PQC', label: 'Pavement quality concrete', thicknessMm: e.thicknessMm, behaviour: 'concrete' },
    ...subBaseSlots(d.subBase, band),
    { slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' },
  ];

  return {
    code: CODES.IRCSP62.designation,
    cvpd,
    case: kase,
    repetitions: reps,
    k: found.k,
    subgradeK: found.subgradeK,
    strength,
    band,
    designedMm: designed?.thicknessMm ?? null,
    adopted: e,
    trial: Boolean(trial),
    safe: e.safe,
    slots,
    steps,
    warnings,
  };
}
