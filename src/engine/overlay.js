/**
 * Overlay design for flexible pavements from deflection surveys.
 *
 *  - IRC:81-1997: Benkelman beam rebound deflections, corrected to 35 °C and
 *    to the monsoon, give a characteristic deflection; Fig. 9 gives the
 *    bituminous macadam overlay for it and the design traffic.
 *  - IRC:115-2014: falling weight deflectometer bowls give the layer moduli
 *    by back-calculation; corrected and taken at the 15th percentile, they
 *    give the strains of the pavement as it stands, its remaining life, and
 *    the overlay that carries the design traffic.
 *
 * Every step carries the clause it comes from.
 */

import { IRC81, IRC115 } from '../data/overlay.js';
import { STANDARD_AXLE } from '../data/ircConstants.js';
import { analyze, surfaceDeflections } from './elastic.js';

const fmt = (v, digits = 0) =>
  Number.isFinite(v) ? v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '–';
const positive = (v) => Number.isFinite(v) && v > 0;
const CODE = { bbd: IRC81, fwd: IRC115 };

/* ------------------------------------------------------------------ *
 * Design traffic (IRC:81 Eq. 1, IRC:115 Eqs. 10 and 11)
 * ------------------------------------------------------------------ */

export const laneOptions = (method) => CODE[method].traffic.lanes.options;

/** Indicative VDF of Table 4, by commercial vehicles per day at the start of the design life. */
export function overlayVdf(method, cvpd, terrain) {
  const row = CODE[method].traffic.vdf.rows.find((r) => cvpd <= r.upToCVPD);
  return terrain === 'hilly' ? row.hilly : row.plainRolling;
}

/**
 * @param {'bbd'|'fwd'} method
 * @param {object} t  mode ('calculate'|'direct'), designMsa, presentCVPD (both directions),
 *        growthRatePercent, yearsToCompletion, designLifeYears, laneId,
 *        directionalSplitPercent, vdfMode ('indicative'|'value'), vehicleDamageFactor.
 * @param {object} project  roadCategory, terrain.
 */
export function overlayTraffic(method, t, project = {}) {
  const spec = CODE[method].traffic;
  const steps = [];
  const warnings = [];
  const major = IRC81.characteristic.majorRoads.includes(project.roadCategory);

  if (t.mode === 'direct') {
    if (!positive(t.designMsa)) return { ok: false, message: 'Enter the design traffic' };
    steps.push({
      title: 'Design traffic',
      formula: 'Entered',
      substitution: '',
      result: `${fmt(t.designMsa, 2)} msa`,
      ref: spec.ref,
    });
    return { ok: true, msa: t.designMsa, steps, warnings };
  }

  if (!positive(t.presentCVPD)) return { ok: false, message: 'Enter the commercial vehicles per day' };
  if (!positive(t.designLifeYears)) return { ok: false, message: 'Enter the design life' };
  if (!(t.growthRatePercent >= 0)) return { ok: false, message: 'Enter the growth rate' };

  let growth = t.growthRatePercent;
  if (method === 'fwd' && growth < spec.growth.minimumPercent) {
    warnings.push(`Growth rate taken as ${spec.growth.minimumPercent}%, the least the code allows · ${spec.growth.ref.clause}`);
    growth = spec.growth.minimumPercent;
  }
  const years = t.designLifeYears;
  const life = spec.designLife;
  if (years < life.minimumYears) {
    warnings.push(`Design life under ${life.minimumYears} years · ${life.ref.clause}`);
  } else if (major && years < (life.majorYears ?? life.years)) {
    warnings.push(`A design life of at least ${life.majorYears ?? life.years} years for a major road · ${life.ref.clause}`);
  }

  const r = growth / 100;
  const x = t.yearsToCompletion || 0;
  const P = t.presentCVPD;
  const A0 = P * Math.pow(1 + r, x);
  steps.push({
    title: 'Traffic at the start of the design life',
    formula: 'A = P (1 + r)^x',
    substitution: `A = ${fmt(P)} × (1 + ${r.toFixed(3)})^${x}`,
    result: `${fmt(A0)} CVPD, both directions`,
    ref: method === 'fwd' ? spec.ref : spec.ref,
  });

  const lane = spec.lanes.options.find((o) => o.id === t.laneId) || spec.lanes.options[1];
  const split = lane.basis === 'direction' ? (t.directionalSplitPercent ?? 50) / 100 : 1;
  const D = lane.factor * split;
  steps.push({
    title: 'Lane distribution',
    formula: lane.basis === 'direction' ? 'D = factor × share of the heavier direction' : 'D = factor on both directions',
    substitution: lane.basis === 'direction' ? `D = ${lane.factor} × ${split.toFixed(2)}` : `D = ${lane.factor}`,
    result: `${lane.label}: D = ${D.toFixed(3)}`,
    ref: spec.lanes.ref,
  });

  let F = t.vehicleDamageFactor;
  if (t.vdfMode !== 'value') {
    F = overlayVdf(method, A0, project.terrain);
    steps.push({
      title: 'Vehicle damage factor',
      formula: 'Indicative, by commercial vehicles per day and terrain',
      substitution: `${fmt(A0)} CVPD, ${project.terrain === 'hilly' ? 'hilly' : 'plain or rolling'}`,
      result: `VDF = ${F}`,
      ref: spec.vdf.ref,
    });
  } else if (!positive(F)) {
    return { ok: false, message: 'Enter the vehicle damage factor' };
  }

  const growthFactor = r > 0 ? (Math.pow(1 + r, years) - 1) / r : years;
  const N = 365 * growthFactor * A0 * D * F;
  steps.push({
    title: 'Design traffic',
    formula: 'N = 365 [(1 + r)^n − 1] / r × A × D × F',
    substitution: `N = 365 × ${growthFactor.toFixed(3)} × ${fmt(A0)} × ${D.toFixed(3)} × ${F}`,
    result: `${fmt(N / 1e6, 2)} msa`,
    ref: spec.ref,
  });
  return { ok: true, msa: N / 1e6, A: A0, D, F, years, growth, steps, warnings };
}

