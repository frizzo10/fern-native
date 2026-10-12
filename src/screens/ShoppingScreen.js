import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { useTour } from '../services/TourContext';
import { sendListToInstacart, sendListToKroger, sendListToAlbertsons } from '../services/storeShoppingListService';
import StoreRemainingItemsModal from '../components/modals/StoreRemainingItemsModal';
import { fetchAllCoupons } from '../services/couponsService';
import { normalizeCoupons } from '../utils/couponNormalize';
import {
  dealSaving,
  fmtMoney,
  loadLedger,
  loadWeekDeals,
  matchListItems,
  summarizeLedger,
  syncCircularSavings,
  updateLedger,
  weekKeyFor,
  weekLabel,
} from '../utils/savings';

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
  const { maybeAutoStart, tourKey: activeTourKey, stepIndex: activeTourStepIndex } = useTour();
  const { data, pull, pushChangedFromStorage } = useSync(user);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingToStore, setSendingToStore] = useState(null);
  const [remainingItemsModal, setRemainingItemsModal] = useState(null);
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const [weekDeals, setWeekDeals] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [ledger, setLedger] = useState({});
  const [doneShopping, setDoneShopping] = useState(false);

  useEffect(() => {
    maybeAutoStart('shopping');
  }, []);

  // "shopping" tour step -> scroll target: step 1 is the list itself (top),
  // step 2 is the manual add row, step 3 (clear/check off) is back on the
  // list where checked items live.
  useEffect(() => {
    if (activeTourKey !== 'shopping') return;
    const target = ['top', 'addRow', 'top'][activeTourStepIndex] || 'top';
    const y = target === 'top' ? 0 : (sectionY.current[target] ?? 0);
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [activeTourKey, activeTourStepIndex]);

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  useEffect(() => {
    setItems(toUiItems(data.shopping));
  }, [data.shopping]);

  // This week's flyer deals, the live coupon catalog and the savings ledger (all best effort).
  useFocusEffect(
    useMemo(() => () => {
      loadWeekDeals().then(setWeekDeals);
      loadLedger().then(setLedger);
      fetchAllCoupons().then((list) => setCatalog(normalizeCoupons(list))).catch(() => {});
    }, [])
  );

  // Wallet coupons first, then the catalog (minus anything already in the wallet and expired ones).
  const coupons = useMemo(() => {
    const now = Date.now();
    const wallet = normalizeCoupons(data.walletCoupons).map((c) => ({ ...c, inWallet: true }));
    const ids = new Set(wallet.map((c) => c.id));
    const live = (c) => { const ts = Date.parse(c.expiresAt); return !ts || ts > now; };
    return [...wallet, ...catalog.filter((c) => !ids.has(c.id))].filter(live);
  }, [data.walletCoupons, catalog]);

  const matches = useMemo(() => matchListItems(items, weekDeals, coupons), [items, weekDeals, coupons]);

  // Ticked-off sale items turn into circular savings (unticking takes them back out).
  useEffect(() => {
    if (!items.length) return;
    syncCircularSavings(items, matches).then(setLedger);
  }, [items, matches]);

  const savings = useMemo(() => summarizeLedger(ledger), [ledger]);
  const thisWeekKey = weekKeyFor();
  const usedIds = useMemo(() => new Set(Object.keys(ledger[thisWeekKey] || {})), [ledger, thisWeekKey]);

  // Coupons that fit things already in the cart.
  const checkoutCoupons = useMemo(() => {
    const seen = new Set();
    const out = [];
    items.filter((i) => i.checked).forEach((item) => {
      (matches[item.id]?.coupons || []).forEach((m) => {
        if (seen.has(m.coupon.id)) return;
        seen.add(m.coupon.id);
        out.push({ ...m, itemText: item.text, itemId: item.id });
      });
    });
    return out;
  }, [items, matches]);

  const checkedCount = items.filter((i) => i.checked).length;
  const showCheckout = items.length > 0 && checkedCount > 0 && (doneShopping || checkedCount === items.length);

  const toggleCouponUsed = async (m) => {
    const id = `k:${m.coupon.id}`;
    if (usedIds.has(id)) {
      setLedger(await updateLedger({ remove: [id] }));
    } else {
      setLedger(await updateLedger({ upsert: [{ id, type: 'coupon', label: m.coupon.title || m.itemText, amount: m.value.amount, est: false, store: m.coupon.store }] }));
    }
  };

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

  // Instacart takes the whole list at once. Kroger/Albertsons only support a
  // single-item search deep link — that opens for the first item, and
  // whatever's left comes back as `remainingItems` for the copy/paste modal.
  const handleSendToStore = async (storeKey) => {
    const listItems = items.map((item) => item.text).filter(Boolean);
    if (!listItems.length) {
      Alert.alert(t('store_list_empty'));
      return;
    }

    setSendingToStore(storeKey);
    try {
      if (storeKey === 'instacart') {
        const { url } = await sendListToInstacart({ items: listItems, title: t('share_list_header') });
        if (url) Linking.openURL(url);
      } else if (storeKey === 'kroger') {
        const { url, remainingItems } = await sendListToKroger({ items: listItems, title: t('share_list_header') });
        if (url) Linking.openURL(url);
        if (remainingItems.length) setRemainingItemsModal({ storeName: t('kroger_btn_label'), items: remainingItems });
      } else if (storeKey === 'safeway') {
        const { url, remainingItems } = await sendListToAlbertsons({ items: listItems, title: t('share_list_header') });
        if (url) Linking.openURL(url);
        if (remainingItems.length) setRemainingItemsModal({ storeName: t('safeway_btn_label'), items: remainingItems });
      }
    } catch (e) {
      console.log(`[shopping] send to ${storeKey} failed`, e?.message || e);
      Alert.alert(t('store_list_send_failed_title'), t('store_list_send_failed_desc'));
    } finally {
      setSendingToStore(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <Text style={styles.sendToStoreLabel}>{t('send_to_store_label')}</Text>
        <View style={styles.storeRow}>
          <TouchableOpacity
            style={[styles.storeBtn, styles.instacartBtn]}
            activeOpacity={0.88}
            onPress={() => handleSendToStore('instacart')}
            disabled={Boolean(sendingToStore)}
          >
            {sendingToStore === 'instacart' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.storeBtnText}>{`🥕 ${t('instacart_btn_label')}`}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.storeBtn, styles.krogerBtn]}
            activeOpacity={0.88}
            onPress={() => handleSendToStore('kroger')}
            disabled={Boolean(sendingToStore)}
          >
            {sendingToStore === 'kroger' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.storeBtnText}>{`🛒 ${t('kroger_btn_label')}`}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.storeBtn, styles.safewayBtn]}
            activeOpacity={0.88}
            onPress={() => handleSendToStore('safeway')}
            disabled={Boolean(sendingToStore)}
          >
            {sendingToStore === 'safeway' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.storeBtnText}>{t('safeway_btn_label')}</Text>
            )}
          </TouchableOpacity>
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

        <View style={styles.addRow} onLayout={(e) => { sectionY.current.addRow = e.nativeEvent.layout.y; }}>
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

        {showCheckout ? (
          <View style={[styles.checkoutCard, shadow.card]}>
            <View style={styles.checkoutHead}>
              <Text style={styles.checkoutTitle}>{`🎟 ${t('sav_checkout_title')}`}</Text>
              <TouchableOpacity onPress={() => setDoneShopping(false)} activeOpacity={0.8}>
                <Text style={styles.checkoutHide}>{t('sav_hide')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.checkoutSub}>
              {checkoutCoupons.length ? t('sav_checkout_sub', { n: checkoutCoupons.length }) : t('sav_checkout_none')}
            </Text>
            {checkoutCoupons.map((m) => {
              const used = usedIds.has(`k:${m.coupon.id}`);
              const c = m.coupon;
              return (
                <View key={c.id} style={styles.couponRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponTitle} numberOfLines={2}>{c.title || c.discountLabel}</Text>
                    <Text style={styles.couponMeta}>
                      {[c.discountLabel, c.store, t('sav_for_item', { item: m.itemText })].filter(Boolean).join(' · ')}
                    </Text>
                    {m.level === 'possible' ? <Text style={styles.couponPossible}>{t('sav_possible')}</Text> : null}
                    {c.redemption === 'code' && c.realCode ? (
                      <Text style={styles.couponCode}>{t('sav_use_code', { code: c.realCode })}</Text>
                    ) : null}
                    {c.redemption === 'link' && c.url ? (
                      <TouchableOpacity onPress={() => Linking.openURL(c.url)} activeOpacity={0.8}>
                        <Text style={styles.couponLink}>{t('sav_open_link')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {c.redemption !== 'code' && c.redemption !== 'link' ? (
                      <Text style={styles.couponMeta}>{t('sav_digital')}</Text>
                    ) : null}
                    {m.value.percent && !m.value.amount ? <Text style={styles.couponMeta}>{t('sav_pct_note')}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.usedBtn, used ? styles.usedBtnOn : null]}
                    onPress={() => toggleCouponUsed(m)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.usedBtnText, used ? styles.usedBtnTextOn : null]}>{used ? t('sav_used') : t('sav_mark_used')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : items.length > 0 && checkedCount > 0 ? (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setDoneShopping(true)} activeOpacity={0.88}>
            <Text style={styles.doneBtnText}>{`🎟 ${t('sav_done_btn')}`}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.savingsCard, shadow.card]}>
          <Text style={styles.savingsTitle}>{t('sav_card_title')}</Text>
          {savings.allTime.total > 0 ? (
            <>
              <Text style={styles.savingsBig}>{`${savings.thisWeek.est ? '~' : ''}${fmtMoney(savings.thisWeek.total)}`}</Text>
              <Text style={styles.savingsSub}>{t('sav_this_week')}</Text>
              <View style={styles.savingsSplit}>
                <View style={styles.savingsCell}>
                  <Text style={styles.savingsCellNum}>{fmtMoney(savings.thisWeek.circular)}</Text>
                  <Text style={styles.savingsCellLabel}>{t('sav_flyer')}</Text>
                </View>
                <View style={styles.savingsCell}>
                  <Text style={styles.savingsCellNum}>{fmtMoney(savings.thisWeek.coupon)}</Text>
                  <Text style={styles.savingsCellLabel}>{t('sav_coupons')}</Text>
                </View>
                <View style={styles.savingsCell}>
                  <Text style={styles.savingsCellNum}>{fmtMoney(savings.allTime.total)}</Text>
                  <Text style={styles.savingsCellLabel}>{t('sav_all_time')}</Text>
                </View>
              </View>
              {savings.weeks.filter((w) => w.weekKey !== thisWeekKey).slice(0, 4).length ? (
                <View style={styles.savingsWeeks}>
                  <Text style={styles.savingsCellLabel}>{t('sav_earlier_weeks')}</Text>
                  {savings.weeks.filter((w) => w.weekKey !== thisWeekKey).slice(0, 4).map((w) => (
                    <View key={w.weekKey} style={styles.savingsWeekRow}>
                      <Text style={styles.savingsWeekName}>{t('sav_week_of', { date: weekLabel(w.weekKey) })}</Text>
                      <Text style={styles.savingsWeekAmt}>{fmtMoney(w.total)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.savingsNote}>{t('sav_est_note')}</Text>
            </>
          ) : (
            <Text style={styles.savingsNote}>{t('sav_none_yet')}</Text>
          )}
        </View>

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
                      {matches[item.id]?.deal ? (() => {
                        const sv = dealSaving(matches[item.id].deal);
                        return (
                          <Text style={styles.tagSale}>
                            {sv.amount > 0
                              ? t(sv.est ? 'sav_sale_tag_est' : 'sav_sale_tag', { amount: fmtMoney(sv.amount) })
                              : t('sav_sale_tag_plain')}
                          </Text>
                        );
                      })() : null}
                      {(matches[item.id]?.coupons || []).slice(0, 1).map((m) => (
                        <Text key={m.coupon.id} style={styles.tagCoupon} numberOfLines={2}>
                          {t(m.level === 'match' ? 'sav_coupon_tag' : 'sav_coupon_possible', { label: m.coupon.discountLabel || m.coupon.title })}
                        </Text>
                      ))}
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

      <StoreRemainingItemsModal
        visible={Boolean(remainingItemsModal)}
        storeName={remainingItemsModal?.storeName}
        items={remainingItemsModal?.items}
        onClose={() => setRemainingItemsModal(null)}
      />
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
  sendToStoreLabel: {
    marginTop: 18,
    color: colors.brown,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.2,
    fontFamily: 'Jost-Bold',
  },
  storeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  storeBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  instacartBtn: {
    backgroundColor: '#1F8A3B',
  },
  krogerBtn: {
    backgroundColor: '#003DA5',
  },
  safewayBtn: {
    backgroundColor: '#D9291C',
  },
  storeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    textAlign: 'center',
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
  tagSale: {
    color: '#2A6A2A',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Jost-SemiBold',
    marginTop: 3,
  },
  tagCoupon: {
    color: '#C25A12',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Jost-SemiBold',
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: colors.forest,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  doneBtnText: { color: '#F3EEE4', fontSize: 14, fontFamily: 'Jost-Bold' },
  checkoutCard: {
    backgroundColor: '#FFF4E3',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E8651A',
    padding: 14,
    marginBottom: 14,
  },
  checkoutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutTitle: { color: '#2B1E13', fontSize: 17, fontFamily: 'Jost-Bold' },
  checkoutHide: { color: '#7A5C3A', fontSize: 12, fontFamily: 'Jost-SemiBold' },
  checkoutSub: { color: '#5A4630', fontSize: 13, lineHeight: 18, fontFamily: 'Jost-Regular', marginTop: 6, marginBottom: 6 },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EBCFA6',
    paddingVertical: 10,
  },
  couponTitle: { color: '#2B1E13', fontSize: 14, lineHeight: 19, fontFamily: 'Jost-SemiBold' },
  couponMeta: { color: '#7A5C3A', fontSize: 11, lineHeight: 15, fontFamily: 'Jost-Regular', marginTop: 2 },
  couponPossible: { color: '#C25A12', fontSize: 11, fontFamily: 'Jost-Bold', marginTop: 2 },
  couponCode: { color: '#2B1E13', fontSize: 13, fontFamily: 'Jost-Bold', marginTop: 3, letterSpacing: 1 },
  couponLink: { color: '#2A6A2A', fontSize: 12, fontFamily: 'Jost-Bold', marginTop: 3, textDecorationLine: 'underline' },
  usedBtn: {
    borderWidth: 1.5,
    borderColor: '#2A6A2A',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  usedBtnOn: { backgroundColor: '#2A6A2A' },
  usedBtnText: { color: '#2A6A2A', fontSize: 12, fontFamily: 'Jost-Bold' },
  usedBtnTextOn: { color: '#F7F5F0' },
  savingsCard: {
    backgroundColor: colors.forest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  savingsTitle: { color: colors.sage, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Jost-Bold' },
  savingsBig: { color: '#F3EEE4', fontSize: 34, lineHeight: 40, fontFamily: 'Jost-Bold', marginTop: 4 },
  savingsSub: { color: colors.muted, fontSize: 12, fontFamily: 'Jost-Regular' },
  savingsSplit: { flexDirection: 'row', marginTop: 12 },
  savingsCell: { flex: 1 },
  savingsCellNum: { color: '#F3EEE4', fontSize: 16, fontFamily: 'Jost-Bold' },
  savingsCellLabel: { color: colors.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Jost-SemiBold', marginTop: 2 },
  savingsWeeks: { marginTop: 14 },
  savingsWeekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  savingsWeekName: { color: colors.muted, fontSize: 12, fontFamily: 'Jost-Regular' },
  savingsWeekAmt: { color: '#F3EEE4', fontSize: 12, fontFamily: 'Jost-Bold' },
  savingsNote: { color: colors.muted, fontSize: 11, lineHeight: 15, fontFamily: 'Jost-Regular', marginTop: 10 },
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
