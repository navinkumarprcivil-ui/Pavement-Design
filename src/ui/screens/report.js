/**
 * The design report: a textbook-style write-up of the design on the go, with
 * every input, every calculation step and the clause each one comes from.
 *
 * It is built as plain HTML with inline-friendly markup (tables rather than
 * drawings) so the same document prints to PDF and opens in Word for editing.
 * The wording is the app's own; no code text is reproduced.
 */

import { h, card, button, msa } from '../dom.js';
import { formatCitation } from '../citations.js';
import { designTraffic } from '../project.js';
import { currentDesign } from '../currentDesign.js';
import { AXLES, SUB_BASES, SHOULDERS } from '../rigidProject.js';
import { checkSteps, damageRows, fromIitpave } from './results.js';
import { iitpaveCases } from '../iitpave.js';
import { ctbDamageInput, ctbSevenDay } from '../ctbProject.js';
import { reliabilityOf } from '../flexibleProject.js';
import { CONSTRUCTION_TYPES, FACILITY_TYPES, optionLabel } from '../modules.js';
import { CODES, RIGID, TRAFFIC, STANDARD_AXLE, MODULI, CRITERIA, roadCategory } from '../../data/ircConstants.js';
import { combinationName } from '../../data/layerCatalog.js';
import { CATALOGUE_REF } from '../../engine/ruralSP72.js';
import { costSection, formatCurrency, formatNumber } from '../../engine/costing.js';

const LAYER_COLOURS = {
  bituminous: '#3c4552',
  granular: '#c9a227',
  cemented: '#8fa3b8',
  treated: '#5b4a3a',
  concrete: '#d3d8de',
  subgrade: '#a9805a',
};

const DARK_TEXT = new Set(['granular', 'concrete', 'cemented']);

/** Disclaimer acceptance lasts for the session, not across reloads. */
let accepted = false;

/* ---------- Building blocks ---------- */

/** Collects every clause the report cites, for the references at the end. */
function citations() {
  const seen = new Map();
  return {
    cite(ref) {
      if (!ref) return null;
      const text = formatCitation(ref);
      if (!seen.has(text)) seen.set(text, ref);
      return h('span', { class: 'r-cite' }, `(${[ref.clause, ref.table, ref.equation].filter(Boolean).join(', ')})`);
    },
    list: () => [...seen.keys()].sort(),
  };
}

const para = (...children) => h('p', {}, ...children);

function table(caption, head, rows) {
  return h(
    'table',
    { class: 'r-table' },
    caption ? h('caption', {}, caption) : null,
    h('thead', {}, h('tr', {}, head.map((cell) => h('th', {}, cell)))),
    h('tbody', {}, rows.map((row) => h('tr', {}, row.map((cell) => h('td', {}, cell ?? '—')))))
  );
}

/** A "given" table: symbol, quantity, value and where the value comes from. */
function givenTable(caption, rows, cite) {
  return table(
    caption,
    ['Symbol', 'Quantity', 'Value', 'Source'],
    rows.map(([symbol, name, value, source, ref]) => [
      symbol,
      name,
      value,
      h('span', {}, h('span', { class: `r-source ${source.toLowerCase()}` }, source), ref ? [' ', cite(ref)] : null),
    ])
  );
}

/** One calculation step, set out as relation, substitution and result. */
function stepBlock(step, cite) {
  return h(
    'div',
    { class: 'r-step' },
    h('h4', {}, step.title, ' ', cite(step.ref)),
    step.formula ? h('div', { class: 'r-eq' }, step.formula) : null,
    step.substitution ? h('div', { class: 'r-eq' }, '= ', step.substitution) : null,
    step.result ? h('div', { class: 'r-eq r-result' }, '= ', step.result) : null,
    step.warning ? h('div', { class: 'r-note' }, 'Note: ', step.warning) : null
  );
}

/** The section drawn as a table of coloured bands, with where it is checked. */
function sectionFigure(slots, marks = {}) {
  const drawn = slots.filter((s) => s.behaviour === 'subgrade' || s.thicknessMm > 0);
  return h(
    'table',
    { class: 'r-figure' },
    h(
      'tbody',
      {},
      drawn.map((slot) =>
        h(
          'tr',
          {},
          h(
            'td',
            {
              class: 'r-band',
              style: {
                background: LAYER_COLOURS[slot.behaviour] || '#ccc',
                color: DARK_TEXT.has(slot.behaviour) ? '#10161d' : '#f5f8fb',
                height: slot.behaviour === 'subgrade' ? '34px' : `${Math.min(70, Math.max(26, slot.thicknessMm * 0.2))}px`,
              },
            },
            slot.behaviour === 'subgrade' ? slot.label : `${slot.label} · ${slot.thicknessMm} mm`
          ),
          h('td', { class: 'r-mark' }, marks[slot.slotId] || marks[slot.behaviour] || '')
        )
      )
    )
  );
}

