// AuthScreen.js — Fern Native
// Sign in / Sign up with Supabase
// Matches web app design exactly

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SafeAreaView } from 'react-native-safe-area-context';
import useLanguage from '../hooks/useLanguage';

// Guarded: an app build without this native module simply has no Apple button.
let AppleAuthentication = null;
try { AppleAuthentication = require('expo-apple-authentication'); } catch (e) { AppleAuthentication = null; }

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
export default function LoginScreen({ onAuthSuccess, signInWithSupabase, signUpWithSupabase, forgotPassword, resetPassword, signInWithApple, signInWithGoogle, appleAvailable, googleAvailable }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [loading, setLoading] = useState(false);
  // A synchronous guard: a fast double tap would otherwise send two requests before `loading` re-renders.
  const busyRef = React.useRef(false);
  const begin = () => { if (busyRef.current) return false; busyRef.current = true; setLoading(true); return true; };
  const end = () => { busyRef.current = false; setLoading(false); };
  const cleanEmail = () => String(email || '').trim().toLowerCase();
  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  // Server and network errors in plain words (and translated), never raw technical text.
  const friendly = (e) => {
    const m = String(e?.message || '');
    if (m === 'slow_connection' || /network request failed|timed? ?out|abort/i.test(m)) return t('auth_err_slow');
    if (m === 'account_exists' || /already registered|already exists/i.test(m)) return t('auth_err_exists');
    if (m === 'check_email' || /email not confirmed|confirm your email/i.test(m)) return t('auth_err_check_email');
    if (/invalid login|invalid credentials|invalid grant|login failed/i.test(m)) return t('auth_err_wrong');
    // A password problem is only "too short" when the server says so; otherwise it is a wrong email/password.
    if (/password/i.test(m)) return /at least|too short|characters/i.test(m) ? t('password_too_short') : t('auth_err_wrong');
    if (/email/i.test(m)) return t('enter_valid_email');
    return t('auth_err_generic');
  };
  // A fresh install (no account used on this phone yet) opens on Create account.
  useEffect(() => {
    AsyncStorage.getItem('fern_has_signed_in').then((v) => { if (!v) setMode((m) => (m === 'signin' ? 'signup' : m)); }).catch(() => {});
  }, []);
  const [showApple, setShowApple] = useState(false);
  const showGoogle = !!(googleAvailable && googleAvailable());
  useEffect(() => {
    let alive = true;
    if (appleAvailable) appleAvailable().then((ok) => { if (alive) setShowApple(!!ok && !!AppleAuthentication); }).catch(() => {});
    return () => { alive = false; };
  }, [appleAvailable]);

  async function handleSocial(fn) {
    if (!fn || !begin()) return;
    try {
      const user = await fn();
      if (user) onAuthSuccess(user);
    } catch (e) {
      Alert.alert(t('auth_social_failed'), friendly(e));
    } finally {
      end();
    }
  }

  async function handleSignIn() {
    console.log('🔵 handleSignIn called');
    const em = cleanEmail();
    if (!em || !password) return Alert.alert(t('enter_email_password'));
    if (!validEmail(em)) return Alert.alert(t('enter_valid_email'));
    if (!begin()) return;
    try {
      const user = await signInWithSupabase(em, password);
      console.log('✅ Sign in successful, user:', user);
      console.log('🔄 Calling onAuthSuccess callback...');
      onAuthSuccess(user);
      console.log('✅ onAuthSuccess callback completed');
    } catch (e) {
      console.error('❌ Sign in error:', e);
      Alert.alert(t('sign_in_failed'), friendly(e));
    } finally {
      end();
    }
  }

  async function handleSignUp() {
    const em = cleanEmail();
    const nm = String(name || '').trim().slice(0, 40);
    if (!em || !password || !nm) return Alert.alert(t('fill_all_fields'));
    if (!validEmail(em)) return Alert.alert(t('enter_valid_email'));
    if (password.length < 6) return Alert.alert(t('password_too_short'));
    if (!begin()) return;
    try {
      const user = await signUpWithSupabase(em, password, nm);
      onAuthSuccess(user);
    } catch (e) {
      const m = String(e?.message || '');
      if (m === 'account_exists' || /already registered|already exists/i.test(m)) {
        Alert.alert(t('sign_up_failed'), t('auth_err_exists'), [{ text: t('sign_in'), onPress: () => setMode('signin') }]);
      } else {
        Alert.alert(t('sign_up_failed'), friendly(e));
      }
    } finally {
      end();
    }
  }

  async function handleForgot() {
    const em = cleanEmail();
    if (!validEmail(em)) {
      return Alert.alert(t('enter_valid_email'));
    }
    if (!begin()) return;
    try {
      await forgotPassword(em);
      setResetStatus(t('check_email_for_code'));
      setMode('reset');
    } catch (e) {
      Alert.alert(t('forgot_password_failed'), friendly(e));
    } finally {
      end();
    }
  }

  async function handleReset() {
    const cd = String(code || '').replace(/\s+/g, '');
    if (!cd || !newPassword) return Alert.alert(t('enter_code_new_password'));
    if (!/^\d{4,10}$/.test(cd)) return Alert.alert(t('enter_code_new_password'));
    if (newPassword.length < 6) return Alert.alert(t('password_too_short'));
    if (!begin()) return;
    try {
      const user = await resetPassword({ email: cleanEmail(), code: cd, newPassword });
      onAuthSuccess(user);
    } catch (e) {
      Alert.alert(t('reset_password_failed'), friendly(e));
    } finally {
      end();
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
            {(mode === 'signin' || mode === 'signup') && (
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
            )}

            {(mode === 'signin' || mode === 'signup') && (
              <>
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

                {mode === 'signin' && (
                  <TouchableOpacity onPress={() => setMode('forgot')} style={s.linkWrap}>
                    <Text style={s.link}>{t('forgot_password')}</Text>
                  </TouchableOpacity>
                )}

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

                {(showApple || showGoogle) ? (
                  <>
                    <View style={s.orRow}>
                      <View style={s.orLine} /><Text style={s.orText}>{t('auth_or')}</Text><View style={s.orLine} />
                    </View>
                    {showApple ? (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={12}
                        style={s.appleBtn}
                        onPress={() => handleSocial(signInWithApple)}
                      />
                    ) : null}
                    {showGoogle ? (
                      <TouchableOpacity style={s.googleBtn} onPress={() => handleSocial(signInWithGoogle)} disabled={loading} activeOpacity={0.85}>
                        <Text style={s.googleG}>G</Text>
                        <Text style={s.googleText}>{t('auth_google_btn')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}
              </>
            )}

            {mode === 'forgot' && (
              <>
                <Text style={s.helperText}>{t('enter_email_for_code')}</Text>
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
                <TouchableOpacity style={s.btn} onPress={handleForgot} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>{t('send_code')}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('signin')} style={s.linkWrap}>
                  <Text style={s.link}>{t('back_to_sign_in')}</Text>
                </TouchableOpacity>
              </>
            )}

            {mode === 'reset' && (
              <>
                {!!resetStatus && <Text style={s.helperText}>{resetStatus}</Text>}
                <TextInput
                  style={s.input}
                  placeholder={t('reset_code_placeholder')}
                  placeholderTextColor={C.brown}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={s.input}
                  placeholder={t('new_password_placeholder')}
                  placeholderTextColor={C.brown}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <TouchableOpacity style={s.btn} onPress={handleReset} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnText}>{t('reset_password')}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('signin')} style={s.linkWrap}>
                  <Text style={s.link}>{t('back_to_sign_in')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={s.footer}>{t('always_free')}</Text>
          {mode === 'signup' ? (
          <Text style={s.legal}>
            {t('auth_legal_pre')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://app.clickpickandcook.com/terms.html')}>{t('auth_legal_terms')}</Text>
            {' '}{t('auth_legal_and')}{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://app.clickpickandcook.com/privacy.html')}>{t('auth_legal_privacy')}</Text>.
          </Text>
          ) : null}
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
  tagline: { fontSize: 12, color: C.sage, letterSpacing: 1.5, marginTop: 4, fontFamily: 'Jost-Regular' },
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
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { marginHorizontal: 12, color: C.brown, fontSize: 12, fontFamily: 'Jost-Regular' },
  appleBtn: { height: 48, width: '100%', marginBottom: 10 },
  googleBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  googleG: { fontSize: 20, color: '#4285F4', fontFamily: 'Jost-Bold', marginRight: 10 },
  googleText: { color: C.ink, fontSize: 16, fontFamily: 'Jost-SemiBold' },
  linkWrap: { alignItems: 'center', marginTop: 14 },
  link: { color: C.forest, fontSize: 13, fontFamily: 'Jost-SemiBold', textDecorationLine: 'underline' },
  helperText: { color: C.brown, fontSize: 13, fontFamily: 'Jost-Regular', lineHeight: 18, marginBottom: 12, textAlign: 'center' },
  footer: { textAlign: 'center', color: C.sage, fontSize: 12, marginTop: 24, fontFamily: 'Jost-Regular' },
  legal: { textAlign: 'center', color: C.sage, fontSize: 12, marginTop: 10, lineHeight: 18, fontFamily: 'Jost-Regular' },
  legalLink: { textDecorationLine: 'underline', fontWeight: '700' },
});