/* ------------------------------------------------------------------ *
 * Statistics
 * ------------------------------------------------------------------ */

export function meanAndSd(values) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd };
}

/**
 * The value 15% of the values fall below (IRC:115 Cl. 8.4 vii): in the
 * sorted values, the one with 0.15 n of them before it, between two values
 * taken in proportion. Appendix IV takes it so.
 */
export function percentileBelow(values, percent) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (percent / 100) * sorted.length;
  const i = Math.min(Math.floor(position), sorted.length - 1);
  const j = Math.min(i + 1, sorted.length - 1);
  return sorted[i] + (position - i) * (sorted[j] - sorted[i]);
}

/* ------------------------------------------------------------------ *
 * IRC:81 — Benkelman beam
 * ------------------------------------------------------------------ */

/** The Fig. 2 - 7 curve for a soil and rainfall. */
export function seasonalChart(soil, rainfall) {
  return IRC81.seasonal.charts.find((c) => c.soil === soil && c.rainfall === rainfall);
}

/** Seasonal correction factor at a field moisture content, or null outside the chart. */
export function seasonalFactor(soil, rainfall, moisturePercent) {
  const chart = seasonalChart(soil, rainfall);
  if (!chart || !Number.isFinite(moisturePercent)) return null;
  const position = (moisturePercent - chart.fromPercent) / chart.stepPercent;
  if (position < -1e-9 || position > chart.factors.length - 1 + 1e-9) return null;
  const i = Math.min(Math.floor(position), chart.factors.length - 2);
  const f = position - i;
  return chart.factors[i] + f * (chart.factors[i + 1] - chart.factors[i]);
}

export const chartRange = (soil, rainfall) => {
  const c = seasonalChart(soil, rainfall);
  return c ? [c.fromPercent, c.fromPercent + c.stepPercent * (c.factors.length - 1)] : null;
};

const CURVE_KEYS = () =>
  Object.keys(IRC81.overlayChart.curves)
    .map(Number)
    .sort((a, b) => a - b);

