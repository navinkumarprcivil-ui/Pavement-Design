/**
 * IRC:SP:62-2014 — the edge stresses of the illustrative example
 * (Appendix I) and the design cases. Only the example's numbers appear here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  westergaardEdge,
  dualRadius,
  singleRadius,
  sp62Flexural,
  sp62K,
  designCase,
  bradburyC,
  designSP62,
  evaluateSP62,
} from '../src/engine/ruralRigid.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

const dual = dualRadius(50000, 0.8, 310);

test('Appendix I — M30 gives 3.834 MPa at 28 days and 4.22 MPa at 90 days', () => {
  const s = sp62Flexural({ mode: 'fck', fck: 30 });
  near(s.f28, 3.834, 0.001, '28-day');
  near(s.f90, 4.22, 0.005, '90-day');
});

test('Appendix I — k over granular and cementitious sub-bases on CBR 4', () => {
  assert.equal(sp62K({ subgradeCBR: 4, subBase: 'granular' }).k, 42);
  assert.equal(sp62K({ subgradeCBR: 4, subBase: 'cementitious' }).k, 70);
});

test('Appendix I — edge stresses of a 50 kN dual wheel', () => {
  near(westergaardEdge(50000, 150, 42, dual), 4.34, 0.005, '150 mm, k 42');
  near(westergaardEdge(50000, 150, 70, dual), 3.985, 0.005, '150 mm, k 70');
  near(westergaardEdge(50000, 160, 42, dual), 3.93, 0.005, '160 mm, k 42');
});

test('Appendix I — a tractor wheel at 0.5 MPa gives 4.37 MPa on 150 mm', () => {
  near(westergaardEdge(50000, 150, 42, singleRadius(50000, 0.5)), 4.37, 0.005, 'tractor');
});

test('design cases by traffic', () => {
  assert.equal(designCase(45), 1);
  assert.equal(designCase(140), 2);
  assert.equal(designCase(200), 3);
});

test("Bradbury's coefficient rises from 0 towards about 1.08", () => {
  near(bradburyC(0.5), 0, 0.01, 'short slab');
  near(bradburyC(8.5), 1.08, 0.01, 'long slab');
});

test('Appendix I, 45 CVPD on a granular sub-base: 150 mm fails and 160 mm passes', () => {
  const d = designSP62({
    presentCVPD: 45,
    growthPercent: 5,
    yearsToCompletion: 0,
    designYears: 20,
    subgradeCBR: 4,
    subBase: 'granular',
    strengthMode: 'fck',
    fck: 30,
    temperature: { mode: 'zone', zone: 'I' },
    jointM: 3.75,
    tractor: true,
  });
  assert.equal(d.case, 1);
  assert.equal(d.designedMm, 160);
});

test('Appendix I, 140 CVPD at 2.5 m joints: 170 mm is safe', () => {
  const e = evaluateSP62({ thicknessMm: 170, k: 42, f90: 4.2174, jointM: 2.5, temperature: { mode: 'zone', zone: 'I' }, cvpd: 140, tractor: false });
  assert.equal(e.case, 2);
  assert.ok(e.safe);
  near(e.total, 3.64, 0.06, 'total stress');
});
