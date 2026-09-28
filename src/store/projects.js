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
