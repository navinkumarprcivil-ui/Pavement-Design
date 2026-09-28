/**
 * The design modules, one per IRC code the app designs to. Each has its own
 * steps; the pavement type in state says which one is under way.
 */

export const MODULES = {
  flexible: { label: 'Flexible pavement', short: 'Flexible', code: 'IRC:37-2018', start: 'traffic' },
  rigid: { label: 'Rigid pavement', short: 'Rigid', code: 'IRC:58-2015', start: 'rigidTraffic' },
  rural: { label: 'Flexible pavement · Low volume', short: 'Flexible · LVR', code: 'IRC:SP:72-2015', start: 'ruralTraffic' },
  ruralRigid: { label: 'Rigid pavement · Low volume', short: 'Rigid · LVR', code: 'IRC:SP:62-2014', start: 'lvRigidTraffic' },
};

/** The choices on the home page; the low volume codes are offered from the traffic step. */
export const MODULE_ORDER = ['flexible', 'rigid'];

/** The module a low volume one sits under, for the side panel and the home page. */
export const PARENT_MODULE = { rural: 'flexible', ruralRigid: 'rigid' };

/** What the project is, for the record and the report. */
export const CONSTRUCTION_TYPES = [
  { value: 'greenfield', label: 'Greenfield (new construction)' },
  { value: 'widening', label: 'Widening' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'other', label: 'Other' },
];

export const FACILITY_TYPES = [
  { value: 'main', label: 'Main carriageway' },
  { value: 'service', label: 'Service road' },
  { value: 'slip', label: 'Slip road' },
  { value: 'parikrama', label: 'Parikrama path' },
  { value: 'other', label: 'Other' },
];

export const optionLabel = (options, value) => options.find((o) => o.value === value)?.label ?? '';
