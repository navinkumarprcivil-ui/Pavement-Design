/**
 * IRC:58-2015 provisions beyond the slab fatigue check: the dowel bearing
 * check of Appendix-VIII, k from a plate or an FWD, 0.7 √fck and the layout
 * warnings.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dowelBearing } from '../src/engine/rigidDetails.js';
import { defaultRigidState, runRigid, measuredFoundationK, flexuralOf } from '../src/ui/rigidProject.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

test('Appendix-VIII: 38 mm dowels at 300 mm under a 190 kN axle with tied shoulders', () => {
  const r = dowelBearing({ diameterMm: 38, spacingMm: 300, lMm: 1035.3, axleKN: 190, tiedShoulder: true, fck: 40 });
  near(r.acrossKN, 33.25, 1e-9, 'load across the joint');
  assert.equal(r.dowels, 4);
  near(r.sum, 2.26, 0.005, 'Σ');
  near(r.PtKN, 14.71, 0.01, 'Pt');
  near(r.beta, 0.021, 0.0005, 'β');
  near(r.allowable, 26.7, 0.01, 'Fb');
  // The appendix prints 20.19 MPa at the 20 mm expansion joint; the relation gives 19.6.
  near(r.joints.find((j) => j.id === 'expansion').stress, 19.6, 0.1, 'Fbmax');
  assert.equal(r.safe, true);
  const free = dowelBearing({ diameterMm: 38, spacingMm: 300, lMm: 1035.3, axleKN: 190, tiedShoulder: false, fck: 40 });
  near(free.acrossKN, 47.5, 1e-9, 'no shoulder takes a share');
});

test('Cl. 5.7.3.2 / 5.7.3.4 / 5.7.3.8: plate and FWD k', () => {
  near(measuredFoundationK({ kSource: 'measured', measuredK: 100, plateMm: 750 }).k, 100, 1e-9, '750 mm plate');
  near(measuredFoundationK({ kSource: 'measured', measuredK: 100, plateMm: 300, subBase: 'granular', subBaseMm: 0 }).k, 100 * (1.21 * 0.3 + 0.078), 1e-9, '300 mm plate');
  near(measuredFoundationK({ kSource: 'measured', measuredK: 100, plateMm: 750, soakedCBR: 5, unsoakedCBR: 10 }).k, 50, 1e-9, 'soaked');
  near(measuredFoundationK({ kSource: 'fwd', fwdDynamicK: 120 }).k, 60, 1e-9, 'FWD');
});

test('Cl. 5.8.1: M40 by 0.7 √fck is 4.43 MPa, under the 4.5 MPa minimum', () => {
  near(flexuralOf({ flexuralFrom: 'fck', fck: 40, flexural28MPa: 4.5 }), 4.43, 1e-9, 'Fcr');
  assert.equal(flexuralOf({ flexuralFrom: 'beam', fck: 40, flexural28MPa: 4.6 }), 4.6);
});

const withSpectrum = () => {
  const rigid = defaultRigidState();
  rigid.spectrum = {
    single: [{ loadKN: 190, percent: 100 }],
    tandem: [{ loadKN: 390, percent: 100 }],
    tridem: [{ loadKN: 545, percent: 100 }],
  };
  return rigid;
};

test('a rigid design checks its Table 5 dowels for bearing', () => {
  const r = runRigid(withSpectrum(), 'design');
  assert.ok(r.ok);
  assert.equal(r.dowels.axleKN, 190);
  assert.ok(r.dowels.bearing.allowable > 0);
  assert.equal(r.dowels.bearing.safe, true);
});

test('layout warnings: no shoulders, a widened lane on a divided road, a long panel', () => {
  const rigid = withSpectrum();
  rigid.slab.shoulder = 'none';
  assert.ok(runRigid(rigid, 'check').warnings.some((w) => w.includes('Cl. 6.2.5')));
  rigid.slab.shoulder = 'widened';
  rigid.traffic.carriageway = 'divided';
  assert.ok(runRigid(rigid, 'check').warnings.some((w) => w.includes('two-lane two-way')));
  rigid.slab.shoulder = 'tied';
  rigid.slab.laneWidthM = 2.5;
  assert.ok(runRigid(rigid, 'check').warnings.some((w) => w.includes('Cl. 8.2.3')));
});

test('Cl. 5.7.3.7, Eq. 3: subgrade CBR from the DCP', async () => {
  const { cbrFromDcp } = await import('../src/engine/rigidDesign.js');
  const { rigidFoundation, subgradeCbrOf } = await import('../src/ui/rigidProject.js');
  near(cbrFromDcp(10), 10 ** 1.345, 1e-9, 'N 10');
  near(cbrFromDcp(25), 7.93, 0.01, 'N 25');
  const rigid = withSpectrum();
  rigid.foundation.cbrFrom = 'dcp';
  assert.equal(runRigid(rigid, 'design').message, 'Enter the DCP penetration rate');
  rigid.foundation.dcpMmPerBlow = 25;
  near(subgradeCbrOf(rigid.foundation), cbrFromDcp(25), 1e-12, 'CBR used');
  const byTest = withSpectrum();
  byTest.foundation.subgradeCBR = cbrFromDcp(25);
  near(rigidFoundation(rigid).k, rigidFoundation(byTest).k, 1e-9, 'same k as the same CBR by test');
  const r = runRigid(rigid, 'design');
  assert.ok(r.ok);
  assert.ok(r.steps.some((s) => s.title === 'Subgrade CBR from the DCP'));
});
