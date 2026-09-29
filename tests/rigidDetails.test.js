/**
 * IRC:58-2015 details: PQC bonded to DLC (Cl. 6.7, Appendix-VII Option IV)
 * and tie bars for longitudinal joints (Cl. 8.2, Table 6, Appendix-IX).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bondedStiffness, bondedSlab, equivalentSlab, flexuralStiffness, tieBars } from '../src/engine/rigidDetails.js';
import { defaultRigidState, runRigid } from '../src/ui/rigidProject.js';

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);

test('Appendix-VII Option IV: 235 mm PQC bonded to 150 mm DLC matches a 300 mm slab', () => {
  const s = bondedStiffness({ h1M: 0.235, h2M: 0.15, E1: 30000, mu1: 0.15, E2: 13600, mu2: 0.2 });
  near(s.d, 0.16, 0.001, 'neutral axis');
  near(s.pqc, 46.65, 0.005, 'PQC stiffness');
  near(s.dlc, 23.28, 0.005, 'DLC stiffness');
  near(s.combined, 69.93, 0.01, 'combined');
  near(flexuralStiffness(30000, 0.3, 0.15), 69.05, 0.005, 'design slab');

  const b = bondedSlab({ designMm: 300, dlcMm: 150, E1: 30000, mu1: 0.15, dlc28MPa: 13.6 });
  assert.equal(b.thicknessMm, 235);
  assert.equal(b.E2, 13600);
});

test('an entered bonded PQC is checked as the monolithic slab it is as stiff as', () => {
  const e = equivalentSlab({ pqcMm: 235, dlcMm: 150, E1: 30000, mu1: 0.15, dlc28MPa: 13.6 });
  assert.ok(e.thicknessMm > 300 && e.thicknessMm < 302, `${e.thicknessMm}`);
});

test('Appendix-IX: 12 mm tie bars in a 330 mm slab, 3.5 m lane', () => {
  const plain = tieBars({ slabMm: 330, laneWidthM: 3.5, type: 'plain', diameterMm: 12 });
  near(plain.areaPerM, 332.6, 0.05, 'plain As');
  assert.equal(plain.spacingMm, 340);
  near(plain.bondLength, 428.2, 0.5, 'plain bond length');
  assert.equal(plain.lengthMm, 580);

  const deformed = tieBars({ slabMm: 330, laneWidthM: 3.5, type: 'deformed', diameterMm: 12 });
  near(deformed.areaPerM, 207.9, 0.05, 'deformed As');
  assert.equal(deformed.spacingMm, 540);
  near(deformed.bondLength, 487.4, 0.5, 'deformed bond length');
  assert.equal(deformed.lengthMm, 640);
});

test('Table 6: every row, before the 750 mm limit of Cl. 8.2.4', () => {
  // [slab, diameter, spacing plain, spacing deformed, length plain, length deformed]
  const rows = [
    [150, 8, 330, 530, 440, 480],
    [150, 10, 520, 830, 510, 560],
    [200, 10, 390, 620, 510, 560],
    [200, 12, 560, 900, 580, 640],
    [250, 12, 450, 720, 580, 640],
    [300, 12, 370, 600, 580, 640],
    [300, 16, 660, 1060, 720, 800],
    [350, 12, 320, 510, 580, 640],
    [350, 16, 570, 910, 720, 800],
  ];
  for (const [slabMm, d, sp, sd, lp, ld] of rows) {
    const p = tieBars({ slabMm, laneWidthM: 3.5, type: 'plain', diameterMm: d });
    const q = tieBars({ slabMm, laneWidthM: 3.5, type: 'deformed', diameterMm: d });
    assert.equal(Math.round(p.spacingCalc / 10) * 10, sp, `${slabMm}/${d} plain spacing`);
    assert.equal(Math.round(q.spacingCalc / 10) * 10, sd, `${slabMm}/${d} deformed spacing`);
    assert.equal(p.lengthMm, lp, `${slabMm}/${d} plain length`);
    assert.equal(q.lengthMm, ld, `${slabMm}/${d} deformed length`);
    assert.ok(q.spacingMm <= 750);
  }
  const wide = tieBars({ slabMm: 300, laneWidthM: 3.5, type: 'deformed', diameterMm: 16 });
  assert.equal(wide.spacingMm, 750);
  assert.equal(wide.warnings.length, 1);
});

test('a bonded design is thinner than the slab designed on the granular sub-base', () => {
  const rigid = defaultRigidState();
  rigid.spectrum = {
    single: [{ loadKN: 190, percent: 100 }],
    tandem: [{ loadKN: 390, percent: 100 }],
    tridem: [{ loadKN: 545, percent: 100 }],
  };
  rigid.foundation.bonded = true;
  rigid.foundation.gsbMm = 250;
  const r = runRigid(rigid, 'design');
  assert.ok(r.ok);
  assert.ok(r.bonded.pqcMm < r.bonded.designMm);
  assert.ok(r.bonded.combined >= r.bonded.required);
  assert.equal(r.adoptedMm, r.bonded.pqcMm + 10);
  assert.equal(r.slots[1].label, 'DLC, bonded');

  rigid.slab.thicknessMm = r.bonded.pqcMm;
  const check = runRigid(rigid, 'check');
  assert.ok(check.evaluation.thicknessMm >= r.bonded.designMm - 1e-9, 'the checked PQC stands for at least the designed slab');
  assert.equal(check.safe, true);
  assert.ok(check.tieBars.lengthMm > 0);
});
