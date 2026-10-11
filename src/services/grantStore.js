import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIERS } from '../constants/tiers';

// Admin-granted plan (Pro / Pro Max given from the admin panel, no store
// purchase). The server returns it on every sync pull as `granted_tier` /
// `granted_until` (only while active). It is kept here, separate from the
// RevenueCat tier, and useEntitlement() uses whichever of the two is higher.
//
// Device-only cache (`fern_granted_tier`) so a grant still applies offline and
// on a cold start before the first pull finishes. Cleared on sign-out; every
// pull overwrites it, so a revoked or expired grant disappears on next sync.

const STORAGE_KEY = 'fern_granted_tier';
const RANK = { [TIERS.FREE]: 0, [TIERS.PRO]: 1, [TIERS.PRO_MAX]: 2 };

let current = { tier: null, until: null };
const listeners = new Set();

// Pure: the tier a grant gives right now, or null (unknown tier / expired).
export function activeGrantTier(grant, now = Date.now()) {
  const tier = grant && grant.tier;
  if (tier !== TIERS.PRO && tier !== TIERS.PRO_MAX) return null;
  if (grant.until) {
    const until = new Date(grant.until).getTime();
    if (isNaN(until) || until <= now) return null;
  }
  return tier;
}

// Pure: the higher of two tiers.
export function higherTier(a, b) {
  return (RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : (RANK[a] !== undefined ? a : TIERS.FREE);
}

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch (e) {} });
}

export function getGrantedTier() {
  return activeGrantTier(current);
}

export async function setGrant(grant) {
  const next = {
    tier: grant && grant.tier ? grant.tier : null,
    until: grant && grant.until ? grant.until : null,
  };
  current = next;
  notify();
  try {
    if (next.tier) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('grantStore: could not persist grant', e);
  }
}

export function clearGrant() {
  return setGrant(null);
}

// Load whatever was saved last time (cold start / offline).
(async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw && !current.tier) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        current = { tier: saved.tier || null, until: saved.until || null };
        notify();
      }
    }
  } catch (e) {}
})();

// React hook: re-renders when the grant changes. Also re-checks at the grant's
// expiry time so an expired grant stops working without an app restart.
export function useGrantedTier() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    let timer = null;
    if (current.until) {
      const ms = new Date(current.until).getTime() - Date.now();
      if (ms > 0 && ms < 2147483000) timer = setTimeout(fn, ms + 500);
    }
    return () => { listeners.delete(fn); if (timer) clearTimeout(timer); };
  });
  return getGrantedTier();
}
