import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_URL = 'https://app.clickpickandcook.com/.netlify/functions/sync';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'FernApp/1.0 (myaifern.com)',
};

// Node/RN's console.log truncates nested objects/arrays past a shallow depth
// ("[Object]", "[Array]"), which is useless for a payload this nested (saved
// recipes, shopping items, meal plan, etc). JSON.stringify prints the full
// structure instead — but base64 blobs (recipe-card scans, uploaded photos)
// can be hundreds of KB, so any string over 200 chars is collapsed to a
// placeholder rather than dumped to the terminal. `token`/`refreshToken`/
// `userId` are exempted so the auth values stay fully visible even though a
// JWT can itself run past 200 chars.
const LOG_KEYS_NEVER_REDACTED = new Set(['token', 'refreshToken', 'userId']);
function logPayload(label, obj) {
  console.log(label, JSON.stringify(obj, (key, value) => (
    typeof value === 'string' && value.length > 200 && !LOG_KEYS_NEVER_REDACTED.has(key)
      ? `[string omitted, ${value.length} chars]`
      : value
  ), 2));
}

function fixCorruptedEmojis(recipes) {
  if (!Array.isArray(recipes)) return { fixed: recipes, hadCorruption: false };

  let hadCorruption = false;
  const fixed = recipes.map((recipe) => {
    if (recipe?.emoji?.includes?.('�')) {
      console.log('[sync] Fixed corrupted emoji in recipe:', recipe.title);
      hadCorruption = true;
      return { ...recipe, emoji: '🍽️' };
    }
    return recipe;
  });

  return { fixed, hadCorruption };
}

