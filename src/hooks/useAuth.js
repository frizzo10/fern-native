import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Required once per app for expo-web-browser's redirect-completion handling.
WebBrowser.maybeCompleteAuthSession();

const AUTH_URL = 'https://app.clickpickandcook.com/.netlify/functions/auth';
const AUTH_KEY = 'fern_user';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load persisted user on mount
  useEffect(() => {
    SecureStore.getItemAsync(AUTH_KEY).then(val => {
      if (val) setUser(JSON.parse(val));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password }),
    });
    const data = await res.json();
    if (!data.user) throw new Error(data.error || 'Login failed');
    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  // Mirrors the web app's Google sign-in flow (same backend actions:
  // 'google' then 'oauth_user'), but a native app can't do a plain browser
  // redirect the way a web page can -- expo-auth-session builds a redirect
  // URI the OS can route back into this app, and expo-web-browser opens the
  // OAuth page in a proper in-app browser session and hands back the final
  // redirect URL once Google (via Supabase) completes it.
  const signInWithGoogle = async () => {
    const redirectUri = AuthSession.makeRedirectUri();

    const startRes = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'google', redirectTo: redirectUri }),
    });
    const { url } = await startRes.json();
    if (!url) throw new Error('Could not start Google sign-in');

    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in was cancelled');
    }

    // Supabase returns the session in the URL fragment:
    // ...#access_token=...&refresh_token=...&expires_in=...
    const fragment = result.url.split('#')[1] || '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshTokenVal = params.get('refresh_token');
    if (!accessToken) throw new Error('Google sign-in did not return a session');

    const finishRes = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'oauth_user', token: accessToken, refreshToken: refreshTokenVal }),
    });
    const data = await finishRes.json();
    if (!data.success) throw new Error(data.error || 'Google sign-in failed');

    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    setUser(null);
  };

  return { user, loading, signIn, signInWithGoogle, signOut };
}