/** Overlay on one Fig. 9 curve, mm of BM; 0 left of where the curve leaves the axis. */
function overlayOnCurve(msaKey, deflection) {
  const pts = IRC81.overlayChart.curves[String(msaKey)];
  if (deflection <= pts[0][0]) return 0;
  for (let k = 1; k < pts.length; k++) {
    const [d1, h1] = pts[k];
    if (deflection <= d1) {
      const [d0, h0] = pts[k - 1];
      return h0 + ((deflection - d0) / (d1 - d0)) * (h1 - h0);
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Fig. 9: BM overlay for a characteristic deflection and design traffic,
 * between the curves in proportion to the logarithm of the traffic.
 */
export function fig9Overlay(deflectionMm, msa) {
  const keys = CURVE_KEYS();
  const lo = keys[0];
  const hi = keys[keys.length - 1];
  if (!(deflectionMm > 0)) return { ok: false, message: 'No characteristic deflection' };
  if (deflectionMm > IRC81.overlayChart.maxDeflectionMm) {
    return { ok: false, message: `A characteristic deflection over ${IRC81.overlayChart.maxDeflectionMm} mm is beyond Fig. 9` };
  }
  if (msa > hi) return { ok: false, message: `Design traffic over ${hi} msa is beyond Fig. 9` };
  const m = Math.max(msa, lo);
  const below = [...keys].reverse().find((k) => k <= m);
  const above = keys.find((k) => k >= m);
  const hBelow = overlayOnCurve(below, deflectionMm);
  const hAbove = overlayOnCurve(above, deflectionMm);
  const f = above === below ? 0 : (Math.log10(m) - Math.log10(below)) / (Math.log10(above) - Math.log10(below));
  return { ok: true, overlayMm: hBelow + f * (hAbove - hBelow), below, above, hBelow, hAbove, clampedMsa: msa < lo };
}

/**
 * @param {object} input
 * @param {Array<{deflectionMm:number, temperatureC:number, moisturePercent:number}>} input.points
 * @param {number} input.bituminousMm        Bituminous layers over the base.
 * @param {boolean} input.coldArea           Cl. 4.4.4.
 * @param {boolean} input.severelyCracked    Cracked or stripped: no temperature correction.
 * @param {'monsoon'|'dry'} input.season      Measured after the monsoon, or in the dry months.
 * @param {'sandy'|'clayLow'|'clayHigh'} input.soil
 * @param {'low'|'high'} input.rainfall
 * @param {string} input.roadCategory
 * @param {number} input.designMsa
 */
export function designBbd(input) {
  const steps = [];
  const warnings = [];
  const points = (input.points || []).filter((p) => positive(p.deflectionMm));
  if (points.length < 2) return { ok: false, message: 'Enter the rebound deflections' };

  const t = IRC81.temperature;
  const tempApplies = !input.coldArea && !input.severelyCracked && input.bituminousMm >= t.minimumBituminousMm;
  const seasonalApplies = input.season === 'dry';
  if (tempApplies && points.some((p) => !Number.isFinite(p.temperatureC))) {
    return { ok: false, message: 'Enter the pavement temperature at every point' };
  }
  if (seasonalApplies && points.some((p) => !Number.isFinite(p.moisturePercent))) {
    return { ok: false, message: 'Enter the field moisture content at every point' };
  }

  const range = chartRange(input.soil, input.rainfall);
  const rows = [];
  for (const [i, p] of points.entries()) {
    const temperatureCorrection = tempApplies ? (t.standardC - p.temperatureC) * t.mmPerDegree : 0;
    let factor = 1;
    if (seasonalApplies) {
      factor = seasonalFactor(input.soil, input.rainfall, p.moisturePercent);
      if (factor == null) {
        return {
          ok: false,
          message: `Moisture content ${p.moisturePercent}% at point ${i + 1} is outside ${seasonalChart(input.soil, input.rainfall).figure} (${range[0]} – ${range[1]}%)`,
        };
      }
    }
    rows.push({ ...p, temperatureCorrection, factor, corrected: (p.deflectionMm + temperatureCorrection) * factor });
  }

  if (input.coldArea) {
    warnings.push(`Cold or high area: no temperature correction, and measure above 20 °C ambient · ${t.cold.ref.clause}`);
  }
  if (points.length < IRC81.survey.minimumPoints) {
    warnings.push(`At least ${IRC81.survey.minimumPoints} points in each lane of a section · ${IRC81.survey.ref.clause}`);
  }

  steps.push({
    title: 'Temperature correction',
    formula: tempApplies ? 'Δ = 0.01 mm × (35 − T)' : 'Not applied',
    substitution: tempApplies
      ? `${rows.length} points, T = ${fmt(Math.min(...rows.map((r) => r.temperatureC)))} – ${fmt(Math.max(...rows.map((r) => r.temperatureC)))} °C`
      : input.coldArea
        ? 'Cold or high area'
        : input.severelyCracked
          ? 'Severely cracked or stripped surfacing'
          : `Bituminous layer under ${t.minimumBituminousMm} mm`,
    result: tempApplies ? `Δ = ${fmt(Math.min(...rows.map((r) => r.temperatureCorrection)), 2)} to ${fmt(Math.max(...rows.map((r) => r.temperatureCorrection)), 2)} mm` : '–',
    ref: input.coldArea ? t.cold.ref : t.ref,
  });
  const chart = seasonalChart(input.soil, input.rainfall);
  steps.push({
    title: 'Seasonal correction',
    formula: seasonalApplies ? `Factor from ${chart.figure} at the field moisture content` : 'Not applied',
    substitution: seasonalApplies
      ? `${rows.length} points, ${fmt(Math.min(...rows.map((r) => r.moisturePercent)), 1)} – ${fmt(Math.max(...rows.map((r) => r.moisturePercent)), 1)}% moisture`
      : 'Measured after the monsoon',
    result: seasonalApplies
      ? `Factor ${fmt(Math.min(...rows.map((r) => r.factor)), 2)} – ${fmt(Math.max(...rows.map((r) => r.factor)), 2)}`
      : '–',
    ref: { ...IRC81.seasonal.ref, note: seasonalApplies ? chart.figure : IRC81.seasonal.ref.note },
  });

  const { n, mean, sd } = meanAndSd(rows.map((r) => r.corrected));
  const variability = IRC81.variability;
  const off = rows.filter((r) => Math.abs(r.corrected - mean) > variability.fractionOfMean * mean);
  if (off.length) {
    warnings.push(
      `${off.length} point${off.length > 1 ? 's' : ''} more than a third off the mean: take readings ${variability.extraAtM} m either side · ${variability.ref.clause}`
    );
  }
  const major = IRC81.characteristic.majorRoads.includes(input.roadCategory);
  const Dc = mean + (major ? 2 : 1) * sd;
  steps.push({
    title: 'Mean and standard deviation',
    formula: 'x̄ = Σx / n,  σ = √[Σ(x − x̄)² / (n − 1)]',
    substitution: `n = ${n}`,
    result: `x̄ = ${fmt(mean, 3)} mm, σ = ${fmt(sd, 3)} mm`,
    ref: IRC81.characteristic.ref,
  });
  steps.push({
    title: 'Characteristic deflection',
    formula: major ? 'Dc = x̄ + 2σ  (NH, SH)' : 'Dc = x̄ + σ',
    substitution: `Dc = ${fmt(mean, 3)} + ${major ? '2 × ' : ''}${fmt(sd, 3)}`,
    result: `Dc = ${fmt(Dc, 2)} mm`,
    ref: IRC81.characteristic.ref,
  });

  const partial = { rows, steps, n, mean, sd, Dc, warnings };
  if (!positive(input.designMsa)) return { ok: false, message: 'Enter the design traffic', ...partial };
  const chartResult = fig9Overlay(Dc, input.designMsa);
  if (!chartResult.ok) return { ok: false, message: chartResult.message, ...partial };
  if (chartResult.clampedMsa) {
    warnings.push(`Design traffic under the lowest curve of Fig. 9: the ${chartResult.below} msa curve is used`);
  }
  const bm = chartResult.overlayMm;
  steps.push({
    title: 'Overlay, bituminous macadam',
    formula: chartResult.above === chartResult.below ? `Fig. 9, ${chartResult.below} msa curve` : 'Fig. 9, between curves on log traffic',
    substitution:
      chartResult.above === chartResult.below
        ? `Dc = ${fmt(Dc, 2)} mm`
        : `${chartResult.below} msa: ${fmt(chartResult.hBelow)} mm, ${chartResult.above} msa: ${fmt(chartResult.hAbove)} mm at ${fmt(input.designMsa, 2)} msa`,
    result: `${fmt(bm)} mm BM`,
    ref: IRC81.overlayChart.ref,
  });

  const eq = IRC81.equivalence;
  const min = IRC81.minimum;
  const structural = bm > 0.5;
  const bmProvided = structural ? Math.max(Math.ceil(bm / 5) * 5, min.bmMm) : 0;
  const dbmBc = Math.ceil((bm * eq.dbmCm) / 5) * 5;
  const granular = Math.ceil((bm * eq.granularCm) / 5) * 5;
  if (structural) {
    steps.push({
      title: 'In other materials',
      formula: '1 cm BM = 0.7 cm DBM / AC / SDC = 1.5 cm WBM / WMM / BUSG',
      substitution: `${fmt(bm)} × 0.7, ${fmt(bm)} × 1.5`,
      result: `${dbmBc} mm DBM or BC, or ${granular} mm WMM`,
      ref: eq.ref,
    });
    if (bm < min.bmMm) {
      warnings.push(`Least overlay: ${min.bmMm} mm BM with ${min.dbmMm} mm DBM or ${min.bcMm} mm BC over it · ${min.ref.clause}`);
    }
  }
  return {
    ok: true,
    method: 'bbd',
    rows,
    n,
    mean,
    sd,
    Dc,
    major,
    tempApplies,
    seasonalApplies,
    chart: chartResult,
    overlayBmMm: bm,
    structural,
    provided: { bmMm: bmProvided, dbmBcMm: structural ? Math.max(dbmBc, 0) : 0, granularMm: granular },
    steps,
    warnings,
  };
}

/* ------------------------------------------------------------------ *
 * IRC:115 — falling weight deflectometer
 * ------------------------------------------------------------------ */

/** Deflections to the 40 kN target load, and the checks of Cl. 6.1.1. */
export function normalisePoint(point, radii) {
  const target = IRC115.load.targetKN;
  const load = positive(point.loadKN) ? point.loadKN : target;
  const d = radii.map((_, i) => point.deflections?.[i]);
  const complete = d.every(positive);
  const normalised = complete ? d.map((v) => (v * target) / load) : null;
  const falling = complete ? normalised.every((v, i) => i === 0 || v <= normalised[i - 1]) : false;
  return { load, normalised, complete, falling };
}

/** Temperature correction factor of Eq. 5, to the standard temperature. */
export function temperatureFactor(temperatureC) {
  const { standardC, coefficient } = IRC115.temperature;
  return (1 - coefficient * Math.log(standardC)) / (1 - coefficient * Math.log(temperatureC));
}

/** Subgrade and granular moduli to the monsoon (Eqs. 6 - 9). */
export function toMonsoon(season, subgrade, granular) {
  const s = IRC115.seasonal;
  if (season === 'winter') {
    return {
      subgrade: s.subgradeWinter.a * Math.pow(subgrade, s.subgradeWinter.b) + s.subgradeWinter.c,
      granular: s.granularWinter.a * Math.pow(granular, s.granularWinter.b) + s.granularWinter.c,
    };
  }
  if (season === 'summer') {
    return {
      subgrade: s.subgradeSummer.a * subgrade + s.subgradeSummer.c,
      granular: s.granularSummer.a2 * granular ** 2 + s.granularSummer.a1 * granular + s.granularSummer.c,
    };
  }
  return { subgrade, granular };
}

/**
 * Subgrade modulus from the outer sensors (Eq. III.2), E = (1 − μ²) P / (π r w),
 * r and w the averages of the radii from 1200 mm and their deflections.
 */
export function subgradeEstimate(radii, normalised, loadN, nu) {
  const from = IRC115.backcalculation.ranges.subgradeSensorsFromMm;
  const outer = radii.map((r, i) => [r, normalised[i]]).filter(([r]) => r >= from);
  if (!outer.length) return null;
  const r = outer.reduce((s, [v]) => s + v, 0) / outer.length;
  const w = outer.reduce((s, [, v]) => s + v, 0) / outer.length;
  return ((1 - nu * nu) * loadN) / (Math.PI * r * w);
}

/** Search ranges for a point (App. III.8.4). */
export function backcalcRanges({ radii, normalised, loadN, nu, condition }) {
  const R = IRC115.backcalculation.ranges;
  const estimate = subgradeEstimate(radii, normalised, loadN, nu);
  const subgrade = estimate
    ? [R.subgradeFactor * estimate * R.subgradeSpread[0], R.subgradeFactor * estimate * R.subgradeSpread[1]]
    : R.subgradeDefault;
  return {
    bituminous: condition === 'good' ? R.bituminousGood : R.bituminousDistressed,
    granular: R.granular,
    subgrade,
    subgradeEstimate: estimate,
  };
}

/**
 * Back-calculate the three moduli from a normalised bowl: the moduli, within
 * their ranges, that make the least sum of squared relative differences from
 * the measured deflections (App. III.7). Solved by damped Gauss-Newton on the
 * logarithms of the moduli, from the middle of each range.
 *
 * @returns {{E:number[], computed:number[], objective:number, rmsPercent:number, iterations:number, atBound:boolean[]}}
 */
export function backcalculate({ radii, measured, thicknesses, nu, plate, ranges }) {
  const bounds = [ranges.bituminous, ranges.granular, ranges.subgrade].map(([lo, hi]) => [Math.log(lo), Math.log(hi)]);
  const clamp = (x) => x.map((v, i) => Math.min(bounds[i][1], Math.max(bounds[i][0], v)));
  const forward = (x) =>
    surfaceDeflections({
      layers: [
        { h: thicknesses[0], E: Math.exp(x[0]), nu: nu[0] },
        { h: thicknesses[1], E: Math.exp(x[1]), nu: nu[1] },
        { h: 0, E: Math.exp(x[2]), nu: nu[2] },
      ],
      plate,
      radii,
    });
  const residual = (d) => d.map((v, i) => (v - measured[i]) / measured[i]);
  const cost = (res) => res.reduce((s, v) => s + v * v, 0);

  let x = clamp(bounds.map(([lo, hi]) => (lo + hi) / 2));
  if (ranges.subgradeEstimate) x[2] = Math.log(Math.min(ranges.subgrade[1], Math.max(ranges.subgrade[0], ranges.subgradeEstimate * 1.2)));
  let d = forward(x);
  let res = residual(d);
  let c = cost(res);
  let lambda = 1e-2;
  let iterations = 0;
  for (; iterations < 40; iterations++) {
    // Jacobian by forward differences in log modulus.
    const J = [0, 1, 2].map((k) => {
      const xs = [...x];
      xs[k] += 0.01;
      const r2 = residual(forward(xs));
      return r2.map((v, i) => (v - res[i]) / 0.01);
    });
    // Normal equations (J^T J + λ diag) δ = −J^T r.
    const JTJ = [0, 1, 2].map((a) => [0, 1, 2].map((b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0)));
    const JTr = [0, 1, 2].map((a) => J[a].reduce((s, v, i) => s + v * res[i], 0));
    let improved = false;
    for (let tries = 0; tries < 8; tries++) {
      const M = JTJ.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (JTJ[a][a] || 1e-12) : 0)));
      const delta = solve3(M, JTr.map((v) => -v));
      if (!delta) {
        lambda *= 10;
        continue;
      }
      const xn = clamp(x.map((v, i) => v + delta[i]));
      const dn = forward(xn);
      const rn = residual(dn);
      const cn = cost(rn);
      if (cn < c) {
        const gain = c - cn;
        x = xn;
        d = dn;
        res = rn;
        c = cn;
        lambda = Math.max(lambda / 5, 1e-6);
        improved = gain > 1e-12;
        break;
      }
      lambda *= 8;
    }
    if (!improved) break;
  }
  const E = x.map(Math.exp);
  const atBound = x.map((v, i) => Math.abs(v - bounds[i][0]) < 1e-6 || Math.abs(v - bounds[i][1]) < 1e-6);
  return { E, computed: d, objective: c, rmsPercent: 100 * Math.sqrt(c / measured.length), iterations, atBound };
}