function referencesSection(number, refs) {
  const list = refs.list();
  return [
    h('h2', {}, `${number}. References`),
    h('ol', { class: 'r-refs' }, list.map((text) => h('li', {}, text))),
  ];
}

function costSectionBlock(number, slots, app) {
  const layers = slots.filter((s) => s.thicknessMm > 0);
  const cost = costSection(layers, app.state.rates, app.state.geometry);
  if (!(cost.total > 0)) return null;
  return [
    h('h2', {}, `${number}. Cost estimate`),
    table(
      null,
      ['Layer', 'Thickness, mm', 'Volume, m³', 'Rate, ₹/m³', 'Amount'],
      cost.lines.map((line) => [
        line.materialId,
        String(line.thicknessMm),
        formatNumber(line.volumeCum, 1),
        line.rateMissing ? 'no rate' : formatCurrency(line.rate),
        formatCurrency(line.amount),
      ])
    ),
    para(
      `Carriageway ${formatNumber(app.state.geometry.carriagewayWidthM, 2)} m wide over ${formatNumber(app.state.geometry.lengthKm, 2)} km: `,
      h('strong', {}, formatCurrency(cost.total)),
      ` in all, ${formatCurrency(cost.costPerKm)} per km.`
    ),
  ];
}

function header(app, codeId, kind) {
  const p = app.state.project;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    h('h1', {}, 'Pavement Design Report'),
    h(
      'table',
      { class: 'r-meta' },
      h(
        'tbody',
        {},
        [
          ['Project', p.name],
          ['Location', p.location],
          ['Client', p.client],
          ['Designer', p.designer],
          ['Construction', optionLabel(CONSTRUCTION_TYPES, p.constructionType)],
          ['Facility', optionLabel(FACILITY_TYPES, p.facility)],
          ['Pavement', `${kind} to ${CODES[codeId].designation}`],
          ['Date', today],
        ].map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v || '—')))
      )
    ),
  ];
}

function introduction(codeId, kind, method, particulars) {
  const code = CODES[codeId];
  return [
    h('h2', {}, '1. Introduction'),
    h('h3', {}, '1.1 General'),
    para(
      `This report sets out the structural design of a ${kind.toLowerCase()} to ${code.designation}, `,
      h('em', {}, code.title),
      ` (${code.publisher}, ${code.edition}). ${method}`
    ),
    h('h3', {}, '1.2 Project particulars'),
    table(null, ['Particular', 'Value'], particulars),
  ];
}

function closing() {
  return [
    h(
      'p',
      { class: 'r-disclaimer' },
      'This report was prepared with software as an aid to design. The designer is responsible for checking every ' +
        'input, calculation and result against the codes cited, and for having the design reviewed by a qualified ' +
        'pavement engineer before it is used.'
    ),
    h('p', { class: 'r-credit' }, 'Prepared with IRC Pavement Design · created by Navin Kumar P R, IIT Madras'),
  ];
}

/* ---------- Flexible, IRC:37 ---------- */

function trafficGiven(app, traffic, cite) {
  const t = app.state.traffic;
  const surveyed = t.vdfMode === 'survey' && t.vehicleDamageFactor > 0;
  return givenTable(
    'Design traffic inputs',
    [
      ['P', 'Commercial vehicles per day, both ways', `${t.presentCVPD} CVPD`, 'Input'],
      ['r', 'Annual growth rate', `${traffic.growthRatePercent}%`, (t.growthRatePercent ?? 0) < TRAFFIC.minimumGrowthRate.percent ? 'Code' : 'Input', TRAFFIC.minimumGrowthRate.ref],
      ['x', 'Years from count to completion', `${t.yearsToCompletion} years`, 'Input'],
      ['n', 'Design period', `${t.designLifeYears} years`, 'Input', TRAFFIC.longLife.ref],
      ['D', `Lane distribution factor, ${traffic.lane.label.toLowerCase()}`, String(traffic.lane.value), 'Code', TRAFFIC.laneDistributionFactors.ref],
      traffic.lane.directional ? ['', 'Share in the design direction', `${t.directionalSplitPercent}%`, 'Input'] : null,
      ['F', 'Vehicle damage factor', traffic.vdf.toFixed(2), surveyed ? 'Input' : 'Code', surveyed ? null : TRAFFIC.indicativeVDF.ref],
    ].filter(Boolean),
    cite
  );
}

