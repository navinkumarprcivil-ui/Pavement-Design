/**
 * Low volume rural roads, flexible — IRC:SP:72-2015.
 *
 * Design traffic in cumulative ESAL (Cl. 3.4), the traffic category (Cl. 3.5)
 * and subgrade class (Cl. 4.3), then the composition from the design
 * catalogue: Fig. 4 for gravel and granular layers, Fig. 6 for cement treated
 * ones. The catalogue cell is then adjusted as the code allows: surfacing
 * (Cl. 6.3, 7.3), part of a gravel base as sub-base (Table 4), frost (Cl. 8),
 * and an overlay on an existing road (Cl. 2.2.3).
 */

import { CODES } from '../data/ircConstants.js';
import { SP72, SP72_LAYERS, FIG4, FIG6, FIG6_PREMIX_FROM } from '../data/sp72.js';

const inr = (value, digits = 0) =>
  Number(value).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const CATEGORY_IDS = SP72.categories.list.map((c) => c.id);
const categoryIndex = (id) => CATEGORY_IDS.indexOf(id);

export function laneFactor(laneId) {
  return (SP72.lane.options.find((o) => o.id === laneId) || SP72.lane.options[0]).value;
}

/** Growth factor [(1 + r)^n − 1] / r; n where r is zero. */
export function growthFactor(ratePercent, years) {
  const r = ratePercent / 100;
  return r > 0 ? (Math.pow(1 + r, years) - 1) / r : years;
}

/** Average annual daily traffic of a vehicle type counted in a season with harvest peaks. */
export function harvestAADT(count, { countSeason, rise, seasonDays, seasons = SP72.harvest.seasons }) {
  const lean = countSeason === 'peak' ? count / (1 + rise) : count;
  return lean + (seasons * rise * lean * SP72.harvest.peakShare * seasonDays) / 365;
}

