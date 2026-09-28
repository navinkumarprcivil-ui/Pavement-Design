/**
 * Every layered elastic analysis behind a flexible design, laid out as the
 * inputs IITPAVE takes, so each can be run there and its output entered back.
 */

import { STANDARD_AXLE, MODULI, CRITERIA } from '../data/ircConstants.js';
import { effectiveSubgrade } from '../engine/materials.js';
import { stressKey } from '../engine/ctbDamage.js';

const stackOf = (layers) =>
  layers.map((l, i) => ({ label: l.label, h: i === layers.length - 1 ? null : l.thicknessMm, E: l.E, nu: l.nu }));

/** Identifies the analysed section, so values read for another one are not reused. */
export function sectionKey(result) {
  return result.layers.map((l) => `${l.thicknessMm}:${l.E.toFixed(2)}:${l.nu}`).join('|');
}

const worstOf = (result, role, pick) =>
  result.responses.filter((r) => r.role === role).reduce((best, r) => Math.max(best, pick(r)), -Infinity);

const pointsOf = (result, role) =>
  result.responses.filter((r) => r.role === role).map((r) => ({ z: r.z, r: r.x }));

/**
 * @returns {Array<{id, title, ref, layers, wheelLoadN, tyrePressureMPa,
 *   dualSpacingMm, points, outputs?, classes?}>}
 */
export function iitpaveCases(result, state) {
  const cases = [];
  const stack = stackOf(result.layers);
  const has = (id) => result.checks.some((c) => c.id === id);
  const byId = (id) => result.checks.find((c) => c.id === id);
  const standard = {
    wheelLoadN: STANDARD_AXLE.wheelLoadN,
    tyrePressureMPa: STANDARD_AXLE.tyrePressureMPa,
    dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
  };

  const layered = state.materials.layeredSubgrade;
  if (layered?.enabled && layered.borrowCBR > 0 && layered.embankmentCBR > 0) {
    const e = effectiveSubgrade(layered);
    const spec = MODULI.effectiveSubgrade;
    cases.push({
      id: 'subgrade',
      title: 'Effective subgrade',
      ref: spec.ref,
      layers: [
        { label: 'Select borrow', h: layered.borrowMm || spec.subgradeThicknessMm, E: e.borrowMR, nu: spec.poissonRatio },
        { label: 'Embankment', h: null, E: e.embankmentMR, nu: spec.poissonRatio },
      ],
      wheelLoadN: spec.wheelLoadN,
      tyrePressureMPa: spec.tyrePressureMPa,
      dualSpacingMm: 0,
      points: [{ z: 0, r: 0 }],
      readout: { label: 'Surface deflection', unit: 'mm', value: e.deflection.toFixed(3) },
    });
  }

  const outputs = [];
  if (has('bituminous-fatigue')) {
    outputs.push({
      key: 'bituminous',
      label: 'εt, bottom of bituminous layer',
      unit: 'µε',
      app: Math.max(0, worstOf(result, 'bituminous-tension', (r) => r.maxHorizontalStrain)) * 1e6,
    });
  }
  outputs.push({
    key: 'subgrade',
    label: 'εv, top of subgrade',
    unit: 'µε',
    app: worstOf(result, 'subgrade-compression', (r) => r.verticalCompressiveStrain) * 1e6,
  });
  cases.push({
    id: 'standard',
    title: 'Standard axle',
    ref: STANDARD_AXLE.ref,
    layers: stack,
    ...standard,
    points: [...pointsOf(result, 'bituminous-tension'), ...pointsOf(result, 'subgrade-compression')],
    outputs,
  });

  if (has('cemented-fatigue')) {
    cases.push({
      id: 'ctb',
      title: 'CTB fatigue',
      ref: CRITERIA.cementedFatigue.ref,
      layers: stack,
      ...standard,
      tyrePressureMPa: STANDARD_AXLE.ctbTyrePressureMPa,
      points: pointsOf(result, 'cemented-tension'),
      outputs: [
        {
          key: 'ctb',
          label: 'εt, bottom of CTB',
          unit: 'µε',
          app: Math.max(0, worstOf(result, 'cemented-tension', (r) => r.maxHorizontalStrain)) * 1e6,
        },
      ],
    });
  }

  const damage = byId('cemented-damage');
  if (damage) {
    const ctb = result.layers.findIndex((l) => l.slotId === 'BASE');
    const depth = result.layers.slice(0, ctb + 1).reduce((sum, l) => sum + l.thicknessMm, 0);
    // One analysis per equivalent single axle load.
    const seen = new Map();
    for (const row of damage.rows) {
      const key = stressKey(row.singleKN);
      if (!seen.has(key)) seen.set(key, { key, singleKN: row.singleKN, wheelLoadN: (row.singleKN * 1000) / 4, app: row.computedMPa, axles: [] });
      seen.get(key).axles.push(`${row.axle} ${row.loadKN}`);
    }
    cases.push({
      id: 'damage',
      title: 'CTB cumulative fatigue damage',
      ref: CRITERIA.cementedDamage.ref,
      layers: stack,
      wheelLoadN: null,
      tyrePressureMPa: CRITERIA.cementedDamage.tyrePressureMPa,
      dualSpacingMm: STANDARD_AXLE.dualSpacingMm,
      points: [0, STANDARD_AXLE.dualSpacingMm / 2].map((r) => ({ z: depth, r })),
      classes: [...seen.values()].sort((a, b) => b.singleKN - a.singleKN),
    });
  }

  const gsb = byId('construction-traffic');
  if (gsb?.analysis) {
    cases.push({
      id: 'construction',
      title: 'Sub-base under construction traffic',
      ref: CRITERIA.constructionTraffic.ref,
      ...gsb.analysis,
      outputs: [{ key: 'construction', label: 'εv, top of subgrade', unit: 'µε', app: gsb.computed * 1e6 }],
    });
  }

  const ctbBuild = byId('ctb-construction');
  if (ctbBuild?.analysis) {
    cases.push({
      id: 'ctbConstruction',
      title: 'CTB under construction traffic',
      ref: CRITERIA.ctbConstruction.ref,
      ...ctbBuild.analysis,
      outputs: [{ key: 'ctbConstruction', label: 'σt, bottom of CTB', unit: 'MPa', app: ctbBuild.computed }],
    });
  }

  return cases;
}