/** Every analysis behind the design, as the inputs IITPAVE takes. */
function iitpaveAppendix(app) {
  const result = app.state.result;
  const cases = iitpaveCases(result, app.state);
  return [
    h('h2', {}, 'Appendix A. IITPAVE inputs'),
    cases.map((c, i) => [
      h('h3', {}, `A.${i + 1} ${c.title}`),
      table(
        null,
        ['Layer', 'E, MPa', 'μ', 'h, mm'],
        c.layers.map((l) => [l.label, l.E.toFixed(1), l.nu.toFixed(2), l.h == null ? '∞' : String(l.h)])
      ),
      table(
        null,
        ['Input', 'Value'],
        [
          ['No. of layers', String(c.layers.length)],
          c.wheelLoadN != null
            ? ['Wheel load', `${Math.round(c.wheelLoadN)} N`]
            : ['Wheel loads', c.classes.map((k) => `${Math.round(k.wheelLoadN)} N`).join(', ')],
          ['Tyre pressure', `${c.tyrePressureMPa.toFixed(2)} MPa`],
          ['Wheel set', c.dualSpacingMm > 0 ? `Dual, ${c.dualSpacingMm} mm c/c` : 'Single'],
          ['Analysis points (z, r), mm', c.points.map((p) => `(${p.z.toFixed(0)}, ${p.r.toFixed(0)})`).join(', ')],
        ]
      ),
    ]),
  ];
}

/** The allowable value of a check, in its own terms. */
function allowableCell(c) {
  if (c.kind === 'damage') return `CFD ${c.allowableDamage.toFixed(2)}`;
  if (c.kind === 'stress') return `${c.allowableStress.toFixed(3)} MPa`;
  return c.allowableMicro != null ? `${c.allowableMicro.toFixed(1)} µε` : '—';
}

function computedCell(c) {
  if (c.kind === 'damage') return `CFD ${c.damage.toFixed(3)}`;
  if (c.kind === 'stress') return `${c.stress.toFixed(3)} MPa`;
  return c.strainMicro != null ? `${c.strainMicro.toFixed(1)} µε` : '—';
}

/** Dumper loads and trips behind the construction traffic checks. */
function constructionGiven(app, result, cite) {
  const onSubBase = result.checks.some((c) => c.id === 'construction-traffic' && c.preSteps?.length);
  const onCtb = result.checks.some((c) => c.id === 'ctb-construction');
  if (!onSubBase && !onCtb) return null;
  const c = app.state.construction;
  const vdfRef = CRITERIA.constructionTraffic.vdf.ref;
  const seven = onCtb ? ctbSevenDay(app.state) : null;
  return givenTable(
    'Construction traffic inputs',
    [
      ['Pt', 'Dumper rear tandem axle', `${c.rearTandemKN} kN`, 'Input', vdfRef],
      ['Pf', 'Dumper front axle', `${c.frontKN} kN`, 'Input', vdfRef],
      onSubBase ? ['', 'Dumper trips on the sub-base', String(c.subBaseTrips), 'Input', CRITERIA.constructionTraffic.ref] : null,
      onCtb ? ['', 'Dumper trips on the CTB', String(c.ctbTrips), 'Input', CRITERIA.ctbConstruction.ref] : null,
      onCtb
        ? [
            'MR(7)',
            'CTB 7-day flexural strength',
            `${seven.value.toFixed(2)} MPa`,
            seven.entered ? 'Input' : 'Derived',
            CRITERIA.ctbConstruction.ref,
          ]
        : null,
    ].filter(Boolean),
    cite
  );
}

