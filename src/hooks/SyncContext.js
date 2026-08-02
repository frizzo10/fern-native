import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
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

const SyncContext = createContext(null);

// ── Why this exists ─────────────────────────────────────────────────────
// Each screen used to call a plain useSync(user) hook, which created its
// OWN independent copy of data/push/pull. React Navigation's tab navigator
// keeps every tab's screen mounted in the background when you switch tabs
// (it doesn't unmount them) — so when, say, RecipesScreen pushed a change
// to the shopping list, that update landed correctly on the backend, but
// ShoppingScreen's own separate useSync instance never knew anything had
// changed, since it only re-pulls on its own mount. The result: a button
// tap that visibly succeeds on one screen (recipe -> shopping list) simply
// never shows up on the actual Shopping screen, while typing directly into
// Shopping's own input works fine because that path only ever touches its
// own already-in-sync local state. Reported directly by Haider during
// testing. Fixed by lifting the state up into one Provider every screen
// shares, so a push from anywhere is immediately visible everywhere.
export function SyncProvider({ user, children }) {
  const [data, setData] = useState(toDisplayData(EMPTY_RAW));
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
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
      setData(toDisplayData(raw));
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

  // patchItem('saved', recipeId, { rating: 4 }) -- the fix for the
  // "starring a recipe sends everything" report: push() above always
  // round-trips the ENTIRE raw record (all 14 fields, every saved recipe,
  // every book, worse if any recipe still has a base64 image fallback
  // embedded) even for a one-field change on one item. This calls the
  // backend's new 'patch' action instead, which does a real partial
  // update server-side -- the request body here is just the one id and
  // the one changed field, not the whole state. Local display state still
  // updates immediately the same way push() does, so the UI doesn't wait
  // on the network either way.
  const patchItem = useCallback(async (field, itemId, updates) => {
    if (!user?.id || !user?.token) return { ok: false, error: 'Not signed in' };

    const backendKey = field === 'recipes' ? 'saved' : field; // display-name passthrough, same mapping push() uses
    const currentArr = Array.isArray(rawRef.current[backendKey]) ? rawRef.current[backendKey] : [];
    const nextArr = currentArr.map((item) =>
      (item && (item.id === itemId || item._id === itemId)) ? { ...item, ...updates } : item
    );
    rawRef.current = { ...rawRef.current, [backendKey]: nextArr };
    setData(toDisplayData(rawRef.current));

    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'patch',
          userId: user.id,
          token: user.token,
          data: { field: backendKey, itemId, updates },
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        console.warn('Sync patch failed:', result.error || res.status);
        return { ok: false, error: result.error || `HTTP ${res.status}` };
      }
      await AsyncStorage.setItem('fern_sync_raw_cache', JSON.stringify(rawRef.current));
      setLastSync(new Date());
      return { ok: true };
    } catch (e) {
      console.warn('Sync patch failed:', e.message);
      return { ok: false, error: e.message };
    }
  }, [user]);

  useEffect(() => { pull(); }, [pull]);

  const value = { data, loading, lastSync, pull, push, patchItem };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// Kept as useSync(user) for call-site compatibility with all 4 existing
// screens — the user argument is accepted but unused; the Provider above
// (which already has user) is the single source of truth. If this hook is
// called outside a SyncProvider, it throws loudly rather than silently
// creating a second, disconnected copy of the old per-screen behavior.
export function useSync(_user) {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync() must be called within a <SyncProvider>. Did you forget to wrap MainApp in App.js?');
  }
  return ctx;
}
