/**
 * Firebase project configuration.
 *
 * These values are NOT secrets. A Firebase web apiKey identifies the project to
 * Google's servers; it grants no access by itself and is meant to ship in
 * client code. What actually protects the data is the Realtime Database
 * security rules in `database.rules.json`, which scope every record to the
 * signed-in user.
 *
 * Set `enabled` to false to run the app purely on device storage.
 */

export const FIREBASE_ENABLED = true;

export const firebaseConfig = {
  apiKey: 'AIzaSyBbdHQO9hx65NBRg2CS6bjvO19MavDNsXU',
  authDomain: 'pavement-design.firebaseapp.com',
  databaseURL:
    'https://pavement-design-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'pavement-design',
  storageBucket: 'pavement-design.firebasestorage.app',
  messagingSenderId: '1040904516448',
  appId: '1:1040904516448:web:4fd928dbc66f8402fd2405',
  measurementId: 'G-8JPJ5M5N81',
};

/** Firebase JS SDK version loaded from the CDN. */
export const FIREBASE_SDK_VERSION = '10.12.5';

/**
 * Analytics is loaded only on a real https origin — it fails on file:// and is
 * noise on localhost. Set to false to switch it off entirely.
 */
export const ANALYTICS_ENABLED = true;