/** The CTB's cumulative fatigue damage: axle loads, working and one table per axle type. */
function ctbDamageSection(app, damage, ctb, cite) {
  const state = app.state.ctb;
  return [
    h('h3', {}, '3.5 Cumulative fatigue damage of the CTB'),
    para(
      'Every axle load class expected over the design period uses up part of the fatigue life of the cement treated ' +
        'base. Tandem and tridem axles are taken as two and three single axles sharing the load. The tensile stress at ' +
        `the underside of the CTB is computed for each class on dual wheels at ${CRITERIA.cementedDamage.tyrePressureMPa.toFixed(2)} MPa ` +
        'contact pressure, and the damage of all classes is summed. ',
      cite(damage.ref)
    ),
    givenTable(
      'Axle load inputs',
      [
        ...AXLES.map((a) => ['', `${a.label} axles, share of all axles`, `${state.axleMix[a.id] || 0}%`, 'Input']),
        ['', 'Axles per commercial vehicle', String(state.axlesPerVehicle), 'Input'],
      ],
      cite
    ),
    ctb.steps.map((step) => stepBlock(step, cite)),
    AXLES.map((a) => {
      const rows = damageRows(damage, a.id);
      if (!rows.length) return null;
      return [
        table(
          `${a.label} axles`,
          ['Load, kN', 'ni, as single axles', 'σt, MPa', 'σt / MRup', 'Nfi', 'ni / Nfi'],
          rows
        ),
        para(`Damage from ${a.label.toLowerCase()} axles: ${damage.byAxle[a.id].toFixed(3)}.`),
      ];
    }),
    para(
      h('strong', {}, `CFD = ${damage.damage.toFixed(3)}`),
      damage.safe
        ? `, within the limit of ${damage.allowableDamage}.`
        : `, over the limit of ${damage.allowableDamage}: the CTB would crack before the end of the design period.`
    ),
  ];
}

