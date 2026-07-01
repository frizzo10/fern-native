import { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_URL = 'https://app.clickpickandcook.com/.netlify/functions/sync';

// Fields the sync backend (netlify/functions/sync.js) tracks on the user's
// row. Several of these (remi_explicit, remi_learned, followed_bloggers,
// user_stores, unlocked, ks, circular, circular_saved_at, activities_ts)
// aren't shown anywhere in the native UI yet, but the backend always does a
// full-record replace on push — not a partial patch — so we must round-trip
// every field we received on pull, even ones we never display, or a native
// save would silently wipe that data for anyone who also uses the web app.
const EMPTY_RAW = {
  saved: [], books: [], meal_plan: {}, shopping: [],
  remi_explicit: {}, remi_learned: {}, followed_bloggers: [],
  user_stores: [], unlocked: {}, ks: null,
  circular: [], circular_saved_at: null,
  activities: [], activities_ts: 0,
};

function toDisplayData(raw) {
  return {
    recipes:    raw.saved      || [],
    mealPlan:   raw.meal_plan  || {},
    shopping:   raw.shopping   || [],
    books:      raw.books      || [],
    activities: raw.activities || [],
  };
}

export function useSync(user) {
  const [data, setData] = useState(toDisplayData(EMPTY_RAW));
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Holds the complete last-known record (display fields + passthrough
  // fields the UI doesn't touch), so push() can merge into the whole thing
  // rather than just what this screen happens to care about.
  const rawRef = useRef(EMPTY_RAW);

  const pull = useCallback(async () => {
    if (!user?.id || !user?.token) return;
    setLoading(true);
    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', userId: user.id, token: user.token }),
      });
      const result = await res.json();
      const dd = result.data;
      if (!dd) return;

      const raw = { ...EMPTY_RAW, ...dd };
      rawRef.current = raw;
      const next = toDisplayData(raw);

      setData(next);
      setLastSync(new Date());

      await AsyncStorage.setItem('fern_sync_raw_cache', JSON.stringify(raw));
    } catch (e) {
      try {
        const cached = await AsyncStorage.getItem('fern_sync_raw_cache');
        if (cached) {
          const raw = { ...EMPTY_RAW, ...JSON.parse(cached) };
          rawRef.current = raw;
          setData(toDisplayData(raw));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [user]);

  // push({ shopping: [...] }) — or mealPlan, recipes, books, activities.
  // Merges the partial update into the full last-known record (display
  // fields translated back to their backend names, passthrough fields
  // preserved untouched) and sends the complete object every time.
  const push = useCallback(async (partial = {}) => {
    if (!user?.id || !user?.token) return { ok: false, error: 'Not signed in' };

    const nextRaw = { ...rawRef.current };
    if (partial.recipes    !== undefined) nextRaw.saved      = partial.recipes;
    if (partial.mealPlan   !== undefined) nextRaw.meal_plan  = partial.mealPlan;
    if (partial.shopping   !== undefined) nextRaw.shopping   = partial.shopping;
    if (partial.books      !== undefined) nextRaw.books      = partial.books;
    if (partial.activities !== undefined) nextRaw.activities = partial.activities;

    rawRef.current = nextRaw;
    setData(toDisplayData(nextRaw));

    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push',
          userId: user.id,
          token: user.token,
          data: nextRaw,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        console.warn('Sync push failed:', result.error || res.status);
        return { ok: false, error: result.error || `HTTP ${res.status}` };
      }
      await AsyncStorage.setItem('fern_sync_raw_cache', JSON.stringify(nextRaw));
      setLastSync(new Date());
      return { ok: true };
    } catch (e) {
      console.warn('Sync push failed:', e.message);
      return { ok: false, error: e.message };
    }
  }, [user]);

  // Pull on mount + when user changes
  useEffect(() => { pull(); }, [pull]);

  return { data, loading, lastSync, pull, push };
}
