import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { STATIONERY } from '../../constants/stationery';

// The row of paper swatches (Plain + the ten stationery looks). Shared by the Shopping page's top bar and the first-run
// "Pick your paper" screen. `value` is the chosen id ('' / null = plain); `onPick(id)` gets '' for plain.
export default function PaperChips({ t, value, onPick, wrap = false }) {
  const chips = (
    <>
      <TouchableOpacity onPress={() => onPick('')} activeOpacity={0.85} style={[s.chip, !value ? s.chipOn : null]}>
        <View style={[s.swatch, { backgroundColor: '#FDE8E0', borderColor: '#D8607C' }]} />
        <Text style={s.chipText}>{t('stat_plain')}</Text>
      </TouchableOpacity>
      {STATIONERY.map((st) => (
        <TouchableOpacity key={st.id} onPress={() => onPick(st.id)} activeOpacity={0.85} style={[s.chip, value === st.id ? s.chipOn : null]}>
          <View style={[s.swatch, { backgroundColor: st.bg, borderColor: st.accent }]}>
            <Text style={{ fontSize: 12, color: st.accent }}>{st.icon}</Text>
          </View>
          <Text style={s.chipText} numberOfLines={1}>{t(`stat_${st.id}_label`)}</Text>
        </TouchableOpacity>
      ))}
    </>
  );
  if (wrap) return <View style={s.wrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.picker} contentContainerStyle={s.row}>
      {chips}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  picker: { marginBottom: 10 },
  row: { gap: 10, paddingRight: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  chip: { alignItems: 'center', width: 78, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: '#C0475F', backgroundColor: '#FDE8E0' },
  swatch: { width: 48, height: 58, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#5A3236', fontSize: 11, fontFamily: 'Jost-SemiBold', marginTop: 4 },
});
