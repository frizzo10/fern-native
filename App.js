import React, { useEffect, useRef, useState } from 'react';
import { translations } from './src/constants/translations';
import { getShoppingDay, scheduleEverydayNudge } from './src/utils/staples';
import ShoppingDayPrompt from './src/components/ShoppingDayPrompt';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Image, Text, View, StyleSheet, TouchableOpacity, Animated, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
import { shouldShowLocationSetup, markLocationSetupShown } from './src/services/locationSetup';
import { stopStoreGeofencing } from './src/services/storeGeofencing';
import useEntitlement from './src/hooks/useEntitlement';
import { FEATURE_TIERS } from './src/constants/featureAccess';
import { TIERS } from './src/constants/tiers';
import { dateToKey } from './src/utils/familyDates';
import UpgradeGateModal from './src/components/UpgradeGateModal';
import { colors, radius, shadow } from './src/constants/tokens';
import { useFonts } from 'expo-font';
import { LanguageProvider } from './src/services/LanguageContext';
import { useLanguage } from './src/hooks/useLanguage';
import ChatSheetModal from './src/components/modals/ChatSheetModal';
import { subscribeOpenChat } from './src/services/chatBus';
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
        source={require('./assets/icon.png')}
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
    const t = setTimeout(onDismiss, 45000); // auto-dismiss after 45s
    return () => clearTimeout(t);
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

