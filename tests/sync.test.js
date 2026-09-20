import test from 'node:test';
import assert from 'node:assert/strict';

// The sync store talks to localStorage; stand one up before importing it.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const sync = await import('../src/store/sync.js');

function reset() {
  store.clear();
}

test('a saved record can be read back and listed', () => {
  reset();
  sync.put('trials', 't1', { name: 'BC + DBM / WMM / GSB', totalThicknessMm: 600 });

  const record = sync.get('trials', 't1');
  assert.equal(record.name, 'BC + DBM / WMM / GSB');
  assert.equal(record.id, 't1');
  assert.ok(record.savedAt, 'a record must be stamped so merges can order it');
  assert.equal(sync.list('trials').length, 1);
});

test('deleting leaves a tombstone rather than dropping the record', () => {
  reset();
  sync.put('trials', 't1', { name: 'one' });
  sync.remove('trials', 't1');

  assert.equal(sync.get('trials', 't1'), null, 'deleted records read as absent');
  assert.equal(sync.list('trials').length, 0, 'deleted records are not listed');
  assert.equal(
    sync.getMap('trials').t1.deleted,
    true,
    'the tombstone must survive so the delete can be synced'
  );
});

test('a newer remote record replaces the local one', () => {
  reset();
  sync.put('trials', 't1', { name: 'local' });

  const changed = sync.mergeRemote('trials', {
    t1: { id: 't1', name: 'remote', savedAt: '2099-01-01T00:00:00.000Z' },
  });

  assert.equal(changed, true);
  assert.equal(sync.get('trials', 't1').name, 'remote');
});

test('an older remote record does not clobber newer local work', () => {
  reset();
  sync.put('trials', 't1', { name: 'local' });

  const changed = sync.mergeRemote('trials', {
    t1: { id: 't1', name: 'stale', savedAt: '1999-01-01T00:00:00.000Z' },
  });

  assert.equal(changed, false, 'nothing changed, so nothing should be pushed back');
  assert.equal(sync.get('trials', 't1').name, 'local');
});

test('a remote record the device has never seen is added', () => {
  reset();
  const changed = sync.mergeRemote('trials', {
    t9: { id: 't9', name: 'from another phone', savedAt: '2026-01-01T00:00:00.000Z' },
  });

  assert.equal(changed, true);
  assert.equal(sync.list('trials').length, 1);
  assert.equal(sync.get('trials', 't9').name, 'from another phone');
});

test('a delete on one device is not resurrected by another device copy', () => {
  reset();
  sync.put('trials', 't1', { name: 'one' });
  sync.remove('trials', 't1');

  // The other device still holds the pre-delete version.
  const changed = sync.mergeRemote('trials', {
    t1: { id: 't1', name: 'one', savedAt: '2020-01-01T00:00:00.000Z' },
  });

  assert.equal(changed, false);
  assert.equal(sync.list('trials').length, 0, 'the delete must win');
});

test('a remote tombstone deletes a record held locally', () => {
  reset();
  sync.put('trials', 't1', { name: 'one' });

  const changed = sync.mergeRemote('trials', {
    t1: { id: 't1', deleted: true, savedAt: '2099-01-01T00:00:00.000Z' },
  });

  assert.equal(changed, true);
  assert.equal(sync.list('trials').length, 0);
});

test('merging reports remote origin so the change is not echoed back', () => {
  reset();
  const seen = [];
  const unsubscribe = sync.subscribe((collection, origin) => seen.push([collection, origin]));

  sync.put('trials', 't1', { name: 'one' });
  sync.mergeRemote('trials', {
    t2: { id: 't2', name: 'two', savedAt: '2099-01-01T00:00:00.000Z' },
  });
  unsubscribe();

  assert.deepEqual(seen, [
    ['trials', 'local'],
    ['trials', 'remote'],
  ]);
});

test('malformed stored data does not throw', () => {
  reset();
  store.set('pavement-design.trials.v2', 'not json at all');
  assert.deepEqual(sync.list('trials'), []);

  store.set('pavement-design.trials.v2', '[1,2,3]');
  assert.deepEqual(sync.list('trials'), [], 'an array is not a valid record map');
});

test('trials and catalogue are kept apart', () => {
  reset();
  sync.put('trials', 'x', { name: 'trial' });
  sync.put('catalogue', 'x', { surfacingMm: 20 });

  assert.equal(sync.get('trials', 'x').name, 'trial');
  assert.equal(sync.get('catalogue', 'x').surfacingMm, 20);
  assert.equal(sync.list('trials').length, 1);
  assert.equal(sync.list('catalogue').length, 1);
});

test('trial helpers round-trip through the sync store', async () => {
  reset();
  const trials = await import('../src/store/trials.js');

  const saved = trials.saveTrial({ name: 'A', totalThicknessMm: 500 });
  trials.saveTrial({ name: 'B', totalThicknessMm: 600 });
  assert.equal(trials.listTrials().length, 2);

  trials.setChosenTrial(saved.id);
  const chosen = trials.listTrials().filter((t) => t.chosen);
  assert.equal(chosen.length, 1, 'exactly one trial can be the chosen one');
  assert.equal(chosen[0].name, 'A');

  trials.deleteTrial(saved.id);
  assert.equal(trials.listTrials().length, 1);
  assert.equal(trials.listTrials()[0].name, 'B');
});

test('the rural catalogue stores and reports coverage', async () => {
  reset();
  const rural = await import('../src/engine/ruralSP72.js');

  assert.equal(rural.getComposition('T3', 'cbr-5'), null);
  assert.equal(rural.catalogueCoverage().entered, 0);

  rural.setComposition('T3', 'cbr-5', { surfacingMm: 20, baseMm: 150, subBaseMm: 150 });

  const cell = rural.getComposition('T3', 'cbr-5');
  assert.equal(cell.baseMm, 150);
  assert.equal(rural.catalogueCoverage().entered, 1);

  const design = rural.designRuralRoad({ cumulativeEsal: 80000, subgradeCBR: 5 });
  assert.equal(design.missing, false);
  assert.equal(design.totalThicknessMm, 320);
});

test('an empty catalogue cell reports what is missing instead of guessing', async () => {
  reset();
  const rural = await import('../src/engine/ruralSP72.js');

  const design = rural.designRuralRoad({ cumulativeEsal: 80000, subgradeCBR: 5 });
  assert.equal(design.missing, true);
  assert.equal(design.composition, null);
  assert.match(design.message, /has not been entered yet/);
});