function flexibleReport(app, cite) {
  const result = app.state.result;
  const traffic = designTraffic(app.state);
  const { project, materials, mix, traffic: t, combination } = app.state;
  const category = roadCategory(project.roadCategory);

  const marks = {
    bituminous: '',
    subgrade: '◂ εv, top of subgrade',
  };
  const bituminousSlots = result.slots.filter((s) => s.behaviour === 'bituminous' && s.thicknessMm > 0);
  if (bituminousSlots.length) marks[bituminousSlots[bituminousSlots.length - 1].slotId] = '◂ εt, bottom of bituminous layer';
  if (result.slots.some((s) => s.slotId === 'BASE' && s.behaviour === 'cemented')) marks.BASE = '◂ εt, bottom of CTB';

  const damage = result.checks.find((c) => c.kind === 'damage');
  const layered = materials.layeredSubgrade?.enabled ? materials.layeredSubgrade : null;
  const narratives = app.state.narratives || {};
  const narrative = (key) => (narratives[key]?.trim() ? narratives[key].trim().split(/\n{2,}/).map((text) => para(text)) : null);
  const ctb = damage ? ctbDamageInput(app.state, traffic) : null;
  const rupture = CRITERIA.ctbRupture;
  const verdictNumber = damage ? '3.6' : '3.5';

  return [
    header(app, 'IRC37', 'Flexible pavement'),
    introduction(
      'IRC37',
      'Flexible pavement',
      'Strains in the layer system are computed by multi-layer linear elastic analysis under the standard axle and ' +
        'checked against the performance criteria of the code at the design reliability.',
      [
        ['Road category', category?.label],
        ['Terrain', project.terrain[0].toUpperCase() + project.terrain.slice(1)],
        ['Carriageway', traffic.lane.label],
        ['Design period', `${t.designLifeYears} years`],
        ['Composition', combinationName(combination)],
      ]
    ),

    h('h2', {}, '2. Materials'),
    givenTable(
      'Material inputs',
      [
        ...(layered
          ? [
              ['CBR', 'Select borrow CBR', `${layered.borrowCBR}%`, 'Input', MODULI.effectiveSubgrade.ref],
              ['', 'Select borrow thickness', `${layered.borrowMm} mm`, 'Input', MODULI.effectiveSubgrade.ref],
              ['CBR', 'Embankment CBR', `${layered.embankmentCBR}%`, 'Input', MODULI.effectiveSubgrade.ref],
              ['CBR', 'Effective subgrade CBR', `${Number(materials.subgradeCBR).toFixed(1)}%`, 'Derived', MODULI.effectiveSubgrade.ref],
            ]
          : [['CBR', 'Effective subgrade CBR', `${materials.subgradeCBR}%`, 'Input', MODULI.subgrade.ref]]),
        ['', 'Binder of the bottom bituminous layer', materials.binderGrade, 'Input', MODULI.bituminous.ref],
        ['T', 'Average annual pavement temperature', `${materials.pavementTemperatureC} °C`, 'Input', MODULI.bituminous.ref],
        materials.bituminousModulusMPa > 0
          ? ['MRm', 'Bituminous mix modulus, from the mix design', `${materials.bituminousModulusMPa} MPa`, 'Input', MODULI.bituminous.ref]
          : null,
        ['Va', 'Air voids, bottom bituminous layer', `${mix.airVoidsPercent}%`, 'Input', CRITERIA.bituminousFatigue.ref],
        ['Vbe', 'Effective binder, bottom bituminous layer', `${mix.effectiveBinderPercent}%`, 'Input', CRITERIA.bituminousFatigue.ref],
        ['R', 'Reliability', `${result.reliability}%`, reliabilityOf(app.state).chosen ? 'Input' : 'Code', CRITERIA.reliability?.ref],
        ...(ctb
          ? [
              ['', 'Cement treated base material', ctb.rupture.material.label, 'Input', rupture.ref],
              ['UCS', '28-day UCS of the CTB', `${app.state.ctb.ucsMPa} MPa`, 'Input', rupture.ref],
              ['MRup', 'Modulus of rupture of the CTB', `${ctb.rupture.value.toFixed(2)} MPa`, 'Derived', rupture.ref],
            ]
          : []),
      ].filter(Boolean),
      cite
    ),
    narrative('subgrade'),
    narrative('mix'),
    narrative('materials'),

    h('h2', {}, '3. Design'),
    h('h3', {}, '3.1 Design traffic'),
    narrative('traffic'),
    trafficGiven(app, traffic, cite),
    traffic.result.steps.map((step) => stepBlock(step, cite)),

    h('h3', {}, '3.2 Layer moduli'),
    result.modulusSteps.map((step) => stepBlock(step, cite)),
    table(
      'Layer system analysed',
      ['#', 'Layer', 'h, mm', 'E, MPa', 'μ'],
      result.layers.map((l, i) => [
        String(i + 1),
        l.label,
        l.behaviour === 'subgrade' ? '∞' : String(l.thicknessMm),
        l.E.toFixed(0),
        l.nu.toFixed(2),
      ])
    ),

    h('h3', {}, '3.3 Layer analysis'),
    para(
      `The section is analysed under the standard ${STANDARD_AXLE.axleLoadKN} kN axle: dual wheels of ` +
        `${STANDARD_AXLE.wheelLoadN / 1000} kN each at ${STANDARD_AXLE.tyrePressureMPa} MPa contact pressure, ` +
        `${STANDARD_AXLE.dualSpacingMm} mm apart centre to centre. `,
      cite(STANDARD_AXLE.ref)
    ),
    sectionFigure(result.slots, marks),
    table(
      'Computed strains',
      ['Depth, mm', 'Position', 'Horizontal, µε', 'Vertical, µε'],
      result.responses.map((r) => [
        r.z.toFixed(0),
        `${r.label}${r.pressureMPa !== STANDARD_AXLE.tyrePressureMPa ? `, ${r.pressureMPa} MPa` : ''}`,
        (r.maxHorizontalStrain * 1e6).toFixed(1),
        (-r.epsZZ * 1e6).toFixed(1),
      ])
    ),

    h('h3', {}, '3.4 Performance criteria'),
    constructionGiven(app, result, cite),
    result.checks.flatMap(checkSteps).map((step) => stepBlock(step, cite)),

    damage ? ctbDamageSection(app, damage, ctb, cite) : null,

    h('h3', {}, `${verdictNumber} Verdict`),
    table(
      'Allowable against computed values',
      ['Check', 'Allowable', 'Computed', 'Life', 'Verdict'],
      result.checks.map((c) => [
        c.title,
        allowableCell(c),
        fromIitpave(c) ? [computedCell(c), ' (IITPAVE)'] : computedCell(c),
        msa(c.allowableMsa),
        h('strong', { class: c.safe ? 'r-pass' : 'r-fail' }, c.safe ? 'Pass' : 'Fail'),
      ])
    ),
    para(
      h('strong', {}, result.safe ? 'The section is safe' : 'The section is not safe'),
      ` for ${msa(result.designTrafficMsa)}: its governing life is ${msa(result.governingLifeMsa)}.`
    ),
    [...result.thicknessWarnings, ...result.notChecked.map((n) => `${n.title} not checked · ${formatCitation(n.ref)}`)].map((w) =>
      h('p', { class: 'r-note' }, 'Note: ', w)
    ),

    h('h2', {}, '4. Recommended pavement composition'),
    table(
      null,
      ['#', 'Layer', 'Thickness'],
      [
        ...result.slots.filter((s) => s.thicknessMm > 0).map((s, i) => [String(i + 1), s.label, `${s.thicknessMm} mm`]),
        ['', `Subgrade, effective CBR not less than ${materials.subgradeCBR}%`, '—'],
      ]
    ),
    para(`Total thickness ${result.totalThicknessMm} mm, of which ${result.bituminousMm} mm bituminous.`),
  ];
}

/* ---------- Rigid, IRC:58 ---------- */

