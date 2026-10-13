import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import { EVERYDAY_CHIPS, dueStaples, loadHistory, stapleKey } from '../../utils/staples';

// "Anything you need that isn't a recipe?" — the non-recipe half of the list: your regular restock items
// (learned from what you tick off) and common household things, each one tap to add.
export default function EverydayCard({ t, items, onAdd, highlight }) {
  const [history, setHistory] = useState({});
  useEffect(() => { loadHistory().then(setHistory); }, [items.length]);

  const onList = useMemo(() => new Set(items.map((i) => stapleKey(i.text))), [items]);
  const due = useMemo(() => dueStaples(history, items.map((i) => i.text)), [history, items]);
  const dueKeys = new Set(due.map((d) => d.key));
  const chips = EVERYDAY_CHIPS.filter((c) => !onList.has(stapleKey(c.text)) && !dueKeys.has(stapleKey(c.text)));

  return (
    <View style={[styles.card, highlight ? styles.cardHi : null]}>
      <Text style={styles.title}>{`🧻 ${t('everyday_title')}`}</Text>
      <Text style={styles.sub}>{t('everyday_sub')}</Text>

      {due.length ? (
        <>
          <Text style={styles.label}>{t('everyday_due')}</Text>
          <View style={styles.wrap}>
            {due.map((d) => (
              <TouchableOpacity key={d.key} style={[styles.chip, styles.chipDue]} activeOpacity={0.85} onPress={() => onAdd(d.text)}>
                <Text style={styles.chipDueText}>{`+ ${d.text}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {chips.length ? (
        <View style={[styles.wrap, { marginTop: 10 }]}>
          {chips.map((c) => (
            <TouchableOpacity key={c.text} style={styles.chip} activeOpacity={0.85} onPress={() => onAdd(c.text)}>
              <Text style={styles.chipText}>{`${c.emoji} ${c.text}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E4DCD2' },
  cardHi: { borderColor: colors.orange, borderWidth: 2 },
  title: { fontSize: 16, fontWeight: '800', color: '#2D1B10' },
  sub: { fontSize: 13, color: '#7a6d60', marginTop: 3, lineHeight: 18 },
  label: { fontSize: 11, letterSpacing: 1, fontWeight: '800', color: colors.orange, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F4F1ED', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '600', color: '#2D1B10' },
  chipDue: { backgroundColor: colors.orange },
  chipDueText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dayLink: { fontSize: 13, fontWeight: '700', color: colors.forest },
  dayChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F4F1ED' },
  dayChipOn: { backgroundColor: colors.forest },
  dayChipText: { fontSize: 14, fontWeight: '700', color: '#2D1B10' },
});