function solve3(M, b) {
  const [[a, b1, c], [d, e, f], [g, h, i]] = M;
  const det = a * (e * i - f * h) - b1 * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null;
  const inv = [
    [(e * i - f * h) / det, (c * h - b1 * i) / det, (b1 * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b1 * g - a * h) / det, (a * e - b1 * d) / det],
  ];
  return inv.map((row) => row[0] * b[0] + row[1] * b[1] + row[2] * b[2]);
}

/** Fatigue life, Eq. 16, standard axles. */
export function fatigueLife(tensileStrain, modulusMPa) {
  const s = IRC115.fatigue;
  return s.k * Math.pow(1 / tensileStrain, s.strainExponent) * Math.pow(1 / modulusMPa, s.modulusExponent);
}

/** Rutting life, Eq. 17, standard axles. */
export function ruttingLife(verticalStrain) {
  const s = IRC115.rutting;
  return s.k * Math.pow(1 / verticalStrain, s.strainExponent);
}

/**
 * Critical strains under the standard dual wheel (IRC:37): horizontal tension
 * at the bottom of the bituminous layers, vertical compression on the subgrade.
 */
export function criticalStrains(layers) {
  const bitIndex = layers.length - 3;
  const zBit = layers.slice(0, bitIndex + 1).reduce((s, l) => s + l.h, 0);
  const zSub = layers.slice(0, -1).reduce((s, l) => s + l.h, 0);
  const offsets = [0, STANDARD_AXLE.dualSpacingMm / 2];
  const points = [
    ...offsets.map((x) => ({ x, y: 0, z: zBit, layerIndex: bitIndex })),
    ...offsets.map((x) => ({ x, y: 0, z: zSub, layerIndex: layers.length - 1 })),
  ];
  const r = analyze({
    layers,
    load: { wheelLoadN: STANDARD_AXLE.wheelLoadN, tyrePressureMPa: STANDARD_AXLE.tyrePressureMPa, dualSpacingMm: STANDARD_AXLE.dualSpacingMm },
    points,
  });
  return {
    tensile: Math.max(...r.slice(0, 2).map((p) => p.maxHorizontalStrain)),
    vertical: Math.max(...r.slice(2).map((p) => p.verticalCompressiveStrain)),
  };
}