function rigidReport(app, cite) {
  const result = app.state.rigidResult;
  const rigid = app.state.rigid;
  const { traffic: t, foundation: f, slab, temperature } = rigid;
  const e = result.evaluation;
  const subBase = SUB_BASES.find((o) => o.value === f.subBase);
  const zone = RIGID.temperature.zones.find((z) => z.id === temperature.zone);
  const shoulder = SHOULDERS.find((o) => o.value === slab.shoulder)?.label;
  const count = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '∞');

  const classRows = (category) =>
    category.rows
      .filter((r) => r.expected > 0)
      .map((r) => [String(r.loadKN), count(r.expected), r.stress.toFixed(3), r.stressRatio.toFixed(3), count(r.allowable), r.damage.toFixed(3)]);
  const damageTable = (caption, category) =>
    category.rows.some((r) => r.expected > 0)
      ? table(caption, ['Load, kN', 'Expected', 'Stress, MPa', 'SR', 'Allowable', 'Damage'], classRows(category))
      : null;

  return [
    header(app, 'IRC58', 'Rigid pavement'),
    introduction(
      'IRC58',
      'Rigid pavement',
      'The slab is checked for cumulative fatigue damage from bottom-up and top-down cracking under the axle load ' +
        'spectrum, with the flexural stresses from the relations of Appendix-V.',
      [
        ['Carriageway', t.carriageway === 'divided' ? 'Divided multi-lane' : 'Two-lane two-way'],
        ['Design period', `${t.designPeriodYears} years`],
        ['Shoulder', shoulder],
        ['Transverse joints', slab.doweled ? 'Doweled' : 'Not doweled'],
        ['Temperature', temperature.mode === 'zone' ? `Zone ${zone?.label}` : `Site, ${temperature.dayC} °C day-time differential`],
      ]
    ),

    h('h2', {}, '2. Materials'),
    givenTable(
      'Concrete and foundation',
      [
        ['fcr', 'Flexural strength at 28 days', `${slab.flexural28MPa} MPa`, 'Input', RIGID.concrete.ref],
        ['', 'Design strength', slab.ninetyDay ? `90 day, × ${RIGID.concrete.ninetyDayFactor}` : '28 day', 'Code', RIGID.concrete.ref],
        ['E', 'Elastic modulus of concrete', `${slab.E} MPa`, 'Code', RIGID.concrete.ref],
        ['μ', "Poisson's ratio", String(slab.mu), 'Code', RIGID.concrete.ref],
        f.kSource === 'measured'
          ? ['k', 'Effective k from plate load test', `${f.measuredK} MPa/m`, 'Input']
          : ['CBR', 'Effective subgrade CBR', `${f.subgradeCBR}%`, 'Input', RIGID.subgradeK.ref],
        ['', `Sub-base, ${subBase?.name}`, `${f.subBaseMm} mm`, 'Input', f.subBase === 'dlc' ? RIGID.dlcK.ref : RIGID.subBaseK.ref],
        f.subBase !== 'granular' && f.gsbMm > 0 ? ['', 'Granular sub-base below', `${f.gsbMm} mm`, 'Input'] : null,
        ['k', 'Effective modulus of subgrade reaction', `${e.kMPaPerM.toFixed(1)} MPa/m`, 'Derived'],
      ].filter(Boolean),
      cite
    ),

    h('h2', {}, '3. Design'),
    h('h3', {}, '3.1 Design traffic'),
    givenTable(
      'Design traffic inputs',
      [
        ['A', 'Commercial vehicles per day, both ways', `${t.twoWayCVPD} CVPD`, 'Input', RIGID.traffic.ref],
        ['r', 'Annual growth rate', `${Math.max(t.growthRatePercent, RIGID.traffic.minimumGrowthRatePercent)}%`, 'Input', RIGID.traffic.ref],
        ['', 'Years to completion', `${t.yearsToCompletion} years`, 'Input'],
        ['n', 'Design period', `${t.designPeriodYears} years`, 'Input'],
        t.carriageway === 'divided' ? ['', 'Share in the predominant direction', `${t.directionalSplitPercent}%`, 'Input'] : null,
        ['', 'Share in the design lane', `${RIGID.traffic.laneShare * 100}%`, 'Code', RIGID.traffic.ref],
        ['', 'Commercial vehicles at night', `${t.nightSharePercent}%`, 'Input', RIGID.traffic.ref],
        ['', 'Wheel base shorter than the joint spacing', `${t.shortWheelBasePercent}%`, 'Input', RIGID.traffic.ref],
        ['', 'Axles per commercial vehicle', String(t.axlesPerVehicle), 'Input'],
        ...AXLES.map((a) => ['', `${a.label} axles, share of all axles`, `${t.axleMix[a.id]}%`, 'Input']),
      ].filter(Boolean),
      cite
    ),

    h('h3', {}, '3.2 Axle load spectrum'),
    AXLES.map((a) => {
      const rows = rigid.spectrum[a.id].filter((r) => r.percent > 0);
      return rows.length ? table(`${a.label} axles`, ['Load, kN', 'Share, %'], rows.map((r) => [String(r.loadKN), String(r.percent)])) : null;
    }),

    h('h3', {}, '3.3 Calculation'),
    result.steps.map((step) => stepBlock(step, cite)),

    h('h3', {}, '3.4 Fatigue damage by load class'),
    sectionFigure(result.slots, { PQC: '◂ flexural stress, bottom-up and top-down' }),
    damageTable('Bottom-up cracking, single axles', e.bottomUp.single),
    damageTable('Bottom-up cracking, tandem axles', e.bottomUp.tandem),
    damageTable('Top-down cracking, single axles', e.topDown.single),
    damageTable('Top-down cracking, tandem axles', e.topDown.tandem),
    damageTable('Top-down cracking, tridem axles', e.topDown.tridem),

    h('h3', {}, '3.5 Verdict'),
    table(
      'Cumulative fatigue damage',
      ['Check', 'CFD', 'Limit', 'Verdict'],
      [
        ['Bottom-up cracking', e.cfdBottomUp, RIGID.criterion.maximumCFD],
        ['Top-down cracking', e.cfdTopDown, RIGID.criterion.maximumCFD],
        ['Total', e.cfd, RIGID.criterion.maximumCFD],
      ].map(([name, cfd, limit]) => [
        name,
        cfd.toFixed(3),
        limit.toFixed(2),
        h('strong', { class: cfd <= limit ? 'r-pass' : 'r-fail' }, cfd <= limit ? 'Pass' : 'Fail'),
      ])
    ),
    para(
      h('strong', {}, result.safe ? 'The slab is safe' : 'The slab is not safe'),
      ` at ${e.thicknessMm} mm: total damage ${e.cfd.toFixed(3)} against ${RIGID.criterion.maximumCFD}. `,
      cite(RIGID.criterion.ref)
    ),
    result.warnings.map((w) => h('p', { class: 'r-note' }, 'Note: ', w)),

    h('h2', {}, '4. Recommended pavement composition'),
    table(
      null,
      ['#', 'Layer', 'Thickness'],
      [
        ...result.slots
          .filter((s) => s.thicknessMm > 0)
          .map((s, i) => [String(i + 1), s.slotId === 'PQC' ? 'Pavement quality concrete (PQC)' : s.label, `${s.thicknessMm} mm`]),
        ['', f.kSource === 'measured' ? 'Subgrade' : `Subgrade, effective CBR not less than ${f.subgradeCBR}%`, '—'],
      ]
    ),
    result.retextureMm > 0 && result.mode === 'design'
      ? para(`The slab is ${e.thicknessMm} mm for fatigue plus ${result.retextureMm} mm for retexturing. `, cite(RIGID.criterion.ref))
      : null,
    result.dowels
      ? para(
          `Dowel bars ${result.dowels.diameterMm} mm diameter, ${result.dowels.lengthMm} mm long at ${result.dowels.spacingMm} mm centres. `,
          cite(RIGID.dowels.ref)
        )
      : null,
  ];
}