/** Cumulative ESAL read from Appendix A for a CVPD where the HCV/MCV split is not known. */
export function appendixAEsal(cvpd) {
  const { cvpd: xs, esal: ys } = SP72.appendixA;
  let i = xs.findIndex((x) => x >= cvpd);
  if (i === -1) i = xs.length - 1;
  if (i === 0) i = 1;
  const t = (cvpd - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return { value: Math.max(0, ys[i - 1] + t * (ys[i] - ys[i - 1])), outside: cvpd < xs[0] || cvpd > xs[xs.length - 1] };
}

/**
 * Design traffic.
 * @param {object} t
 * @param {'counts'|'appendixA'} t.mode
 * @param {number} t.hcv  Heavy commercial vehicles per day as counted.
 * @param {number} t.mcv  Medium-heavy commercial vehicles per day as counted.
 * @param {'counts'|'appendixA'|'direct'} t.mode
 * @param {number} t.cvpd Commercial vehicles per day, for Appendix A.
 * @param {number} [t.designEsal]  Design traffic, when known.
 * @param {number} t.ladenPercent  Share of each class laden.
 * @param {'indicative'|'survey'} t.vdfMode
 * @param {number} [t.vdfHcv] @param {number} [t.vdfMcv]  From an axle load survey.
 * @param {object} t.harvest  {enabled, countSeason, rise, seasonDays, seasons}
 * @param {number} t.yearsToOpening @param {number} t.growthPercent
 * @param {number} t.designLifeYears @param {string} t.laneId
 */
export function sp72Traffic(t) {
  const steps = [];
  const warnings = [];
  const L = laneFactor(t.laneId);
  const growth = t.growthPercent ?? SP72.growth.defaultPercent;
  const years = t.designLifeYears || SP72.designLife.years;
  const x = t.yearsToOpening || 0;
  const toOpening = Math.pow(1 + growth / 100, x);

  if (years !== SP72.designLife.years) {
    warnings.push(`Design life taken as ${years} years; the code recommends ${SP72.designLife.years} · ${SP72.designLife.ref.clause}`);
  }

  if (t.mode === 'direct') {
    const N = t.designEsal > 0 ? t.designEsal : 0;
    steps.push({
      id: 'esal',
      title: 'Cumulative ESAL over the design life',
      formula: 'Entered',
      substitution: '',
      result: `N = ${inr(N)} ESAL`,
      ref: SP72.cumulative.ref,
    });
    return { mode: 'direct', esal: N, esalPerDay: null, laneFactor: null, cvpdAtOpening: null, steps, warnings };
  }

  if (t.mode === 'appendixA') {
    const cvpd = (t.cvpd || 0) * toOpening;
    const read = appendixAEsal(cvpd);
    if (x > 0) {
      steps.push({
        id: 'opening',
        title: 'Commercial vehicles in the year of opening',
        formula: 'A = P (1 + r)^x',
        substitution: `A = ${inr(t.cvpd || 0)} x (1 + ${growth / 100})^${x}`,
        result: `A = ${inr(cvpd, 1)} CVPD`,
        ref: SP72.cumulative.ref,
      });
    }
    const N = read.value * L;
    if (read.outside) warnings.push(`CVPD outside the range of Appendix A (${SP72.appendixA.cvpd[0]} – ${SP72.appendixA.cvpd.at(-1)}); the value is extrapolated`);
    if (years !== SP72.designLife.years) warnings.push('Appendix A is for a 10-year design life');
    steps.push({
      id: 'appendix-a',
      title: 'Cumulative ESAL from typical rural traffic',
      formula: 'Interpolated on CVPD in Appendix A' + (L !== 1 ? ', x L' : ''),
      substitution: `CVPD = ${inr(cvpd, 1)}${L !== 1 ? `, L = ${L}` : ''}`,
      result: `N = ${inr(N)} ESAL`,
      ref: SP72.appendixA.ref,
    });
    return { mode: 'appendixA', esal: N, esalPerDay: null, laneFactor: L, cvpdAtOpening: cvpd, steps, warnings };
  }

  // Counts by class, adjusted for harvesting seasons, carried to the year of opening.
  const classes = [
    { id: 'hcv', label: 'HCV', count: t.hcv || 0 },
    { id: 'mcv', label: 'MCV', count: t.mcv || 0 },
  ];
  const h = t.harvest || {};
  for (const c of classes) {
    c.aadt = h.enabled ? harvestAADT(c.count, h) : c.count;
    c.opening = c.aadt * toOpening;
  }

  if (h.enabled) {
    steps.push({
      id: 'harvest',
      title: 'Average annual daily traffic with harvesting seasons',
      formula: 'AADT = T + s·n·T·(0.6 t) / 365' + (h.countSeason === 'peak' ? ',  T = peak count / (1 + n)' : ''),
      substitution: `n = ${h.rise}, t = ${h.seasonDays} days, s = ${h.seasons ?? SP72.harvest.seasons}; ` +
        classes.map((c) => `${c.label} ${inr(c.count)} -> ${inr(c.aadt, 1)}`).join(', '),
      result: classes.map((c) => `${c.label} ${inr(c.aadt, 1)}`).join(' · ') + ' per day',
      ref: SP72.harvest.ref,
    });
  }
  if (x > 0) {
    steps.push({
      id: 'opening',
      title: 'Traffic in the year of opening',
      formula: 'A = P (1 + r)^x',
      substitution: `(1 + ${growth / 100})^${x} = ${toOpening.toFixed(4)}`,
      result: classes.map((c) => `${c.label} ${inr(c.opening, 1)}`).join(' · ') + ' per day',
      ref: SP72.cumulative.ref,
    });
  }

  const p = (t.ladenPercent ?? 50) / 100;
  // A survey value is used once entered; an empty box keeps the indicative one.
  const entered = (v) => t.vdfMode === 'survey' && Number.isFinite(v) && v >= 0;
  const surveyed = { hcv: entered(t.vdfHcv), mcv: entered(t.vdfMcv) };
  const indicative = !surveyed.hcv && !surveyed.mcv;
  const vdf = {
    hcv: surveyed.hcv ? t.vdfHcv : p * SP72.vdf.hcv.laden + (1 - p) * SP72.vdf.hcv.unladen,
    mcv: surveyed.mcv ? t.vdfMcv : p * SP72.vdf.mcv.laden + (1 - p) * SP72.vdf.mcv.unladen,
  };
  steps.push({
    id: 'vdf',
    title: 'Vehicle damage factor',
    formula: indicative
      ? 'VDF = p x laden + (1 − p) x unladen'
      : surveyed.hcv && surveyed.mcv
        ? 'From the axle load survey'
        : 'From the axle load survey; otherwise p x laden + (1 − p) x unladen',
    substitution: indicative
      ? `p = ${p}; HCV ${p} x ${SP72.vdf.hcv.laden} + ${(1 - p).toFixed(2)} x ${SP72.vdf.hcv.unladen}; ` +
        `MCV ${p} x ${SP72.vdf.mcv.laden} + ${(1 - p).toFixed(2)} x ${SP72.vdf.mcv.unladen}`
      : `HCV ${+vdf.hcv.toFixed(3)}, MCV ${+vdf.mcv.toFixed(3)}`,
    result: `HCV ${vdf.hcv.toFixed(3)} · MCV ${vdf.mcv.toFixed(3)}`,
    ref: SP72.vdf.ref,
  });

  const [hcv, mcv] = classes;
  const T0 = hcv.opening * vdf.hcv + mcv.opening * vdf.mcv;
  steps.push({
    id: 'esal-day',
    title: 'Standard axles per day',
    formula: 'T0 = Σ CVPD x VDF',
    substitution: `${inr(hcv.opening, 1)} x ${vdf.hcv.toFixed(3)} + ${inr(mcv.opening, 1)} x ${vdf.mcv.toFixed(3)}`,
    result: `T0 = ${T0.toFixed(2)} ESAL per day`,
    ref: SP72.vdf.ref,
  });

  const F = growthFactor(growth, years);
  const N = T0 * 365 * F * L;
  steps.push({
    id: 'esal',
    title: 'Cumulative ESAL over the design life',
    formula: 'N = T0 x 365 x [(1 + r)^n − 1] / r x L',
    substitution: `N = ${T0.toFixed(2)} x 365 x ${F.toFixed(3)} x ${L}`,
    result: `N = ${inr(N)} ESAL`,
    ref: SP72.cumulative.ref,
  });

  return {
    mode: 'counts',
    esal: N,
    esalPerDay: T0,
    laneFactor: L,
    vdf,
    cvpdAtOpening: hcv.opening + mcv.opening,
    classes,
    steps,
    warnings,
  };
}

/** Traffic category T1 – T9, and whether the traffic is within the code's range. */
export function categorise(esal) {
  const list = SP72.categories.list;
  const found = list.find((c, i) => (i === 0 ? esal >= c.min : esal > c.min) && esal <= c.max);
  if (found) return { category: found, withinScope: true };
  if (esal < list[0].min) {
    return { category: list[0], withinScope: false, below: true, message: `Under ${inr(list[0].min)} ESAL: designed as ${list[0].id}` };
  }
  return { category: list.at(-1), withinScope: false, above: true, message: `Over ${inr(list.at(-1).max)} ESAL: IRC:37 applies · Cl. 8 (ix)` };
}

/** Subgrade class S1 – S5 from CBR. */
export function subgradeClass(cbr) {
  const list = SP72.subgradeClasses.list;
  const c = Math.floor(cbr);
  return list.find((s) => c >= s.min && c <= s.max) || (c > 15 ? list.at(-1) : list[0]);
}

/** Soaked CBR estimated from classification tests, Appendix B. */
export function quickCBR({ plastic, passing75Percent, plasticityIndex, d60Mm }) {
  const q = SP72.quickCBR;
  if (plastic) {
    const wpi = (passing75Percent / 100) * plasticityIndex;
    return { value: q.plastic.numerator / (1 + q.plastic.wpiFactor * wpi), wpi };
  }
  return { value: q.nonPlastic.coefficient * Math.pow(d60Mm, q.nonPlastic.exponent) };
}

/** Table 4: sub-base for the part of a gravel base above the 100 mm kept. */
export function gravelToSubBase(designBaseMm, subBaseCBR) {
  const t = SP72.baseToSubBase;
  const row = t.designBaseMm.indexOf(designBaseMm);
  const col = t.subBaseCBR.indexOf(subBaseCBR);
  if (row === -1 || col === -1) return null;
  return { baseMm: t.keptBaseMm, subBaseMm: t.subBaseMm[row][col] };
}

const layerSum = (layers, kinds) => layers.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + (l.mm || 0), 0);
const BASE_KINDS = ['wbm3', 'base', 'gravel', 'bm', 'crackRelief', 'ctb'];
const SUB_BASE_KINDS = ['gsb', 'ctsb', 'improved'];

