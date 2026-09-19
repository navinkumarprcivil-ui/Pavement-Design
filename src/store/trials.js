/**
 * Saved design trials.
 *
 * Trials live in localStorage so the app works offline with no server. The
 * storage layer is deliberately small and framework-free: when this moves to
 * Android, only the four functions at the bottom need a new backing store.
 */

const STORAGE_KEY = 'pavement-design.trials.v1';
const PROJECT_KEY = 'pavement-design.project.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listTrials() {
  const trials = read(STORAGE_KEY, []);
  return Array.isArray(trials) ? trials : [];
}

export function saveTrial(trial) {
  const trials = listTrials();
  const record = {
    ...trial,
    id: trial.id || `trial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const existing = trials.findIndex((t) => t.id === record.id);
  if (existing >= 0) trials[existing] = record;
  else trials.push(record);
  write(STORAGE_KEY, trials);
  return record;
}

export function deleteTrial(id) {
  write(
    STORAGE_KEY,
    listTrials().filter((t) => t.id !== id)
  );
}

export function setChosenTrial(id) {
  const trials = listTrials().map((t) => ({ ...t, chosen: t.id === id }));
  write(STORAGE_KEY, trials);
}

export function clearTrials() {
  write(STORAGE_KEY, []);
}

export function loadProject() {
  return read(PROJECT_KEY, null);
}

export function saveProject(project) {
  write(PROJECT_KEY, project);
}
