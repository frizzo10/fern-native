// AuthScreen.js — Fern Native
// Sign in / Sign up with Supabase
// Matches web app design exactly

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import useLanguage from '../hooks/useLanguage';
// ── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  forest: '#1C3A1A',
  bright: '#2D5A27',
  orange: '#E8651A',
  sage: '#A8D5A2',
  parch: '#FDFAF6',
  ink: '#1A0E05',
  brown: '#9C835F',
  border: '#E8E0D0',
};

// ── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen({ onAuthSuccess, signInWithSupabase, signUpWithSupabase }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    console.log('🔵 handleSignIn called');
    if (!email || !password) return Alert.alert(t('enter_email_password'));
    console.log('📧 Email:', email, 'Password length:', password.length);
    setLoading(true);
    try {
      console.log('🔄 Calling signInWithSupabase...');
      const user = await signInWithSupabase(email, password);
      console.log('✅ Sign in successful, user:', user);
      console.log('🔄 Calling onAuthSuccess callback...');
      onAuthSuccess(user);
      console.log('✅ onAuthSuccess callback completed');
    } catch (e) {
      console.error('❌ Sign in error:', e);
      Alert.alert(t('sign_in_failed'), e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password || !name) return Alert.alert(t('fill_all_fields'));
    setLoading(true);
    try {
      const user = await signUpWithSupabase(email, password, name);
      onAuthSuccess(user);
    } catch (e) {
      Alert.alert(t('sign_up_failed'), e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          bounces={false}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.logo}>{t('logo')}</Text>
            <Text style={s.tagline}>{t('tagline')}</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            {/* Tab switcher */}
            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, mode === 'signin' && s.tabActive]}
                onPress={() => setMode('signin')}
              >
                <Text style={[s.tabText, mode === 'signin' && s.tabTextActive]}>{t('sign_in')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, mode === 'signup' && s.tabActive]}
                onPress={() => setMode('signup')}
              >
                <Text style={[s.tabText, mode === 'signup' && s.tabTextActive]}>{t('create_account')}</Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            {mode === 'signup' && (
              <TextInput
                style={s.input}
                placeholder={t('first_name_placeholder')}
                placeholderTextColor={C.brown}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={s.input}
              placeholder={t('email_placeholder')}
              placeholderTextColor={C.brown}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={s.input}
              placeholder={t('password_placeholder')}
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
                : <Text style={s.btnText}>{mode === 'signin' ? t('sign_in') : t('create_account')}</Text>
              }
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>{t('always_free')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.forest },
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 42, color: '#FDFAF6', fontFamily: 'PlayfairDisplay-Bold', letterSpacing: -1 },
  tagline: { fontSize: 9, color: C.sage, letterSpacing: 1.5, marginTop: 4, fontFamily: 'Jost-Regular' },
  card: { backgroundColor: C.parch, borderRadius: 20, padding: 20 },
  tabs: { flexDirection: 'row', backgroundColor: C.border, borderRadius: 10, padding: 3, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: C.forest },
  tabText: { fontSize: 14, color: C.brown, fontFamily: 'Jost-SemiBold' },
  tabTextActive: { color: '#FDFAF6' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink,
    fontFamily: 'Jost-Regular', marginBottom: 12
  },
  btn: {
    backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4
  },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Jost-Bold' },
  footer: { textAlign: 'center', color: C.sage, fontSize: 12, marginTop: 24, fontFamily: 'Jost-Regular' },
});
