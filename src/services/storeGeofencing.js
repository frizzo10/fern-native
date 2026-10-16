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
import { fmtMoney, loadLedger, summarizeSince } from '../utils/savings';

export const GEOFENCE_TASK = 'fern-store-geofence';
export const GEOFENCE_RADIUS_M = 125;      // ~400 ft; 300 m then 200 m still fired from a neighbouring store (Harris Teeter / Walmart), tightened 2026-10-16
import { LAUNCH_ALL_FREE } from '../constants/launch';

export const COOLDOWN_MS = 30 * 60 * 1000; // per-store, shared by both layers
// iOS monitors at most 20 regions per app; Android allows more, but one limit keeps
// behaviour identical on both. Nearest stores win when the user has more than this.
export const MAX_REGIONS = 20;

const COOLDOWN_KEY = 'fern_geofence_last_notified'; // device-only, { [storeKey]: epoch ms }
const LOCALE_KEY = 'fern_user_locale';
const TIER_KEY = 'fern_user_tier';       // RevenueCat tier, mirrored by App.js
const GRANT_KEY = 'fern_granted_tier';   // admin-granted plan, see grantStore.js
const ENTER = (Location.GeofencingEventType && Location.GeofencingEventType.Enter) || 1;
const EXIT = (Location.GeofencingEventType && Location.GeofencingEventType.Exit) || 2;
const TRIP_KEY = 'fern_trip_started';     // device-only, { store, at } written on arrival, read on exit

// expo-task-manager is a native module. A build made before it was added doesn't
// contain it, and importing it would crash the whole app on launch. Load it
// defensively so such a build simply keeps using the foreground poll.
let TaskManager = null;
try { TaskManager = require('expo-task-manager'); } catch (e) { TaskManager = null; }

// Stores saved on this phone have `lng`; ones from the web app may have `lon`. Accept either.
export function storeLon(s) {
  const v = Number(s && (s.lon ?? s.lng));
  return Number.isFinite(v) ? v : null;
}
export function storeLat(s) {
  const v = Number(s && s.lat);
  return Number.isFinite(v) ? v : null;
}

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
  return `${store.name}_${Math.round(Number(store.lat) * 100)}`;
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
  if (LAUNCH_ALL_FREE) return true; // launch period: everyone gets store alerts
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
  // The whole trip (flyer, sales, coupons, a week of dinners) is open to every plan for now.
  return dict.geofence_arrived_body_pro_max || translations.en.geofence_arrived_body_pro_max;
}

export async function notifyArrival(name) {
  // Store alerts are a Pro Max feature; everyone else is left alone.
  if (!(await hasProMax())) return;
  try { await AsyncStorage.setItem(TRIP_KEY, JSON.stringify({ store: name, at: Date.now() })); } catch (e) { /* best effort */ }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🛒 ${name}`,
      body: await arrivalBody(),
      data: { store: name, type: 'store_arrival' },
    },
    trigger: null, // immediately
  });
}

// Leaving the store: tell the shopper what this trip saved them (ticked-off sale items + coupons
// marked used, both from the savings ledger since they arrived). Nothing saved = no notification.
export async function notifyDeparture(name) {
  if (!(await hasProMax())) return;
  const trip = await readJson(TRIP_KEY, null);
  const since = trip && typeof trip.at === 'number' && Date.now() - trip.at < 12 * 60 * 60 * 1000 ? trip.at : Date.now() - 6 * 60 * 60 * 1000;
  const sum = summarizeSince(await loadLedger(), since);
  if (!sum.count || sum.total <= 0) return;
  let locale = 'en';
  try { locale = (await AsyncStorage.getItem(LOCALE_KEY)) || 'en'; } catch (e) { /* default */ }
  const dict = translations[locale] || translations.en;
  const fill = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const body = fill(dict.geofence_left_body || translations.en.geofence_left_body, {
    amt: `${sum.est ? '~' : ''}${fmtMoney(sum.total)}`,
    sale: fmtMoney(sum.circular),
    coupons: fmtMoney(sum.coupon),
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: `🎉 ${name}`, body, data: { store: name, type: 'store_exit' } },
    trigger: null,
  });
  try { await AsyncStorage.removeItem(TRIP_KEY); } catch (e) { /* ignore */ }
}

// What the OS calls us with (also exported for tests).
export async function handleGeofenceEvent({ data, error } = {}) {
  if (error) { console.warn('[geofence] task error:', error.message); return; }
  const { eventType, region } = data || {};
  if (!region || !region.identifier) return;
  if (eventType === EXIT) {
    if (await claimArrival(`exit:${region.identifier}`)) await notifyDeparture(storeNameFromKey(region.identifier));
    return;
  }
  if (eventType !== ENTER) return;
  if (!(await claimArrival(region.identifier))) return;
  await notifyArrival(storeNameFromKey(region.identifier));
}

export function isBackgroundGeofencingAvailable() {
  return !!TaskManager && typeof Location.startGeofencingAsync === 'function';
}

// Turn the user's saved stores into OS regions: skip ones without coordinates,
// nearest first when we have the user's position, capped at MAX_REGIONS.
export function buildRegions(stores, position) {
  const usable = (stores || []).filter((s) => s && s.name && storeLat(s) !== null && storeLon(s) !== null);
  const ranked = position
    ? usable.map((s) => ({ s, d: getDistanceMeters(position.latitude, position.longitude, storeLat(s), storeLon(s)) })).sort((a, b) => a.d - b.d).map((x) => x.s)
    : usable;
  const seen = new Set();
  const regions = [];
  for (const s of ranked) {
    const id = storeKey(s);
    if (seen.has(id)) continue;
    seen.add(id);
    regions.push({ identifier: id, latitude: storeLat(s), longitude: storeLon(s), radius: GEOFENCE_RADIUS_M, notifyOnEnter: true, notifyOnExit: true });
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
