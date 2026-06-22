// AuthScreen.js — Fern Native
// Sign in / Sign up with Supabase
// Matches web app design exactly

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, Image, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ── Supabase ────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { storage: AsyncStorage } }
  );

// ── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  forest:  '#1C3A1A',
  bright:  '#2D5A27',
  orange:  '#E8651A',
  sage:    '#A8D5A2',
  parch:   '#FDFAF6',
  ink:     '#1A0E05',
  brown:   '#9C835F',
  border:  '#E8E0D0',
};

// ── Sync pull after login ────────────────────────────────────────────────────
async function syncPull(userId, token) {
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
  } catch (e) {
    console.warn('Sync pull failed:', e.message);
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth }) {
  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSignIn() {
    if (!email || !password) {
      return Alert.alert('Please enter email and password');
    }

    setLoading(true);

    try {
      const res = await fetch(
        'https://app.clickpickandcook.com/.netlify/functions/auth',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            email,
            password,
          }),
        }
        );

      const result = await res.json();

      console.log('Auth Response:', result);

      if (!res.ok) {
        throw new Error(result.message || 'Login failed');
      }

    // Example: if API returns user and tokens
      await AsyncStorage.setItem(
        'rv4_auth',
        JSON.stringify({
          id: result.user.id,
          email: result.user.email,
          token: result.access_token,
          refreshToken: result.refresh_token,
        })
        );

    // Pull all data
      await syncPull(result.user.id, result.token);

      onAuth(result.user);

    } catch (e) {
      Alert.alert('Sign in failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password || !name) return Alert.alert('Please fill in all fields');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const user = data.user;
      const session = data.session;
      // Save name to profile
      await AsyncStorage.setItem('remi_explicit', JSON.stringify({ userName: name }));
      await AsyncStorage.setItem('rv4_auth', JSON.stringify({
        id: user.id, email: user.email,
        token: session?.access_token,
        refreshToken: session?.refresh_token
      }));
      if (session) await syncPull(user.id, session.access_token);
      // onAuth(user);
    } catch (e) {
      Alert.alert('Sign up failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView
    style={s.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
        {/* Header */}
    <View style={s.header}>
    <Text style={s.logo}>🌿 fern</Text>
    <Text style={s.tagline}>WEEKLY AD TO DINNER TABLE · PATENT PENDING</Text>
    </View>

  {/* Card */}
  <View style={s.card}>
{/* Tab switcher */}
<View style={s.tabs}>
<TouchableOpacity
style={[s.tab, mode === 'signin' && s.tabActive]}
onPress={() => setMode('signin')}
>
<Text style={[s.tabText, mode === 'signin' && s.tabTextActive]}>Sign In</Text>
</TouchableOpacity>
<TouchableOpacity
style={[s.tab, mode === 'signup' && s.tabActive]}
onPress={() => setMode('signup')}
>
<Text style={[s.tabText, mode === 'signup' && s.tabTextActive]}>Create Account</Text>
</TouchableOpacity>
</View>

          {/* Fields */}
{mode === 'signup' && (
  <TextInput
  style={s.input}
  placeholder="Your first name"
  placeholderTextColor={C.brown}
  value={name}
  onChangeText={setName}
  autoCapitalize="words"
  />
  )}
<TextInput
style={s.input}
placeholder="Email address"
placeholderTextColor={C.brown}
value={email}
onChangeText={setEmail}
keyboardType="email-address"
autoCapitalize="none"
autoCorrect={false}
/>
<TextInput
style={s.input}
placeholder="Password"
placeholderTextColor={C.brown}
value={password}
onChangeText={setPassword}
secureTextEntry
/>

          {/* Button */}
<TouchableOpacity
style={s.btn}
onPress={mode === 'signin' ? handleSignIn : handleSignUp}
disabled={loading}
>
{loading
  ? <ActivityIndicator color="#fff" />
  : <Text style={s.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
}
</TouchableOpacity>
</View>

<Text style={s.footer}>✓ Always free · No ads · No spam</Text>
</KeyboardAvoidingView>
</SafeAreaView>
);
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.forest },
  container:    { flex: 1, justifyContent: 'center', padding: 24 },
  header:       { alignItems: 'center', marginBottom: 32 },
  logo:         { fontSize: 42, color: '#FDFAF6', fontFamily: 'PlayfairDisplay-Bold', letterSpacing: -1 },
  tagline:      { fontSize: 9, color: C.sage, letterSpacing: 1.5, marginTop: 4, fontFamily: 'Jost-Regular' },
  card:         { backgroundColor: C.parch, borderRadius: 20, padding: 20 },
  tabs:         { flexDirection: 'row', backgroundColor: C.border, borderRadius: 10, padding: 3, marginBottom: 20 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive:    { backgroundColor: C.forest },
  tabText:      { fontSize: 14, color: C.brown, fontFamily: 'Jost-SemiBold' },
  tabTextActive:{ color: '#FDFAF6' },
  input:        { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink,
  fontFamily: 'Jost-Regular', marginBottom: 12 },
  btn:          { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14,
  alignItems: 'center', marginTop: 4 },
  btnText:      { color: '#fff', fontSize: 16, fontFamily: 'Jost-Bold' },
  footer:       { textAlign: 'center', color: C.sage, fontSize: 12, marginTop: 24, fontFamily: 'Jost-Regular' },
});