/* ---------- Low volume road, IRC:SP:72 ---------- */

function ruralReport(app, cite) {
  const result = app.state.ruralResult;
  const traffic = designTraffic(app.state);
  const { design } = result;
  const { project, traffic: t } = app.state;
  const category = roadCategory(project.roadCategory);

  return [
    header(app, 'IRCSP72', 'Low volume road'),
    introduction(
      'IRCSP72',
      'Low volume road',
      'The design traffic places the road in a traffic category, the subgrade CBR in a strength band, and the ' +
        'pavement composition is read from the design catalogue for that pair.',
      [
        ['Road category', category?.label],
        ['Terrain', project.terrain[0].toUpperCase() + project.terrain.slice(1)],
        ['Carriageway', traffic.lane.label],
        ['Design period', `${t.designLifeYears} years`],
      ]
    ),

    h('h2', {}, '2. Materials'),
    givenTable(
      'Subgrade',
      [
        ['CBR', 'Subgrade CBR', `${result.subgradeCBR}%`, 'Input', CATALOGUE_REF],
        ['', 'Subgrade strength band', design.band.label, 'Derived', CATALOGUE_REF],
      ],
      cite
    ),

    h('h2', {}, '3. Design'),
    h('h3', {}, '3.1 Design traffic'),
    trafficGiven(app, traffic, cite),
    traffic.result.steps.map((step) => stepBlock(step, cite)),

    h('h3', {}, '3.2 Pavement composition from the catalogue'),
    design.steps.map((step) => stepBlock(step, cite)),
    sectionFigure(result.slots),

    h('h2', {}, '4. Recommended pavement composition'),
    table(
      null,
      ['#', 'Layer', 'Thickness'],
      [
        ...result.slots.filter((s) => s.thicknessMm > 0).map((s, i) => [String(i + 1), s.label, `${s.thicknessMm} mm`]),
        ['', `Subgrade, CBR not less than ${result.subgradeCBR}%`, '—'],
      ]
    ),
    para(`Total thickness ${design.totalThicknessMm} mm for ${msa(result.designTrafficMsa)}, category ${design.category.label}.`),
  ];
}

