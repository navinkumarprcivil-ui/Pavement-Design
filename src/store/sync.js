/**
 * Syncable local storage.
 *
 * Collections are keyed maps of records, each carrying a `savedAt` timestamp.
 * The device's localStorage is always the working copy, so the app keeps
 * functioning with no network — which matters when it is being used at site.
 * The cloud layer in `cloud.js` mirrors these maps and merges what comes back.
 *
 * Merging is last-write-wins on `savedAt`, per record. Deletes leave a
 * tombstone (`deleted: true`) rather than dropping the record, so that deleting
 * a trial on one phone does not see it resurrected from another device's copy.
 */

const KEYS = {
  trials: 'pavement-design.trials.v2',
  catalogue: 'pavement-design.sp72-catalogue.v2',
};

export const COLLECTIONS = Object.keys(KEYS);

const listeners = new Set();

function notify(collection, origin) {
  for (const listener of listeners) {
    try {
      listener(collection, origin);
    } catch (error) {
      console.error('sync listener failed', error);
    }
  }
}

/** Subscribe to changes. Receives (collection, 'local' | 'remote'). */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readMap(collection) {
  try {
    const raw = localStorage.getItem(KEYS[collection]);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeMap(collection, map) {
  try {
    localStorage.setItem(KEYS[collection], JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

/** The whole collection including tombstones — this is what gets mirrored. */
export function getMap(collection) {
  return readMap(collection);
}

/** Live records only, tombstones filtered out. */
export function list(collection) {
  return Object.values(readMap(collection)).filter((r) => !r.deleted);
}

export function get(collection, id) {
  const record = readMap(collection)[id];
  return record && !record.deleted ? record : null;
}

/** Insert or replace a record, stamping it so merges can order it. */
export function put(collection, id, record) {
  const map = readMap(collection);
  const stored = { ...record, id, savedAt: new Date().toISOString() };
  delete stored.deleted;
  map[id] = stored;
  writeMap(collection, map);
  notify(collection, 'local');
  return stored;
}

/** Replace every record in a collection, preserving existing tombstones. */
export function putAll(collection, records) {
  const map = readMap(collection);
  const now = new Date().toISOString();
  for (const [id, record] of Object.entries(records)) {
    map[id] = { ...record, id, savedAt: now };
    delete map[id].deleted;
  }
  writeMap(collection, map);
  notify(collection, 'local');
}

/** Tombstone a record so the delete survives a merge. */
export function remove(collection, id) {
  const map = readMap(collection);
  map[id] = { id, deleted: true, savedAt: new Date().toISOString() };
  writeMap(collection, map);
  notify(collection, 'local');
}

const time = (record) => Date.parse(record?.savedAt || '') || 0;

/**
 * Merge a remote copy into the local one, newest write per record winning.
 * Returns true when the local copy actually changed, which is what stops a
 * remote update from echoing straight back out as a local one.
 */
export function mergeRemote(collection, remoteMap) {
  if (!remoteMap || typeof remoteMap !== 'object') return false;

  const local = readMap(collection);
  let changed = false;

  for (const [id, remote] of Object.entries(remoteMap)) {
    if (!remote || typeof remote !== 'object') continue;
    const mine = local[id];
    if (!mine || time(remote) > time(mine)) {
      local[id] = { ...remote, id };
      changed = true;
    }
  }

  if (changed) {
    writeMap(collection, local);
    notify(collection, 'remote');
  }
  return changed;
}

/** Drop everything, including tombstones. Used by "clear saved data". */
export function clear(collection) {
  writeMap(collection, {});
  notify(collection, 'local');
}