export function useSync(user) {
  const [data, setData] = useState({
    recipes: [],
    mealPlan: {},
    shopping: [],
    books: [],
    activities: [],
    followers: [],
    userProfile: {},
    userStores: [],
    walletCoupons: [],
    cbCovers: {},
    tier: 'free',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const pull = useCallback(async () => {
    if (!user?.id || !user?.token) return;
    if (loading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'pull', userId: user.id, token: user.token }),
      });
      const result = await res.json();
      const dd = result.data;
      if (!dd) return;

      const { fixed: fixedSaved, hadCorruption } = fixCorruptedEmojis(dd.saved || []);

      const next = {
        recipes: fixedSaved,
        mealPlan: dd.meal_plan || {},
        shopping: dd.shopping || [],
        books: dd.books || [],
        activities: dd.activities || [],
        followers: dd.followed_bloggers || [],
        userProfile: dd.remi_explicit || {},
        userStores: dd.user_stores || [],
        // Backend's pull response actually returns the user's wallet under
        // `coupons`, not `wallet_coupons` (confirmed from a live pull
        // sample) -- `wallet_coupons` is kept as a fallback in case that's
        // an older/alternate shape, but `coupons` is what's really there.
        walletCoupons: dd.coupons || dd.wallet_coupons || [],
        cbCovers: dd.cb_covers || {},
        tier: dd.tier || 'free',
      };

      setData(next);
      setLastSync(new Date());

      // Cache locally
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify(next));
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(fixedSaved));
      await AsyncStorage.setItem('rv4_books', JSON.stringify(dd.books || []));
      await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(dd.meal_plan || {}));
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(dd.shopping || []));
      await AsyncStorage.setItem('remi_explicit', JSON.stringify(dd.remi_explicit || {}));
      await AsyncStorage.setItem('cpc_followed_bloggers', JSON.stringify(dd.followed_bloggers || []));
      await AsyncStorage.setItem('cpc_user_stores', JSON.stringify(dd.user_stores || []));
      await AsyncStorage.setItem('rv4_activities', JSON.stringify(dd.activities || []));
      // The server's coupon catalog (`available_coupons`) is intentionally not
      // collected here — the full catalog is fetched live from the `fetch-coupons`
      // function instead (see couponsService.js), so any `available_coupons` in
      // the pull response is ignored client-side.
      await AsyncStorage.setItem('rv4_wallet_coupons', JSON.stringify(dd.coupons || dd.wallet_coupons || []));
      await AsyncStorage.setItem('rv4_cb_covers', JSON.stringify(dd.cb_covers || {}));
      await AsyncStorage.setItem('fern_user_tier', JSON.stringify(dd.tier || 'free'));

      if (hadCorruption) {
        console.log('[sync] Pushing fixed emoji back to backend');
        await fetch(SYNC_URL, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify({
            action: 'push',
            userId: user.id,
            token: user.token,
            data: {
              saved: fixedSaved,
              books: dd.books || [],
              meal_plan: dd.meal_plan || {},
              shopping: dd.shopping || [],
              remi_explicit: dd.remi_explicit || {},
              followed_bloggers: dd.followed_bloggers || [],
              user_stores: dd.user_stores || [],
              wallet_coupons: dd.coupons || dd.wallet_coupons || [],
              coupons: dd.coupons || dd.wallet_coupons || [],
              activities: dd.activities || [],
              cb_covers: dd.cb_covers || {},
              tier: dd.tier || 'free',
            },
          }),
        });
      }
    } catch (e) {
      console.warn('Sync pull failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, loading]);

  const loadCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('fern_sync_cache');
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.warn('Load cache failed:', e);
    }
  }, []);

  const push = useCallback(async (payload) => {
    if (!user?.id || !user?.token) return;
    try {
      await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'push', userId: user.id, token: user.token, ...payload }),
      });
    } catch (e) {
      console.warn('Sync push failed:', e);
    }
  }, [user]);

  const pushChangedFromStorage = useCallback(async (changedData = {}) => {
    if (!user?.id || !user?.token) return null;
    try {
      const saved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || '[]');
      const books = JSON.parse(await AsyncStorage.getItem('rv4_books') || '[]');
      const mealPlan = JSON.parse(await AsyncStorage.getItem('rv4_meal_plan') || '{}');
      const shopping = JSON.parse(await AsyncStorage.getItem('rv4_master_shop') || '[]');
      const remiExplicit = JSON.parse(await AsyncStorage.getItem('remi_explicit') || '{}');
      const followedBloggers = JSON.parse(await AsyncStorage.getItem('cpc_followed_bloggers') || '[]');
      const userStores = JSON.parse(await AsyncStorage.getItem('cpc_user_stores') || '[]');
      const walletCoupons = JSON.parse(await AsyncStorage.getItem('rv4_wallet_coupons') || '[]');
      const activities = JSON.parse(await AsyncStorage.getItem('rv4_activities') || '[]');
      const cbCovers = JSON.parse(await AsyncStorage.getItem('rv4_cb_covers') || '{}');
      const tier = JSON.parse(await AsyncStorage.getItem('fern_user_tier') || '"free"');

      const dataToPush = {
        saved,
        books,
        meal_plan: mealPlan,
        shopping,
        remi_explicit: remiExplicit,
        followed_bloggers: followedBloggers,
        user_stores: userStores,
        // Sent under both keys — the pull response's real field for this is
        // `coupons`, not `wallet_coupons` (see the naming-trap note in
        // DATAMODEL.md); the push side has never been confirmed against a
        // real response, so covering both avoids silently dropping the write.
        wallet_coupons: walletCoupons,
        coupons: walletCoupons,
        activities,
        cb_covers: cbCovers,
        tier,
        ...changedData,
      };

      const requestBody = {
        action: 'push',
        userId: user.id,
        token: user.token,
        data: dataToPush,
      };

      logPayload('[sync] push request body', requestBody);

      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(requestBody),
      });

      const responseJson = await res.json().catch(() => null);
      console.log('[sync] push response status', res.status);
      logPayload('[sync] push response json', responseJson);

      setLastSync(new Date());
      return responseJson;
    } catch (e) {
      console.warn('Sync changed push failed:', e);
      return null;
    }
  }, [user]);

  const pushAllFromStorage = useCallback(async () => {
    await pushChangedFromStorage();
  }, [pushChangedFromStorage]);

  // Load cache first, then refresh from API silently
  useEffect(() => {
    loadCache().then(() => {
      pull();
    });
  }, [loadCache, pull]);

  return { data, loading, refreshing, lastSync, pull, push, pushAllFromStorage, pushChangedFromStorage };
}
