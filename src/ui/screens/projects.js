import { h, card, textField, badge, notice, button } from '../dom.js';
import { listProjects, deleteProject, duplicateProject, getProject } from '../../store/projects.js';
import { MODULES } from '../modules.js';

const typeOf = (pavementType) => (MODULES[pavementType] || MODULES.flexible).short;

const savedOn = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const fileName = (name) => `${(name || 'project').trim().replace(/[^\w-]+/g, '-')}.pavement.json`;

/** Largest project file read, well above any real project. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function download(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: fileName(name) });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A message for the next render of the screen, which a re-render would otherwise lose. */
let flash = null;

export default function renderProjects(app) {
  const projects = listProjects();
  const status = h('div', {}, flash ? notice('info', null, flash) : null);
  flash = null;
  const state = h('span', {});
  const showState = () =>
    state.replaceChildren(app.isUnsaved() ? badge('info', 'Unsaved') : badge('pass', 'Saved'));

  const confirmLeave = (action) =>
    !app.isUnsaved() || window.confirm(`${action}? Unsaved changes to the current project will be lost.`);

  const named = () => {
    if (app.state.project.name.trim()) return true;
    status.replaceChildren(notice('danger', null, 'Enter a project name'));
    return false;
  };

  app.setActions(
    button(
      'New project',
      () => {
        if (confirmLeave('Start a new project')) app.newProject();
      },
      { kind: 'secondary' }
    ),
    button('Save project', () => {
      if (!named()) return;
      app.storeProject();
      app.render();
    })
  );

  // Import: a file becomes a new saved project, leaving the open one as it is.
  const picker = h('input', {
    type: 'file',
    accept: '.json,application/json',
    class: 'visually-hidden',
    'aria-label': 'Project file',
    onchange: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error('The file is too large to be a project');
        const record = app.importProjectFile(JSON.parse(await file.text()));
        flash = `Imported as ${record.name}`;
        app.render();
      } catch (error) {
        status.replaceChildren(notice('danger', null, error instanceof SyntaxError ? 'Not a project file from this app' : error.message));
      }
    },
  });

  const open = getProject(app.state.projectId);

  const row = (project) => {
    const isOpen = project.id === app.state.projectId;
    return h(
      'section',
      { class: 'trial-card', 'data-chosen': String(isOpen) },
      h('div', { class: 'trial-head' }, h('h3', {}, project.name), isOpen ? badge('chosen', 'Open') : null),
      h('p', { class: 'project-meta' }, `${typeOf(project.pavementType)} · ${savedOn(project.savedAt)}`),
      h(
        'div',
        { class: 'trial-actions two' },
        isOpen
          ? null
          : button(
              'Open',
              () => {
                if (confirmLeave(`Open ${project.name}`)) app.openProject(project);
              },
              { kind: 'ghost' }
            ),
        button(
          'Duplicate',
          () => {
            duplicateProject(project);
            app.render();
          },
          { kind: 'ghost' }
        ),
        button('Export', () => download(app.projectFile(project), project.name), { kind: 'ghost' }),
        button(
          'Delete',
          () => {
            if (!window.confirm(`Delete ${project.name}?`)) return;
            deleteProject(project.id);
            if (isOpen) app.state.projectId = null;
            app.persist();
            app.render();
          },
          { kind: 'ghost danger' }
        )
      )
    );
  };

  showState();

  return h(
    'div',
    { class: 'card-stack' },
    card(
      'Current project',
      textField({
        label: 'Name',
        value: app.state.project.name,
        onInput: (value) => {
          app.state.project.name = value;
          app.persist();
          status.replaceChildren();
          showState();
        },
      }),
      h('div', { class: 'summary-chips' }, h('span', { class: 'chip' }, typeOf(app.state.pavementType)), state),
      h(
        'div',
        { class: 'trial-actions two' },
        open
          ? button(
              'Save as copy',
              () => {
                if (!named()) return;
                app.storeProject({ copy: true });
                app.render();
              },
              { kind: 'secondary' }
            )
          : null,
        button('Export file', () => download(app.projectFile(), app.state.project.name), { kind: 'secondary' })
      )
    ),
    status,
    h('div', { class: 'trial-actions two' }, button('Import file', () => picker.click(), { kind: 'secondary' }), picker),
    projects.length
      ? [h('h2', { class: 'section-title list-title' }, 'Saved'), projects.map(row)]
      : h('div', { class: 'empty-state' }, h('p', {}, 'No saved projects.'))
  );
}
