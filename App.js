import React, { useEffect, useRef, useState } from 'react';
import { translations } from './src/constants/translations';
import { getShoppingDay, scheduleEverydayNudge } from './src/utils/staples';
import ShoppingDayPrompt from './src/components/ShoppingDayPrompt';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, Text, View, StyleSheet, TouchableOpacity, Animated, Modal, Pressable, Alert, ActivityIndicator, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { registerForPush } from './src/services/pushRegistration';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Platform, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import RecipesScreen from './src/screens/RecipesScreen';
import LoginScreen from './src/screens/LoginScreen';
import FindScreen from './src/screens/FindScreen';
import { useAuth } from './src/hooks/useAuth';
import { useGeofence } from './src/hooks/useGeofence';
import LocationSetupModal from './src/components/modals/LocationSetupModal';
import PaperPickModal from './src/components/modals/PaperPickModal';
import { STATIONERY_KEY } from './src/constants/stationery';
import { shouldShowLocationSetup, markLocationSetupShown } from './src/services/locationSetup';
import { stopStoreGeofencing } from './src/services/storeGeofencing';
import useEntitlement from './src/hooks/useEntitlement';
import { FEATURE_TIERS } from './src/constants/featureAccess';
import { TIERS } from './src/constants/tiers';
import { dateToKey } from './src/utils/familyDates';
import UpgradeGateModal from './src/components/UpgradeGateModal';
import { colors, radius, shadow } from './src/constants/tokens';
import { useFonts } from 'expo-font';
import { useFernVoice } from './src/hooks/useFernVoice';
import { LanguageProvider } from './src/services/LanguageContext';
import { useLanguage } from './src/hooks/useLanguage';
import ChatSheetModal from './src/components/modals/ChatSheetModal';
import { subscribeOpenChat } from './src/services/chatBus';
import { subscribeOpenHelp, requestToursScroll } from './src/services/helpBus';
import { requestOpenTool } from './src/services/toolBus';
import AccountScreen from './src/screens/AccountScreen';
import PlansScreen from './src/screens/PlansScreen';
import HelpModal from './src/components/modals/HelpModal';
import { AccountModalProvider, useAccountModal } from './src/services/AccountModalContext';
import { PlansModalProvider, usePlansModal } from './src/services/PlansModalContext';
import { TourProvider, useTour } from './src/services/TourContext';
import TourModal from './src/components/TourModal';
import { TOUR_PREVIEW_ROUTE } from './src/constants/tourContent';
import { RevenueCatProvider, useRevenueCat } from './src/services/RevenueCatContext';
import { useSync } from './src/hooks/useSync';
import { startLinkListener, subscribeLink, checkShareClipboardOnce } from './src/services/linkBus';

startLinkListener(); // fern://cookbook?id=... links: listen from the very first moment (cold start included)

const Tab = createBottomTabNavigator();

// Notification taps already acted on (getLastNotificationResponseAsync can hand the
// same tap back more than once in one app session).
const handledArrivalTaps = new Set();

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

function AppTabHeader() {
  const { t } = useLanguage();
  return (
    <View style={styles.appHeaderRow}>
      <Image
        source={require('./assets/header-logo.png')}
        style={styles.appHeaderIcon}
      />
      <View>
        <Text style={styles.appHeaderText}>fern</Text>
        <Text style={styles.appHeaderSubText}>{t('tagline')}</Text>
      </View>
    </View>
  );
}

