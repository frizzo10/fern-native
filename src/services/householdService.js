// Households: people who eat together share one week, list, family calendar, stores and recipe library.
// The server (web repo `household` function + `_household.js`) owns the shared copy; this file is the thin client.
// Device-only keys: `fern_household` { id, code, shopperId, isShopper, hv, members, avoids } (filled by useSync.pull
// from every pull) and `fern_household_hv` (the shared-data version this phone last pulled, sent with every push).
import AsyncStorage from '@react-native-async-storage/async-storage';

const URL = 'https://app.clickpickandcook.com/.netlify/functions/household';
export const HOUSEHOLD_KEY = 'fern_household';
export const HOUSEHOLD_HV_KEY = 'fern_household_hv';

export async function getCachedHousehold() {
  try {
    const raw = await AsyncStorage.getItem(HOUSEHOLD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Only the shopper (or everyone, when there is no household) gets store alerts. Read in the background task too.
export async function isStoreShopper() {
  const h = await getCachedHousehold();
  if (!h) return true;
  return h.isShopper !== false;
}

// "Foods to avoid" of everyone at the table (each member's own line), plus this phone's own line.
export async function householdAvoids() {
  const h = await getCachedHousehold();
  return h && typeof h.avoids === 'string' ? h.avoids : '';
}

export async function mergedDietary(own) {
  const mine = own && own !== 'none' ? String(own).trim() : '';
  const shared = await householdAvoids();
  const parts = [mine, shared].filter(Boolean);
  const seen = new Set();
  const out = [];
  parts.join('; ').split(/[;,]/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
    const k = s.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  });
  return out.join(', ');
}

export async function householdCall(token, action, extra = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 25000) : null;
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({ token, action, ...extra }),
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `household ${res.status}`);
    return json;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function saveHouseholdLocally(h) {
  try {
    if (h) {
      await AsyncStorage.setItem(HOUSEHOLD_KEY, JSON.stringify({
        id: h.id, code: h.code, shopperId: h.shopperId, isShopper: !!h.isShopper, hv: h.version || h.hv || 0,
        members: Array.isArray(h.members) ? h.members : [],
        avoids: (Array.isArray(h.members) ? h.members.map((m) => m.avoids).filter(Boolean).join('; ') : h.avoids) || '',
      }));
    } else {
      await AsyncStorage.multiRemove([HOUSEHOLD_KEY, HOUSEHOLD_HV_KEY]);
    }
  } catch (e) { /* best effort */ }
}
