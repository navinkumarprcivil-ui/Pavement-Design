/**
 * IRC:37 catalogues (Cl. 12, Figs. 12.1 - 12.48), checked against the
 * Annex-III calculations for 10% effective CBR, which set out the same
 * sections layer by layer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueSection, catalogueTrial, catalogueType } from '../src/engine/catalogue.js';
import { IRC37_CATALOGUE } from '../src/data/irc37Catalogue.js';

const COMBINATIONS = {
  granular: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'GSB', crackReliefId: 'AGG_INTERLAYER' },
  ctbAil: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
  ctbSami: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'CTSB', crackReliefId: 'SAMI' },
  rap: { bituminousId: 'BC_DBM', baseId: 'RAP', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
  gsbCtbAil: { bituminousId: 'BC_DBM', baseId: 'CTB', subBaseId: 'GSB', crackReliefId: 'AGG_INTERLAYER' },
  ctsbGranular: { bituminousId: 'BC_DBM', baseId: 'WMM', subBaseId: 'CTSB', crackReliefId: 'AGG_INTERLAYER' },
};

const at = (type, msa, cbr = 10, roadCategory = 'mdr') =>
  catalogueSection({ combination: COMBINATIONS[type], designMsa: msa, cbr, roadCategory });

const bituminous = (s) => s.layers.surface + s.layers.binder;

/** Annex-III, Tables III.1 - III.6: total bituminous and the layers below, at 5 - 50 msa. */
const ANNEX_III = {
  granular: { bit: [80, 80, 110, 125, 135, 145], base: [250, 250, 250, 250, 250, 250], sub: [150, 200, 200, 200, 200, 200] },
  ctbAil: { bit: [40, 40, 50, 100, 100, 100], base: [100, 100, 110, 100, 100, 100], sub: [200, 200, 200, 200, 200, 200] },
  ctbSami: { bit: [40, 50, 80, 100, 100, 100], base: [160, 160, 150, 130, 135, 135], sub: [200, 200, 200, 200, 200, 200] },
  rap: { bit: [40, 40, 40, 100, 100, 105], base: [100, 100, 100, 100, 100, 100], sub: [200, 200, 200, 200, 200, 200] },
  gsbCtbAil: { bit: [80, 80, 85, 100, 100, 100], base: [135, 145, 155, 150, 155, 160], sub: [200, 200, 200, 200, 200, 200] },
  ctsbGranular: { bit: [40, 40, 80, 90, 95, 110], base: [150, 150, 150, 150, 150, 150], sub: [200, 200, 200, 200, 200, 200] },
};

/** Where the code's figure and its Annex-III table differ; the figure is kept. */
const FIGURE_DIFFERS = { 'ctbSami 50 base': 140, 'gsbCtbAil 20 bit': 80 };

test('Annex-III: each composition at 10% CBR, every traffic level', () => {
  for (const [type, want] of Object.entries(ANNEX_III)) {
    IRC37_CATALOGUE.trafficMsa.forEach((msa, i) => {
      const s = at(type, msa);
      assert.ok(s.ok, `${type} ${msa}`);
      const check = (what, got, expected) => {
        const figure = FIGURE_DIFFERS[`${type} ${msa} ${what}`];
        assert.equal(got, figure ?? expected, `${type} at ${msa} msa, ${what}`);
      };
      check('bit', bituminous(s), want.bit[i]);
      check('base', s.layers.base, want.base[i]);
      check('sub', s.layers.subBase, want.sub[i]);
      if (type === 'ctbAil' || type === 'gsbCtbAil') assert.equal(s.layers.crackRelief, 100);
    });
  }
});

test('figures and pages: Fig. 12.1 on p. 36, Fig. 12.22 on p. 43, Fig. 12.48 on p. 51', () => {
  assert.equal(at('granular', 5, 5).figure, 'Fig. 12.1');
  assert.equal(at('granular', 5, 5).ref.page, 36);
  assert.equal(at('ctbSami', 5, 10).figure, 'Fig. 12.22');
  assert.equal(at('ctbSami', 5, 10).ref.page, 43);
  assert.equal(at('ctsbGranular', 5, 15).figure, 'Fig. 12.48');
  assert.equal(at('ctsbGranular', 5, 15).ref.page, 51);
  // Fig. 12.1 at 5 msa: 30 + 65 mm over 250 mm WMM and 150 mm GSB.
  assert.deepEqual(at('granular', 5, 5).layers, { surface: 30, binder: 65, crackRelief: 0, base: 250, subBase: 150 });
});

test('traffic rounds up, CBR down; outside 2 - 50 msa and under 5% CBR there is no catalogue', () => {
  const s = at('granular', 37.4, 8.9);
  assert.equal(s.trafficMsa, 40);
  assert.equal(s.cbr, 8);
  assert.equal(at('granular', 3, 20).trafficMsa, 5);
  assert.equal(at('granular', 3, 20).cbr, 15);
  assert.equal(at('granular', 50, 10).trafficMsa, 50);
  assert.equal(at('granular', 1.5).ok, false);
  assert.equal(at('granular', 51).ok, false);
  assert.equal(at('granular', 10, 4).ok, false);
  assert.equal(catalogueType({ baseId: 'RAP', subBaseId: 'GSB' }), null);
  assert.equal(catalogueType({ baseId: 'CTB', subBaseId: 'GSB', crackReliefId: 'SAMI' }), null);
});

test('Cl. 12.3: 80% reliability and VG30 below 20 msa, flagged on a national highway; CTB fatigue alone', () => {
  const nh = at('ctbAil', 10, 10, 'nh');
  assert.ok(nh.warnings.some((w) => w.includes('80% reliability')));
  assert.ok(nh.warnings.some((w) => w.includes('VG40')));
  assert.ok(nh.warnings.some((w) => w.includes('Eq. 3.5')));
  assert.equal(at('granular', 30, 10, 'nh').warnings.length, 0);
  assert.equal(at('granular', 10, 10, 'mdr').warnings.length, 0);
});

test('a catalogue section as a trial: one BC course where there is no binder course', () => {
  const single = catalogueTrial(at('ctbSami', 5), COMBINATIONS.ctbSami);
  assert.equal(single.combination.bituminousId, 'BC_ONLY');
  assert.deepEqual(single.thicknesses, { BC: 40, BASE: 160, SUB_BASE: 200 });
  const two = catalogueTrial(at('ctbAil', 30), { ...COMBINATIONS.ctbAil, bituminousId: 'BC_ONLY' });
  assert.equal(two.combination.bituminousId, 'BC_DBM');
  assert.deepEqual(two.thicknesses, { BC: 40, DBM: 60, CRACK_RELIEF: 100, BASE: 100, SUB_BASE: 200 });
  const bm = catalogueTrial(at('granular', 10), { ...COMBINATIONS.granular, bituminousId: 'BC_BM' });
  assert.deepEqual(bm.thicknesses, { BC: 30, BM: 50, BASE: 250, SUB_BASE: 200 });
});
