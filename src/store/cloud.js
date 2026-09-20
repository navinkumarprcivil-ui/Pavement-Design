/**
 * Cloud sync over Firebase Realtime Database.
 *
 * The app is offline-first: everything works from device storage, and this
 * layer mirrors it when a network and a signed-in session are available. Every
 * failure path here ends in the app carrying on locally — losing the cloud must
 * never cost you a design.
 *
 * Sign-in is anonymous. Each device gets a Firebase uid and its records live
 * under `users/{uid}`, which is what the security rules enforce. Signing in
 * anonymously must be enabled in the Firebase console for this to work; if it
 * is not, the status reports exactly that and the app stays local.
 *
 * The SDK is imported from Google's CDN at runtime rather than bundled, so the
 * app keeps its no-build-step property.
 */

import {
  FIREBASE_ENABLED,
  FIREBASE_SDK_VERSION,
  ANALYTICS_ENABLED,
  firebaseConfig,
} from '../config/firebase.js';
import { COLLECTIONS, getMap, mergeRemote, subscribe } from './sync.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

export const STATUS = {
  DISABLED: 'disabled',
  CONNECTING: 'connecting',
  ONLINE: 'online',
  OFFLINE: 'offline',
  BLOCKED: 'blocked',
};

const state = {
  status: FIREBASE_ENABLED ? STATUS.CONNECTING : STATUS.DISABLED,
  message: FIREBASE_ENABLED
    ? 'Connecting to cloud sync…'
    : 'Cloud sync is switched off. Designs are saved on this device.',
  uid: null,
  lastSyncedAt: null,
};

const watchers = new Set();

export function cloudState() {
  return { ...state };
}

export function onCloudChange(watcher) {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

function setState(patch) {
  Object.assign(state, patch);
  for (const watcher of watchers) {
    try {
      watcher(cloudState());
    } catch (error) {
      console.error('cloud watcher failed', error);
    }
  }
}

let db = null;
let dbApi = null;
let userRef = null;
let applyingRemote = false;
let connectPromise = null;

/** Push one collection's whole map up. Cheap: these maps are small. */
async function pushCollection(collection) {
  if (!userRef || !dbApi) return;
  try {
    await dbApi.set(dbApi.child(userRef, collection), getMap(collection));
    setState({ lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    setState({
      status: STATUS.OFFLINE,
      message: `Could not save to the cloud: ${error.message}. Your work is safe on this device.`,
    });
  }
}

function watchLocalChanges() {
  subscribe((collection, origin) => {
    // A change we just merged in from the cloud must not be pushed back out.
    if (origin === 'remote' || applyingRemote) return;
    if (state.status !== STATUS.ONLINE) return;
    pushCollection(collection);
  });
}

function watchRemoteChanges() {
  for (const collection of COLLECTIONS) {
    dbApi.onValue(
      dbApi.child(userRef, collection),
      (snapshot) => {
        const remote = snapshot.val();
        if (!remote) return;
        applyingRemote = true;
        try {
          mergeRemote(collection, remote);
        } finally {
          applyingRemote = false;
        }
        setState({ lastSyncedAt: new Date().toISOString() });
      },
      (error) => {
        setState({
          status: STATUS.BLOCKED,
          message:
            `The database refused to read ${collection}: ${error.message}. ` +
            'Check the Realtime Database rules.',
        });
      }
    );
  }
}

async function loadSdk() {
  const [appMod, authMod, dbMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-database.js`),
  ]);
  return { appMod, authMod, dbMod };
}

async function startAnalytics(app) {
  if (!ANALYTICS_ENABLED) return;
  if (location.protocol !== 'https:') return;
  try {
    const mod = await import(`${CDN}/firebase-analytics.js`);
    if (await mod.isSupported()) mod.getAnalytics(app);
  } catch {
    // Analytics is never worth failing the app over.
  }
}

/**
 * Connect, sign in anonymously, merge both directions, then keep in sync.
 * Safe to call repeatedly — the first call's promise is reused.
 */
export function connectCloud() {
  if (!FIREBASE_ENABLED) return Promise.resolve(cloudState());
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    setState({ status: STATUS.CONNECTING, message: 'Connecting to cloud sync…' });

    let sdk;
    try {
      sdk = await loadSdk();
    } catch (error) {
      setState({
        status: STATUS.OFFLINE,
        message:
          'Could not load the Firebase SDK. Designs are saved on this device ' +
          'and will sync when you are back online.',
      });
      connectPromise = null;
      return cloudState();
    }

    const { appMod, authMod, dbMod } = sdk;

    try {
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      db = dbMod.getDatabase(app);
      dbApi = dbMod;

      const credential = await authMod.signInAnonymously(auth);
      const uid = credential.user.uid;
      userRef = dbMod.ref(db, `users/${uid}`);

      // Pull what the cloud has, merge it in, then push the merged result back
      // so both sides agree before live syncing starts.
      applyingRemote = true;
      try {
        for (const collection of COLLECTIONS) {
          const snapshot = await dbMod.get(dbMod.child(userRef, collection));
          if (snapshot.exists()) mergeRemote(collection, snapshot.val());
        }
      } finally {
        applyingRemote = false;
      }

      setState({
        status: STATUS.ONLINE,
        uid,
        message: 'Synced. Your designs are backed up and shared across your devices.',
        lastSyncedAt: new Date().toISOString(),
      });

      for (const collection of COLLECTIONS) await pushCollection(collection);

      watchRemoteChanges();
      watchLocalChanges();
      startAnalytics(app);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setState({
          status: STATUS.BLOCKED,
          message:
            'Anonymous sign-in is not enabled for this Firebase project. Turn it ' +
            'on under Authentication → Sign-in method → Anonymous. Until then ' +
            'designs are saved on this device only.',
        });
      } else if (code === 'auth/configuration-not-found') {
        setState({
          status: STATUS.BLOCKED,
          message:
            'Firebase Authentication is not set up for this project yet. Enable ' +
            'Anonymous sign-in in the Firebase console. Designs are saved on ' +
            'this device meanwhile.',
        });
      } else {
        setState({
          status: STATUS.OFFLINE,
          message: `Cloud sync is unavailable (${error.message}). Designs are saved on this device.`,
        });
      }
      connectPromise = null;
    }

    return cloudState();
  })();

  return connectPromise;
}

/** Force another attempt after a failure. */
export function retryCloud() {
  connectPromise = null;
  return connectCloud();
}