// Store arrival banner — slides down from top
function ArrivalBanner({ store, onShop, onDismiss }) {
  const { t } = useLanguage();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
    // Stays until the shopper taps Shop or ✕ (it used to disappear on its own after 45 s).
  }, []);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.bannerEmoji}>🛒</Text>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{store.name} — {t('arrived')}</Text>
        <Text style={styles.bannerSub}>{t('ready_to_shop')}</Text>
      </View>
      <TouchableOpacity style={styles.bannerBtn} onPress={onShop}>
        <Text style={styles.bannerBtnText}>{t('shop')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={styles.bannerClose}>
        <Text style={styles.bannerCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SyncFailedBanner({ onRetry, onDismiss }) {
  const { t } = useLanguage();
  const [retrying, setRetrying] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80 }).start();
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <Animated.View style={[styles.banner, styles.syncBanner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.bannerEmoji}>⚠️</Text>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{t('sync_failed_title') || "Couldn't sync your data"}</Text>
      </View>
      <TouchableOpacity style={styles.bannerBtn} onPress={handleRetry} disabled={retrying}>
        {retrying
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.bannerBtnText}>{t('retry') || 'Retry'}</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={styles.bannerClose}>
        <Text style={styles.bannerCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function MoreSheet({ visible, onClose, token, onCouponWallet, onImport, onHelp }) {
  const { t } = useLanguage();
  const { prepareSpeech, playPrepared, stopSpeaking } = useFernVoice({ token, enabled: visible, allowFree: true });
  // Fern's short walkthrough lives inside the sheet itself (a second Modal over this one is dropped by iOS). It plays once ever:
  // the first time the sheet opens, one line per button, lighting that button and showing the line as a caption.
  const [lit, setLit] = useState(-1); // index of the lit button, -1 = none
  const [caption, setCaption] = useState('');
  const runRef = useRef(0);

  useEffect(() => {
    if (!visible) {
      runRef.current += 1;
      stopSpeaking();
      setLit(-1);
      setCaption('');
      return undefined;
    }
    runRef.current += 1;
    const run = runRef.current;
    let timer = null;
    (async () => {
      let heard = null;
      try { heard = await AsyncStorage.getItem('fern_more_intro_heard'); } catch (e) { /* ignore */ }
      if (heard || runRef.current !== run) return;
      try { await AsyncStorage.setItem('fern_more_intro_heard', '1'); } catch (e) { /* ignore */ }
      // Wait for the sheet to finish sliding up.
      await new Promise((resolve) => { timer = setTimeout(resolve, 900); });
      const segs = [
        { key: 'tour_more_step1', idx: -1 },
        { key: 'tour_more_step3', idx: 0 },
        { key: 'tour_more_step4', idx: 1 },
        { key: 'tour_more_step5', idx: 2 },
      ];
      const uris = segs.map((sg) => prepareSpeech(t(sg.key)));
      for (let i = 0; i < segs.length; i += 1) {
        if (runRef.current !== run) return;
        setLit(segs[i].idx);
        setCaption(t(segs[i].key));
        const uri = await uris[i];
        if (runRef.current !== run) return;
        await new Promise((resolve) => {
          const ok = uri ? playPrepared(uri, resolve) : null;
          setTimeout(resolve, ok ? 60000 : 4500);
        });
      }
      if (runRef.current === run) { setLit(-1); setCaption(''); }
    })();
    return () => { runRef.current += 1; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const items = [
    { key: 'coupons', label: t('more_coupon_wallet'), emoji: '🎟️', onPress: onCouponWallet },
    { key: 'import', label: t('importNavText'), emoji: '📥', onPress: onImport },
    { key: 'help', label: t('more_help'), emoji: '❓', onPress: onHelp },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.moreBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.moreSheet}>
          <View style={styles.moreHeader}>
            <View style={styles.moreHeaderTextWrap}>
              <Text style={styles.moreTitle}>{t('more_title')}</Text>
              <Text style={styles.moreSubtitle}>{t('more_subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.moreCloseBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.moreCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          {caption ? <Text style={styles.moreCaption}>{caption}</Text> : null}

          <View style={styles.moreGrid}>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.85}
                onPress={item.onPress}
                style={[styles.moreAction, lit === idx && styles.moreActionLit, lit >= 0 && lit !== idx && styles.moreActionDim]}
              >
                <Text style={styles.moreActionEmoji}>{item.emoji}</Text>
                <Text style={styles.moreActionText} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

async function checkForUpdate() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (e) {
    console.log('OTA check failed:', e.message);
  }
}

// "Publix - Blowing Rock" / "Harris Teeter #123" -> "Publix" / "Harris Teeter" so she says it naturally.
function shortStoreName(name) {
  return String(name || '').split(/ - |#/)[0].trim() || String(name || '');
}

function AppNavigator({ user, signOut, userStores: rawUserStores, syncError, retrySync }) {
  const { t } = useLanguage();
  const { visible: isAccountOpen, open: openAccountModal, close: closeAccount } = useAccountModal();
  const { visible: isPlansOpen, open: openPlans, close: closePlans } = usePlansModal();
  const {
    tour: activeTour,
    tourKey: activeTourKey,
    startedManually: tourStartedManually,
    stepIndex: activeTourStepIndex,
    setStepIndex: setActiveTourStepIndex,
    storageKey: activeTourStorageKey,
    closeTour,
  } = useTour();
  const [arrivedStore, setArrivedStore] = useState(null);
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  // The leaf button shows what Fern is doing while the voice session is open: 'listen' | 'talk' | 'think' | 'idle' | 'error' | 'off'.
  const [leafPhase, setLeafPhase] = useState('off');
  const [leafNote, setLeafNote] = useState(''); // the real problem, or what she just heard
  const leafPulse = React.useRef(new Animated.Value(1)).current;
  const leafRing = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const cfg = { listen: [1.12, 700, 0.7], talk: [1.07, 420, 0.8], think: [1.03, 1100, 0.5] }[leafPhase];
    if (!cfg) { leafPulse.setValue(1); leafRing.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(leafPulse, { toValue: cfg[0], duration: cfg[1], useNativeDriver: true }),
        Animated.timing(leafPulse, { toValue: 1, duration: cfg[1], useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(leafRing, { toValue: cfg[2], duration: cfg[1], useNativeDriver: true }),
        Animated.timing(leafRing, { toValue: 0.15, duration: cfg[1], useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [leafPhase, leafPulse, leafRing]);
  const [activeTabName, setActiveTabName] = useState('');
  // Lets screens (the new Home's "Ask Fern" bar) open this global chat sheet.
  useEffect(() => subscribeOpenChat(() => setIsChatOpen(true)), []);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  useEffect(() => subscribeOpenHelp(() => { requestToursScroll(); openAccountModal(); }), [openAccountModal]);
  const [showArrivalUpsell, setShowArrivalUpsell] = useState(false);
  const navigationRef = React.useRef(null);

  // A fern:// cookbook/recipe link was tapped: open Recipes and import it (RecipesScreen does the import).
  useEffect(() => subscribeLink((p) => {
    let tries = 0;
    const go = () => {
      const nav = navigationRef.current;
      if (!nav?.isReady?.()) { if (tries++ < 40) setTimeout(go, 250); return; }
      closeTour();
      nav.navigate('Recipes', { openTab: 'cookbooks', requestKey: String(Date.now()), importLink: p.link, importNonce: String(Date.now()) });
    };
    go();
  }), []);
  // First launch after installing from a share link: pick up the cookbook the share page copied.
  useEffect(() => { const t = setTimeout(() => checkShareClipboardOnce(AsyncStorage), 3000); return () => clearTimeout(t); }, []);

  // Plan checks for the arrival-notification tap. Refs, because that handler is
  // registered once and must see the current plan (RevenueCat can still be
  // loading when the tap cold-starts the app).
  const { hasAccess, loading: tierLoading } = useEntitlement();
  const hasShopperRef = useRef(false);
  const tierLoadingRef = useRef(true);
  hasShopperRef.current = hasAccess(FEATURE_TIERS.personal_shopper);
  tierLoadingRef.current = tierLoading;

  // Real saved stores from sync data, mapped to the {name, lat, lon}
  // shape useGeofence expects (stored stores use `lng`, not `lon`).
  // Stores missing coordinates are filtered out rather than crashing
  // the distance calc on undefined lat/lon.
  const userStores = (rawUserStores || [])
    .filter((s) => s && typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({ name: s.name, lat: s.lat, lon: s.lng }));

  const { start: startGeofence } = useGeofence({
    stores: userStores,
    onArrival: (store, distMeters) => {
      setArrivedStore(store);
      // Fern greets you out loud the moment you arrive (app open), and says she's here to help.
      try { speakWelcome(t('arrival_greet_say', { store: shortStoreName(store?.name || store) })); } catch (e) { /* ignore */ }
    },
  });

  // Start geofencing once user is logged in (uses permissions already granted).
  useEffect(() => {
    if (user) startGeofence();
  }, [user]);

  // Ask for location / "Always" / notifications on a short explanation screen: right
  // after signup or first login, and again (at most once a day) while something is missing.
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  // Fern's spoken greeting on store arrival (app open). The old unprompted first-run welcome (`leaf_welcome_say`) was removed
  // 2026-10-16: it repeated the Home tour and talked over whatever the person tapped next. The tour explains the leaf.
  const { speakText: speakWelcome } = useFernVoice({ token: user?.token, allowFree: true, enabled: true });
  // One-time "Pick your paper" screen (the Shopping list stationery), after sign-in. If the location screen is up it waits
  // for that to close first (iOS drops a modal opened while another is still dismissing). Device-only flag fern_paper_asked.
  const [showPaperPick, setShowPaperPick] = useState(false);
  const maybeAskPaper = (delay) => {
    AsyncStorage.getItem('fern_paper_asked').then((v) => {
      if (!v) setTimeout(() => setShowPaperPick(true), delay);
    }).catch(() => {});
  };
  const finishPaperPick = async (id) => {
    setShowPaperPick(false);
    try {
      await AsyncStorage.setItem('fern_paper_asked', 'done');
      if (id) await AsyncStorage.setItem(STATIONERY_KEY, id);
    } catch (e) { /* best effort */ }
  };
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    shouldShowLocationSetup(dateToKey(new Date())).then((show) => {
      if (!alive) return;
      if (show) setShowLocationSetup(true);
      else maybeAskPaper(2500);
    });
    return () => { alive = false; };
  }, [user?.id]);
  const finishLocationSetup = async () => {
    setShowLocationSetup(false);
    await markLocationSetupShown(dateToKey(new Date()));
    startGeofence(); // pick up whatever was just granted
    maybeAskPaper(900);
  };

  // Tapping the "you've arrived" notification (from the background geofence or the
  // foreground check). Pro Max opens Personal Shopper, which starts by scanning the
  // store flyer; everyone else lands on the shopping list, with a (once a day)
  // note about what Pro Max adds. Handles both a tap while the app is running and
  // a tap that launched the app from closed; the navigator and the plan may not
  // be ready yet in that case, so retry briefly.
  useEffect(() => {
    const open = (response, coldStart = false) => {
      const content = response?.notification?.request?.content;
      if (!content?.data || !['store_arrival', 'store_exit', 'everyday_nudge', 'deals_alert'].includes(content.data.type)) return;
      const isExit = content.data.type === 'store_exit';
      const id = response.notification.request.identifier;
      if (handledArrivalTaps.has(id)) return;
      handledArrivalTaps.add(id);
      setArrivedStore(null);
      const store = String(content.data.store || '');
      let tries = 0;
      // When the tap launched the app, give a plan granted from the admin panel a
      // moment to load from the device cache, so it isn't mistaken for a free plan.
      const settleUntil = Date.now() + (coldStart ? 1200 : 0);
      const go = () => {
        const nav = navigationRef.current;
        const navReady = Boolean(nav?.isReady?.());
        if (!navReady || tierLoadingRef.current || Date.now() < settleUntil) {
          if (tries++ < 40) setTimeout(go, 250);
          else if (navReady) nav.navigate('Shopping'); // plan never resolved: safe default
          return;
        }
        closeTour(); // a Home tour that opened underneath must not sit on top of the screen the tap opens
        setIsChatOpen(false); // the Ask Fern card must not sit on top of the screen the tap opens
        // Arrival: Home starts that store's flyer scan (same as tapping the store on Home). Leaving a store lands on the
        // Shopping savings card, and the everyday nudge on Shopping's Everyday card.
        if (content.data.type === 'everyday_nudge') nav.navigate('Shopping', { everyday: Date.now() });
        else if (content.data.type === 'deals_alert') {
          // sale alert: that store's circular on Shopping when the push names a store, else the circulars list
          if (store) nav.navigate('Shopping', { guide: Date.now(), guideStore: store });
          else nav.navigate('Home', { openCirculars: Date.now() });
        }
        else if (isExit) nav.navigate('Shopping', { tripDone: Date.now() });
        else nav.navigate('Shopping', { guide: Date.now(), guideStore: store, greet: true }); // arrival: Fern starts guiding the trip
      };
      go();
    };
    Notifications.getLastNotificationResponseAsync().then((response) => open(response, true)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((response) => open(response, false));
    return () => sub.remove();
  }, []);

  // At most once a day, so a weekly shop never turns into a nag. Device-only.
  const maybeShowArrivalUpsell = async () => {
    const today = dateToKey(new Date());
    try {
      if ((await AsyncStorage.getItem('fern_arrival_upsell_last')) === today) return;
      await AsyncStorage.setItem('fern_arrival_upsell_last', today);
    } catch (e) { /* storage unavailable: show it anyway */ }
    setShowArrivalUpsell(true);
  };

  // A dismissed banner should come back if sync fails again later, rather
  // than staying hidden for the rest of the session after the first dismiss.
  useEffect(() => {
    if (syncError) setSyncBannerDismissed(false);
  }, [syncError]);

  // When a tour starts (e.g. "Take a Tour" from AccountScreen/PlansScreen),
  // switch to the tab it's narrating so that real, live screen is what's
  // frozen behind the tour card — instead of whatever overlay happened to be
  // open. Tours with no direct screen (see TOUR_PREVIEW_ROUTE) are a no-op
  // here and just show whatever's already behind.
  //
  // Deliberately tab-only, not modal-opening: RN's Modal has no z-index, and
  // several feature modals (e.g. FridgeChallengeModal) already call their
  // own maybeAutoStart() the moment they open. Forcing TourModal to also
  // stack on top in that case blocks all touches to the real modal — that
  // was a real bug (tapping Fridge Challenge appeared to "freeze"). Tabs
  // don't have this problem since they're not native Modals, so this stays
  // scoped to navigation only.
  // Finishing a feature tour that was picked from the Account / Plans list takes the person into that feature
  // (Fridge Challenge tour -> the Fridge Challenge page). If a plan ever locks it, the feature's own upgrade offer shows.
  const launchAfterTour = (key) => {
    if (!key || !tourStartedManually) return;
    const TOOL_ON_HOME = { weekly_nutrition: 'nutrition', fridge_challenge: 1, leftover_magic: 1, quick_dinner: 1, budget_planner: 1, meal_planner: 1, semi_homemade: 1, charcuterie: 1, wine_pairing: 1, nutrition: 1, dinner_party: 1, alexa_skill: 1, family_vault: 1 };
    const SCREEN = { find: 'Find', recipes: 'Recipes', cook_mode: 'Recipes', shopping: 'Shopping', shopping_mode: 'Shopping', personal_shopper: 'Shopping', instacart: 'Shopping', family_hub: 'Family' };
    // Wait for the tour card to finish closing: iOS drops a modal opened while another is still dismissing.
    setTimeout(() => {
      if (key === 'ask_fern') { setIsChatOpen(true); return; }
      if (TOOL_ON_HOME[key]) {
        const tool = typeof TOOL_ON_HOME[key] === 'string' ? TOOL_ON_HOME[key] : key;
        navigationRef.current?.navigate('Home');
        setTimeout(() => requestOpenTool(tool), 250);
      } else if (SCREEN[key]) {
        navigationRef.current?.navigate(SCREEN[key]);
      }
    }, 500);
  };

  useEffect(() => {
    const route = TOUR_PREVIEW_ROUTE[activeTourKey];
    if (route) navigationRef.current?.navigate(route);
  }, [activeTourKey]);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" />
      {/* Sync failure banner -- shown above the arrival banner since a
          failed sync is a more fundamental problem than a store arrival */}
      {syncError && !syncBannerDismissed && (
        <SyncFailedBanner
          onRetry={retrySync}
          onDismiss={() => setSyncBannerDismissed(true)}
        />
      )}
      {/* Store arrival banner */}
      {arrivedStore && (
        <ArrivalBanner
          store={arrivedStore}
          onShop={() => {
            setArrivedStore(null);
            navigationRef.current?.navigate('Shopping', { guide: Date.now(), guideStore: String(arrivedStore?.name || arrivedStore || ''), greet: true });
          }}
          onDismiss={() => setArrivedStore(null)}
        />
      )}

      <MoreSheet
        visible={isMoreOpen}
        token={user?.token}
        onClose={() => setIsMoreOpen(false)}
        onCouponWallet={() => {
          setIsMoreOpen(false);
          navigationRef.current?.navigate('Home', { openCouponWallet: Date.now() });
        }}
        onImport={() => {
          setIsMoreOpen(false);
          navigationRef.current?.navigate('Home', { openImport: true, requestKey: String(Date.now()) });
        }}
        onHelp={() => {
          setIsMoreOpen(false);
          setTimeout(() => { requestToursScroll(); openAccountModal(); }, 450);
        }}
      />

      <ChatSheetModal
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        user={user}
        mode="text"
        silent
        compact
        onPhase={(p, detail) => { setLeafPhase(p); setLeafNote(String(detail || '')); }}
        onShow={(w) => {
          // She just changed something: jump to where it is so the person watches it happen (the chat stays open and she keeps talking).
          if (!w?.screen) return;
          if (w.screen === 'Family') navigationRef.current?.navigate('Family', { showDayOffset: w.dayOffset || 0, showNonce: Date.now(), showKind: w.kind, showLabel: w.label, showSlot: w.slot });
          else navigationRef.current?.navigate(w.screen);
        }}
        onSpeechDone={(p) => {
          // Fern finished talking and asked to open something / close the card.
          setIsChatOpen(false);
          const item = String(p?.show_recipes_for || '').trim();
          setTimeout(() => {
            if (item) navigationRef.current?.navigate('Shopping', { recipesFor: item, recipesNonce: Date.now() });
            else if (p?.go_to) navigationRef.current?.navigate(p.go_to);
          }, 350);
        }}
      />

      <HelpModal
        visible={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <UpgradeGateModal
        visible={showArrivalUpsell}
        onClose={() => setShowArrivalUpsell(false)}
        tier={TIERS.PRO_MAX}
        title={t('arrival_upsell_title')}
        desc={t('arrival_upsell_desc')}
      />

      <AccountScreen
        visible={isAccountOpen}
        onClose={closeAccount}
        user={user}
        signOut={signOut}
        onOpenShopping={() => navigationRef.current?.navigate('Shopping')}
      />

      <PlansScreen
        visible={isPlansOpen}
        onClose={closePlans}
      />

      <LocationSetupModal visible={showLocationSetup} onDone={finishLocationSetup} />
      <PaperPickModal visible={showPaperPick} onDone={finishPaperPick} />

      <TourModal
        visible={!!activeTour}
        tour={activeTour}
        storageKey={activeTourStorageKey}
        onClose={closeTour}
        onDone={() => launchAfterTour(activeTourKey)}
        token={user?.token}
        stepIndex={activeTourStepIndex}
        setStepIndex={setActiveTourStepIndex}
      />

      {!!leafNote && isChatOpen && (
        <View style={styles.leafProblem} pointerEvents="none">
          <Text style={styles.leafProblemText} numberOfLines={3}>{leafPhase === 'error' ? `${t('voice_fern_problem')} ` : ''}{leafNote}</Text>
        </View>
      )}
      {isChatOpen && <Animated.View pointerEvents="none" style={[styles.chatFabRing, { opacity: leafRing, transform: [{ scale: leafPulse }] }]} />}
      <Animated.View style={[styles.chatFabWrap, { transform: [{ scale: isChatOpen ? leafPulse : 1 }] }]}>
        <TouchableOpacity
          style={styles.chatFab}
          activeOpacity={0.85}
          onPress={() => {
            // One Fern everywhere. Tap = start talking to her; tap again = end the conversation. The app stays visible the whole time.
            setIsChatOpen((open) => !open);
          }}
          accessibilityLabel={t('ask_fern_btn')}
        >
          <Text style={styles.chatFabText}>🌿</Text>
        </TouchableOpacity>
      </Animated.View>

      <Tab.Navigator
        screenListeners={{
          // A genuine user tap on a tab bar button — not the tour system's own
          // programmatic navigate() above, which doesn't fire tabPress. Whatever
          // tour bubble (and its narration audio) was open no longer matches
          // what's on screen once the tab changes, so close it immediately
          // rather than leaving it floating over the new screen.
          tabPress: () => { Keyboard.dismiss(); closeTour(); },
          focus: (e) => setActiveTabName(String(e?.target || '').split('-')[0]),
        }}
        screenOptions={{
          headerShown: true,
          headerTitle: () => <AppTabHeader />,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: '#F0B3A3',
            height: 100,
          },
          headerTintColor: '#7A3C42',
          headerShadowVisible: false,

          tabBarStyle: {
            backgroundColor: '#FFF4EE',
            borderTopColor: '#F3C9BD',
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 70,
          },
          tabBarHideOnKeyboard: Platform.OS === 'android',
          tabBarActiveTintColor: '#D8607C',
          tabBarInactiveTintColor: '#8F6F6A',
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginTop: 2,
          },
          headerTitleContainerStyle: {
            left: 0,
            right: 0,
            paddingHorizontal: 20,
          },
        }}
      >

        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: t('nav_home'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />
          }}
        >
          {({ route }) => <HomeScreen user={user} route={route} />}
        </Tab.Screen>
        <Tab.Screen
          name="Find"
          options={{
            tabBarLabel: t('nav_find'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />
          }}
        >
          {() => <SearchScreen user={user} />}
        </Tab.Screen>
        <Tab.Screen
          name="Family"
          options={{
            tabBarLabel: t('nav_family'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} />,
          }}
        >
          {() => <FamilyScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
          name="Recipes"
          options={{
            tabBarLabel: t('nav_recipes'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} />
          }}
        >
          {() => <RecipesScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
          name="Shopping"
          options={{
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        >
          {() => <ShoppingScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
          name="More"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setIsMoreOpen(true);
            },
          }}
          options={{
            tabBarLabel: t('nav_more'),
            tabBarIcon: ({ focused }) => (
              <Ionicons
                name="ellipsis-horizontal"
                size={28}
                color={focused ? '#B59C48' : '#999'}
              />
            ),
          }}
        >
          {() => null}
        </Tab.Screen>

      </Tab.Navigator>
    </NavigationContainer>
  );
}

function MainAppContent() {
  const { user, loading, signInWithSupabase, signUpWithSupabase, forgotPassword, resetPassword, signInWithApple, signInWithGoogle, appleAvailable, googleAvailable, signOut, syncError, retrySync } = useAuth();
  const { loginPurchaser, logoutPurchaser, tier: rcTier, loading: rcLoading } = useRevenueCat();
  const { pushChangedFromStorage, data: syncData } = useSync(user);
  console.log('📱 App rendering, current user:', user?.email || 'none', 'loading:', loading);

  useEffect(() => {
    checkForUpdate();
  }, []);

  // Keep the weekly "everyday items" nudge scheduled (replaces itself, so this is safe on every launch).
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const day = await getShoppingDay();
      let locale = 'en';
      try { locale = (await AsyncStorage.getItem('fern_user_locale')) || 'en'; } catch (e) { /* default */ }
      const dict = translations[locale] || translations.en;
      scheduleEverydayNudge(day, { title: dict.everyday_nudge_title, body: dict.everyday_nudge_body });
    })();
  }, [user?.id]);

  // Attach the RevenueCat purchaser to the real backend user id once auth
  // resolves, so purchases (and entitlements already on that account from
  // another device) are tied to the right person rather than an anonymous id.
  useEffect(() => {
    if (user?.id) {
      loginPurchaser(user.id);
    }
  }, [user?.id]);

  // Push the current RevenueCat tier (free/pro/pro_max) to the sync backend
  // on every app launch, so the web app can read the same status. This same
  // effect also re-fires whenever `rcTier` changes mid-session — which
  // happens automatically after a purchase or restore, since
  // RevenueCatContext's customerInfo listener (see RevenueCatContext.js)
  // updates `rcTier` the moment the SDK reports a new entitlement, however
  // the purchase happened (PlansScreen, UpgradeGateModal, or the "Restore
  // Purchases" action) — so no per-screen wiring is needed for that case.
  // Wait for RevenueCat to finish resolving first — it reports FREE while
  // loading, and pushing that prematurely would clobber a real Pro/Pro Max
  // tier already on record.
  const didInitialTierSyncRef = useRef(false);
  useEffect(() => {
    if (!user?.id || rcLoading) return;
    const isLaunchSync = !didInitialTierSyncRef.current;
    didInitialTierSyncRef.current = true;

    AsyncStorage.setItem('fern_user_tier', JSON.stringify(rcTier))
      .then(() => pushChangedFromStorage({ tier: rcTier }))
      .then(() => {
        console.log('\n🔔🔔🔔 ============================================');
        console.log(`🔔🔔🔔  TIER SYNCED TO BACKEND ${isLaunchSync ? '(APP LAUNCH)' : '(PLAN CHANGED)'}`);
        console.log(`🔔🔔🔔  user: ${user.email || user.id}`);
        console.log(`🔔🔔🔔  plan: ${rcTier}`);
        console.log(`🔔🔔🔔  token: ${user.token}`);
        console.log('🔔🔔🔔 ============================================\n');
      })
      .catch((e) => console.warn('⚠️ Failed to push tier to sync:', e.message));
  }, [user?.id, rcTier, rcLoading]);

  // Tell the server this phone can receive circular sale alerts. Runs when the user signs in and
  // again each time the app returns to the foreground (the notification permission may have been
  // granted in between); it only talks to the server when the user or token changed.
  useEffect(() => {
    if (!user?.id || !user?.token) return undefined;
    registerForPush(user);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') registerForPush(user); });
    return () => sub.remove();
  }, [user?.id, user?.token]);

  const handleSignOut = async () => {
    await stopStoreGeofencing(); // stop the OS watching this user's stores
    await logoutPurchaser();
    await signOut();
  };

  if (loading) return null;

  if (!user) {
    console.log(user)
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          onAuthSuccess={() => {
            // User state is automatically updated by useAuth hook
            // The app will re-render when user state changes
          }}
          signInWithSupabase={signInWithSupabase}
          signUpWithSupabase={signUpWithSupabase}
          forgotPassword={forgotPassword}
          resetPassword={resetPassword}
          signInWithApple={signInWithApple}
          signInWithGoogle={signInWithGoogle}
          appleAvailable={appleAvailable}
          googleAvailable={googleAvailable}
        />
      </>
    );
  }

  return (
    <>
      <AppNavigator user={user} signOut={handleSignOut} userStores={syncData.userStores} syncError={syncError} retrySync={retrySync} />
      <ShoppingDayPrompt userId={user?.id} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Playfair-Regular': require('./assets/fonts/PlayfairDisplay-Regular.ttf'),
    'Playfair-Italic': require('./assets/fonts/PlayfairDisplay-Italic.ttf'),
    'Playfair-Medium': require('./assets/fonts/PlayfairDisplay-Medium.ttf'),
    'Playfair-MediumItalic': require('./assets/fonts/PlayfairDisplay-MediumItalic.ttf'),
    'Playfair-SemiBold': require('./assets/fonts/PlayfairDisplay-SemiBold.ttf'),
    'Playfair-SemiBoldItalic': require('./assets/fonts/PlayfairDisplay-SemiBoldItalic.ttf'),
    'Playfair-Bold': require('./assets/fonts/PlayfairDisplay-Bold.ttf'),

    'Jost-Regular': require('./assets/fonts/Jost-Regular.ttf'),
    'Jost-SemiBold': require('./assets/fonts/Jost-SemiBold.ttf'),
    'Jost-Bold': require('./assets/fonts/Jost-Bold.ttf'),
  });

  return (
    <SafeAreaProvider>
      <RevenueCatProvider>
        <LanguageProvider>
          <AccountModalProvider>
            <PlansModalProvider>
              <TourProvider>
                <ErrorBoundary>
                  <MainAppContent />
                </ErrorBoundary>
              </TourProvider>
            </PlansModalProvider>
          </AccountModalProvider>
        </LanguageProvider>
      </RevenueCatProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    marginBottom: 10,
  },
  appHeaderIcon: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
    marginRight: 10,
    marginLeft: 0,
  },
  appHeaderText: {
    color: '#7A3C42',
    fontFamily: 'Jost-Bold',
    fontSize: 22,
  },
  appHeaderSubText: {
    fontSize: 8,
    fontFamily: 'Jost-Bold',
    color: '#A9756F',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 999,
    backgroundColor: '#8A4A4E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,232,224,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 52, // safe area
    gap: 10,
    ...shadow.strong,
  },
  bannerEmoji: { fontSize: 24 },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: colors.onFern },
  bannerSub: { fontSize: 12, color: '#EBCFC6', marginTop: 2 },
  bannerBtn: { backgroundColor: '#D8607C', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bannerClose: { padding: 6 },
  bannerCloseText: { color: 'rgba(255,255,255,0.4)', fontSize: 18 },
  syncBanner: { backgroundColor: '#B45309', borderBottomColor: 'rgba(255,255,255,0.25)' },

  chatFabWrap: { position: 'absolute', right: 18, bottom: 86, zIndex: 998, width: 56, height: 56 },
  chatFabRing: { position: 'absolute', right: 6, bottom: 74, zIndex: 997, width: 80, height: 80, borderRadius: 40, backgroundColor: '#D8607C' },
  leafProblem: { position: 'absolute', right: 18, bottom: 152, zIndex: 999, maxWidth: 260, backgroundColor: 'rgba(30,30,30,0.92)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  leafProblemText: { color: '#fff', fontSize: 12 },
  chatFab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: '#D8607C',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.strong,
  },
  chatFabText: { fontSize: 26 },

  moreBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // Same look as the app's feature screens: forest header band, Playfair title in
  // gold, parchment body.
  moreSheet: {
    backgroundColor: '#8A4A4E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 34,
    ...shadow.strong,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8A4A4E',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
  },
  moreHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  moreTitle: {
    fontFamily: 'Playfair-Bold',
    fontSize: 20,
    color: '#FDE8E0',
  },
  moreSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#F3C9BD',
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  moreCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCloseText: {
    fontSize: 24,
    lineHeight: 26,
    color: '#FDE8E0',
    marginTop: -2,
  },
  // Buttons match the bottom tab bar: emoji icon over a small uppercase label, on forest.
  moreGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  moreCaption: { color: '#FDE8E0', fontSize: 15, lineHeight: 21, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  moreActionLit: { borderWidth: 3, borderColor: '#D8607C', borderRadius: 14, backgroundColor: 'rgba(242,140,40,0.18)' },
  moreActionDim: { opacity: 0.35 },
  moreAction: {
    flex: 1,
    height: 70,
    paddingTop: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreActionEmoji: {
    fontSize: 22,
  },
  moreActionText: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#F3C9BD',
  },

});
