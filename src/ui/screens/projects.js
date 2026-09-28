import { h, card, textField, badge, notice, button } from '../dom.js';
import { listProjects, deleteProject } from '../../store/projects.js';

const TYPE = { flexible: 'Flexible', rigid: 'Rigid' };

const savedOn = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function renderProjects(app) {
  const projects = listProjects();
  const status = h('div', {});
  const state = h('span', {});
  const showState = () =>
    state.replaceChildren(app.isUnsaved() ? badge('info', 'Unsaved') : badge('pass', 'Saved'));

  const confirmLeave = (action) =>
    !app.isUnsaved() || window.confirm(`${action}? Unsaved changes to the current project will be lost.`);

  app.setActions(
    button(
      'New project',
      () => {
        if (confirmLeave('Start a new project')) app.newProject();
      },
      { kind: 'secondary' }
    ),
    button('Save project', () => {
      const name = app.state.project.name.trim();
      if (!name) {
        status.replaceChildren(notice('danger', null, 'Enter a project name'));
        return;
      }
      app.storeProject();
      app.render();
    })
  );

  const row = (project) => {
    const open = project.id === app.state.projectId;
    return h(
      'section',
      { class: 'trial-card', 'data-chosen': String(open) },
      h(
        'div',
        { class: 'trial-head' },
        h('h3', {}, project.name),
        open ? badge('chosen', 'Open') : null
      ),
      h('p', { class: 'project-meta' }, `${TYPE[project.pavementType] || 'Flexible'} · ${savedOn(project.savedAt)}`),
      h(
        'div',
        { class: 'trial-actions two' },
        open
          ? null
          : button('Open', () => {
              if (confirmLeave(`Open ${project.name}`)) app.openProject(project);
            }, { kind: 'ghost' }),
        button('Delete', () => {
          if (!window.confirm(`Delete ${project.name}?`)) return;
          deleteProject(project.id);
          if (open) app.state.projectId = null;
          app.persist();
          app.render();
        }, { kind: 'ghost danger' })
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
      h('div', { class: 'summary-chips' }, h('span', { class: 'chip' }, TYPE[app.state.pavementType]), state)
    ),
    status,
    projects.length
      ? [h('h2', { class: 'section-title list-title' }, 'Saved'), projects.map(row)]
      : h('div', { class: 'empty-state' }, h('p', {}, 'No saved projects.'))
  );
}