const BUILDERS = { flexible: flexibleReport, rigid: rigidReport, rural: ruralReport };

/** The report as one element, or null when there is no design to report. */
export function buildReport(app) {
  const design = currentDesign(app);
  if (!design) return null;
  const refs = citations();
  const body = BUILDERS[design.type](app, refs.cite);
  const cost = costSectionBlock(5, design.slots, app);
  const appendix = design.type === 'flexible' ? iitpaveAppendix(app) : null;
  return h('article', { class: 'report' }, body, cost, referencesSection(cost ? 6 : 5, refs), appendix, closing());
}

/* ---------- Export ---------- */

/** Styles carried into the Word file, which cannot read the app's stylesheet. */
const WORD_STYLES = `
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #16202c; }
h1 { font-size: 20pt; color: #1f3a5f; border-bottom: 1px solid #1f3a5f; }
h2 { font-size: 14pt; color: #1d5fa8; margin-top: 18pt; }
h3 { font-size: 12pt; color: #1d5fa8; }
h4 { font-size: 11pt; margin: 10pt 0 4pt; }
table { border-collapse: collapse; margin: 6pt 0 10pt; }
th, td { border: 1px solid #b8c2cf; padding: 3pt 6pt; font-size: 10pt; text-align: left; vertical-align: top; }
th { background: #eef1f5; }
caption { text-align: left; font-weight: bold; font-size: 10pt; padding: 4pt 0; }
.r-meta th, .r-meta td { border: none; padding: 1pt 8pt 1pt 0; background: none; }
.r-eq { font-family: Consolas, monospace; font-size: 10pt; margin: 2pt 0 2pt 12pt; }
.r-result { font-weight: bold; }
.r-cite { color: #5a6775; font-style: italic; font-size: 9pt; }
.r-note { color: #9a6207; }
.r-pass { color: #1c7a4a; } .r-fail { color: #b3261e; }
.r-figure td { border: none; padding: 3pt 8pt; }
.r-mark { color: #1d5fa8; font-size: 9pt; }
.r-disclaimer, .r-credit { font-size: 9pt; color: #5a6775; }
`;

function downloadWord(report, name) {
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
    `<head><meta charset="utf-8"><title>${name}</title><style>${WORD_STYLES}</style></head>` +
    `<body>${report.outerHTML}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `${name}.doc` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Screen ---------- */

export default function renderReport(app) {
  const report = buildReport(app);
  if (!report) {
    return h('div', { class: 'card-stack' }, h('div', { class: 'empty-state' }, h('p', {}, 'No design yet.')));
  }

  const fileName = `${(app.state.project.name || 'pavement-design').trim().replace(/[^\w-]+/g, '-')}-report`;

  const print = button('Print / PDF', () => window.print(), { kind: 'secondary', disabled: !accepted });
  const word = button('Word file', () => downloadWord(report, fileName), { disabled: !accepted });
  app.setActions(print, word);

  const checkbox = h('input', {
    type: 'checkbox',
    checked: accepted,
    onchange: (event) => {
      accepted = event.target.checked;
      print.disabled = !accepted;
      word.disabled = !accepted;
    },
  });

  return h(
    'div',
    { class: 'card-stack' },
    h('div', { class: 'report-sheet' }, report),
    card(
      'Before you download',
      h(
        'p',
        { class: 'disclaimer-text' },
        'This report is an aid to design, not a substitute for it. I will check every input, calculation and ' +
          'result against the codes cited, have the design reviewed by a qualified pavement engineer, and remain ' +
          'responsible for it. The software is provided as is, without warranty.'
      ),
      h('label', { class: 'accept' }, checkbox, h('span', {}, 'I accept'))
    )
  );
}