/** Lives and the verdict at one set of strains. */
function lives({ tensile, vertical }, bituminousModulus, designMsa) {
  const fatigue = tensile > 0 ? fatigueLife(tensile, bituminousModulus) / 1e6 : Infinity;
  const rutting = vertical > 0 ? ruttingLife(vertical) / 1e6 : Infinity;
  return { tensile, vertical, fatigueMsa: fatigue, ruttingMsa: rutting, lifeMsa: Math.min(fatigue, rutting), safe: Math.min(fatigue, rutting) >= designMsa };
}

/**
 * The moduli of each test point to 35 °C and the monsoon, and the design
 * moduli at the 15th percentile.
 *
 * @param {object} input
 * @param {Array<{bituminous:number, granular:number, subgrade:number, temperatureC:number}>} input.moduli
 * @param {number} input.bituminousMm
 * @param {'good'|'fair'|'poor'} input.condition
 * @param {boolean} input.coldArea
 * @param {'monsoon'|'winter'|'summer'} input.season
 */
export function designModuli(input) {
  const steps = [];
  const warnings = [];
  const t = IRC115.temperature;
  const tempApplies = !input.coldArea && input.condition !== 'poor' && input.bituminousMm >= t.minimumBituminousMm;
  const limits = IRC115.seasonal.limits;
  const rows = input.moduli.map((m) => {
    const lambda = tempApplies ? temperatureFactor(m.temperatureC) : 1;
    const monsoon = toMonsoon(input.season, m.subgrade, m.granular);
    return { ...m, lambda, bituminous35: m.bituminous * lambda, granularMonsoon: monsoon.granular, subgradeMonsoon: monsoon.subgrade };
  });
  if (tempApplies) {
    const out = rows.filter((r) => r.temperatureC < t.extendedC[0] || r.temperatureC > t.extendedC[1]);
    if (out.length) warnings.push(`Temperature outside ${t.extendedC[0]} – ${t.extendedC[1]} °C, where Eq. 5 holds · ${t.ref.clause}`);
  }
  if (input.season !== 'monsoon') {
    const measuredMin = limits.subgradeMeasured;
    const granMin = input.season === 'winter' ? limits.granularWinter : limits.granularSummer;
    if (rows.some((r) => r.subgrade < measuredMin || r.granular < granMin)) {
      warnings.push(
        `Eqs. 6 – 9 hold for ${input.season} moduli of at least ${measuredMin} MPa (subgrade) and ${granMin} MPa (granular) · ${IRC115.seasonal.ref.clause}`
      );
    }
  }
  steps.push({
    title: 'Bituminous modulus to 35 °C',
    formula: tempApplies ? 'E35 = λ E_T,  λ = (1 − 0.238 ln 35) / (1 − 0.238 ln T)' : 'Not applied',
    substitution: tempApplies
      ? `T = ${fmt(Math.min(...rows.map((r) => r.temperatureC)))} – ${fmt(Math.max(...rows.map((r) => r.temperatureC)))} °C`
      : input.coldArea
        ? 'Cold or high area'
        : input.condition === 'poor'
          ? 'Poor section'
          : `Bituminous layer under ${t.minimumBituminousMm} mm`,
    result: tempApplies ? `λ = ${fmt(Math.min(...rows.map((r) => r.lambda)), 3)} – ${fmt(Math.max(...rows.map((r) => r.lambda)), 3)}` : '–',
    ref: input.coldArea ? t.cold.ref : t.ref,
  });
  const seasonFormula = {
    monsoon: 'Measured in the monsoon: none',
    winter: 'Sub = 3.351 E^0.7688 − 28.9,  Gran = 10.5523 E^0.624 − 113.857',
    summer: 'Sub = 0.8554 E − 8.461,  Gran = −0.0003 E² + 0.9584 E − 32.989',
  }[input.season];
  steps.push({
    title: 'Granular and subgrade moduli to the monsoon',
    formula: seasonFormula,
    substitution: input.season === 'monsoon' ? '' : `${rows.length} points, measured in ${input.season}`,
    result: input.season === 'monsoon' ? '–' : input.season === 'winter' ? 'Eqs. 9 and 6' : 'Eqs. 8 and 7',
    ref: IRC115.seasonal.ref,
  });

  const p = IRC115.procedure.percentile;
  const design = {
    bituminous: percentileBelow(rows.map((r) => r.bituminous35), p),
    granular: percentileBelow(rows.map((r) => r.granularMonsoon), p),
    subgrade: percentileBelow(rows.map((r) => r.subgradeMonsoon), p),
  };
  steps.push({
    title: 'Design moduli, 15th percentile',
    formula: 'The value 15% of the points fall below',
    substitution: `${rows.length} points`,
    result: `${fmt(design.bituminous)}, ${fmt(design.granular)}, ${fmt(design.subgrade, 1)} MPa`,
    ref: IRC115.procedure.ref,
  });
  if (design.subgrade < limits.subgradeMonsoon || design.granular < limits.granularMonsoon) {
    warnings.push(`Monsoon moduli under ${limits.subgradeMonsoon} MPa (subgrade) or ${limits.granularMonsoon} MPa (granular) are outside Eqs. 6 – 9 · ${IRC115.seasonal.ref.clause}`);
  }
  return { rows, design, tempApplies, steps, warnings };
}