/** An entered output in engine units: strains as fractions, stresses in MPa. */
export function engineValue(output, entered) {
  if (!(entered > 0)) return null;
  return output.unit === 'µε' ? entered * 1e-6 : entered;
}

/** A case as plain text in IITPAVE's order of entry, to copy across. */
export function caseText(c) {
  const lines = [
    `No. of layers: ${c.layers.length}`,
    `Elastic moduli (MPa): ${c.layers.map((l) => l.E.toFixed(1)).join(', ')}`,
    `Poisson's ratios: ${c.layers.map((l) => l.nu.toFixed(2)).join(', ')}`,
    `Thicknesses (mm): ${c.layers.filter((l) => l.h != null).map((l) => l.h).join(', ')}`,
    c.wheelLoadN != null ? `Wheel load (N): ${Math.round(c.wheelLoadN)}` : `Wheel loads (N): ${c.classes.map((k) => Math.round(k.wheelLoadN)).join(', ')}`,
    `Tyre pressure (MPa): ${c.tyrePressureMPa.toFixed(2)}`,
    `Analysis points: ${c.points.length}`,
    ...c.points.map((p, i) => `  ${i + 1}: z = ${p.z.toFixed(0)} mm, r = ${p.r.toFixed(0)} mm`),
    `Wheel set: ${c.dualSpacingMm > 0 ? `2 (dual, ${c.dualSpacingMm} mm c/c)` : '1 (single)'}`,
  ];
  return lines.join('\n');
}
