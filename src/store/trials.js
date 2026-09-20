/**
 * Saved design trials and the working project state.
 *
 * Trials go through the syncable store so they are mirrored to the cloud when
 * one is available. The project form state stays on the device — it is
 * half-finished input, and having it jump between devices mid-edit would be
 * more surprising than useful.
 */

import { list, get, put, remove, getMap, putAll, clear } from './sync.js';

const PROJECT_KEY = 'pavement-design.project.v1';

export function listTrials() {
  return list('trials').sort(
    (a, b) => Date.parse(a.savedAt || 0) - Date.parse(b.savedAt || 0)
  );
}

export function saveTrial(trial) {
  const id =
    trial.id || `trial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return put('trials', id, trial);
}

export function deleteTrial(id) {
  remove('trials', id);
}

/** Mark one trial as the chosen design, clearing the flag on the others. */
export function setChosenTrial(id) {
  const map = getMap('trials');
  const updates = {};
  for (const [trialId, trial] of Object.entries(map)) {
    if (trial.deleted) continue;
    const chosen = trialId === id;
    if (Boolean(trial.chosen) !== chosen) {
      updates[trialId] = { ...trial, chosen };
    }
  }
  if (Object.keys(updates).length) putAll('trials', updates);
}

export function clearTrials() {
  clear('trials');
}

export function getTrial(id) {
  return get('trials', id);
}

export function loadProject() {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProject(project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    // A full or blocked storage quota must not break the design flow.
  }
}