function MoreSheet({ visible, onClose, onProfile, onCookbooks, onImport, onHelp, onLogout }) {
  const { t } = useLanguage();

  const items = [
    { key: 'profile', label: t('more_profile'), emoji: '👤', onPress: onProfile },
    { key: 'cookbooks', label: t('more_cookbooks'), emoji: '📚', onPress: onCookbooks },
    { key: 'import', label: t('importNavText'), emoji: '📥', onPress: onImport },
    { key: 'help', label: t('more_help'), emoji: '❓', onPress: onHelp },
    { key: 'logout', label: t('more_logout'), emoji: '🚪', onPress: onLogout },
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

          <View style={styles.moreGrid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.85}
                onPress={item.onPress}
                style={styles.moreAction}
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

function AppNavigator({ user, signOut, userStores: rawUserStores, syncError, retrySync }) {
  const { t } = useLanguage();
  const { visible: isAccountOpen, open: openAccount, close: closeAccount } = useAccountModal();
  const { visible: isPlansOpen, open: openPlans, close: closePlans } = usePlansModal();
  const {
    tour: activeTour,
    tourKey: activeTourKey,
    stepIndex: activeTourStepIndex,
    setStepIndex: setActiveTourStepIndex,
    storageKey: activeTourStorageKey,
    closeTour,
  } = useTour();
  const [arrivedStore, setArrivedStore] = useState(null);
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTabName, setActiveTabName] = useState('');
  // Lets screens (the new Home's "Ask Fern" bar) open this global chat sheet.
  useEffect(() => subscribeOpenChat(() => setIsChatOpen(true)), []);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showArrivalUpsell, setShowArrivalUpsell] = useState(false);
  const navigationRef = React.useRef(null);

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
    },
  });

  // Start geofencing once user is logged in (uses permissions already granted).
  useEffect(() => {
    if (user) startGeofence();
  }, [user]);

  // Ask for location / "Always" / notifications on a short explanation screen: right
  // after signup or first login, and again (at most once a day) while something is missing.
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    shouldShowLocationSetup(dateToKey(new Date())).then((show) => { if (alive && show) setShowLocationSetup(true); });
    return () => { alive = false; };
  }, [user?.id]);
  const finishLocationSetup = async () => {
    setShowLocationSetup(false);
    await markLocationSetupShown(dateToKey(new Date()));
    startGeofence(); // pick up whatever was just granted
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
      if (!content?.data || !['store_arrival', 'store_exit', 'everyday_nudge'].includes(content.data.type)) return;
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
        // The whole trip (list, flyer, sales, coupons, a week of dinners) lives on the Shopping screen.
        nav.navigate('Shopping', content.data.type === 'everyday_nudge' ? { everyday: Date.now() } : isExit ? { tripDone: Date.now() } : { tripStart: Date.now(), store });
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
  useEffect(() => {
    const route = TOUR_PREVIEW_ROUTE[activeTourKey];
    if (route) navigationRef.current?.navigate(route);
  }, [activeTourKey]);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
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
            navigationRef.current?.navigate('Shopping');
          }}
          onDismiss={() => setArrivedStore(null)}
        />
      )}

      <MoreSheet
        visible={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        onProfile={() => {
          setIsMoreOpen(false);
          openAccount();
        }}
        onCookbooks={() => {
          setIsMoreOpen(false);
          navigationRef.current?.navigate('Recipes', { openTab: 'cookbooks', requestKey: String(Date.now()) });
        }}
        onImport={() => {
          setIsMoreOpen(false);
          navigationRef.current?.navigate('Home', { openImport: true, requestKey: String(Date.now()) });
        }}
        onHelp={() => {
          setIsMoreOpen(false);
          setIsHelpOpen(true);
        }}
        onLogout={() => {
          setIsMoreOpen(false);
          signOut();
        }}
      />

      <ChatSheetModal
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        user={user}
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

      <TourModal
        visible={!!activeTour}
        tour={activeTour}
        storageKey={activeTourStorageKey}
        onClose={closeTour}
        token={user?.token}
        stepIndex={activeTourStepIndex}
        setStepIndex={setActiveTourStepIndex}
      />

      {!isChatOpen && (
        <TouchableOpacity
          style={styles.chatFab}
          activeOpacity={0.85}
          onPress={() => {
            // On the Shopping page the leaf talks about the shopping list (add / change / remove); elsewhere it's Ask Fern.
            if (activeTabName === 'Shopping') navigationRef.current?.navigate('Shopping', { listChat: Date.now() });
            else setIsChatOpen(true);
          }}
          accessibilityLabel={t('ask_fern_btn')}
        >
          <Text style={styles.chatFabText}>🌿</Text>
        </TouchableOpacity>
      )}

      <Tab.Navigator
        screenListeners={{
          // A genuine user tap on a tab bar button — not the tour system's own
          // programmatic navigate() above, which doesn't fire tabPress. Whatever
          // tour bubble (and its narration audio) was open no longer matches
          // what's on screen once the tab changes, so close it immediately
          // rather than leaving it floating over the new screen.
          tabPress: () => closeTour(),
          focus: (e) => setActiveTabName(String(e?.target || '').split('-')[0]),
        }}
        screenOptions={{
          headerShown: true,
          headerTitle: () => <AppTabHeader />,
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: '#1C3A1A',
            height: 100,
          },
          headerTintColor: '#fff',
          headerShadowVisible: false,

          tabBarStyle: {
            backgroundColor: colors.forest,
            borderTopColor: 'rgba(168,200,162,0.2)',
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 70,
          },
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.orange,
          tabBarInactiveTintColor: 'rgba(168,213,162,0.45)',
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
  const { user, loading, signInWithSupabase, signUpWithSupabase, forgotPassword, resetPassword, signOut, syncError, retrySync } = useAuth();
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
                <MainAppContent />
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
    marginLeft: -20,
  },
  appHeaderText: {
    color: '#F5EFE6',
    fontFamily: 'Jost-Bold',
    fontSize: 22,
  },
  appHeaderSubText: {
    fontSize: 8,
    fontFamily: 'Jost-Bold',
    color: '#A8D5A2',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 999,
    backgroundColor: colors.forest,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168,213,162,0.2)',
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
  bannerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bannerBtn: { backgroundColor: colors.orange, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bannerClose: { padding: 6 },
  bannerCloseText: { color: 'rgba(255,255,255,0.4)', fontSize: 18 },
  syncBanner: { backgroundColor: '#B45309', borderBottomColor: 'rgba(255,255,255,0.25)' },

  chatFab: {
    position: 'absolute',
    right: 18,
    bottom: 86,
    zIndex: 998,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.orange,
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
    backgroundColor: colors.forest,
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
    backgroundColor: colors.forest,
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
    color: '#F0E0B0',
  },
  moreSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.sage,
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
    color: '#F0E0B0',
    marginTop: -2,
  },
  // Buttons match the bottom tab bar: emoji icon over a small uppercase label, on forest.
  moreGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 2,
  },
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
    color: colors.sage,
  },

});