/**
 * Remaining life of the pavement as it stands and the overlay that carries
 * the design traffic (Cl. 8.3, 8.4).
 *
 * @param {object} input
 * @param {{bituminous:number, granular:number, subgrade:number}} input.moduli  Design moduli.
 * @param {number} input.bituminousMm
 * @param {number} input.granularMm
 * @param {{bituminous:number, granular:number, subgrade:number}} input.nu
 * @param {number} input.overlayModulusMPa
 * @param {number} input.designMsa
 * @param {number} [input.trialMm]  An overlay to check in place of the least one found.
 * @param {object} [input.measured]  Strains read from IITPAVE: {existing:{tensile,vertical}, overlaid:{tensile,vertical}} in microstrain.
 */
export function designFwdOverlay(input) {
  const steps = [];
  const warnings = [];
  const { moduli, nu } = input;
  const existingLayers = [
    { h: input.bituminousMm, E: moduli.bituminous, nu: nu.bituminous },
    { h: input.granularMm, E: moduli.granular, nu: nu.granular },
    { h: 0, E: moduli.subgrade, nu: nu.subgrade },
  ];
  const measured = input.measured || {};
  const fromIitpave = (set) => positive(set?.tensile) && positive(set?.vertical);

  const appExisting = criticalStrains(existingLayers);
  const existingStrains = fromIitpave(measured.existing)
    ? { tensile: measured.existing.tensile * 1e-6, vertical: measured.existing.vertical * 1e-6 }
    : appExisting;
  const existing = lives(existingStrains, moduli.bituminous, input.designMsa);
  existing.fromIitpave = fromIitpave(measured.existing);
  existing.app = appExisting;
  steps.push({
    title: 'Strains in the pavement as it stands',
    formula: 'Three layers under the standard dual wheel, 20 kN each at 0.56 MPa, 310 mm apart',
    substitution: `${fmt(input.bituminousMm)} / ${fmt(input.granularMm)} mm on ${fmt(moduli.bituminous)} / ${fmt(moduli.granular)} / ${fmt(moduli.subgrade, 1)} MPa`,
    result: `εt = ${fmt(existingStrains.tensile * 1e6, 1)}, εv = ${fmt(existingStrains.vertical * 1e6, 1)} µε${existing.fromIitpave ? ' (IITPAVE)' : ''}`,
    ref: IRC115.procedure.ref,
  });
  steps.push({
    title: 'Remaining life',
    formula: 'Nf = 0.711×10⁻⁴ (1/εt)^3.89 (1/MR)^0.854,  Nr = 1.41×10⁻⁸ (1/εv)^4.5337',
    substitution: `MR = ${fmt(moduli.bituminous)} MPa`,
    result: `Fatigue ${fmt(existing.fatigueMsa, 1)} msa, rutting ${fmt(existing.ruttingMsa, 1)} msa`,
    ref: { ...IRC115.fatigue.ref, equation: 'Eqs. 16, 17' },
  });

  const overlaid = (h) => [
    { h, E: input.overlayModulusMPa, nu: nu.bituminous },
    ...existingLayers,
  ];
  // The bituminous layer at whose bottom the strain is taken is the existing one.
  const strainsWith = (h) => {
    const layers = overlaid(h);
    const bitIndex = 1;
    const zBit = h + input.bituminousMm;
    const zSub = zBit + input.granularMm;
    const offsets = [0, STANDARD_AXLE.dualSpacingMm / 2];
    const r = analyze({
      layers,
      load: { wheelLoadN: STANDARD_AXLE.wheelLoadN, tyrePressureMPa: STANDARD_AXLE.tyrePressureMPa, dualSpacingMm: STANDARD_AXLE.dualSpacingMm },
      points: [
        ...offsets.map((x) => ({ x, y: 0, z: zBit, layerIndex: bitIndex })),
        ...offsets.map((x) => ({ x, y: 0, z: zSub, layerIndex: layers.length - 1 })),
      ],
    });
    return {
      tensile: Math.max(...r.slice(0, 2).map((p) => p.maxHorizontalStrain)),
      vertical: Math.max(...r.slice(2).map((p) => p.verticalCompressiveStrain)),
    };
  };

  if (existing.safe && !positive(input.trialMm)) {
    return { ok: true, method: 'fwd', existing, needed: false, overlayMm: 0, steps, warnings };
  }

  // The least overlay, in 5 mm steps, that carries the design traffic.
  let least = null;
  let atLeast = null;
  for (let h = 5; h <= 400; h += 5) {
    const check = lives(strainsWith(h), moduli.bituminous, input.designMsa);
    if (check.safe) {
      least = h;
      atLeast = check;
      break;
    }
  }
  const chosen = positive(input.trialMm) ? input.trialMm : least;
  if (chosen == null) {
    return { ok: false, message: 'No overlay up to 400 mm carries the design traffic', existing, steps, warnings };
  }
  const appOverlaid = chosen === least ? { tensile: atLeast.tensile, vertical: atLeast.vertical } : strainsWith(chosen);
  const useIitpave = fromIitpave(measured.overlaid) && (measured.overlaid.forMm == null || measured.overlaid.forMm === chosen);
  const overlaidStrains = useIitpave
    ? { tensile: measured.overlaid.tensile * 1e-6, vertical: measured.overlaid.vertical * 1e-6 }
    : appOverlaid;
  const withOverlay = lives(overlaidStrains, moduli.bituminous, input.designMsa);
  withOverlay.fromIitpave = useIitpave;
  withOverlay.app = appOverlaid;
  steps.push({
    title: positive(input.trialMm) ? 'Overlay checked' : 'Least overlay, by trial',
    formula: 'Four layers; strains at the bottom of the existing bituminous layer and on the subgrade',
    substitution: `${fmt(chosen)} mm at ${fmt(input.overlayModulusMPa)} MPa over the pavement`,
    result: `εt = ${fmt(overlaidStrains.tensile * 1e6, 1)}, εv = ${fmt(overlaidStrains.vertical * 1e6, 1)} µε${useIitpave ? ' (IITPAVE)' : ''}`,
    ref: IRC115.procedure.ref,
  });
  steps.push({
    title: 'Life with the overlay',
    formula: 'Eqs. 16 and 17, MR of the existing bituminous layer',
    substitution: `Design traffic ${fmt(input.designMsa, 1)} msa`,
    result: `Fatigue ${fmt(withOverlay.fatigueMsa, 1)} msa, rutting ${fmt(withOverlay.ruttingMsa, 1)} msa: ${withOverlay.safe ? 'carries it' : 'does not carry it'}`,
    ref: { ...IRC115.fatigue.ref, equation: 'Eqs. 16, 17' },
  });
  if (positive(input.trialMm) && least != null && input.trialMm < least) {
    warnings.push(`The least overlay that carries the design traffic is ${least} mm`);
  }
  return { ok: true, method: 'fwd', existing, needed: !existing.safe, overlayMm: chosen, leastMm: least, withOverlay, steps, warnings };
}
