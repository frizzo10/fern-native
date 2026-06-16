import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

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

  const signOut = async () => {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
