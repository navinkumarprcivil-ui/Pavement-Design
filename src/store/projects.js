/**
 * Saved projects: named copies of the working inputs, flexible or rigid.
 *
 * They go through the syncable store like trials, so a project saved on one
 * device opens on another once the cloud is connected.
 */

import { list, get, put, remove } from './sync.js';

export function listProjects() {
  return list('projects').sort(
    (a, b) => Date.parse(b.savedAt || 0) - Date.parse(a.savedAt || 0)
  );
}

export function getProject(id) {
  return id ? get('projects', id) : null;
}

/** Save under `id` when given, otherwise as a new project. Returns the record. */
export function saveProjectRecord({ id, ...record }) {
  const projectId =
    id || `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return put('projects', projectId, record);
}

export function deleteProject(id) {
  remove('projects', id);
}

/** A name no saved project has: the name itself, else "name (copy)", "name (copy 2)" and so on. */
export function freeName(name) {
  const taken = new Set(listProjects().map((p) => p.name));
  if (!taken.has(name)) return name;
  const base = name.replace(/ \(copy(?: \d+)?\)$/, '');
  for (let n = 1; ; n++) {
    const candidate = `${base} (copy${n > 1 ? ` ${n}` : ''})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** A saved project copied under a free name. Returns the new record. */
export function duplicateProject(record) {
  const name = freeName(record.name);
  const state = structuredClone(record.state);
  state.project = { ...(state.project || {}), name };
  return saveProjectRecord({ name, pavementType: record.pavementType, state });
}

/** What an exported project file holds. */
export const PROJECT_FILE = { app: 'irc-pavement-design', kind: 'project', version: 1 };
