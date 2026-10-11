// Store-arrival detection that works when Fern is closed.
//
// Two layers cooperate:
//   1. OS-level geofences (this file): the user's saved stores are registered with
//      the operating system via expo-location's startGeofencingAsync. iOS/Android
//      wake the app in the background when the user crosses into a store's radius
//      and run the task defined below, which posts a local notification. This needs
//      the "Always" location permission.
//   2. useGeofence's 2-minute foreground poll (src/hooks/useGeofence.js) stays as a
//      fallback for users who only granted "While Using", and to catch "already
//      inside the store when the app opened" (a geofence only fires on crossing).
// Both layers share one per-store cooldown (claimArrival) so a single arrival never
// notifies twice.
//
// IMPORTANT: this module must be imported from index.js, before the app is
// registered. TaskManager.defineTask has to run in the global scope of the JS
// bundle because, when iOS relaunches the app in the background for a geofence
// event, no React tree is ever mounted. If the task isn't defined at that moment
// expo-task-manager unregisters the geofences.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { translations } from '../constants/translations';

export const GEOFENCE_TASK = 'fern-store-geofence';
export const GEOFENCE_RADIUS_M = 150;      // ~500 ft, same as the web app
export const COOLDOWN_MS = 30 * 60 * 1000; // per-store, shared by both layers
// iOS monitors at most 20 regions per app; Android allows more, but one limit keeps
// behaviour identical on both. Nearest stores win when the user has more than this.
export const MAX_REGIONS = 20;

const COOLDOWN_KEY = 'fern_geofence_last_notified'; // device-only, { [storeKey]: epoch ms }
const LOCALE_KEY = 'fern_user_locale';
const TIER_KEY = 'fern_user_tier';       // RevenueCat tier, mirrored by App.js
const GRANT_KEY = 'fern_granted_tier';   // admin-granted plan, see grantStore.js
const ENTER = (Location.GeofencingEventType && Location.GeofencingEventType.Enter) || 1;

// expo-task-manager is a native module. A build made before it was added doesn't
// contain it, and importing it would crash the whole app on launch. Load it
// defensively so such a build simply keeps using the foreground poll.
let TaskManager = null;
try { TaskManager = require('expo-task-manager'); } catch (e) { TaskManager = null; }

export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Stable id for a store. It is both the geofence region identifier and the cooldown key.
export function storeKey(store) {
  return `${store.name}_${Math.round(store.lat * 100)}`;
}

// Recover the display name from a region identifier made by storeKey().
export function storeNameFromKey(key) {
  return String(key || '').replace(/_-?\d+$/, '');
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

// True (and records the time) if this store hasn't notified within the cooldown.
// Shared by the background task and the foreground poll.
export async function claimArrival(key, now = Date.now()) {
  const last = await readJson(COOLDOWN_KEY, {});
  if (last && typeof last[key] === 'number' && now - last[key] <= COOLDOWN_MS) return false;
  const next = { ...(last || {}), [key]: now };
  // keep the map from growing forever
  Object.keys(next).forEach((k) => { if (now - next[k] > 24 * 60 * 60 * 1000) delete next[k]; });
  try { await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(next)); } catch (e) { /* best effort */ }
  return true;
}

// Pro Max (bought, or granted by an admin) is taken to Personal Shopper's flyer scan,
// so its notification says that instead of "open your shopping list". Read from the
// device-only copies because the background task has no React tree.
async function hasProMax() {
  const tiers = [];
  try { tiers.push(JSON.parse(await AsyncStorage.getItem(TIER_KEY))); } catch (e) { /* none */ }
  try {
    const grant = JSON.parse(await AsyncStorage.getItem(GRANT_KEY));
    if (grant && (!grant.until || new Date(grant.until).getTime() > Date.now())) tiers.push(grant.tier);
  } catch (e) { /* none */ }
  return tiers.includes('pro_max');
}

async function arrivalBody() {
  let locale = 'en';
  try { locale = (await AsyncStorage.getItem(LOCALE_KEY)) || 'en'; } catch (e) { /* default */ }
  const dict = translations[locale] || translations.en;
  if (await hasProMax()) return dict.geofence_arrived_body_pro_max || translations.en.geofence_arrived_body_pro_max;
  return dict.geofence_arrived_body || translations.en.geofence_arrived_body;
}

export async function notifyArrival(name) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🛒 ${name}`,
      body: await arrivalBody(),
      data: { store: name, type: 'store_arrival' },
    },
    trigger: null, // immediately
  });
}

// What the OS calls us with (also exported for tests).
export async function handleGeofenceEvent({ data, error } = {}) {
  if (error) { console.warn('[geofence] task error:', error.message); return; }
  const { eventType, region } = data || {};
  if (eventType !== ENTER || !region || !region.identifier) return;
  if (!(await claimArrival(region.identifier))) return;
  await notifyArrival(storeNameFromKey(region.identifier));
}

export function isBackgroundGeofencingAvailable() {
  return !!TaskManager && typeof Location.startGeofencingAsync === 'function';
}

// Turn the user's saved stores into OS regions: skip ones without coordinates,
// nearest first when we have the user's position, capped at MAX_REGIONS.
export function buildRegions(stores, position) {
  const usable = (stores || []).filter((s) => s && s.name && typeof s.lat === 'number' && typeof s.lon === 'number');
  const ranked = position
    ? usable.map((s) => ({ s, d: getDistanceMeters(position.latitude, position.longitude, s.lat, s.lon) })).sort((a, b) => a.d - b.d).map((x) => x.s)
    : usable;
  const seen = new Set();
  const regions = [];
  for (const s of ranked) {
    const id = storeKey(s);
    if (seen.has(id)) continue;
    seen.add(id);
    regions.push({ identifier: id, latitude: s.lat, longitude: s.lon, radius: GEOFENCE_RADIUS_M, notifyOnEnter: true, notifyOnExit: false });
    if (regions.length >= MAX_REGIONS) break;
  }
  return regions;
}

// Register (or replace) the geofences. Calling startGeofencingAsync again with a
// new array swaps the regions. Returns true when OS-level monitoring is running.
export async function registerStoreGeofences(stores) {
  if (!isBackgroundGeofencingAvailable()) return false;
  try {
    let position = null;
    try {
      position = (await Location.getLastKnownPositionAsync())?.coords || null;
    } catch (e) { /* no fix: fall back to list order */ }
    const regions = buildRegions(stores, position);
    if (!regions.length) {
      await stopStoreGeofencing();
      return false;
    }
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return true;
  } catch (e) {
    // e.g. only "While Using" permission, or this build lacks the native module
    console.warn('[geofence] could not start background geofencing:', e.message);
    return false;
  }
}

export async function stopStoreGeofencing() {
  if (!isBackgroundGeofencingAvailable()) return;
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  } catch (e) { /* nothing running */ }
}

// Global scope on purpose (see the note at the top of this file).
if (TaskManager) {
  try { TaskManager.defineTask(GEOFENCE_TASK, handleGeofenceEvent); } catch (e) { console.warn('[geofence] defineTask failed:', e.message); }
}
