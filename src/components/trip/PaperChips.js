import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { STATIONERY, stationeryById } from '../../constants/stationery';

// The row of paper swatches (Plain + the ten stationery looks). Shared by the Shopping page's top bar and the first-run
// "Pick your paper" screen. `value` is the chosen id ('' / null = plain); `onPick(id)` gets '' for plain.
// A small sample page in the chosen paper: its title, handwriting, colours and frame, with three sample items.
function PaperPreview({ t, value, name }) {
  const st = stationeryById(value);
  const items = [t('paper_prev_1'), t('paper_prev_2'), t('paper_prev_3')];
  const title = st ? (name ? t(`stat_${st.id}_t`, { name }) : t(`stat_${st.id}_tn`)) : t('shopping_list_title');
  const ink = st ? st.ink : '#2F4535';
  const accent = st ? st.accent : '#4E7A54';
  return (
    <View style={[s.prev, { backgroundColor: st ? st.bg : '#ECF2E6', borderColor: '#C8D6BE', borderWidth: 1 }, st ? st.frame : null]}>
      {st && st.icon ? <Text style={{ textAlign: 'center', fontSize: 18, color: accent }}>{st.icon}</Text> : null}
      <Text style={[s.prevTitle, { color: st ? st.title : '#3F5645' }, st ? { fontFamily: st.font } : { fontFamily: 'Jost-Bold' }]} numberOfLines={2}>{title}</Text>
      {st ? <Text style={[s.prevSub, { color: st.sub }]}>{t(`stat_${st.id}_s`).toUpperCase()}</Text> : null}
      <View style={[s.prevRule, { backgroundColor: accent }]} />
      {items.map((it, i) => (
        <View key={i} style={s.prevRow}>
          <View style={[s.prevDot, { borderColor: accent }, i === 1 ? { backgroundColor: accent } : null]} />
          <Text style={[s.prevItem, { color: ink }, st ? { fontFamily: st.font } : { fontFamily: 'Jost-Medium' }, i === 1 ? { textDecorationLine: 'line-through', opacity: 0.6 } : null]}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PaperChips({ t, value, onPick, wrap = false, name = '' }) {
  const chips = (
    <>
      <TouchableOpacity onPress={() => onPick('')} activeOpacity={0.85} style={[s.chip, !value ? s.chipOn : null]}>
        <View style={[s.swatch, { backgroundColor: '#ECF2E6', borderColor: '#4E7A54' }]} />
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
  const preview = <PaperPreview t={t} value={value} name={name} />;
  if (wrap) return <View style={{ alignSelf: 'stretch' }}><View style={s.wrap}>{chips}</View>{preview}</View>;
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.picker} contentContainerStyle={s.row}>
        {chips}
      </ScrollView>
      {preview}
    </View>
  );
}

const s = StyleSheet.create({
  prev: { borderRadius: 8, padding: 16, marginTop: 8, marginBottom: 12 },
  prevTitle: { fontSize: 26, lineHeight: 32, textAlign: 'center' },
  prevSub: { fontSize: 11, letterSpacing: 2, textAlign: 'center', marginTop: 2, fontFamily: 'Jost-SemiBold' },
  prevRule: { height: 2, width: 90, alignSelf: 'center', marginVertical: 10, borderRadius: 1 },
  prevRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  prevDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginRight: 12 },
  prevItem: { fontSize: 20 },
  picker: { marginBottom: 10 },
  row: { gap: 10, paddingRight: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  chip: { alignItems: 'center', width: 78, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  chipOn: { borderColor: '#3F6845', backgroundColor: '#ECF2E6' },
  swatch: { width: 48, height: 58, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#2F4535', fontSize: 11, fontFamily: 'Jost-SemiBold', marginTop: 4 },
});
