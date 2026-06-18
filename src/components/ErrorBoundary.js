import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { logCrash } from '../lib/crashLogger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });

    // Log to Supabase
    logCrash({
      error,
      stack:  info.componentStack,
      screen: this.props.screen || 'unknown',
      userId: this.props.userId || null,
    });
  }

  handleReload() {
    this.setState({ hasError: false, error: null, info: null });
  }

  handleReport() {
    Alert.alert('Error Details', this.state.error?.message || 'Unknown error', [{ text: 'OK' }]);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || '';
    const isNetworkError = /network|fetch|connection/i.test(msg);
    const isMicError     = /record|audio|mic/i.test(msg);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.logo}>🌿</Text>
          <Text style={styles.logoWord}>fern</Text>

          <View style={[styles.card, shadow.strong]}>
            <Text style={styles.emoji}>
              {isNetworkError ? '📡' : isMicError ? '🎙' : '⚠️'}
            </Text>
            <Text style={styles.title}>
              {isNetworkError ? 'Connection Problem'
                : isMicError  ? 'Microphone Issue'
                : 'Something went wrong'}
            </Text>
            <Text style={styles.subtitle}>
              {isNetworkError
                ? 'Check your internet connection and try again.'
                : isMicError
                ? 'Fern had trouble with the microphone. Tap below to try again.'
                : 'Fern ran into an unexpected problem. This has been noted.'}
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => this.handleReload()} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>↻  Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => this.handleReport()} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>View Error Details</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.help}>
            If this keeps happening, close and reopen the app.{'\n'}
            Your data is safe — nothing was lost.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container:       { flex:1, backgroundColor:colors.forest },
  inner:           { flexGrow:1, alignItems:'center', justifyContent:'center', padding:24 },
  logo:            { fontSize:52, marginBottom:4 },
  logoWord:        { fontSize:38, fontWeight:'800', color:colors.onFern,
                     fontFamily:'serif', fontStyle:'italic', marginBottom:32 },
  card:            { width:'100%', backgroundColor:colors.parch,
                     borderRadius:radius.xl, padding:28, alignItems:'center' },
  emoji:           { fontSize:48, marginBottom:12 },
  title:           { fontSize:22, fontWeight:'800', color:colors.ink,
                     fontFamily:'serif', textAlign:'center', marginBottom:8 },
  subtitle:        { fontSize:14, color:colors.brown, textAlign:'center',
                     lineHeight:22, marginBottom:24 },
  primaryBtn:      { width:'100%', backgroundColor:colors.orange,
                     borderRadius:radius.md, paddingVertical:14,
                     alignItems:'center', marginBottom:10 },
  primaryBtnText:  { color:'#fff', fontSize:16, fontWeight:'800' },
  secondaryBtn:    { width:'100%', borderWidth:1, borderColor:colors.border,
                     borderRadius:radius.md, paddingVertical:12, alignItems:'center' },
  secondaryBtnText:{ color:colors.brown, fontSize:14, fontWeight:'600' },
  help:            { marginTop:24, fontSize:12, color:colors.muted,
                     textAlign:'center', lineHeight:18 },
});

export default ErrorBoundary;
