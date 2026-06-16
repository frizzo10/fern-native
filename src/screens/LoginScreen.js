import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    try {
      await onLogin(email, password);
    } catch (e) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoLeaf}>🌿</Text>
          <Text style={styles.logoWord}>fern</Text>
          <Text style={styles.logoSub}>Weekly ad to dinner table</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, shadow.strong]}>
          <Text style={styles.cardTitle}>Sign in</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.brown}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.brown}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign in to Fern</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Use the same account as app.clickpickandcook.com</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex:1, backgroundColor:colors.forest },
  inner:       { flex:1, justifyContent:'center', paddingHorizontal:24 },
  logoWrap:    { alignItems:'center', marginBottom:32 },
  logoLeaf:    { fontSize:48, marginBottom:4 },
  logoWord:    { fontSize:42, fontWeight:'800', color:colors.onFern, fontFamily:'serif', fontStyle:'italic' },
  logoSub:     { fontSize:13, color:colors.muted, marginTop:4, letterSpacing:0.3 },
  card:        { backgroundColor:colors.parch, borderRadius:radius.xl, padding:24 },
  cardTitle:   { fontSize:22, fontWeight:'800', color:colors.ink, fontFamily:'serif', marginBottom:20 },
  label:       { fontSize:11, fontWeight:'800', color:colors.brown, textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 },
  input:       { backgroundColor:'#fff', borderWidth:1, borderColor:colors.border, borderRadius:radius.sm, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:colors.ink, marginBottom:16 },
  error:       { color:colors.voiceRed, fontSize:13, marginBottom:12, fontWeight:'600' },
  btn:         { backgroundColor:colors.orange, borderRadius:radius.md, paddingVertical:14, alignItems:'center', marginTop:4 },
  btnDisabled: { opacity:0.6 },
  btnText:     { color:'#fff', fontSize:16, fontWeight:'800' },
  footer:      { textAlign:'center', color:colors.muted, fontSize:12, marginTop:24, lineHeight:18 },
});
