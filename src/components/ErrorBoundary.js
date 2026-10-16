import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Instead of the app silently closing on a screen error, show what went wrong (so it can be fixed) and offer "Try again".
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      const text = `${new Date().toISOString()}\n${String(error?.message || error)}\n${String(error?.stack || '').split('\n').slice(0, 8).join('\n')}\n${String(info?.componentStack || '').split('\n').slice(0, 8).join('\n')}`;
      AsyncStorage.setItem('fern_last_crash', text).catch(() => {});
    } catch (e) { /* best effort */ }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#FFF8EE', paddingTop: 70, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#2D1B10' }}>Fern hit a problem</Text>
        <Text style={{ marginTop: 8, color: '#7a6d60' }}>Please tell Frank what this says:</Text>
        <ScrollView style={{ marginTop: 12, maxHeight: 360 }}>
          <Text selectable style={{ color: '#B3261E', fontSize: 13 }}>
            {String(error?.message || error)}
            {'\n\n'}
            {String(error?.stack || '').split('\n').slice(0, 10).join('\n')}
          </Text>
        </ScrollView>
        <TouchableOpacity
          onPress={() => this.setState({ error: null })}
          activeOpacity={0.85}
          style={{ marginTop: 20, backgroundColor: '#E8742A', borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
