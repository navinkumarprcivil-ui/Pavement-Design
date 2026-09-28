/**
 * The design modules, one per IRC code the app designs to. Each has its own
 * steps; the pavement type in state says which one is under way.
 */

export const MODULES = {
  flexible: { label: 'Flexible pavement', short: 'Flexible', code: 'IRC:37-2018', start: 'traffic' },
  rigid: { label: 'Rigid pavement', short: 'Rigid', code: 'IRC:58-2015', start: 'rigidTraffic' },
  rural: { label: 'Low volume road', short: 'Low volume', code: 'IRC:SP:72-2015', start: 'traffic' },
};

export const MODULE_ORDER = ['flexible', 'rigid', 'rural'];
