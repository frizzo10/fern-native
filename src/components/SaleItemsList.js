import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../constants/tokens';
import { dealSaving, fmtMoney } from '../utils/savings';

// Every item read off the flyer, grouped by aisle, with a one-tap "add to my list".
// Shared by the Personal Shopper scan check and the Shopping tab.
//   deals     [{ name, salePrice, originalPrice, category, isBogo, store, emoji }]
//   isOnList  (deal) => boolean   already on the shopping list / queued for it
//   onAdd     (deal) => void
export default function SaleItemsList({ deals, isOnList, onAdd, t }) {
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState({});

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    (Array.isArray(deals) ? deals : []).forEach((deal, i) => {
      const name = String(deal?.name || '').trim();
      if (!name) return;
      if (q && !name.toLowerCase().includes(q) && !String(deal?.category || '').toLowerCase().includes(q)) return;
      const cat = String(deal?.category || '').trim() || t('sale_list_other');
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ deal, key: `${name}-${deal?.store || ''}-${i}` });
    });
    // Biggest savers first inside each aisle.
    map.forEach((rows) => rows.sort((a, b) => dealSaving(b.deal).amount - dealSaving(a.deal).amount));
    return Array.from(map.entries());
  }, [deals, query, t]);

  return (
    <View>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('sale_list_search')}
        placeholderTextColor="#9a8f84"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {!groups.length ? <Text style={styles.empty}>{t('sale_list_none')}</Text> : null}
      {groups.map(([cat, rows]) => (
        <View key={cat} style={styles.group}>
          <Text style={styles.groupLabel}>{cat}</Text>
          {rows.map(({ deal, key }) => {
            const done = Boolean(added[key]) || Boolean(isOnList?.(deal));
            const saving = dealSaving(deal);
            const price = deal.isBogo ? 'BOGO' : deal.salePrice;
            return (
              <View key={key} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={2}>{`${deal.emoji ? `${deal.emoji} ` : ''}${deal.name}`}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[price, deal.originalPrice ? t('sale_list_was', { price: deal.originalPrice }) : '', deal.store].filter(Boolean).join(' · ')}
                  </Text>
                  {saving.amount > 0 ? <Text style={styles.save}>{t('psp_save_amt', { amt: `${saving.est ? '~' : ''}${fmtMoney(saving.amount)}` })}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.btn, done ? styles.btnOn : null]}
                  activeOpacity={0.85}
                  disabled={done}
                  onPress={() => {
                    setAdded((prev) => ({ ...prev, [key]: true }));
                    onAdd?.(deal);
                  }}
                >
                  <Text style={[styles.btnText, done ? styles.btnTextOn : null]}>{done ? t('sale_list_on_list') : t('sale_list_add')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E4DCD2',
    borderRadius: radius?.md || 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2D1B10',
    marginBottom: 6,
  },
  empty: { color: '#7a6d60', fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  group: { marginTop: 8 },
  groupLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#7a6d60', fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCD2', gap: 10 },
  rowText: { flex: 1 },
  name: { fontSize: 14, color: '#2D1B10', fontWeight: '600' },
  sub: { fontSize: 12, color: '#7a6d60', marginTop: 1 },
  save: { fontSize: 12, color: '#2F7D4F', fontWeight: '700', marginTop: 1 },
  btn: { backgroundColor: colors?.orange || '#E8742A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  btnOn: { backgroundColor: '#E6F1EA' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnTextOn: { color: '#2F7D4F' },
});
