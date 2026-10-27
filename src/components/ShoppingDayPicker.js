import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/tokens';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "Which day do you usually shop?" — seven chips. day is 0-6 (0 = Sunday) or null.
export default function ShoppingDayPicker({ t, day, onPick }) {
  return (
    <View style={styles.row}>
      {DAY_KEYS.map((k, i) => (
        <TouchableOpacity key={k} style={[styles.chip, day === i ? styles.chipOn : null]} activeOpacity={0.85} onPress={() => onPick(i)}>
          <Text style={[styles.chipText, day === i ? { color: '#fff' } : null]}>{t(`day_${k}`)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: '#F1EEE8', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  chipOn: { backgroundColor: '#4E7A54' },
  chipText: { fontSize: 15, fontWeight: '800', color: '#2F4535' },
});
