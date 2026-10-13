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
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import useLanguage from '../hooks/useLanguage';
import { useTour } from '../services/TourContext';
import { sendListToInstacart, sendListToKroger, sendListToAlbertsons } from '../services/storeShoppingListService';
import Confetti from '../components/Confetti';
import SaleItemsList from '../components/SaleItemsList';
import FlyerSection from '../components/trip/FlyerSection';
import WeekMealsSection from '../components/trip/WeekMealsSection';
import { addRecipesToShoppingList, buyCount } from '../utils/shoppingListSync';
import { AISLES, aisleFor } from '../utils/aisles';
import { toShoppingName } from '../utils/shoppingName';
import { ListAddPreviewBody } from '../components/ListAddPreview';
import { subscribeReview } from '../services/reviewBus';
import EverydayCard from '../components/trip/EverydayCard';
import { logPurchase, unlogPurchase, getShoppingDay, saveShoppingDay } from '../utils/staples';
import * as Location from 'expo-location';
import { storeAtPosition } from '../utils/flyerStore';
import ChatSheetModal from '../components/modals/ChatSheetModal';
import ShoppingModeModal from '../components/trip/ShoppingModeModal';
import { buildTripSystemPrompt, tripOpenerPrompt } from '../utils/tripChat';
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
  couponItemName,
  isNonFoodCoupon,
  tooGoodCoupons,
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
  const { t, locale } = useLanguage();
  const { maybeAutoStart, tourKey: activeTourKey, stepIndex: activeTourStepIndex } = useTour();
  const { data, pull, pushChangedFromStorage } = useSync(user);
  const route = useRoute();
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
  const [showSales, setShowSales] = useState(false);
  const [shoppingDay, setShoppingDay] = useState(null);
  useEffect(() => { getShoppingDay().then(setShoppingDay); }, []);
  const pickShoppingDay = async (day) => {
    setShoppingDay(day);
    await saveShoppingDay(day, { title: t('everyday_nudge_title'), body: t('everyday_nudge_body') });
  };
  const [review, setReview] = useState(null);
  useEffect(() => subscribeReview(setReview), []);
  const [listChat, setListChat] = useState(false); // the leaf button: talk to Fern about the list
  const [tripChatMode, setTripChatMode] = useState(null); // null | 'choose' | 'voice' | 'text'
  const tripChatOpen = tripChatMode === 'voice' || tripChatMode === 'text';
  const [shopModeOpen, setShopModeOpen] = useState(false);
  const [shopModeVoice, setShopModeVoice] = useState(false);
  const [catalogState, setCatalogState] = useState('loading'); // loading | ok | failed
  const [catalogError, setCatalogError] = useState('');

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

  // One-time clean-up: older versions ticked items off by themselves when a second recipe needed the same
  // ingredient. Nothing ticks an item except you now, so clear those leftovers once (ticks you make afterwards stay).
  const ticksResetRef = useRef(false);
  useEffect(() => {
    if (ticksResetRef.current || !items.length) return;
    ticksResetRef.current = true;
    (async () => {
      try {
        if ((await AsyncStorage.getItem('fern_ticks_reset_v1')) === 'done') return;
        await AsyncStorage.setItem('fern_ticks_reset_v1', 'done');
        if (items.some((it) => it.checked)) await persistShopping(items.map((it) => ({ ...it, checked: false })));
      } catch (e) { /* best effort */ }
    })();
  }, [items]);

  // This week's flyer deals, the live coupon catalog and the savings ledger (all best effort).
  useFocusEffect(
    useMemo(() => () => {
      loadWeekDeals().then(setWeekDeals);
      loadLedger().then(setLedger);
      fetchAllCoupons().then((list) => { const n = normalizeCoupons(list); setCatalog(n); setCatalogState(n.length ? 'ok' : 'failed'); setCatalogError(n.length ? '' : 'empty list'); }).catch((e) => { setCatalogState('failed'); setCatalogError(String(e?.message || e)); });
    }, [])
  );

  useEffect(() => { if (route?.params?.listChat) setListChat(true); }, [route?.params?.listChat]);

  const reloadDeals = () => loadWeekDeals().then(setWeekDeals);

  // Arriving at the store (notification tap / Home's "Scan a flyer") lands here: jump to the flyer.
  // Leaving the store (savings notification tap) lands on the savings card.
  useEffect(() => {
    if (route?.params?.tripStart) {
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.flyer || 0) - 8), animated: true }), 450);
      return () => clearTimeout(timer);
    }
    if (route?.params?.flyerScanned) {
      reloadDeals?.();
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.sales || 0) - 8), animated: true }), 600);
      return () => clearTimeout(timer);
    }
    if (route?.params?.everyday) {
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.everyday || 0) - 8), animated: true }), 450);
      return () => clearTimeout(timer);
    }
    if (route?.params?.tripDone) {
      setDoneShopping(true);
      loadLedger().then(setLedger);
      const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.savings || 0) - 8), animated: true }), 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [route?.params?.tripStart, route?.params?.tripDone, route?.params?.everyday, route?.params?.flyerScanned]);

  // Add a batch of recipes' ingredients (the week of dinners) to the list in one save.
  // `skip` = names the user un-ticked in the preview.
  const addRecipesToList = async (recipes, opts) => {
    const r = await addRecipesToShoppingList(recipes, items, { skip: opts?.skip });
    await persistShopping(r.nextShopping);
  };

  const goTo = (key) => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[key] || 0) - 8), animated: true });

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

  // Every coupon that fits something on the list (bought or not), for the "Coupons for your list" card.
  const listCoupons = useMemo(() => {
    const seen = new Set();
    const out = [];
    items.forEach((item) => {
      (matches[item.id]?.coupons || []).forEach((m) => {
        if (seen.has(m.coupon.id)) return;
        seen.add(m.coupon.id);
        out.push({ ...m, itemText: item.text, itemId: item.id });
      });
    });
    return out;
  }, [items, matches]);

  // Celebrate coupons the user didn't know about, once per coupon.
  const [celebration, setCelebration] = useState(null); // { n, amount }
  const celebratedRef = useRef(null); // Set of ids, null until loaded
  useEffect(() => {
    AsyncStorage.getItem('fern_coupons_celebrated')
      .then((raw) => { celebratedRef.current = new Set(JSON.parse(raw || '[]')); })
      .catch(() => { celebratedRef.current = new Set(); });
  }, []);
  useEffect(() => {
    if (!celebratedRef.current || !listCoupons.length) return;
    const fresh = listCoupons.filter((m) => !celebratedRef.current.has(String(m.coupon.id)));
    if (!fresh.length) return;
    fresh.forEach((m) => celebratedRef.current.add(String(m.coupon.id)));
    AsyncStorage.setItem('fern_coupons_celebrated', JSON.stringify(Array.from(celebratedRef.current).slice(-300))).catch(() => {});
    const amount = fresh.reduce((a, m) => a + (m.value?.amount || 0), 0);
    setCelebration({ n: fresh.length, amount: Math.round(amount * 100) / 100 });
    const timer = setTimeout(() => setCelebration(null), 4200);
    return () => clearTimeout(timer);
  }, [listCoupons]);

  // Big coupons worth adding an item for, even though nothing on the list matches them yet.
  const greatDeals = useMemo(
    () => tooGoodCoupons(coupons, { excludeIds: listCoupons.map((m) => m.coupon.id), items, stores: data.userStores }),
    [coupons, listCoupons, items, data.userStores]
  );

  // Fern ticked things off in the chat ("I got the chicken"): match her names to list items and check them.
  const checkOffByName = async (names) => {
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
    let current = [];
    try { current = JSON.parse((await AsyncStorage.getItem('rv4_master_shop')) || '[]'); } catch (e) { current = []; }
    if (!Array.isArray(current) || !current.length) current = items;
    const wanted = names.map(norm).filter(Boolean);
    let hit = 0;
    const next = current.map((it) => {
      if (it.checked) return it;
      const key = norm(it.text);
      const match = wanted.some((w) => key === w || key.includes(w) || w.includes(key));
      if (!match) return it;
      hit += 1;
      return { ...it, checked: true };
    });
    if (hit) await persistShopping(toUiItems(next));
    return hit;
  };

  // The Shopping button under the list: find out whether the user is at a saved store (GPS), then open Shop with Fern.
  // Not at a store -> Fern stays store-agnostic and asks whether to go straight into shopping mode.
  const startShopping = async () => {
    let at = '';
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.granted) {
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((r) => setTimeout(() => r(null), 3000)),
        ]).catch(() => null) || await Location.getLastKnownPositionAsync().catch(() => null);
        const here = storeAtPosition((data.userStores || []).filter((s) => s && s.name), pos?.coords);
        if (here) at = String(here.name);
      }
    } catch (e) { /* no location: stay store-agnostic */ }
    setShopStore(at);
    Alert.alert(t('trip_chat_how'), undefined, [
      { text: `🎙 ${t('trip_chat_voice')}`, onPress: () => setTimeout(() => setTripChatMode('voice'), 400) },
      { text: `⌨️ ${t('trip_chat_text')}`, onPress: () => setTimeout(() => setTripChatMode('text'), 400) },
      { text: t('cancel_btn'), style: 'cancel' },
    ]);
  };

  const normName = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
  const removeByName = async (names) => {
    let current = [];
    try { current = JSON.parse((await AsyncStorage.getItem('rv4_master_shop')) || '[]'); } catch (e) { current = []; }
    if (!Array.isArray(current) || !current.length) current = items;
    const wanted = names.map(normName).filter(Boolean);
    const next = current.filter((it) => {
      const key = normName(it.text);
      return !wanted.some((w) => key === w || key.includes(w) || w.includes(key));
    });
    if (next.length !== current.length) await persistShopping(toUiItems(next));
    return current.length - next.length;
  };
  const listChatPrompt = useMemo(() => [
    'You are Fern, helping the user build and edit their shopping list by talking or typing. Keep replies to 1-2 short sentences.',
    items.length ? `Their list right now: ${items.map((i) => `${String(i.text).slice(0, 40)}${i.checked ? ' (got it)' : ''}`).slice(0, 80).join(', ')}.` : 'Their list is empty.',
    'When they want to add things, put plain grocery names (e.g. "Olive oil") in add_to_shopping_list and say you are adding them. Do not add something already on the list.',
    'When they want something removed, put the matching names from their list in remove_from_list. When they say they already got something, put the matching names in checked_off. Otherwise leave these empty.',
    'Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1"],"remove_from_list":["item2"],"checked_off":["item3"]}',
  ].join('\n\n'),
  // Built when the chat opens; later list changes shouldn't rewrite a conversation in progress.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [listChat]);

  const [shopStore, setShopStore] = useState('');
  const tripStore = shopStore || route?.params?.store || '';
  const tripPrompt = useMemo(() => buildTripSystemPrompt({
    store: tripStore,
    deals: weekDeals,
    list: items,
    coupons: [...listCoupons.map((m) => m.coupon), ...greatDeals.map((m) => m.coupon)],
  // Built when the chat opens; later list changes shouldn't rewrite a conversation in progress.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tripChatOpen]);

  const [addedIds, setAddedIds] = useState([]);
  const walletIds = useMemo(() => new Set([...(data.walletCoupons || []).map((c) => String(c?.id)), ...addedIds]), [data.walletCoupons, addedIds]);

  const addToWallet = async (coupon) => {
    if (walletIds.has(String(coupon.id))) return;
    setAddedIds((prev) => [...prev, String(coupon.id)]);
    try {
      const wallet = JSON.parse((await AsyncStorage.getItem('rv4_wallet_coupons')) || '[]');
      const next = [...wallet, coupon];
      await AsyncStorage.setItem('rv4_wallet_coupons', JSON.stringify(next));
      const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, walletCoupons: next }));
      // Both keys: the backend's writable field name for the wallet is unconfirmed (see DATAMODEL.md).
      await pushChangedFromStorage({ wallet_coupons: next, coupons: next });
    } catch (e) {
      setAddedIds((prev) => prev.filter((id) => id !== String(coupon.id)));
      Alert.alert(t('save_error_title'), t('save_error_desc'));
    }
  };

  const addGreatDeal = async (m) => {
    const name = couponItemName(m.coupon);
    const exists = items.some((it) => it.text.toLowerCase() === name.toLowerCase());
    if (!exists) {
      await persistShopping([
        ...items,
        { id: `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: name, recipe: 'Coupon deal', checked: false },
      ]);
    }
    await addToWallet(m.coupon);
  };

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
  // The list grouped by store section, in the order you walk the store.
  const aisleSections = useMemo(() => {
    const byAisle = new Map();
    items.forEach((item) => {
      const aisle = aisleFor(item.text);
      if (!byAisle.has(aisle.key)) byAisle.set(aisle.key, []);
      byAisle.get(aisle.key).push(item);
    });

    return AISLES.filter((a) => byAisle.has(a.key)).map((aisle) => {
      const sectionItems = byAisle.get(aisle.key);
      return {
        aisle,
        items: sectionItems,
        total: sectionItems.length,
        checkedCount: sectionItems.filter((item) => item.checked).length,
      };
    });
  }, [items]);

  // "Cook it on <day>": writes the dinner into the Family week.
  const planDinnerOnDay = async (recipe, dateKey) => {
    let plan = {};
    try { plan = JSON.parse((await AsyncStorage.getItem('rv4_meal_plan')) || '{}'); } catch (e) { plan = {}; }
    const dayMeals = Array.isArray(plan[dateKey]) ? plan[dateKey] : [];
    const next = { ...plan, [dateKey]: [...dayMeals, { slot: 'Dinner', title: recipe.title, emoji: recipe.emoji || '🍽️' }] };
    await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(next));
    try {
      const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, mealPlan: next }));
    } catch (e) {}
    await pushChangedFromStorage({ meal_plan: next });
  };

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

  // One tap from the Everyday card: a non-recipe item goes straight on the list.
  const addEveryday = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || items.some((it) => it.text.toLowerCase() === text.toLowerCase())) return;
    await persistShopping([
      ...items,
      { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, recipe: 'Everyday', checked: false },
    ]);
  };

  const toggleItem = async (id) => {
    const target = items.find((item) => item.id === id);
    if (target) { if (target.checked) unlogPurchase(target.text); else logPurchase(target.text); }
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
    // Grouped by store section, with how many to buy when more than one meal needs it.
    const lines = aisleSections.flatMap((section) => [
      `\n${t(section.aisle.labelKey).toUpperCase()}`,
      ...section.items.map((item) => `${item.checked ? '✓' : '•'} ${item.text}${buyCount(item) > 1 ? ` ×${buyCount(item)}` : ''}`),
    ]);
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

        <View onLayout={(e) => { sectionY.current.everyday = e.nativeEvent.layout.y; }}>
          <EverydayCard t={t} items={items} onAdd={addEveryday} highlight={Boolean(route?.params?.everyday)} />
        </View>

        {false ? (
          <>
        <View onLayout={(e) => { sectionY.current.flyer = e.nativeEvent.layout.y; }}>
          <FlyerSection user={user} stores={data.userStores} t={t} weekDeals={weekDeals} onDealsChanged={reloadDeals} onScanned={() => { setShowSales(true); if (route?.params?.tripStart) setTripChatMode('choose'); setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.sales || 0) - 8), animated: true }), 350); }} />
        </View>

        {(tripChatMode === 'choose' ? (
          <View style={[styles.tripChatCard, shadow.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={styles.tripChatTitle}>{t('trip_chat_how')}</Text>
            <View style={styles.tripChoiceRow}>
              <TouchableOpacity style={styles.tripChoiceBtn} activeOpacity={0.85} onPress={() => setTripChatMode('voice')}>
                <Text style={styles.tripChoiceText}>{`🎙 ${t('trip_chat_voice')}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tripChoiceBtn} activeOpacity={0.85} onPress={() => setTripChatMode('text')}>
                <Text style={styles.tripChoiceText}>{`⌨️ ${t('trip_chat_text')}`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.tripChatCard, shadow.card]} activeOpacity={0.9} onPress={() => setTripChatMode('choose')}>
            <Text style={styles.tripChatEmoji}>🌿</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripChatTitle}>{t('trip_chat_title')}</Text>
              <Text style={styles.tripChatSub}>{t('trip_chat_sub')}</Text>
            </View>
            <Text style={styles.tripChatGo}>›</Text>
          </TouchableOpacity>
        ))}
          </>
        ) : null}

        <View style={[styles.checkoutCard, shadow.card]} onLayout={(e) => { sectionY.current.sales = e.nativeEvent.layout.y; }}>
          <Text style={styles.checkoutTitle}>{`🏷 ${t('sale_list_week_title')}`}</Text>
          <Text style={styles.checkoutSub}>{weekDeals.length ? t('sale_list_week_sub', { n: weekDeals.length }) : t('sale_list_week_empty')}</Text>
          {weekDeals.length ? (
            <SaleItemsList
              deals={weekDeals}
              t={t}
              isOnList={(deal) => {
                const key = toShoppingName(deal.name).toLowerCase();
                return items.some((it) => String(it.text).toLowerCase() === key);
              }}
              onAdd={(deal) => addItem(toShoppingName(deal.name))}
              token={user?.token}
              locale={locale}
              shoppingItems={items}
              onPlanDay={planDinnerOnDay}
              onAddRecipe={async (recipe, deal, opts) => {
                const r = await addRecipesToShoppingList([recipe], items, { skip: opts?.skip });
                await persistShopping(r.nextShopping);
              }}
            />
          ) : null}
        </View>

        {!greatDeals.length && !listCoupons.length ? (
          <Text style={[styles.checkoutSub, { marginBottom: 10 }]}>
            {catalogState === 'loading' ? t('sav_status_loading')
              : coupons.length ? t('sav_status_none', { n: coupons.length })
              : `${t('sav_status_empty')} (${catalogError || '…'})`}
          </Text>
        ) : null}

        <View onLayout={(e) => { sectionY.current.coupons = e.nativeEvent.layout.y; }} />

        <View onLayout={(e) => { sectionY.current.meals = e.nativeEvent.layout.y; }}>
          <WeekMealsSection
            t={t}
            locale={locale}
            token={user?.token}
            weekDeals={weekDeals}
            onAddToList={addRecipesToList}
            shoppingItems={items}
            pushChangedFromStorage={pushChangedFromStorage}
            onChanged={pull}
          />
        </View>

        {greatDeals.length || listCoupons.length ? (
          <View style={[styles.greatCard, shadow.card]}>
            <Text style={styles.checkoutTitle}>{`🎟 ${t('sav_coupons')}`}</Text>
            {listCoupons.length ? (
              <>
                <Text style={[styles.checkoutSub, { fontWeight: '700' }]}>{t('sav_for_list_title')}</Text>
                <Text style={styles.checkoutSub}>{t('sav_for_list_sub', { n: listCoupons.length })}</Text>
            {listCoupons.map((m) => {
              const c = m.coupon;
              const inWallet = walletIds.has(String(c.id));
              return (
                <View key={c.id} style={styles.couponRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponTitle} numberOfLines={2}>{c.title || c.discountLabel}</Text>
                    <Text style={styles.couponMeta}>
                      {[c.discountLabel, c.store, t('sav_for_item', { item: m.itemText })].filter(Boolean).join(' · ')}
                    </Text>
                    {m.level === 'possible' ? <Text style={styles.couponPossible}>{t('sav_possible')}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.usedBtn, inWallet ? styles.usedBtnOn : null]}
                    onPress={() => addToWallet(c)}
                    disabled={inWallet}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.usedBtnText, inWallet ? styles.usedBtnTextOn : null]}>{inWallet ? t('sav_in_wallet') : t('sav_add_wallet')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
              </>
            ) : null}
            {greatDeals.length ? (
              <>
                <Text style={[styles.checkoutSub, { fontWeight: '700', marginTop: listCoupons.length ? 14 : 0 }]}>{`🔥 ${t('sav_great_title')}`}</Text>
                <Text style={styles.checkoutSub}>{t('sav_great_sub')}</Text>
            {greatDeals.map((m) => {
              const c = m.coupon;
              const done = walletIds.has(String(c.id));
              return (
                <View key={c.id} style={styles.couponRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponTitle} numberOfLines={2}>{couponItemName(c)}</Text>
                    <Text style={styles.greatValue}>{c.discountLabel || c.title}</Text>
                    {c.store ? <Text style={styles.couponMeta}>{c.store}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.usedBtn, done ? styles.usedBtnOn : null]}
                    onPress={() => addGreatDeal(m)}
                    disabled={done}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.usedBtnText, done ? styles.usedBtnTextOn : null]}>{done ? t('sav_great_done') : t('sav_great_btn')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
              </>
            ) : null}
          </View>
        ) : null}

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

        <View onLayout={(e) => { sectionY.current.savings = e.nativeEvent.layout.y; }} />

        {items.length ? (
          <View style={styles.listWrap}>
            <Text style={styles.bigListTitle}>{t('shopping_list_title')}</Text>
            <Text style={styles.listMeta}>
              {remainingCount === 1
                ? t('items_remaining_singular', { count: remainingCount })
                : t('items_remaining_plural', { count: remainingCount })}
            </Text>
            {aisleSections.map((section) => (
              <View key={section.aisle.key} style={styles.recipeSectionWrap}>
                <View style={styles.recipeSectionHeader}>
                  <Text style={styles.recipeSectionTitle}>{`${section.aisle.emoji} ${t(section.aisle.labelKey)}`.toUpperCase()}</Text>
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
                      <Text style={[styles.listText, item.checked ? styles.listTextDone : null]}>{buyCount(item) > 1 ? `${item.text}  ×${buyCount(item)}` : item.text}</Text>
                      <Text style={styles.listRecipeLabel}>{item.recipe}</Text>
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

        {items.length ? (
          <TouchableOpacity style={[styles.shopBtn, shadow.strong]} activeOpacity={0.9} onPress={startShopping}>
            <Text style={styles.shopBtnText}>{`🛒 ${t('shop_start_btn')}`}</Text>
          </TouchableOpacity>
        ) : null}

        {items.length ? (
          <View style={{ marginTop: 8 }}>
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

          </View>
        ) : null}
      </ScrollView>

      {celebration ? (
        <>
          <Confetti />
          <TouchableOpacity style={styles.celebrateWrap} activeOpacity={0.95} onPress={() => setCelebration(null)}>
            <View style={[styles.celebrateCard, shadow.strong]}>
              <Text style={styles.celebrateEmoji}>🎉</Text>
              <Text style={styles.celebrateTitle}>
                {celebration.amount > 0
                  ? t('sav_celebrate_title', { amt: fmtMoney(celebration.amount) })
                  : t('sav_celebrate_title_plain', { n: celebration.n })}
              </Text>
              <Text style={styles.celebrateSub}>{t('sav_celebrate_sub')}</Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {tripChatOpen && (
        <ChatSheetModal
          visible
          onClose={() => { setTripChatMode(null); pull(); }}
          user={user}
          title={`🌿 ${t('trip_chat_title')}`}
          systemPrompt={tripPrompt}
          mode={tripChatMode}
          onAction={(parsed) => {
            const names = Array.isArray(parsed?.checked_off) ? parsed.checked_off.map((x) => String(x || '').trim()).filter(Boolean) : [];
            if (names.length) checkOffByName(names).catch(() => {});
            if (parsed?.shopping_mode === true) {
              // Hand over to the checklist: close the chat first so two modals never overlap.
              setShopModeVoice(tripChatMode === 'voice');
              setTripChatMode(null);
              setTimeout(() => setShopModeOpen(true), 900);
            }
            return null;
          }}
          autoOpenerPrompt={tripOpenerPrompt(tripStore)}
        />
      )}
      <ShoppingModeModal
        visible={shopModeOpen}
        items={items}
        user={user}
        voice={shopModeVoice}
        coupons={checkoutCoupons}
        usedIds={usedIds}
        onToggleCouponUsed={toggleCouponUsed}
        onClose={() => { setShopModeOpen(false); pull(); }}
        onSetChecked={async (ids, checked) => {
          const wanted = new Set(Array.isArray(ids) ? ids : [ids]);
          const changing = items.filter((it) => wanted.has(it.id) && it.checked !== checked);
          if (!changing.length) return;
          changing.forEach((it) => { if (checked) logPurchase(it.text); else unlogPurchase(it.text); });
          await persistShopping(items.map((it) => (wanted.has(it.id) ? { ...it, checked } : it)));
        }}
      />
      {listChat && (
        <ChatSheetModal
          visible
          onClose={() => { setListChat(false); pull(); }}
          user={user}
          title={`🌿 ${t('list_chat_title')}`}
          systemPrompt={listChatPrompt}
          autoOpenerPrompt={t('list_chat_opener')}
          onAction={(parsed) => {
            const clean = (a) => (Array.isArray(a) ? a.map((x) => String(x || '').trim()).filter(Boolean) : []);
            const rem = clean(parsed?.remove_from_list);
            const chk = clean(parsed?.checked_off);
            if (rem.length) removeByName(rem).catch(() => {});
            if (chk.length) checkOffByName(chk).catch(() => {});
            return null;
          }}
        />
      )}
      {review ? (
        <View style={styles.reviewScreen}>
          <View style={styles.reviewBar}>
            <TouchableOpacity onPress={review.onCancel} disabled={review.busy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.reviewBack}>{`‹ ${t('list_preview_cancel')}`}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
            <ListAddPreviewBody {...review} t={t} flat />
          </ScrollView>
        </View>
      ) : null}
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
  reviewScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F4F1ED', zIndex: 50 },
  reviewBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  reviewBack: { fontSize: 16, fontWeight: '700', color: colors.forest },
  reviewContent: { paddingHorizontal: 20, paddingBottom: 40 },
  tripChatCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.forest, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  tripChatEmoji: { fontSize: 28 },
  tripChatTitle: { color: colors.onFern, fontSize: 16, fontWeight: '800' },
  tripChatSub: { color: colors.onFern, opacity: 0.85, fontSize: 13, marginTop: 2 },
  tripChoiceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tripChoiceBtn: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  tripChoiceText: { color: colors.forest, fontSize: 15, fontWeight: '800' },
  tripChatGo: { color: colors.onFern, fontSize: 28, fontWeight: '300' },
  tripStrip: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tripStep: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E4DCD2' },
  tripStepNum: { fontSize: 11, fontWeight: '800', color: colors.orange },
  tripStepLabel: { fontSize: 11, fontWeight: '700', color: '#2D1B10', marginTop: 1 },
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
  bigListTitle: { fontSize: 30, lineHeight: 36, color: colors.forest, fontFamily: 'Jost-Bold', letterSpacing: 0.5, marginBottom: 4 },
  listWrap: {
    marginTop: 14,
    paddingVertical: 4,
  },
  celebrateWrap: { position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center', paddingHorizontal: 24 },
  celebrateCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, borderColor: '#E8651A', paddingVertical: 20, paddingHorizontal: 22, alignItems: 'center' },
  celebrateEmoji: { fontSize: 44 },
  celebrateTitle: { color: '#1C3A1A', fontSize: 20, lineHeight: 26, textAlign: 'center', fontFamily: 'Jost-Bold', marginTop: 4 },
  celebrateSub: { color: '#7A5C3A', fontSize: 13, textAlign: 'center', fontFamily: 'Jost-Regular', marginTop: 4 },
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
  greatCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderColor: '#E8651A', padding: 14, marginBottom: 14 },
  greatValue: { color: '#C25A12', fontSize: 15, fontFamily: 'Jost-Bold', marginTop: 2 },
  shopBtn: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  shopBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
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
