/**
 * The project details, shared by the first step of every design module.
 */

import { card, textField, segmented } from './dom.js';
import { ROAD_CATEGORIES } from '../data/ircConstants.js';
import { CONSTRUCTION_TYPES, FACILITY_TYPES } from './modules.js';

/**
 * @param {object} app
 * @param {object} [options]
 * @param {(value: string) => void} [options.onCategory]  After the road category changes.
 * @param {boolean} [options.terrain]  Ask for the terrain (IRC:37 VDF).
 */
export function projectCard(app, { onCategory, terrain = false } = {}) {
  const { project } = app.state;
  const categoryOptions = ROAD_CATEGORIES.options.map((o) => ({ value: o.id, label: o.label }));

  return card(
    'Project',
    ['name', 'location', 'client', 'designer'].map((key) =>
      textField({
        label: { name: 'Project name', location: 'Location', client: 'Client', designer: 'Designer' }[key],
        value: project[key],
        onInput: (value) => app.patch('project', { [key]: value }),
      })
    ),
    segmented({
      label: 'Construction type',
      value: project.constructionType,
      options: CONSTRUCTION_TYPES,
      onChange: (value) => app.patch('project', { constructionType: value }, { rerender: true }),
    }),
    segmented({
      label: 'Facility',
      value: project.facility,
      options: FACILITY_TYPES,
      onChange: (value) => app.patch('project', { facility: value }, { rerender: true }),
    }),
    segmented({
      label: 'Road category',
      ref: ROAD_CATEGORIES.ref,
      value: project.roadCategory,
      options: categoryOptions,
      onChange: (value) => {
        app.patch('project', { roadCategory: value });
        onCategory?.(value);
        app.render();
      },
    }),
    terrain
      ? segmented({
          label: 'Terrain',
          value: project.terrain,
          options: [
            { value: 'plain', label: 'Plain' },
            { value: 'rolling', label: 'Rolling' },
            { value: 'hilly', label: 'Hilly' },
          ],
          onChange: (value) => app.patch('project', { terrain: value }, { rerender: true }),
        })
      : null
  );
}
