import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import useLanguage from '../hooks/useLanguage';

const QUICK_ADD_ITEMS = ['Milk', 'Eggs', 'Bread', 'Bananas', 'Butter', 'Pasta'];
const FERN_STARTER_ITEMS = ['Olive oil', 'Garlic', 'Onion', 'Chicken', 'Rice'];

function pickName(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const value = item.name || item.title || item.text || item.item || item.ingredient || item.value || '';
  return String(value).trim();
}

function toUiItems(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, idx) => {
      const text = pickName(item);
      if (!text) return null;
      return {
        id: String(item?.id || item?.uuid || `${text.toLowerCase()}-${idx}`),
        text,
        recipe: String(item?.recipe || item?.recipe_name || item?.sourceRecipe || 'Manual Add').trim(),
        checked: item?.checked === true,
      };
    })
    .filter(Boolean);
}

function toSyncPayload(list) {
  return list.map((item) => ({
    id: item.id,
    text: String(item.text || '').trim(),
    recipe: String(item.recipe || 'Manual Add').trim(),
    checked: Boolean(item.checked),
  }));
}

export default function ShoppingScreen({ user }) {
  const { t } = useLanguage();
  const { data, pull, pushChangedFromStorage } = useSync(user);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  useEffect(() => {
    setItems(toUiItems(data.shopping));
  }, [data.shopping]);

  const remainingCount = useMemo(() => items.filter((item) => !item.checked).length, [items]);
  const recipeSections = useMemo(() => {
    const byRecipe = new Map();
    items.forEach((item) => {
      const recipe = String(item.recipe || 'Manual Add').trim() || 'Manual Add';
      if (!byRecipe.has(recipe)) byRecipe.set(recipe, []);
      byRecipe.get(recipe).push(item);
    });

    return Array.from(byRecipe.entries()).map(([recipe, sectionItems]) => ({
      recipe,
      items: sectionItems,
      total: sectionItems.length,
      checkedCount: sectionItems.filter((item) => item.checked).length,
    }));
  }, [items]);

  const persistShopping = async (nextItems) => {
    const canonical = toSyncPayload(nextItems);
    setItems(canonical);
    setSaving(true);
    try {
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(canonical));

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
        ...cache,
        shopping: canonical,
      }));

      const response = await pushChangedFromStorage({ shopping: canonical });
      console.log('[shopping] pushed shopping payload', canonical);
      console.log('[shopping] latest sync response', response);
    } catch (e) {
      console.warn('Save shopping list failed:', e);
      Alert.alert(t('save_error_title'), t('save_error_desc'));
    } finally {
      setSaving(false);
    }
  };

  const addItem = async (rawValue) => {
    const text = String(rawValue || '').trim();
    if (!text) return;

    const exists = items.some((item) => item.text.toLowerCase() === text.toLowerCase());
    if (exists) {
      Alert.alert(t('quick_item_exists'), t('quick_item_exists_desc'));
      return;
    }

    const nextItems = [
      ...items,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        recipe: 'Manual Add',
        checked: false,
      },
    ];
    setDraft('');
    await persistShopping(nextItems);
  };

  const toggleItem = async (id) => {
    const nextItems = items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
    await persistShopping(nextItems);
  };

  const removeItem = async (id) => {
    const nextItems = items.filter((item) => item.id !== id);
    await persistShopping(nextItems);
  };

  const buildWithFern = async () => {
    const existing = new Set(items.map((item) => item.text.toLowerCase()));
    const additions = FERN_STARTER_ITEMS
      .filter((name) => !existing.has(name.toLowerCase()))
      .map((name, idx) => ({
        id: `fern-${Date.now()}-${idx}`,
        text: name,
        recipe: 'Fern Starter',
        checked: false,
      }));

    if (!additions.length) {
      Alert.alert(t('fern_starter_stocked'), t('fern_starter_stocked_desc'));
      return;
    }

    await persistShopping([...items, ...additions]);
  };

  const shareList = async () => {
    const lines = items.map((item) => {
      const recipeSuffix = item.recipe ? ` (${item.recipe})` : '';
      return `${item.checked ? '✓' : '•'} ${item.text}${recipeSuffix}`;
    });
    const message = lines.length ? `${t('share_list_header')}\n\n${lines.join('\n')}` : t('share_list_empty');
    try {
      await Share.share({ message });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('shopping_screen_title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.86} onPress={shareList}>
              <Text style={styles.shareBtnText}>{t('share_button')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clipBtn} activeOpacity={0.86}>
              <Text style={styles.clipBtnText}>📋</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.voiceCard, shadow.card]} activeOpacity={0.92}>
          <View style={styles.voiceIconWrap}>
            <Text style={styles.voiceIcon}>🎙</Text>
          </View>
          <View style={styles.voiceTextWrap}>
            <Text style={styles.voiceTitle}>{t('voice_card_title')}</Text>
            <Text style={styles.voiceSub}>{t('voice_card_sub')}</Text>
          </View>
          <Text style={styles.voiceTap}>{t('voice_card_tap')}</Text>
        </TouchableOpacity>

        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('type_item_placeholder')}
            placeholderTextColor="#AAA39A"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => addItem(draft)}
          />
          <TouchableOpacity
            style={[styles.addBtn, saving ? styles.addBtnDisabled : null]}
            activeOpacity={0.88}
            onPress={() => addItem(draft)}
            disabled={saving}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.quickLabel}>{t('quick_add_title')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_ADD_ITEMS.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.quickChip}
              activeOpacity={0.85}
              onPress={() => addItem(item)}
            >
              <Text style={styles.quickChipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {items.length ? (
          <View style={styles.listWrap}>
            <Text style={styles.listMeta}>
              {remainingCount === 1
                ? t('items_remaining_singular', { count: remainingCount })
                : t('items_remaining_plural', { count: remainingCount })}
            </Text>
            {recipeSections.map((section) => (
              <View key={section.recipe} style={styles.recipeSectionWrap}>
                <View style={styles.recipeSectionHeader}>
                  <Text style={styles.recipeSectionTitle}>{section.recipe.toUpperCase()}</Text>
                  <Text style={[styles.recipeSectionCount, section.checkedCount === section.total ? styles.recipeSectionCountDone : null]}>
                    {section.checkedCount}/{section.total}
                  </Text>
                </View>

                {section.items.map((item) => (
                  <View key={item.id} style={styles.listRow}>
                    <TouchableOpacity
                      style={[styles.checkBtn, item.checked ? styles.checkBtnOn : null]}
                      onPress={() => toggleItem(item.id)}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.checkBtnText}>{item.checked ? '✓' : ''}</Text>
                    </TouchableOpacity>
                    <View style={styles.listTextWrap}>
                      <Text style={[styles.listText, item.checked ? styles.listTextDone : null]}>{item.text}</Text>
                      <Text style={styles.listRecipeLabel}>{section.recipe}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.75} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyLeaf}>🌿</Text>
            <Text style={styles.emptyTitle}>{t('shopping_empty_title')}</Text>
            <Text style={styles.emptySub}>
              {t('shopping_empty_sub')}
            </Text>

            <TouchableOpacity style={[styles.fernBtn, shadow.strong]} activeOpacity={0.9} onPress={buildWithFern}>
              <Text style={styles.fernBtnText}>{t('build_list_fern')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1ED',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#2D1B10',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'Playfair-Bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareBtn: {
    backgroundColor: colors.forest,
    borderRadius: radius.full,
    height: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#F4F0EA',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Jost-Bold',
  },
  clipBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7B79D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1ECE3',
  },
  clipBtnText: {
    fontSize: 12,
  },
  voiceCard: {
    backgroundColor: colors.forest,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 6,
  },
  voiceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIcon: {
    fontSize: 20,
  },
  voiceTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  voiceTitle: {
    color: '#F3EEE4',
    fontSize: 14,
    lineHeight: 16,
    fontFamily: 'Jost-Bold',
  },
  voiceSub: {
    color: '#8FB18A',
    fontSize: 12,
    lineHeight: 14,
    marginTop: 2,
    fontFamily: 'Jost-Regular',
  },
  voiceTap: {
    color: '#7EA27C',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Jost-Bold',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  input: {
    flex: 1,
    height: 45,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D2C2AA',
    backgroundColor: '#F8F4EC',
    paddingHorizontal: 14,
    color: '#3B2B1D',
    fontSize: 14,
    fontFamily: 'Jost-SemiBold',
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFF6EE',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Jost-Bold',
  },
  quickLabel: {
    marginTop: 18,
    color: colors.brown,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.2,
    fontFamily: 'Jost-Bold',
  },
  quickRow: {
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  quickChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#D3C4AD',
    backgroundColor: '#F8F4EC',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: {
    color: '#6C5238',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Jost-SemiBold',
  },
  listWrap: {
    marginTop: 14,
    paddingVertical: 4,
  },
  listMeta: {
    color: '#7A5C3A',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Jost-SemiBold',
    marginBottom: 8,
  },
  recipeSectionWrap: {
    marginBottom: 14,
  },
  recipeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  recipeSectionTitle: {
    color: colors.bright,
    fontSize: 10,
    paddingTop: 10,
    lineHeight: 12,
    letterSpacing: 2,
    flexShrink: 1,
    fontFamily: 'Jost-Bold'
  },
  recipeSectionCount: {
    color: '#7A5C3A',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Jost-Bold',
  },
  recipeSectionCountDone: {
    color: '#93BE8D',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F6F3EE',
    borderTopWidth: 1,
    borderTopColor: '#DFD3C0',
    borderBottomWidth: 1,
    borderBottomColor: '#DFD3C0',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#CAB89D',
    backgroundColor: '#FFF8EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkBtnOn: {
    backgroundColor: '#2A6A2A',
    borderColor: '#2A6A2A',
  },
  checkBtnText: {
    color: '#F7F5F0',
    fontSize: 22,
    lineHeight: 24,
    fontFamily: 'Jost-Bold',
  },
  listTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  listText: {
    color: '#2B1E13',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Jost-Regular',
  },
  listRecipeLabel: {
    color: '#7A5C3A',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Jost-Regular',
    marginTop: 2,
  },
  listTextDone: {
    color: '#988571',
    textDecorationLine: 'line-through',
  },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#B59E86',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Jost-Bold',
  },
  emptyWrap: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  emptyLeaf: {
    fontSize: 38,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#2E1D12',
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    fontFamily: 'Playfair-Bold',
  },
  emptySub: {
    marginTop: 10,
    color: '#7A5C3A',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Jost-Regular',
    maxWidth: 330,
  },
  fernBtn: {
    marginTop: 28,
    borderRadius: 22,
    backgroundColor: colors.forest,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  fernBtnText: {
    color: '#E8DFC6',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Jost-Bold',
  },
});
