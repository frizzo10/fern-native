import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import { useTranslation } from '../i18n/LocaleContext';

// Shopping items may arrive as plain strings (e.g. pushed from RecipesScreen,
// or from the web client / grocery-list backend functions, which all treat
// "string OR {name}" as interchangeable — see kroger-list.js / albertsons-list.js).
// Normalize everything to {name, checked} for display and going forward,
// which stays backward compatible since every consumer already falls back
// to `item.name || item`.
function normalize(items) {
  return (items || []).map(item =>
    typeof item === 'string' ? { name: item, checked: false } : { checked: false, ...item }
  );
}

function ShoppingRow({ item, onToggle }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
        {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={[styles.rowText, item.checked && styles.rowTextChecked]} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function ShoppingScreen({ user }) {
  const { t } = useTranslation();
  const { data, push } = useSync(user);
  const [newItem, setNewItem] = useState('');

  const items = useMemo(() => normalize(data.shopping), [data.shopping]);
  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  const save = useCallback((next) => push({ shopping: next }), [push]);

  const toggleItem = useCallback((target) => {
    const next = items.map(i => (i === target ? { ...i, checked: !i.checked } : i));
    save(next);
  }, [items, save]);

  const addItem = useCallback(() => {
    const name = newItem.trim();
    if (!name) return;
    save([...items, { name, checked: false }]);
    setNewItem('');
  }, [newItem, items, save]);

  const clearChecked = useCallback(() => {
    save(items.filter(i => !i.checked));
  }, [items, save]);

  const clearAll = useCallback(() => {
    Alert.alert(
      t('shoppingClearAllConfirmTitle'),
      '',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('shoppingClearAll'), style: 'destructive', onPress: () => save([]) },
      ]
    );
  }, [save, t]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      {items.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.stateTitle}>{t('shoppingEmptyTitle')}</Text>
          <Text style={styles.stateText}>{t('shoppingEmptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {unchecked.map((item, i) => (
            <ShoppingRow key={`u${i}`} item={item} onToggle={() => toggleItem(item)} />
          ))}

          {checked.length > 0 && (
            <>
              <View style={styles.divider} />
              {checked.map((item, i) => (
                <ShoppingRow key={`c${i}`} item={item} onToggle={() => toggleItem(item)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {items.length > 0 && (
        <View style={styles.actionRow}>
          {checked.length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={clearChecked}>
              <Text style={styles.actionBtnText}>{t('shoppingClearChecked')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>{t('shoppingClearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.addRow, shadow.card]}>
        <TextInput
          style={styles.addInput}
          value={newItem}
          onChangeText={setNewItem}
          placeholder={t('shoppingAddPlaceholder')}
          placeholderTextColor={colors.brown}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addItem} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  stateTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 6 },
  stateText: { fontSize: 14, color: colors.brown, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper,
  },
  checkboxChecked: { backgroundColor: colors.bright, borderColor: colors.bright },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  rowText: { flex: 1, fontSize: 15, color: colors.ink },
  rowTextChecked: { color: colors.muted, textDecorationLine: 'line-through' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },

  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 8 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: colors.bright },
  actionBtnTextDanger: { color: colors.voiceRed },

  addRow: {
    flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.parch,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  addInput: {
    flex: 1, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: colors.ink,
  },
  addBtn: {
    width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 24, color: '#fff', fontWeight: '600', marginTop: -2 },
});
