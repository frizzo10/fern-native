import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chainKey, dealsForStore } from '../utils/flyerStore';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Clipboard,
  Linking,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import useLanguage from '../hooks/useLanguage';
import { useTour } from '../services/TourContext';
import { trackEvent, couponMeta } from '../services/track';
import { sendListToInstacart, sendListToKroger, sendListToAlbertsons } from '../services/storeShoppingListService';
import Confetti from '../components/Confetti';
import SaleItemsList from '../components/SaleItemsList';
import FlyerSection from '../components/trip/FlyerSection';
import WeekMealsSection from '../components/trip/WeekMealsSection';
import CouponPreviewModal from '../components/trip/CouponPreviewModal';
import { storeCouponUrl } from '../components/trip/DigitalCouponHowTo';
import { isDigitalCoupon, isWalmartCoupon } from '../components/trip/DigitalCouponHowTo';
import { addRecipesToShoppingList, buyCount } from '../utils/shoppingListSync';
import { AISLES, aisleFor } from '../utils/aisles';
import { toShoppingName } from '../utils/shoppingName';
import { ListAddPreviewBody } from '../components/ListAddPreview';
import { subscribeReview } from '../services/reviewBus';
import EverydayCard from '../components/trip/EverydayCard';
import FernGreetingCard from '../components/trip/FernGreetingCard';
import GuideBar from '../components/trip/GuideBar';
import { logPurchase, unlogPurchase, getShoppingDay, saveShoppingDay } from '../utils/staples';
import * as Location from 'expo-location';
import { storeAtPosition } from '../utils/flyerStore';
import ChatSheetModal from '../components/modals/ChatSheetModal';
import ShoppingModeModal from '../components/trip/ShoppingModeModal';
import { buildTripSystemPrompt, tripOpenerPrompt } from '../utils/tripChat';
import { buildGuideQAExtra, guideQAOpenerPrompt, guideQAReopenPrompt } from '../utils/planChat';
import { useFernVoice } from '../hooks/useFernVoice';
import { subscribeAgentChange } from '../services/fernAgent';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import { recipeLimitReached } from '../utils/freeLimits';
import { fetchRecipeImage } from '../utils/recipeImage';
import StoreRemainingItemsModal from '../components/modals/StoreRemainingItemsModal';
import { fetchAllCoupons } from '../services/couponsService';
import { normalizeCoupons } from '../utils/couponNormalize';
import {
  dealSaving,
  fmtMoney,
  priceNum,
  loadLedger,
  loadWeekDeals,
  replaceWeekDeals,
  markStoreCleared,
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
import { onePerSlot } from '../utils/onePerSlot';
import AlexaHint from '../components/AlexaHint';
import AlexaSkillModal from '../components/modals/AlexaSkillModal';

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

// Device-only: set once Fern has spoken the full circular walkthrough, so later visits skip it.
// Mood picker on the trip bag: key -> emoji and the plain-English phrase sent to the AI.
const DINNER_MOODS = [
  ['quick20', '⏱', '20-minute meals, ready in 20 minutes or less'], ['italian', '🍝', 'quick Italian dinners'],
  ['mexican', '🌮', 'Mexican night'], ['asian', '🥢', 'Asian-inspired dinners'], ['comfort', '🍲', 'comfort food'],
  ['grill', '🔥', 'grilling'], ['healthy', '🥗', 'light and healthy dinners'], ['onepan', '🍳', 'one-pan dinners with easy cleanup'],
  ['slow', '🥘', 'slow cooker or oven roast dinners'], ['kids', '👨‍👩‍👧', 'kid-friendly dinners'], ['veg', '🥦', 'vegetarian dinners'],
  ['seafood', '🐟', 'seafood'], ['soup', '🍜', 'soups and stews'], ['lowcarb', '🥩', 'low-carb dinners'], ['brdinner', '🥞', 'breakfast for dinner'],
];
const WALKTHROUGH_KEY = 'fern_shop_walkthrough_heard';
const GUIDE_SPEECH_DELAY_MS = 3000; // how long the person gets to read the Shopping screen before Fern speaks

export default function ShoppingScreen({ user }) {
  const { t, locale } = useLanguage();
  const [voiceErr, setVoiceErr] = useState('');
  const { speakText, prepareSpeech, playPrepared, isSpeaking } = useFernVoice({ onError: (m) => { console.warn('[Shopping] voice error:', m); setVoiceErr(String(m || '').slice(0, 120)); }, token: user?.token, enabled: true });
  const { maybeAutoStart, tourKey: activeTourKey, stepIndex: activeTourStepIndex } = useTour();
  const { data, pull, pushChangedFromStorage } = useSync(user);
  const { hasAccess } = useEntitlement();
  const route = useRoute();
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [alexaOpen, setAlexaOpen] = useState(false);
  const [sendingToStore, setSendingToStore] = useState(null);
  const [remainingItemsModal, setRemainingItemsModal] = useState(null);
  const [couponPreview, setCouponPreview] = useState(null); // { coupon, itemText?, level?, kind: 'list' | 'great', match? }
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const [allWeekDeals, setWeekDeals] = useState([]);
  // Arriving at / choosing a store: show only THAT store's flyer, never another store's (Publix must not show Lowes' circular).
  const guideStoreName = String(route?.params?.guideStore || '').trim();
  const weekDeals = useMemo(
    () => (guideStoreName && chainKey(guideStoreName) ? dealsForStore(allWeekDeals, guideStoreName) : allWeekDeals),
    [allWeekDeals, guideStoreName]
  );
  const guideStores = useMemo(
    () => (guideStoreName ? (data.userStores || []).filter((st) => chainKey(st?.name) && chainKey(st.name) === chainKey(guideStoreName)) : (data.userStores || [])),
    [data.userStores, guideStoreName]
  );
  const [catalog, setCatalog] = useState([]);
  const [ledger, setLedger] = useState({});
  const [doneShopping, setDoneShopping] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [dinnerMood, setDinnerMood] = useState(''); // key from DINNER_MOODS ('' = anything)
  const [moodOpen, setMoodOpen] = useState(false);
  // The very first time a circular is on screen it is open so the person sees what's in it; after that it stays a closed accordion.
  const circularSeenChecked = useRef(false);
  const [shoppingDay, setShoppingDay] = useState(null);
  useEffect(() => { getShoppingDay().then(setShoppingDay); }, []);
  const pickShoppingDay = async (day) => {
    setShoppingDay(day);
    await saveShoppingDay(day, { title: t('everyday_nudge_title'), body: t('everyday_nudge_body') });
  };
  const [review, setReview] = useState(null);
  useEffect(() => subscribeReview(setReview), []);
  const [spot, setSpot] = useState(null); // which section Fern is talking about right now (scrolled to and outlined)
  const walkWaitRef = useRef(null);
  const hasCouponsRef = useRef(false);
  const hasDealsRef = useRef(false);
  const hasListRef = useRef(false);
  const hl = (key) => (spot === key ? styles.spotBox : null);
  const guideTimerRef = useRef(null); // pending "Fern starts talking in a few seconds"
  useEffect(() => () => clearTimeout(guideTimerRef.current), []);
  const [guideSpeechGo, setGuideSpeechGo] = useState(0); // a guide arrival wants Fern to speak; held until any open tour is closed
  const [pillWillSpeak, setPillWillSpeak] = useState(false); // only show "about to talk" when a line will really play
  const [introBusy, setIntroBusy] = useState(false); // Fern's arrival speech / walkthrough is still going; the celebration waits
  const [qaArmed, setQaArmed] = useState(false); // Fern's scripted walkthrough is playing; ask "any questions?" when it ends
  const [qaOpen, setQaOpen] = useState(false);
  const [qaReopened, setQaReopened] = useState(false); // opened from the button, not right after the walkthrough
  const [recipeRequest, setRecipeRequest] = useState(null); // { name, nonce }: open this sale item's recipes in the circular list
  const qaHeard = useRef(false);
  const qaStage = useRef('intro'); // 'intro' walkthrough -> 'why' dinners explained -> 'qa' any questions
  const [whyGo, setWhyGo] = useState(false); // the walkthrough ended: scroll to the dinners and explain them
  const [mealsKey, setMealsKey] = useState(0); // bumped when the sale items are cleared, so the dinners built from them reset too
  const [mealCards, setMealCards] = useState(null); // the dinner ideas WeekMealsSection built, with the sale item behind each
  const [listChat, setListChat] = useState(false); // the leaf button: talk to Fern about the list
  const [tripChatMode, setTripChatMode] = useState(null); // null | 'choose' | 'voice' | 'text'
  const tripChatOpen = tripChatMode === 'voice' || tripChatMode === 'text';
  const [shopModeOpen, setShopModeOpen] = useState(false);
  // "Fern guides your week": null = normal screen, else 'list' | 'meals' | 'ready'.
  const [guideStep, setGuideStep] = useState(null);
  const [guideStore, setGuideStore] = useState('');
  // Opened from the Home "Shopping list" card: show only the list (title, add row, list),
  // not the flyer/sales/coupons/dinners trip. Any trip entry (scan a flyer, arrival, etc.) turns it off.
  const [listOnly, setListOnly] = useState(false);
  useEffect(() => {
    if (!route?.params?.listOnly) return;
    setGuideStep(null);
    setListOnly(true);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [route?.params?.listOnly]);
  useEffect(() => {
    if (route?.params?.guide || route?.params?.tripStart || route?.params?.tripDone || route?.params?.everyday || route?.params?.flyerScanned) setListOnly(false);
  }, [route?.params?.guide, route?.params?.tripStart, route?.params?.tripDone, route?.params?.everyday, route?.params?.flyerScanned]);
  const [shopModeVoice, setShopModeVoice] = useState(false);
  const [catalogState, setCatalogState] = useState('loading'); // loading | ok | failed
  const [catalogError, setCatalogError] = useState('');

  // One voice and one overlay at a time on a first visit: the Shopping tour goes first, then Fern's spoken walkthrough,
  // then the coupon celebration. `tourChecked` flips once the tour has either opened or been skipped (already seen).
  const [tourChecked, setTourChecked] = useState(false);
  useEffect(() => {
    // The Shopping intro tour is gone: Fern's spoken walkthrough (which scrolls to and highlights each part) replaces it.
    setTourChecked(true);
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
  // Fern (the global chat) asked to open a sale item's recipes: scroll to the circular and pin them.
  useEffect(() => {
    const item = route?.params?.recipesFor;
    if (!item) return;
    navigation.setParams({ recipesFor: undefined });
    setTimeout(() => { goTo('sales'); setRecipeRequest({ name: String(item), nonce: Date.now() }); }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.recipesFor, route?.params?.recipesNonce]);
  // Something Fern changed (list, recipes, week) from the chat: re-read it.
  const pullRef = useRef(pull);
  pullRef.current = pull;
  useEffect(() => subscribeAgentChange(() => { pullRef.current?.(); }), []);
  useEffect(() => {
    if (!route?.params?.guide) return;
    setGuideStore(String(route.params.guideStore || ''));
    setGuideStep('list');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // The flyer is digitized: Fern says one line (put your everyday items on the list), then stays quiet.
    loadWeekDeals().then(setWeekDeals).catch(() => {});
    setQaOpen(false);
    setQaReopened(false);
    setQaArmed(false);
    setWhyGo(false);
    setMealCards(null);
    qaStage.current = 'intro';
    qaHeard.current = false;
    // Fern's speech itself starts in the effect below, once any open tour has closed (so two voices never overlap).
    clearTimeout(guideTimerRef.current); // a newer arrival replaces a speech that was still waiting
    setShowSales(true); // tapping a scanned circular takes you to it, open
    setPillWillSpeak(false);
    const greetNow = !!route?.params?.greet;
    AsyncStorage.getItem(WALKTHROUGH_KEY).catch(() => null).then((h) => setPillWillSpeak(!h || greetNow));
    setIntroBusy(true);
    setGuideSpeechGo(Date.now());
    const safety = setTimeout(() => setIntroBusy(false), 120000); // never hold the celebration forever
    return () => clearTimeout(safety);
  }, [route?.params?.guide]);

  // Resolves when the line that is playing now has finished (heard start, then stop); 25 s safety.
  useEffect(() => {
    const w = walkWaitRef.current;
    if (!w) return;
    if (isSpeaking) { w.heard = true; return; }
    if (w.heard) { walkWaitRef.current = null; w.resolve(); }
  }, [isSpeaking]);
  // `text` is a string (fetched now) or a promise of an already-fetched line (prepared while the previous one played).
  const speakAndWait = async (text) => {
    let w;
    const done = new Promise((resolve) => {
      w = { heard: false, resolve };
      walkWaitRef.current = w;
    });
    setVoiceErr('');
    // Never wait on one line forever (a stalled request used to leave "Fern is about to talk…" up with no sound).
    const ready = typeof text === 'string'
      ? speakText(text).catch(() => null)
      : Promise.resolve(text).then((uri) => (uri ? playPrepared(uri) : null)).catch(() => null);
    const uri = await Promise.race([ready, new Promise((r) => setTimeout(() => r(null), 30000))]);
    if (!uri) { if (walkWaitRef.current === w) walkWaitRef.current = null; return false; }
    // 40 s safety for the audio itself, counted from when the line was ready (not from the request).
    setTimeout(() => { if (walkWaitRef.current === w) { walkWaitRef.current = null; w.resolve(); } }, 40000);
    await done;
    return true;
  };
  // Fern's walkthrough: each line scrolls to the part of the screen she is talking about and outlines it.
  const runWalkthrough = async (greeting) => {
    const segs = [
      { key: 'sales', text: t('guide_seg_sales'), when: () => hasDealsRef.current },
      { key: 'couponCard', text: t('guide_seg_coupons'), when: () => hasCouponsRef.current },
      { key: 'addRow', text: t('guide_seg_add') },
      { key: 'everyday', text: t('guide_seg_everyday') },
      { key: 'list', text: t('guide_seg_list'), when: () => hasListRef.current },
    ];
    // Only the parts that exist, fetched all at once now: the next line is already on the phone when this one ends.
    const active = segs.filter((seg) => !seg.when || seg.when());
    const lines = active.map((seg, i) => (i === 0 && greeting ? `${greeting} ${seg.text}` : seg.text));
    const prepared = lines.map((line) => prepareSpeech(line).catch(() => null));
    let first = true;
    try {
      for (let i = 0; i < active.length; i += 1) {
        const seg = active[i];
        if (!navigation.isFocused()) return first ? false : true;
        setSpot(seg.key);
        scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current[seg.key] || 0) - 8), animated: true });
        const ok = await speakAndWait(prepared[i]);
        if (!ok) { if (first) return false; continue; } // a later line that failed is skipped, not the rest
        first = false;
      }
      return true;
    } finally {
      setSpot(null);
    }
  };

  useEffect(() => {
    if (!guideSpeechGo || !tourChecked || activeTourKey) return;
    setGuideSpeechGo(0);
    const runGuideSpeech = () => {
    // First time ever: the full spoken walkthrough, then (when it finishes playing) one AI sentence and "any questions?".
    // Every time after that: skip the tour and go straight to the AI sentence and "any questions?".
    const greeting = route?.params?.greet
      ? t('arrival_greet_say', { store: String(route.params.guideStore || '').split(/ - |#/)[0].trim() || t('arrival_greet_store_fallback') })
      : '';
    let leafMarked = false;
    AsyncStorage.getItem(WALKTHROUGH_KEY).catch(() => null).then((heard) => {
      // Arriving at a store: she greets you and says she's here to help (then stays quiet; the leaf reaches her).
      if (heard && greeting) {
        return speakText(greeting).catch(() => {}).then(() => { setTimeout(() => setIntroBusy(false), 1500); return null; });
      }
      if (heard) { setIntroBusy(false); return null; } // no card from the bottom: you just land on the circular
      // The leaf is explained in the Home tour, so the app-level leaf welcome shouldn't talk on top of this walkthrough.
      leafMarked = true;
      AsyncStorage.setItem('fern_leaf_welcome_heard', 'done').catch(() => {});
      return runWalkthrough(greeting).then((uri) => {
        if (uri) {
          setQaArmed(true);
          AsyncStorage.setItem(WALKTHROUGH_KEY, 'done').catch(() => {});
        } else {
          AsyncStorage.removeItem('fern_leaf_welcome_heard').catch(() => {});
          setIntroBusy(false);
        }
      });
    }).catch(() => { if (leafMarked) AsyncStorage.removeItem('fern_leaf_welcome_heard').catch(() => {}); setIntroBusy(false); });
    };
    // Let them see the page first: Fern starts a few seconds after the Shopping screen is up (and not at all if they've already left it).
    clearTimeout(guideTimerRef.current);
    guideTimerRef.current = setTimeout(() => {
      guideTimerRef.current = null;
      if (!navigation.isFocused()) { setIntroBusy(false); return; }
      runGuideSpeech();
    }, GUIDE_SPEECH_DELAY_MS);
  }, [guideSpeechGo, tourChecked, activeTourKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The walkthrough is over once the "any questions?" card is up.
  useEffect(() => { if (qaOpen) setIntroBusy(false); }, [qaOpen]);

  useEffect(() => {
    if (!qaArmed) return;
    if (isSpeaking) { qaHeard.current = true; return; }
    if (qaHeard.current) {
      qaHeard.current = false;
      setQaArmed(false);
      if (qaStage.current === 'intro') { qaStage.current = 'why'; setWhyGo(true); } else setIntroBusy(false);
    }
  }, [qaArmed, isSpeaking]);

  // Second part of the first-time walkthrough: scroll down to the dinners and say why each dish was picked
  // (the sale item behind it and the reason the AI gave for the dish). Then on to "any questions?".
  useEffect(() => {
    if (!whyGo) return undefined;
    if (!mealCards) {
      // Dinner ideas still loading (or failed): wait a bit, then skip straight to questions.
      const timer = setTimeout(() => { setWhyGo(false); qaStage.current = 'qa'; setIntroBusy(false); }, 15000);
      return () => clearTimeout(timer);
    }
    setWhyGo(false);
    goTo('meals');
    const line = buildWhyLine(mealCards);
    const timer = setTimeout(() => {
      speakText(line).then((uri) => {
        qaStage.current = 'qa';
        if (uri) setQaArmed(true); else setIntroBusy(false);
      }).catch(() => { qaStage.current = 'qa'; setIntroBusy(false); });
    }, 700);
    return () => clearTimeout(timer);
  }, [whyGo, mealCards]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildWhyLine = (cards) => {
    const parts = [t('guide_why_intro')];
    cards.slice(0, 3).forEach((c) => {
      const idea = c.ideas.find((x) => x.checked) || c.ideas[0];
      if (!idea) return;
      const p = priceNum(c.deal?.salePrice);
      const price = Number.isFinite(p) && p > 0 ? fmtMoney(p) : '';
      let line = price
        ? t('guide_why_card', { item: c.deal.name, price, dish: idea.title })
        : t('guide_why_card_noprice', { item: c.deal.name, dish: idea.title });
      const why = String(idea.why || '').trim().replace(/[.!?]+$/, '');
      if (why) line += ` ${why}.`;
      parts.push(line);
    });
    parts.push(t('guide_why_outro'));
    return parts.join(' ');
  };

  useEffect(() => {
    if (!weekDeals.length || circularSeenChecked.current) return;
    circularSeenChecked.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('fern_circular_seen');
        if (!seen) {
          setShowSales(true);
          await AsyncStorage.setItem('fern_circular_seen', 'done');
        }
      } catch (e) { /* ignore */ }
    })();
  }, [weekDeals.length]);

  const reloadDeals = () => loadWeekDeals().then(setWeekDeals);
  // Remove this store's sale items from the phone (wrong-store mix-ups); other stores' items stay.
  const clearStoreDeals = () => {
    const label = String(guideStoreName || '').split(/ - |#/)[0].trim() || t('trip_flyer_unknown_store');
    Alert.alert(t('trip_clear_store_title'), t('trip_clear_store_desc', { store: label }), [
      { text: t('cancel_btn'), style: 'cancel' },
      {
        text: t('trip_clear_store_yes'),
        style: 'destructive',
        onPress: async () => {
          const all = await loadWeekDeals();
          const gone = new Set(guideStoreName && chainKey(guideStoreName) ? dealsForStore(all, guideStoreName) : all);
          await replaceWeekDeals(all.filter((d) => !gone.has(d)));
          await markStoreCleared(guideStoreName);
          reloadDeals();
          setMealCards(null);
          setMealsKey((k) => k + 1);
        },
      },
    ]);
  };

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

  const [shopStore, setShopStore] = useState('');
  const tripStore = shopStore || route?.params?.store || '';
  // The store you are shopping at: the chosen/arrival store, else the one store the loaded flyer is from.
  const couponStoreWords = useMemo(() => {
    const names = tripStore ? [tripStore] : Array.from(new Set((weekDeals || []).map((d) => d.store).filter(Boolean)));
    return names.length === 1 ? String(names[0]).toLowerCase().split(/\s+-\s+|#/)[0].replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['the', 'foods', 'food', 'market', 'store', 'stores'].includes(w)) : [];
  }, [tripStore, weekDeals]);
  // A coupon tied to a different store than the one you're at is no use here ("" = any store).
  const rightStore = (c) => {
    if (!couponStoreWords.length || !c.store) return true;
    const cs = String(c.store).toLowerCase();
    return couponStoreWords.some((w) => cs.includes(w));
  };

  // Wallet coupons first, then the catalog (minus anything already in the wallet and expired ones).
  const coupons = useMemo(() => {
    const now = Date.now();
    const wallet = normalizeCoupons(data.walletCoupons).map((c) => ({ ...c, inWallet: true }));
    const ids = new Set(wallet.map((c) => c.id));
    const live = (c) => { const ts = Date.parse(c.expiresAt); return !ts || ts > now; };
    return [...wallet, ...catalog.filter((c) => !ids.has(c.id))].filter(live).filter(rightStore);
  }, [data.walletCoupons, catalog, couponStoreWords]);

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
  // Never on top of a tour, Fern talking, or the "any questions?" card: it waits its turn, then pops up on its own.
  const holdCelebration = !tourChecked || !!activeTourKey || guideSpeechGo !== 0 || introBusy || qaOpen || isSpeaking;
  useEffect(() => {
    if (holdCelebration || !celebratedRef.current || !listCoupons.length) return;
    const fresh = listCoupons.filter((m) => !celebratedRef.current.has(String(m.coupon.id)));
    if (!fresh.length) return;
    fresh.forEach((m) => celebratedRef.current.add(String(m.coupon.id)));
    AsyncStorage.setItem('fern_coupons_celebrated', JSON.stringify(Array.from(celebratedRef.current).slice(-300))).catch(() => {});
    const amount = fresh.reduce((a, m) => a + (m.value?.amount || 0), 0);
    setCelebration({ n: fresh.length, amount: Math.round(amount * 100) / 100 });
  }, [listCoupons, holdCelebration]);
  useEffect(() => {
    if (!celebration) return undefined;
    const timer = setTimeout(() => setCelebration(null), 4200);
    return () => clearTimeout(timer);
  }, [celebration]);

  // Big coupons worth adding an item for, even though nothing on the list matches them yet.
  const greatDeals = useMemo(
    () => tooGoodCoupons(coupons, { excludeIds: listCoupons.map((m) => m.coupon.id), items, stores: data.userStores }),
    [coupons, listCoupons, items, data.userStores]
  );
  // (Must come after greatDeals: reading it earlier is undefined at render time.)
  hasDealsRef.current = weekDeals.length > 0;
  hasCouponsRef.current = greatDeals.length > 0 || listCoupons.length > 0;
  hasListRef.current = items.length > 0;

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
  const startShopping = () => {
    // The modal's first screen asks: on my own, or with Fern talking.
    setShopModeVoice(false);
    setShopModeOpen(true);
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
    trackEvent('coupon_add', coupon.id, couponMeta(coupon));
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
      trackEvent('coupon_used', m.coupon.id, couponMeta(m.coupon));
      setLedger(await updateLedger({ upsert: [{ id, type: 'coupon', label: m.coupon.title || m.itemText, amount: m.value.amount, est: false, store: m.coupon.store }] }));
    }
  };

  const remainingCount = useMemo(() => items.filter((item) => !item.checked).length, [items]);
  const showBag = !listOnly && (!guideStep || guideStep === 'list');
  const bagStore = guideStoreName ? guideStoreName.split(/ - |#/)[0].trim() : '';
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
    const next = { ...plan, [dateKey]: onePerSlot([...dayMeals, { slot: recipe.slot || 'Dinner', title: recipe.title, emoji: recipe.emoji || '🍽️', ...((recipe.sides || []).length ? { sides: recipe.sides } : {}) }]) };
    await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(next));
    try {
      const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, mealPlan: next }));
    } catch (e) {}
    await pushChangedFromStorage({ meal_plan: next });
  };

  // Save a recipe Fern suggested into the saved recipes (rv4_saved), optionally into a cookbook.
  const saveRecipeToLibrary = async (recipe, { bookId } = {}) => {
    const title = String(recipe?.title || '').trim();
    if (!title) throw new Error('no title');
    let saved = [];
    try { const raw = JSON.parse((await AsyncStorage.getItem('rv4_saved')) || '[]'); saved = Array.isArray(raw) ? raw : []; } catch (e) {}
    const existing = saved.find((r) => String(r?.title || '').trim().toLowerCase() === title.toLowerCase());
    if (!existing && !hasAccess(TIERS.PRO) && (await recipeLimitReached())) {
      Alert.alert(t('recipe_limit_title'), t('recipe_limit_desc'));
      throw new Error('limit');
    }
    let next;
    if (existing) {
      if (!bookId) return 'exists';
      next = saved.map((r) => (r === existing ? { ...r, _bookIds: Array.from(new Set([...(r._bookIds || []), bookId])) } : r));
    } else {
      const image = recipe.image || (await fetchRecipeImage(`${title} food`, user?.token));
      const ingredients = (recipe.ingredients || []).map((x) => (typeof x === 'string' ? x : [x?.amount, x?.unit, x?.item].filter(Boolean).join(' ')));
      next = [...saved, {
        id: `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        emoji: recipe.emoji,
        cuisine: recipe.cuisine || '',
        mealType: 'Dinner',
        time: recipe.time,
        difficulty: recipe.difficulty,
        description: recipe.description,
        ingredients: [...ingredients, ...(recipe.sides || [])],
        instructions: recipe.instructions || recipe.directions || [],
        note: '',
        photoSearch: title,
        _cloudPhotos: image ? [image] : [],
        _bookIds: bookId ? [bookId] : [],
      }];
    }
    await AsyncStorage.setItem('rv4_saved', JSON.stringify(next));
    try {
      const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: next }));
    } catch (e) {}
    await pushChangedFromStorage({ saved: next });
    return 'saved';
  };

  // Confirmation: when something new lands on the list (from a sale item, a dinner, a coupon, the add box...), say so.
  const [addedNote, setAddedNote] = useState(null);
  const addedTimer = useRef(null);
  const flashAdded = (added) => {
    if (!added.length) return;
    setAddedNote(added.length === 1 ? t('added_toast_one', { item: added[0].text }) : t('added_toast_many', { n: added.length }));
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedNote(null), 4000);
  };
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

  const persistShopping = async (nextItems) => {
    const canonical = toSyncPayload(nextItems);
    {
      const had = new Set((items || []).map((it) => it.id));
      flashAdded(canonical.filter((it) => !had.has(it.id)));
    }
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

  // Fern's opening suggestions: add several suggested items at once (only after the user taps).
  const addSuggested = async (texts) => {
    const have = new Set(items.map((it) => it.text.toLowerCase()));
    const fresh = (texts || []).map((x) => String(x || '').trim()).filter((x) => x && !have.has(x.toLowerCase()));
    if (!fresh.length) return;
    await persistShopping([
      ...items,
      ...fresh.map((text) => ({ id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, recipe: 'Fern suggestion', checked: false })),
    ]);
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

  // Two separate buttons (2026-10-19): clear only ticked items, or clear the whole list (confirmed).
  const clearChecked = () => persistShopping(items.filter((i) => !i.checked));
  const clearWholeList = () => {
    Alert.alert(t('clear_list_title'), t('clear_list_body'), [
      { text: t('cancel_btn'), style: 'cancel' },
      { text: t('clear_all_btn'), style: 'destructive', onPress: () => persistShopping([]) },
    ]);
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

  // Grouped by store section, with how many to buy when more than one meal needs it.
  const buildListText = () => {
    const lines = aisleSections.flatMap((section) => [
      `\n${t(section.aisle.labelKey).toUpperCase()}`,
      ...section.items.map((item) => `${item.checked ? '✓' : '•'} ${item.text}${buyCount(item) > 1 ? ` ×${buyCount(item)}` : ''}`),
    ]);
    return lines.length ? `${t('share_list_header')}\n\n${lines.join('\n')}` : t('share_list_empty');
  };

  // The 📋 button next to Share: copy the whole list as text so it can be pasted into Notes, a text, etc.
  const copyList = () => {
    try {
      Clipboard.setString(buildListText());
      Alert.alert(t('copied'));
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const shareList = async () => {
    const message = buildListText();
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

  const GUIDE_STEPS = ['list', 'meals', 'ready'];
  const guideIdx = guideStep ? GUIDE_STEPS.indexOf(guideStep) : -1;
  const couponCount = greatDeals.length + listCoupons.length;
  const guideTitle = guideStep ? t(`guide_title_${guideStep}`) : '';
  // 'list': the AI greeting card (FernGreetingCard) does the talking, so the bar itself stays quiet.
  const guideLine = !guideStep || guideStep === 'list' ? ''
    : guideStep === 'meals' ? t('guide_say_meals')
    : t('guide_say_ready', { n: items.filter((i) => !i.checked).length });
  const guideNext = () => {
    if (guideIdx >= GUIDE_STEPS.length - 1) { setGuideStep(null); startShopping(); return; }
    setGuideStep(GUIDE_STEPS[guideIdx + 1]);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const guideBack = () => {
    if (guideIdx > 0) { setGuideStep(GUIDE_STEPS[guideIdx - 1]); scrollRef.current?.scrollTo({ y: 0, animated: false }); }
  };
  const guideNextLabel = guideStep === 'ready' ? t('guide_ready_btn')
    : guideStep === 'list' ? t('guide_next_meals')
    : t('guide_next');

  return (
    <View style={styles.container}>
      {guideStep && guideStep !== 'list' ? (
        <GuideBar
          t={t}
          token={user?.token}
          stepIndex={guideIdx}
          stepCount={GUIDE_STEPS.length}
          title={guideTitle}
          line={guideLine}
          nextLabel={guideNextLabel}
          onBack={guideBack}
          onNext={guideNext}
          onExit={() => setGuideStep(null)}
        />
      ) : null}
      {(isSpeaking || (introBusy && pillWillSpeak)) ? (
        <View style={styles.fernSpeakWrap} pointerEvents="none">
          <View style={styles.fernSpeakPill}>
            <Text style={styles.fernSpeakText}>{isSpeaking ? t('fern_talking') : t('fern_talk_soon')}</Text>
            {voiceErr && !isSpeaking ? <Text style={[styles.fernSpeakText, { fontSize: 11, fontWeight: '500', marginTop: 2 }]}>{`Voice problem: ${voiceErr}`}</Text> : null}
          </View>
        </View>
      ) : null}
      {addedNote ? (
        <TouchableOpacity style={styles.addedToast} activeOpacity={0.9} onPress={() => { setAddedNote(null); goTo('list'); }}>
          <Text style={styles.addedToastText} numberOfLines={2}>{`✓ ${addedNote}`}</Text>
          <Text style={styles.addedToastLink}>{t('added_toast_view')}</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {guideStep && guideStoreName ? (
          <View style={styles.headerRow}>
            <TouchableOpacity activeOpacity={0.8} accessibilityRole="link" onPress={() => Linking.openURL(storeCouponUrl(guideStoreName)).catch(() => {})}>
              <Text style={styles.title} numberOfLines={1}>{`🛒 ${guideStoreName.split(/ - |#/)[0].trim()}`}</Text>
              <Text style={{ fontFamily: 'Jost-SemiBold', fontSize: 13, color: '#D8607C', marginTop: 2 }}>{t('store_coupons_link')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!guideStep ? (
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('shopping_screen_title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.86} onPress={shareList}>
              <Text style={styles.shareBtnText}>{t('share_button')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clipBtn} activeOpacity={0.86} onPress={copyList}>
              <Text style={styles.clipBtnText}>📋</Text>
            </TouchableOpacity>
          </View>
        </View>
        ) : null}

        {showBag ? (
          <View style={styles.bagWrap}>
            <View style={styles.bagPic}>
              <Image source={require('../../assets/bag/bag-full.png')} style={styles.bagImg} resizeMode="contain" />
              {bagStore ? (
                <View style={styles.bagSideAnchor} pointerEvents="none">
                  <Text style={styles.bagSideText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{bagStore}</Text>
                </View>
              ) : null}
              <View style={styles.bagFront} pointerEvents="box-none">
                <View style={styles.bagGrid}>
                  {[
                    { key: 'sales', emoji: '🏷', n: weekDeals.length, full: t('bag_sales', { n: weekDeals.length }), empty: t('bag_empty_sales'), target: 'sales' },
                    { key: 'dinners', emoji: '🍽', n: Array.isArray(mealCards) ? mealCards.length : 0, full: t('bag_dinners', { n: Array.isArray(mealCards) ? mealCards.length : 0 }), empty: t('bag_empty_dinners'), target: 'meals' },
                    { key: 'coupons', emoji: '🎟', n: listCoupons.length + greatDeals.length, full: t('bag_coupons', { n: listCoupons.length + greatDeals.length }), empty: t('bag_empty_coupons'), target: 'couponCard' },
                    { key: 'list', emoji: '📝', n: remainingCount, full: t('bag_list', { n: remainingCount }), empty: t('bag_empty_list'), target: items.length ? 'list' : 'addRow' },
                  ].map((chip) => (
                    <TouchableOpacity key={chip.key} style={[styles.bagChip, chip.n > 0 ? styles.bagChipOn : null]} activeOpacity={0.85} onPress={() => goTo(sectionY.current[chip.target] != null ? chip.target : (chip.target === 'couponCard' ? 'coupons' : chip.target))}>
                      <Text style={styles.bagChipEmoji}>{chip.emoji}</Text>
                      <Text style={[styles.bagChipText, chip.n > 0 ? styles.bagChipTextOn : null]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{chip.n > 0 ? chip.full : chip.empty}</Text>
                      <Text style={styles.bagChipArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            {weekDeals.length > 0 ? (
              <View style={styles.moodCard}>
                <TouchableOpacity style={styles.moodRow} activeOpacity={0.85} onPress={() => setMoodOpen((v) => !v)}>
                  <Text style={styles.moodEmoji}>{dinnerMood ? DINNER_MOODS.find((m) => m[0] === dinnerMood)?.[1] : '🍽'}</Text>
                  <Text style={styles.moodText} numberOfLines={2}>{dinnerMood ? t('mood_btn_set', { mood: t(`mood_${dinnerMood}`) }) : t('mood_btn')}</Text>
                  <Text style={styles.moodText}>{moodOpen ? '▴' : '▾'}</Text>
                </TouchableOpacity>
                {moodOpen ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.bagSub}>{t('mood_sub')}</Text>
                    <View style={styles.moodGrid}>
                      {[['', '✨', '']].concat(DINNER_MOODS).map((m) => (
                        <TouchableOpacity key={m[0] || 'any'} style={[styles.moodChip, dinnerMood === m[0] ? styles.moodChipOn : null]} activeOpacity={0.85}
                          onPress={() => { setDinnerMood(m[0]); setMoodOpen(false); setMealsKey((k) => k + 1); setMealCards(null); setTimeout(() => goTo('meals'), 300); }}>
                          <Text style={styles.moodChipEmoji}>{m[1]}</Text>
                          <Text style={[styles.moodChipText, dinnerMood === m[0] ? styles.moodChipTextOn : null]} numberOfLines={2}>{m[0] ? t(`mood_${m[0]}`) : t('mood_any')}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {(!guideStep || guideStep === 'list') ? (
        <>
        {!guideStep && !listOnly ? (
        <FernGreetingCard
          hold={!tourChecked || !!activeTourKey}
          alwaysSpeak={guideStep === 'list'}
          hideSuggestions={guideStep === 'list'}
          t={t}
          locale={locale}
          token={user?.token}
          items={items}
          weekDeals={weekDeals}
          recipes={data.recipes}
          mealPlan={data.mealPlan}
          onAddItems={addSuggested}
          onPlan={() => goTo('meals')}
          onScan={() => navigation.navigate('Home')}
        />
        ) : null}


        </>
        ) : null}


        {guideStep === 'list' && !weekDeals.length ? (
          <View onLayout={(e) => { sectionY.current.flyer = e.nativeEvent.layout.y; }}>
            <FlyerSection user={user} stores={guideStores.length ? guideStores : data.userStores} t={t} weekDeals={weekDeals} onDealsChanged={reloadDeals} onScanned={() => {}} />
          </View>
        ) : null}

        {false ? (
          <>
        <View onLayout={(e) => { sectionY.current.flyer = e.nativeEvent.layout.y; }}>
          <FlyerSection user={user} stores={data.userStores} t={t} weekDeals={weekDeals} onDealsChanged={reloadDeals} onScanned={() => { if (route?.params?.tripStart) setTripChatMode('choose'); setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY.current.sales || 0) - 8), animated: true }), 350); }} />
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

        {/* "This week's sales" only shows once a flyer has been scanned; the empty-state box is gone.
            The bare anchor keeps the step strip's "Sales" scroll target working either way. */}
        {!weekDeals.length ? <View onLayout={(e) => { sectionY.current.sales = e.nativeEvent.layout.y; }} /> : null}
        {showBag && weekDeals.length > 0 ? <Text style={styles.stepHead}>{t('step_sales')}</Text> : null}
        {weekDeals.length > 0 && (!guideStep || guideStep === 'list') && !listOnly ? (
        <View style={hl('sales')} onLayout={(e) => { sectionY.current.sales = e.nativeEvent.layout.y; }}>
          {weekDeals.length ? (
            <SaleItemsList
              cardStyle={[styles.checkoutCard, shadow.card]}
              header={(
                <View>
                  <Text style={styles.checkoutTitle}>{`🏷 ${t('sale_list_week_title')}`}</Text>
                  <Text style={styles.checkoutSub}>{t('sale_list_week_sub', { n: weekDeals.length })}</Text>
                  <FlyerSection embedded user={user} stores={guideStores.length ? guideStores : data.userStores} t={t} weekDeals={weekDeals} onDealsChanged={reloadDeals} onScanned={() => {}} />
                  <TouchableOpacity onPress={clearStoreDeals} activeOpacity={0.8} style={{ marginTop: 8 }}>
                    <Text style={{ color: '#C0392B', fontSize: 13, fontFamily: 'Jost-Regular' }}>{t('trip_clear_store_btn', { store: String(guideStoreName || '').split(/ - |#/)[0].trim() || t('trip_flyer_unknown_store') })}</Text>
                  </TouchableOpacity>
                </View>
              )}              deals={weekDeals}
              collapsed={!showSales}
              onToggle={() => setShowSales((v) => !v)}
              books={data.books}
              onSaveRecipe={saveRecipeToLibrary}
              openRequest={recipeRequest}
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
        ) : null}

        {showBag ? <Text style={styles.stepHead}>{t('step_dinners')}</Text> : null}
        {(!guideStep || guideStep === 'meals' || guideStep === 'list') && !listOnly ? (
        <View onLayout={(e) => { sectionY.current.meals = e.nativeEvent.layout.y; }}>
          <WeekMealsSection
            key={`meals-${mealsKey}`}
            autoStart={guideStep === 'list' || !!dinnerMood}
            moodLabel={dinnerMood ? t('mood_' + dinnerMood) : ''}
            moodHint={dinnerMood ? (DINNER_MOODS.find((m) => m[0] === dinnerMood)?.[2] || '') : ''}
            onReady={setMealCards}
            t={t}
            locale={locale}
            token={user?.token}
            weekDeals={weekDeals}
            onAddToList={addRecipesToList}
            onPlanDay={planDinnerOnDay}
            books={data.books}
            onSaveRecipe={saveRecipeToLibrary}
            shoppingItems={items}
            pushChangedFromStorage={pushChangedFromStorage}
            onChanged={pull}
          />
        </View>
        ) : null}

        {!greatDeals.length && !listCoupons.length && guideStep !== 'meals' && !listOnly ? (
          <Text style={[styles.checkoutSub, { marginBottom: 10 }]}>
            {catalogState === 'loading' ? t('sav_status_loading')
              : coupons.length ? t('sav_status_none', { n: coupons.length })
              : `${t('sav_status_empty')} (${catalogError || '…'})`}
          </Text>
        ) : null}

        <View onLayout={(e) => { sectionY.current.coupons = e.nativeEvent.layout.y; }} />

        {showBag && (greatDeals.length > 0 || listCoupons.length > 0) ? <Text style={styles.stepHead}>{t('step_coupons')}</Text> : null}
        {(greatDeals.length > 0 || listCoupons.length > 0) && guideStep !== 'meals' && !listOnly ? (
          <View style={[styles.greatCard, shadow.card, hl('couponCard')]} onLayout={(e) => { sectionY.current.couponCard = e.nativeEvent.layout.y; }}>
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
                  <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={() => setCouponPreview({ coupon: c, itemText: m.itemText, level: m.level, kind: 'list' })}>
                    <Text style={styles.couponTitle} numberOfLines={2}>{c.title || c.discountLabel}</Text>
                    <Text style={styles.couponMeta}>
                      {[c.discountLabel, c.store, t('sav_for_item', { item: m.itemText })].filter(Boolean).join(' · ')}
                    </Text>
                    {m.level === 'possible' ? <Text style={styles.couponPossible}>{t('sav_possible')}</Text> : null}
                    <Text style={styles.couponLink}>{t('sav_preview')}</Text>
                  </TouchableOpacity>
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
                  <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={() => setCouponPreview({ coupon: c, kind: 'great', match: m })}>
                    <Text style={styles.couponTitle} numberOfLines={2}>{couponItemName(c)}</Text>
                    <Text style={styles.greatValue}>{c.discountLabel || c.title}</Text>
                    {c.store ? <Text style={styles.couponMeta}>{c.store}</Text> : null}
                    {isDigitalCoupon(c) ? <Text style={styles.couponPossible}>{t(isWalmartCoupon(c) ? 'coupon_howto_walmart_short' : 'coupon_howto_short')}</Text> : null}
                    <Text style={styles.couponLink}>{t('sav_preview')}</Text>
                  </TouchableOpacity>
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

        {guideStep !== 'meals' && !listOnly ? (
          <TouchableOpacity style={[styles.browseAllBtn, shadow.card]} activeOpacity={0.85} onPress={() => navigation.navigate('Home', { openCouponWallet: Date.now() })}>
            <Text style={styles.browseAllText}>{`🎟 ${t('sav_browse_all')}`}</Text>
            <Text style={styles.browseAllSub}>{t('sav_browse_all_sub')}</Text>
          </TouchableOpacity>
        ) : null}

        {showCheckout && !guideStep ? (
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
        ) : null}

        {(!guideStep || guideStep === 'list') ? (
        <>
        {showBag ? <Text style={styles.stepHead}>{t('step_build_list')}</Text> : null}
        <View style={[styles.addRow, hl('addRow')]} onLayout={(e) => { sectionY.current.addRow = e.nativeEvent.layout.y; }}>
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
        <AlexaHint text={t('alexa_hint_list')} onPress={() => setAlexaOpen(true)} />
        </>
        ) : null}

        {(!guideStep || guideStep === 'list') && !listOnly ? (
        <View style={hl('everyday')} onLayout={(e) => { sectionY.current.everyday = e.nativeEvent.layout.y; }}>
          <EverydayCard t={t} items={items} onAdd={addEveryday} highlight={Boolean(route?.params?.everyday)} />
        </View>
        ) : null}

        <View onLayout={(e) => { sectionY.current.savings = e.nativeEvent.layout.y; }} />

        {(!guideStep || guideStep === 'list' || guideStep === 'ready') ? (
        <>
        {showBag && items.length ? <Text style={styles.stepHead}>{t('step_ready')}</Text> : null}
        {items.length ? (
          <View style={[styles.listWrap, hl('list')]} onLayout={(e) => { sectionY.current.list = e.nativeEvent.layout.y; }}>
            {guideStep ? <Text style={styles.bigListTitle}>{t('shopping_list_title')}</Text> : null}
            <Text style={styles.listMeta}>
              {remainingCount === 1
                ? t('items_remaining_singular', { count: remainingCount })
                : t('items_remaining_plural', { count: remainingCount })}
            </Text>
            <TouchableOpacity onPress={shareList} activeOpacity={0.88} style={styles.shareListBtn}>
              <Text style={styles.shareListText}>{`📤 ${t('share_list_btn')}`}</Text>
            </TouchableOpacity>
            <View style={styles.clearRow}>
              {checkedCount > 0 ? (
                <TouchableOpacity onPress={clearChecked} activeOpacity={0.8} style={styles.clearListBtn}>
                  <Text style={styles.clearListText}>{`✓ ${t('clear_checked_btn', { n: checkedCount })}`}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={clearWholeList} activeOpacity={0.8} style={styles.clearListBtn}>
                <Text style={styles.clearListText}>{`🗑 ${t('clear_whole_btn')}`}</Text>
              </TouchableOpacity>
            </View>
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

        {/* "I'm done shopping" sits under the list (moved from the top, 2026-10-18). Hidden once
            the checkout card above is showing, same condition as before. */}
        {!(showCheckout && !guideStep) && items.length > 0 && checkedCount > 0 ? (
          <TouchableOpacity style={styles.doneBtn} onPress={() => setDoneShopping(true)} activeOpacity={0.88}>
            <Text style={styles.doneBtnText}>{`🎟 ${t('sav_done_btn')}`}</Text>
          </TouchableOpacity>
        ) : null}

        {items.length ? (
          <TouchableOpacity style={[styles.shopBtn, shadow.strong]} activeOpacity={0.9} onPress={startShopping}>
            <Text style={styles.shopBtnText}>{`🛒 ${t('shop_start_btn')}`}</Text>
            <Text style={styles.shopBtnSub}>{t('shop_start_sub')}</Text>
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
        </>
        ) : null}
      </ScrollView>
      <AlexaSkillModal visible={alexaOpen} onClose={() => setAlexaOpen(false)} />

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
        onPickVoice={setShopModeVoice}
        coupons={checkoutCoupons}
        usedIds={usedIds}
        onToggleCouponUsed={toggleCouponUsed}
        storeName={tripStore}
        onClearChecked={() => persistShopping(items.filter((i) => !i.checked))}
        onClose={() => { setShopModeOpen(false); pull(); }}
        onSetChecked={async (ids, checked) => {
          const wanted = new Set(Array.isArray(ids) ? ids : [ids]);
          const changing = items.filter((it) => wanted.has(it.id) && it.checked !== checked);
          if (!changing.length) return;
          changing.forEach((it) => { if (checked) logPurchase(it.text); else unlogPurchase(it.text); });
          await persistShopping(items.map((it) => (wanted.has(it.id) ? { ...it, checked } : it)));
        }}
      />
      {qaOpen && (
        <ChatSheetModal
          visible
          compact
          mode="voice"
          onClose={() => { setQaOpen(false); pull(); }}
          user={user}
          title={`🌿 ${t('guide_qa_title')}`}
          agent
          agentExtra={buildGuideQAExtra({
            store: guideStore,
            coupons: [...greatDeals.map((m) => m.coupon), ...listCoupons.map((m) => m.coupon)],
          })}
          autoOpenerPrompt={qaReopened ? guideQAReopenPrompt() : guideQAOpenerPrompt()}
          onSpeechDone={(parsed) => {
            // She has finished saying "opening the Wagyu recipes" / "goodbye": now close the card.
            setQaOpen(false);
            pull();
            const item = String(parsed?.show_recipes_for || '').trim();
            if (parsed?.go_to && parsed.go_to !== 'Shopping') { navigation.navigate(parsed.go_to); return; }
            if (item) {
              setTimeout(() => {
                goTo('sales');
                setRecipeRequest({ name: item, nonce: Date.now() });
              }, 450);
            }
          }}
        />
      )}
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
      <CouponPreviewModal
        preview={couponPreview}
        t={t}
        locale={locale}
        done={couponPreview ? walletIds.has(String(couponPreview.coupon.id)) : false}
        confirmLabel={couponPreview?.kind === 'great' ? t('sav_great_btn') : t('sav_add_wallet')}
        doneLabel={couponPreview?.kind === 'great' ? t('sav_great_done') : t('sav_in_wallet')}
        onClose={() => setCouponPreview(null)}
        onConfirm={async () => {
          const p = couponPreview;
          if (!p) return;
          if (p.kind === 'great') await addGreatDeal(p.match);
          else await addToWallet(p.coupon);
        }}
      />

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
  reviewScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFAF6', zIndex: 50 },
  reviewBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  reviewBack: { fontSize: 16, fontWeight: '700', color: '#8A4A4E' },
  reviewContent: { paddingHorizontal: 20, paddingBottom: 40 },
  tripChatCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#8A4A4E', borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  tripChatEmoji: { fontSize: 28 },
  tripChatTitle: { color: colors.onFern, fontSize: 16, fontWeight: '800' },
  tripChatSub: { color: colors.onFern, opacity: 0.85, fontSize: 13, marginTop: 2 },
  tripChoiceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tripChoiceBtn: { flex: 1, backgroundColor: '#FDE8E0', borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  tripChoiceText: { color: '#8A4A4E', fontSize: 15, fontWeight: '800' },
  tripChatGo: { color: colors.onFern, fontSize: 28, fontWeight: '300' },
  tripStrip: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tripStep: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#F3C9BD' },
  tripStepNum: { fontSize: 11, fontWeight: '800', color: '#D8607C' },
  tripStepLabel: { fontSize: 11, fontWeight: '700', color: '#5A3236', marginTop: 1 },
  container: {
    flex: 1,
    backgroundColor: '#FFFAF6',
  },
  fernSpeakWrap: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  fernSpeakPill: { alignSelf: 'center', backgroundColor: '#8A4A4E', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 6, marginBottom: 2 },
  fernSpeakText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  spotBox: { borderWidth: 3, borderColor: '#D8607C', borderRadius: 18 },
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
    color: '#5A3236',
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
    backgroundColor: '#8A4A4E',
    borderRadius: radius.full,
    height: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#FDE8E0',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Jost-Bold',
  },
  clipBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F3C9BD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1ECE3',
  },
  clipBtnText: {
    fontSize: 12,
  },
  sendToStoreLabel: {
    marginTop: 18,
    color: '#8A5A5C',
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
    backgroundColor: '#8A4A4E',
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
    color: '#EBCFC6',
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
    backgroundColor: '#FDE8E0',
    paddingHorizontal: 14,
    color: '#3B2B1D',
    fontSize: 14,
    fontFamily: 'Jost-SemiBold',
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D8607C',
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
    color: '#8A5A5C',
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
    backgroundColor: '#FDE8E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: {
    color: '#6C5238',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Jost-SemiBold',
  },
  bigListTitle: { fontSize: 30, lineHeight: 36, color: '#8A4A4E', fontFamily: 'Jost-Bold', letterSpacing: 0.5, marginBottom: 4 },
  listWrap: {
    marginTop: 14,
    paddingVertical: 4,
  },
  celebrateWrap: { position: 'absolute', left: 0, right: 0, top: '22%', alignItems: 'center', paddingHorizontal: 24 },
  celebrateCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, borderColor: '#D8607C', paddingVertical: 20, paddingHorizontal: 22, alignItems: 'center' },
  celebrateEmoji: { fontSize: 44 },
  celebrateTitle: { color: '#8A4A4E', fontSize: 20, lineHeight: 26, textAlign: 'center', fontFamily: 'Jost-Bold', marginTop: 4 },
  celebrateSub: { color: '#8A5A5C', fontSize: 13, textAlign: 'center', fontFamily: 'Jost-Regular', marginTop: 4 },
  tagSale: {
    color: '#C0475F',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Jost-SemiBold',
    marginTop: 3,
  },
  tagCoupon: {
    color: '#C0475F',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Jost-SemiBold',
    marginTop: 2,
  },
  greatCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderColor: '#D8607C', padding: 14, marginBottom: 14 },
  greatValue: { color: '#C0475F', fontSize: 15, fontFamily: 'Jost-Bold', marginTop: 2 },
  shopBtn: { backgroundColor: '#D8607C', borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  shopBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  shopBtnSub: { color: '#FFE9D6', fontSize: 12, fontFamily: 'Jost-Regular', marginTop: 2 },
  stepHead: { color: '#C0475F', fontSize: 12, letterSpacing: 1.2, fontFamily: 'Jost-Bold', marginTop: 14, marginBottom: 6 },
  bagWrap: { marginBottom: 8 },
  bagPic: { width: '94%', alignSelf: 'center', aspectRatio: 365 / 497 },
  bagImg: { width: '100%', height: '100%' },
  bagFront: { position: 'absolute', left: '27%', right: '7%', top: '45%', bottom: '19%', justifyContent: 'center', transform: [{ rotate: '-1.2deg' }] },
  bagLabel: { alignSelf: 'center', backgroundColor: '#FFF9EE', borderRadius: 999, borderWidth: 1.5, borderColor: '#1F3D2B', paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8, maxWidth: '100%' },
  bagLabelText: { color: '#1F3D2B', fontSize: 14, fontFamily: 'Jost-Bold', textAlign: 'center' },
  bagSub: { color: '#4A3418', fontSize: 13, lineHeight: 18, fontFamily: 'Jost-Regular', marginBottom: 8, textAlign: 'center' },
  bagGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bagChip: { width: '48.5%', alignItems: 'center', backgroundColor: 'rgba(255,249,238,0.6)', borderRadius: 12, borderWidth: 1.5, borderBottomWidth: 4, borderColor: 'rgba(120,84,36,0.5)', paddingVertical: 6, paddingLeft: 4, paddingRight: 14, marginBottom: 10, height: 72, justifyContent: 'center', shadowColor: '#3C280A', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  bagChipArrow: { position: 'absolute', right: 5, top: 20, fontSize: 22, lineHeight: 26, color: '#E8742A', fontFamily: 'Jost-Bold' },
  bagSideAnchor: { position: 'absolute', left: '14%', top: '62%', width: 0, height: 0 },
  bagSideText: { position: 'absolute', left: -100, top: -16, width: 200, height: 32, textAlign: 'center', fontSize: 25, letterSpacing: 3, fontWeight: '700', color: '#5A3D1C', opacity: 0.85, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', transform: [{ rotate: '-90deg' }, { skewX: '-8deg' }] },
  bagChipOn: { backgroundColor: '#FFF9EE', borderColor: '#1F3D2B' },
  bagChipEmoji: { fontSize: 18, marginBottom: 2 },
  bagChipText: { color: '#6B5230', fontSize: 12, lineHeight: 15, fontFamily: 'Jost-SemiBold', textAlign: 'center' },
  bagChipTextOn: { color: '#1F3D2B' },
  moodCard: { backgroundColor: '#FDE8E0', borderRadius: 14, borderWidth: 1.5, borderColor: '#8A4A4E', padding: 12, marginTop: 6 },
  moodRow: { flexDirection: 'row', alignItems: 'center' },
  moodEmoji: { fontSize: 22, marginRight: 10 },
  moodText: { flex: 1, color: '#8A4A4E', fontSize: 15, fontFamily: 'Jost-SemiBold' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moodChip: { width: '48.5%', flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(31,61,43,0.25)', paddingVertical: 10, paddingHorizontal: 8, marginBottom: 8 },
  moodChipOn: { backgroundColor: '#FBD9CE', borderColor: '#8A4A4E' },
  moodChipEmoji: { fontSize: 18, marginRight: 6 },
  moodChipText: { flex: 1, color: '#8A4A4E', fontSize: 13, lineHeight: 16, fontFamily: 'Jost-SemiBold' },
  moodChipTextOn: { color: '#8A4A4E' },
  addedToast: { position: 'absolute', left: 16, right: 88, bottom: 16, zIndex: 50, backgroundColor: '#8A4A4E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addedToastText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontFamily: 'Jost-SemiBold', marginRight: 10 },
  addedToastLink: { color: '#FFB877', fontSize: 14, fontFamily: 'Jost-Bold' },
  doneBtn: {
    backgroundColor: '#8A4A4E',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  doneBtnText: { color: '#F3EEE4', fontSize: 14, fontFamily: 'Jost-Bold' },
  checkoutCard: {
    backgroundColor: '#FDE8E0',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D8607C',
    padding: 14,
    marginBottom: 14,
  },
  checkoutHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutTitle: { color: '#5A3236', fontSize: 17, fontFamily: 'Jost-Bold' },
  checkoutHide: { color: '#8A5A5C', fontSize: 12, fontFamily: 'Jost-SemiBold' },
  checkoutSub: { color: '#5A4630', fontSize: 13, lineHeight: 18, fontFamily: 'Jost-Regular', marginTop: 6, marginBottom: 6 },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EBCFA6',
    paddingVertical: 10,
  },
  couponTitle: { color: '#5A3236', fontSize: 14, lineHeight: 19, fontFamily: 'Jost-SemiBold' },
  salesHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesToggle: { color: '#D8607C', fontSize: 13, fontWeight: '800' },
  askCircularBtn: { alignSelf: 'flex-start', backgroundColor: '#C0475F', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginTop: 8, marginBottom: 6 },
  askCircularText: { color: '#FDE8E0', fontSize: 14, fontFamily: 'Jost-Bold' },
  couponMeta: { color: '#8A5A5C', fontSize: 11, lineHeight: 15, fontFamily: 'Jost-Regular', marginTop: 2 },
  couponPossible: { color: '#C0475F', fontSize: 11, fontFamily: 'Jost-Bold', marginTop: 2 },
  couponCode: { color: '#5A3236', fontSize: 13, fontFamily: 'Jost-Bold', marginTop: 3, letterSpacing: 1 },
  browseAllBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C0475F', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 4, marginBottom: 12 },
  browseAllText: { color: '#C0475F', fontSize: 15, fontFamily: 'Jost-Bold' },
  browseAllSub: { color: '#5A6A5A', fontSize: 12, marginTop: 2 },
  couponLink: { color: '#C0475F', fontSize: 12, fontFamily: 'Jost-Bold', marginTop: 3, textDecorationLine: 'underline' },
  usedBtn: {
    borderWidth: 1.5,
    borderColor: '#C0475F',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  usedBtnOn: { backgroundColor: '#C0475F' },
  usedBtnText: { color: '#C0475F', fontSize: 12, fontFamily: 'Jost-Bold' },
  usedBtnTextOn: { color: '#FDE8E0' },
  savingsCard: {
    backgroundColor: '#8A4A4E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  savingsTitle: { color: '#F3C9BD', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Jost-Bold' },
  savingsBig: { color: '#F3EEE4', fontSize: 34, lineHeight: 40, fontFamily: 'Jost-Bold', marginTop: 4 },
  savingsSub: { color: '#EBCFC6', fontSize: 12, fontFamily: 'Jost-Regular' },
  savingsSplit: { flexDirection: 'row', marginTop: 12 },
  savingsCell: { flex: 1 },
  savingsCellNum: { color: '#F3EEE4', fontSize: 16, fontFamily: 'Jost-Bold' },
  savingsCellLabel: { color: '#EBCFC6', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Jost-SemiBold', marginTop: 2 },
  savingsWeeks: { marginTop: 14 },
  savingsWeekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  savingsWeekName: { color: '#EBCFC6', fontSize: 12, fontFamily: 'Jost-Regular' },
  savingsWeekAmt: { color: '#F3EEE4', fontSize: 12, fontFamily: 'Jost-Bold' },
  savingsNote: { color: '#EBCFC6', fontSize: 11, lineHeight: 15, fontFamily: 'Jost-Regular', marginTop: 10 },
  shareListBtn: { marginTop: 8, backgroundColor: '#8A4A4E', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  shareListText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Jost-Bold' },
  clearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  clearListBtn: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#B23A2A', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  clearListText: { color: '#B23A2A', fontSize: 13, fontFamily: 'Jost-Bold' },
  listMeta: {
    color: '#8A5A5C',
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
    color: '#C0475F',
    fontSize: 10,
    paddingTop: 10,
    lineHeight: 12,
    letterSpacing: 2,
    flexShrink: 1,
    fontFamily: 'Jost-Bold'
  },
  recipeSectionCount: {
    color: '#8A5A5C',
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Jost-Bold',
  },
  recipeSectionCountDone: {
    color: '#EBCFC6',
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
    backgroundColor: '#C0475F',
    borderColor: '#C0475F',
  },
  checkBtnText: {
    color: '#FDE8E0',
    fontSize: 22,
    lineHeight: 24,
    fontFamily: 'Jost-Bold',
  },
  listTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  listText: {
    color: '#5A3236',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Jost-Regular',
  },
  listRecipeLabel: {
    color: '#8A5A5C',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Jost-Regular',
    marginTop: 2,
  },
  listTextDone: {
    color: '#9A7872',
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
    color: '#8A5A5C',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Jost-Regular',
    maxWidth: 330,
  },
  fernBtn: {
    marginTop: 28,
    borderRadius: 22,
    backgroundColor: '#8A4A4E',
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
