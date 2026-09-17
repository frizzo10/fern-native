import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const AUTH_KEY = 'fern_user';
const AUTH_URL = 'https://app.clickpickandcook.com/.netlify/functions/auth';

// ── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { storage: AsyncStorage } }
);

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Refresh token ────────────────────────────────────────────────────────────
  const tryRefreshToken = async (refreshToken) => {
    console.log('\n🔁🔁🔁 ============================================');
    console.log('🔁🔁🔁  TOKEN REFRESH INITIATED');
    console.log('🔁🔁🔁  refreshToken:', refreshToken);
    console.log('🔁🔁🔁 ============================================\n');
    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refreshToken }),
      });
      const data = await res.json();
      console.log('🔁 Refresh response status:', res.status);
      console.log('🔁 Refresh response data:', JSON.stringify(data));
      if (!data.success || !data.token) {
        console.warn('🔁❌ Refresh failed — no token in response');
        return null;
      }
      console.log('🔁✅ Refresh succeeded — new token obtained');
      return { token: data.token, refreshToken: data.refreshToken || refreshToken };
    } catch (e) {
      console.warn('🔁❌ Refresh request threw:', e.message);
      return null;
    }
  };

  // Load persisted user on mount; attempt token refresh if we have a stored refreshToken
  //
  // IMPORTANT: this restore path re-authenticates the person from the
  // Keychain-backed AUTH_KEY, which survives an app deletion+reinstall.
  // AsyncStorage (where saved recipes, cookbooks, stores, etc. actually
  // live on-device) does NOT survive a reinstall -- it starts empty. If
  // this path doesn't re-pull from the server, a reinstalled app looks
  // completely empty even though the account's data is untouched on
  // Supabase. So every branch below re-syncs before finishing.
  useEffect(() => {
    SecureStore.getItemAsync(AUTH_KEY).then(async (val) => {
      if (val) {
        const savedUser = JSON.parse(val);
        // Try to silently refresh the token so the session stays alive
        if (savedUser.refreshToken) {
          const refreshed = await tryRefreshToken(savedUser.refreshToken);
          if (refreshed) {
            const updatedUser = { ...savedUser, token: refreshed.token, refreshToken: refreshed.refreshToken };
            await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(updatedUser));
            await AsyncStorage.setItem('rv4_auth', JSON.stringify({
              id: updatedUser.id,
              email: updatedUser.email,
              token: updatedUser.token,
              refreshToken: updatedUser.refreshToken,
            }));
            await syncPull(updatedUser.id, updatedUser.token);
            setUser(updatedUser);
            console.log('🔁✅ Session restored via refresh token for user:', updatedUser.id);
          } else {
            // Refresh failed — still load the saved user; let individual API calls handle expiry.
            // Still attempt a sync pull with the (possibly stale) token: if it's
            // actually still valid this repopulates local data; if not, syncPull
            // just warns and leaves the empty defaults, same as it already does today.
            await syncPull(savedUser.id, savedUser.token);
            setUser(savedUser);
            console.warn('🔁⚠️  Refresh failed on startup — using cached session, may be expired');
          }
        } else {
          await syncPull(savedUser.id, savedUser.token);
          setUser(savedUser);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync pull after login ────────────────────────────────────────────────────
  const syncPull = async (userId, token) => {
    try {
      const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', userId, token })
      });
      const result = await res.json();
      const d = result.data || {};
      await AsyncStorage.setItem('rv4_saved',            JSON.stringify(d.saved            || []));
      await AsyncStorage.setItem('rv4_books',            JSON.stringify(d.books            || []));
      await AsyncStorage.setItem('rv4_meal_plan',        JSON.stringify(d.meal_plan        || {}));
      await AsyncStorage.setItem('rv4_master_shop',      JSON.stringify(d.shopping         || []));
      await AsyncStorage.setItem('remi_explicit',        JSON.stringify(d.remi_explicit    || {}));
      await AsyncStorage.setItem('cpc_followed_bloggers',JSON.stringify(d.followed_bloggers|| []));
      await AsyncStorage.setItem('cpc_user_stores',      JSON.stringify(d.user_stores      || []));
      await AsyncStorage.setItem('rv4_wallet_coupons',   JSON.stringify(d.coupons || d.wallet_coupons || []));
      await AsyncStorage.setItem('rv4_activities',       JSON.stringify(d.activities        || []));
      await AsyncStorage.setItem('fern_user_tier',       JSON.stringify(d.tier              || 'free'));
    } catch (e) {
      console.warn('Sync pull failed:', e.message);
    }
  };

  // ── Sign in with REST API ───────────────────────────────────────────────────
  const signInWithSupabase = async (email, password) => {
    console.log('🔷 signInWithSupabase (REST API) called with email:', email);
    try {
      console.log('🔷 Calling REST API endpoint:', AUTH_URL);
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      console.log('🔷 REST API response status:', res.status);

      const data = await res.json();
      console.log('🔷 REST API response data:', data);

      // Login failed — attempt refresh token fallback before surfacing the error
      if (!data.user || !res.ok || data.error) {
        console.log('🔷 Login did not return a user (error:', data.error, ') — attempting refresh token fallback...');
        const stored = await AsyncStorage.getItem('rv4_auth').catch(() => null);
        const storedAuth = stored ? JSON.parse(stored) : null;
        if (storedAuth?.refreshToken) {
          const refreshed = await tryRefreshToken(storedAuth.refreshToken);
          if (refreshed) {
            console.log('🔷✅ Refresh token fallback succeeded — restoring session');
            const updatedUser = {
              ...storedAuth,
              token: refreshed.token,
              refreshToken: refreshed.refreshToken,
            };
            await AsyncStorage.setItem('rv4_auth', JSON.stringify(updatedUser));
            await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(updatedUser));
            await syncPull(updatedUser.id, updatedUser.token);
            setUser(updatedUser);
            return updatedUser;
          }
          console.log('🔷❌ Refresh token fallback also failed');
        } else {
          console.log('🔷 No stored refresh token available for fallback');
        }
        throw new Error(data.error || data.message || 'Login failed');
      }
      
      const token = data.access_token || data.token;
      const refreshToken = data.refresh_token || data.refreshToken;
      const authUser = {
        ...data.user,
        token,
        refreshToken,
      };
      console.log('🔷 Auth user ID:', authUser?.id, 'Token:', token ? 'exists' : 'missing');
      
      // Save auth tokens
      await AsyncStorage.setItem('rv4_auth', JSON.stringify({
        id: authUser.id,
        email: authUser.email,
        token: authUser.token,
        refreshToken: authUser.refreshToken,
      }));
      console.log('🔷 Saved auth tokens to AsyncStorage');
      
      // Sync data
      console.log('🔷 Starting syncPull...');
      await syncPull(authUser.id, authUser.token);
      console.log('🔷 syncPull completed');
      
      // Save to secure storage and update state
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authUser));
      console.log('🔷 Saved to SecureStore, now updating state...');
      
      // Update state - this will trigger App component re-render
      setUser(authUser);
      console.log('🔷 State updated, returning user');
      
      // Wait a tick to ensure state has propagated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      return authUser;
    } catch (e) {
      console.error('🔷 signInWithSupabase error:', e);
      throw new Error(e.message || 'Sign in failed');
    }
  };

  // ── Sign up with Supabase ────────────────────────────────────────────────────
  const signUpWithSupabase = async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      
      const authUser = data.user;
      const session = data.session;
      
      // Save name to profile
      await AsyncStorage.setItem('remi_explicit', JSON.stringify({ userName: name }));
      
      // Save auth tokens
      await AsyncStorage.setItem('rv4_auth', JSON.stringify({
        id: authUser.id,
        email: authUser.email,
        token: session?.access_token,
        refreshToken: session?.refresh_token
      }));
      
      // Sync data if session exists
      if (session) await syncPull(authUser.id, session.access_token);
      
      // Save to secure storage and update state
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authUser));
      setUser(authUser);
      
      return authUser;
    } catch (e) {
      throw new Error(e.message || 'Sign up failed');
    }
  };

  // ── Forgot password ─────────────────────────────────────────────────────────
  // Triggers the backend's Supabase-recovery-email flow. Never receives a
  // code back here -- the code only ever reaches the person via email.
  const forgotPassword = async (email) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'forgot', email }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Could not send reset code');
    }
    return true;
  };

  // ── Reset password (with the code from the forgot-password email) ─────────
  // On success the backend returns the same {user, token, refreshToken}
  // shape as login, so this mirrors signInWithSupabase's tail end to land
  // the person back in the app already signed in with their new password.
  const resetPassword = async ({ email, code, newPassword }) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', email, code, newPassword }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Password reset failed');
    }

    const token = data.token;
    const refreshToken = data.refreshToken;
    const authUser = { ...data.user, token, refreshToken };

    await AsyncStorage.setItem('rv4_auth', JSON.stringify({
      id: authUser.id,
      email: authUser.email,
      token: authUser.token,
      refreshToken: authUser.refreshToken,
    }));

    await syncPull(authUser.id, authUser.token);
    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authUser));
    setUser(authUser);

    return authUser;
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync(AUTH_KEY);
    setUser(null);
  };

  return { 
    user, 
    loading, 
    signInWithSupabase, 
    signUpWithSupabase, 
    forgotPassword,
    resetPassword,
    signOut, 
    syncPull,
    tryRefreshToken,
  };
}
