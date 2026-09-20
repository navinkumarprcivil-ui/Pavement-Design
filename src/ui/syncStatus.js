/**
 * Cloud sync status, shown where saved work is visible.
 *
 * The app never blocks on the cloud, so this is informational: it says whether
 * designs are backed up, and when they are not, exactly what to do about it.
 */

import { h } from './dom.js';
import { cloudState, retryCloud, STATUS } from '../store/cloud.js';

const TONE = {
  [STATUS.ONLINE]: 'info',
  [STATUS.CONNECTING]: 'info',
  [STATUS.OFFLINE]: 'warn',
  [STATUS.BLOCKED]: 'warn',
  [STATUS.DISABLED]: 'info',
};

const TITLE = {
  [STATUS.ONLINE]: 'Synced to the cloud',
  [STATUS.CONNECTING]: 'Connecting',
  [STATUS.OFFLINE]: 'Saved on this device',
  [STATUS.BLOCKED]: 'Cloud sync needs setting up',
  [STATUS.DISABLED]: 'Saved on this device',
};

export function syncStatusCard(app) {
  const state = cloudState();
  const canRetry =
    state.status === STATUS.OFFLINE || state.status === STATUS.BLOCKED;

  return h(
    'div',
    { class: `notice ${TONE[state.status] || 'info'}` },
    h('strong', {}, TITLE[state.status] || 'Cloud sync'),
    state.message,
    canRetry
      ? h(
          'button',
          {
            class: 'citation',
            style: { marginTop: '10px' },
            onclick: async () => {
              await retryCloud();
              app.render();
            },
          },
          'Try again'
        )
      : null
  );
}

/** One compact line, for screens that only need a hint. */
export function syncStatusLine() {
  const state = cloudState();
  return h(
    'p',
    { class: 'muted', style: { margin: 0 } },
    state.status === STATUS.ONLINE
      ? 'Backed up to the cloud and shared across your devices.'
      : 'Saved on this device.'
  );
}