function describe(layers) {
  return layers
    .filter((l) => !['bt', 'surfaceGravel'].includes(l.kind))
    .map((l) => `${SP72_LAYERS[l.kind].short} ${l.mm}`)
    .join(' + ');
}

/**
 * The composition.
 * @param {object} d
 * @param {number} d.esal
 * @param {number} d.subgradeCBR
 * @param {'granular'|'cemented'} d.baseType
 * @param {'over1500'|'1000to1500'|'under1000'} d.rainfall
 * @param {boolean} d.frost
 * @param {'auto'|'sd'|'pc'} d.surfacing
 * @param {number} d.surfaceGravelMm
 * @param {number|null} d.gravelSubBaseCBR  Table 4 conversion, or null to keep the full gravel base.
 * @param {boolean} d.gravelCBR80Available
 * @param {boolean} d.newRoad
 * @param {number|null} d.existingMm  Existing pavement, for an overlay.
 */
export function designSP72(d) {
  const steps = [];
  const warnings = [];
  const { category, withinScope, message, above } = categorise(d.esal);
  const tIndex = categoryIndex(category.id);
  const sClass = subgradeClass(d.subgradeCBR);

  steps.push({
    id: 'category',
    title: 'Traffic category',
    formula: 'Cumulative ESAL placed in T1 – T9',
    substitution: `N = ${inr(d.esal)} ESAL`,
    result: `${category.id} (${inr(category.min)} – ${inr(category.max)})`,
    ref: SP72.categories.ref,
    warning: withinScope ? null : message,
  });
  steps.push({
    id: 'subgrade-class',
    title: 'Subgrade strength class',
    formula: 'Soaked CBR placed in S1 – S5',
    substitution: `CBR = ${d.subgradeCBR}%`,
    result: `${sClass.id}, ${sClass.label.toLowerCase()} (CBR ${sClass.min === 0 ? '2 or less' : `${sClass.min} – ${sClass.max}`})`,
    ref: SP72.subgradeClasses.ref,
  });

  const minCBR = SP72.subgradeClasses.minimumNewRoadCBR;
  if (d.newRoad && d.subgradeCBR < minCBR) {
    warnings.push(`New road: improve the subgrade to a design CBR of at least ${minCBR}% · ${SP72.subgradeClasses.ref.clause}`);
  }
  if (d.subgradeCBR <= 2) {
    warnings.push(`CBR 2 or less: compare replacing ${SP72.subgradeClasses.replacementMm} mm of subgrade with stabilisation · ${SP72.subgradeClasses.ref.clause}`);
  }
  if (d.subgradeCBR > 15) warnings.push('CBR above 15%: designed as S5, the highest class');
  if (above) warnings.push(message);

  const cemented = d.baseType === 'cemented';
  const figure = cemented ? FIG6 : FIG4;
  const figRef = cemented ? SP72.catalogueCemented.ref : SP72.catalogueGranular.ref;
  let cell = figure[sClass.id][tIndex].map(([kind, mm]) => ({ kind, mm: mm ?? 0 }));

  steps.push({
    id: 'catalogue',
    title: 'Composition from the design catalogue',
    formula: `${cemented ? 'Fig. 6, cement treated' : 'Fig. 4, gravel and granular'}: ${category.id} x ${sClass.id}`,
    substitution: `${category.id}, ${sClass.id}`,
    result: describe(cell) + ' mm' + (cell[0].kind === 'bt' ? ', black-topped' : ', gravel road'),
    ref: figRef,
  });

  let blackTopped = cell[0].kind === 'bt';

  // Frost: gravel roads take the frost table; a null there needs a black top.
  if (d.frost && !blackTopped && !cemented) {
    const frostMm = SP72.frostGravel[sClass.id][tIndex];
    if (frostMm == null) {
      const next = FIG4[sClass.id].findIndex((c, i) => i >= tIndex && c[0][0] === 'bt');
      cell = FIG4[sClass.id][next].map(([kind, mm]) => ({ kind, mm: mm ?? 0 }));
      blackTopped = true;
      steps.push({
        id: 'frost-gravel',
        title: 'Frost: a black-topped pavement',
        formula: 'No gravel road is given for this class and category in frost',
        substitution: `${sClass.id}, ${category.id}`,
        result: `Section of ${CATEGORY_IDS[next]}: ${describe(cell)} mm`,
        ref: SP72.frostGravel.ref,
      });
    } else {
      const gravel = cell.find((l) => l.kind === 'gravel');
      steps.push({
        id: 'frost-gravel',
        title: 'Frost: gravel base',
        formula: 'Gravel base increased for frost',
        substitution: `${gravel.mm} mm`,
        result: `${frostMm} mm`,
        ref: SP72.frostGravel.ref,
      });
      gravel.mm = frostMm;
    }
  }

  const gravelLimit = d.subgradeCBR > 5 ? SP72.gravelRoadLimit.aboveCBR5 : SP72.gravelRoadLimit.anyCBR;
  if (!blackTopped && d.esal > gravelLimit) {
    warnings.push(`Gravel roads serve up to ${inr(gravelLimit)} ESAL at this CBR · ${SP72.gravelRoadLimit.ref.clause}`);
  }

  // Part of a gravel base as equivalent sub-base (Table 4).
  const gravel = cell.find((l) => l.kind === 'gravel');
  let converted = false;
  if (gravel && d.gravelSubBaseCBR) {
    const swap = gravelToSubBase(gravel.mm, d.gravelSubBaseCBR);
    if (swap) {
      steps.push({
        id: 'table-4',
        title: 'Gravel base to equivalent sub-base',
        formula: `Keep ${swap.baseMm} mm gravel base; the rest as sub-base of CBR ${d.gravelSubBaseCBR}%`,
        substitution: `Design gravel base ${gravel.mm} mm`,
        result: `Gravel base ${swap.baseMm} mm + sub-base ${swap.subBaseMm} mm`,
        ref: SP72.baseToSubBase.ref,
      });
      const at = cell.indexOf(gravel);
      cell.splice(at, 1, { kind: 'gravel', mm: swap.baseMm }, { kind: 'gsb', mm: swap.subBaseMm, cbr: d.gravelSubBaseCBR });
      converted = true;
    } else {
      warnings.push(`Table 4 covers gravel bases of 150 – 275 mm; ${gravel.mm} mm is kept whole`);
    }
  }

  // Without gravel of soaked CBR 80, the 100 mm gravel base becomes WBM on more sub-base.
  const g = SP72.gravelBase;
  const keptGravel = cell.find((l) => l.kind === 'gravel');
  if (keptGravel && d.gravelCBR80Available === false) {
    if (keptGravel.mm === g.minimumMm) {
      const at = cell.indexOf(keptGravel);
      cell.splice(at, 1, { kind: 'wbm3', mm: g.wbmSubstituteMm });
      const sub = cell.find((l) => l.kind === 'gsb');
      if (sub) sub.mm += g.addToSubBaseMm;
      else cell.splice(at + 1, 0, { kind: 'gsb', mm: g.addToSubBaseMm });
      steps.push({
        id: 'gravel-80',
        title: 'Gravel of soaked CBR 80 not available',
        formula: `${g.minimumMm} mm gravel base -> ${g.wbmSubstituteMm} mm WBM Gr III, ${g.addToSubBaseMm} mm added to the sub-base`,
        substitution: `${g.minimumMm} mm`,
        result: describe(cell) + ' mm',
        ref: g.ref,
      });
    } else {
      warnings.push(`Gravel base material of soaked CBR ${g.soakedCBR} is needed; convert to ${g.minimumMm} mm with Table 4 to use WBM instead`);
    }
  }

  // Surfacing.
  let surfacing;
  if (!blackTopped) {
    const warrant = SP72.surfacingWarrant.rainfall.find((r) => r.id === d.rainfall) || SP72.surfacingWarrant.rainfall.at(-1);
    const bt = warrant.bt.includes(category.id);
    steps.push({
      id: 'surfacing-warrant',
      title: 'Surfacing of the gravel road',
      formula: 'Bituminous surface treatment by annual rainfall and traffic category',
      substitution: `${warrant.label} a year, ${category.id}`,
      result: bt ? 'Bituminous surface treatment' : 'Gravel surface',
      ref: SP72.surfacingWarrant.ref,
    });
    if (bt) {
      cell.unshift({ kind: 'bt', mm: 0 });
      blackTopped = true;
    } else {
      const s = SP72.surfaceGravel;
      const mm = Math.min(s.maxMm, Math.max(s.minMm, d.surfaceGravelMm || s.maxMm));
      cell.unshift({ kind: 'surfaceGravel', mm });
      steps.push({
        id: 'surface-gravel',
        title: 'Surface gravel',
        formula: `${s.minMm} – ${s.maxMm} mm over the gravel base, in addition to it`,
        substitution: `${mm} mm`,
        result: `${mm} mm surface gravel`,
        ref: s.ref,
      });
    }
  }

  if (blackTopped) {
    const top = cell[0];
    const from = cemented ? FIG6_PREMIX_FROM : SP72.surfacingType.premixFrom;
    const premixAllowed = tIndex >= categoryIndex(SP72.surfacingType.premixFrom);
    const auto = tIndex >= categoryIndex(from) ? 'pc' : 'sd';
    const type = d.surfacing === 'pc' && premixAllowed ? 'pc' : d.surfacing === 'sd' ? 'sd' : auto;
    top.type = type;
    top.mm = type === 'pc' ? SP72.surfacingType.premixCarpetMm : 0;
    steps.push({
      id: 'surfacing',
      title: 'Bituminous surfacing',
      formula: 'Surface dressing up to T4; 20 mm premix carpet an alternative from T5',
      substitution: `${category.id}${cemented ? ', cement treated layers' : ''}`,
      result:
        (type === 'pc' ? `${SP72.surfacingType.premixCarpetMm} mm premix carpet` : 'Surface dressing, two coat') +
        (cemented ? ', with modified binder or cold mix' : ''),
      ref: SP72.surfacingType.ref,
    });
    if (d.surfacing === 'pc' && !premixAllowed) warnings.push(`Premix carpet is the alternative from ${SP72.surfacingType.premixFrom}; surface dressing is used`);
  }

  // Frost: black-topped sections at least 450 mm as 300 sub-base + 150 base.
  if (d.frost && blackTopped) {
    const f = SP72.frost;
    const base = layerSum(cell, BASE_KINDS);
    const sub = layerSum(cell, SUB_BASE_KINDS);
    const changes = [];
    if (base < f.baseMm) {
      const layer = [...cell].reverse().find((l) => BASE_KINDS.includes(l.kind));
      layer.mm += f.baseMm - base;
      changes.push(`base +${f.baseMm - base}`);
    }
    if (sub < f.subBaseMm) {
      let layer = cell.find((l) => l.kind === (cemented ? 'ctsb' : 'gsb'));
      if (!layer) {
        layer = { kind: cemented ? 'ctsb' : 'gsb', mm: 0 };
        cell.push(layer);
      }
      layer.mm += f.subBaseMm - sub;
      changes.push(`sub-base +${f.subBaseMm - sub}`);
    }
    steps.push({
      id: 'frost',
      title: 'Frost: minimum pavement',
      formula: `Sub-base ≥ ${f.subBaseMm} mm, base ≥ ${f.baseMm} mm, total ≥ ${f.totalMm} mm`,
      substitution: `Base ${base} mm, sub-base ${sub} mm`,
      result: changes.length ? `${changes.join(', ')} mm: ${describe(cell)} mm` : 'Met by the catalogue section',
      ref: f.ref,
    });
  }

  const structural = cell.filter((l) => !['bt', 'surfaceGravel'].includes(l.kind));
  const totalMm = structural.reduce((s, l) => s + l.mm, 0);
  steps.push({
    id: 'total',
    title: 'Pavement thickness',
    formula: 'Sum of the layers below the surfacing',
    substitution: describe(cell),
    result: `${totalMm} mm`,
    ref: figRef,
  });

  // Overlay on an existing road: the shortfall in total thickness.
  let overlay = null;
  if (d.existingMm > 0) {
    const need = Math.max(0, totalMm - d.existingMm);
    const limit = SP72.overlay.limits.find((l) => tIndex <= categoryIndex(l.upTo));
    overlay = { requiredMm: totalMm, existingMm: d.existingMm, needMm: need, limit };
    steps.push({
      id: 'overlay',
      title: 'Strengthening of the existing road',
      formula: 'Overlay = total required − existing',
      substitution: `${totalMm} − ${d.existingMm}`,
      result: need > 0 ? `${need} mm` : 'None; the existing pavement is thick enough',
      ref: SP72.overlay.ref,
      warning:
        need > 0 && limit && need > limit.mm
          ? `More than ${limit.mm} mm of added WBM in ${limit.layers} layers up to ${limit.upTo}; examine reconstruction`
          : need > 0 && !limit
            ? `No overlay limit is given beyond ${SP72.overlay.limits.at(-1).upTo}`
            : null,
    });
  }

  const slots = cell.map((l, i) => {
    if (l.kind === 'bt') {
      const pc = l.type === 'pc';
      const label = pc ? (cemented ? 'Open-graded premix carpet' : 'Premix carpet') : 'Surface dressing';
      return { slotId: `L${i}`, materialId: pc ? 'PC' : 'SD', label, thicknessMm: l.mm, behaviour: 'bituminous', note: pc ? null : 'Two coat' };
    }
    if (l.kind === 'surfaceGravel') {
      return { slotId: `L${i}`, materialId: 'Surface gravel', label: 'Surface gravel', thicknessMm: l.mm, behaviour: 'granular' };
    }
    const info = SP72_LAYERS[l.kind];
    const label = l.kind === 'gsb' && l.cbr ? `Granular sub-base (CBR ≥ ${l.cbr})` : info.label;
    return { slotId: `L${i}`, materialId: info.short, label, thicknessMm: l.mm, behaviour: info.behaviour };
  });
  slots.push({ slotId: 'SUBGRADE', materialId: null, label: 'Subgrade', thicknessMm: null, behaviour: 'subgrade' });

  return {
    code: CODES.IRCSP72.designation,
    category,
    subgradeClass: sClass,
    baseType: cemented ? 'cemented' : 'granular',
    blackTopped,
    gravelRoad: !blackTopped,
    converted,
    totalThicknessMm: totalMm,
    overlay,
    slots,
    steps,
    warnings,
    withinScope,
    /** Over 2 msa the code does not apply. */
    aboveScope: Boolean(above),
  };
}
