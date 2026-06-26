import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/tokens';
import { useSync } from '../hooks/useSync';

export default function FamilyScreen({ user }) {
  const { pull } = useSync(user);

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.text}>🛒 Family List</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, fontWeight: '800', color: colors.ink, fontFamily: 'serif' },
  sub: { fontSize: 14, color: colors.brown, marginTop: 6 },
});
