import React, { useEffect, useRef, useState } from 'react';
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
import { colors, radius, shadow } from './src/constants/tokens';
import { useFonts } from 'expo-font';
import { LanguageProvider } from './src/services/LanguageContext';
import { useLanguage } from './src/hooks/useLanguage';
import ChatSheetModal from './src/components/modals/ChatSheetModal';
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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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

function MoreSheet({ visible, onClose, onProfile, onCookbooks, onHelp, onLogout }) {
  const { t } = useLanguage();

  const items = [
    { key: 'profile', label: t('more_profile'), icon: 'person-outline', onPress: onProfile },
    { key: 'cookbooks', label: t('more_cookbooks'), icon: 'book-outline', onPress: onCookbooks },
    { key: 'help', label: t('more_help'), icon: 'help-circle-outline', onPress: onHelp },
    { key: 'logout', label: t('more_logout'), icon: 'log-out-outline', onPress: onLogout },
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
                <Ionicons name={item.icon} size={20} color={colors.orange} />
                <Text style={styles.moreActionText}>{item.label}</Text>
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const navigationRef = React.useRef(null);

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

  // Start geofencing once user is logged in
  useEffect(() => {
    if (user) startGeofence();
  }, [user]);

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
          onPress={() => setIsChatOpen(true)}
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
          {() => <HomeScreen user={user} />}
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

  return <AppNavigator user={user} signOut={handleSignOut} userStores={syncData.userStores} syncError={syncError} retrySync={retrySync} />;
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
  moreSheet: {
    height: '30%',
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    ...shadow.strong,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moreHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  moreTitle: {
    fontFamily: 'Jost-Bold',
    fontSize: 18,
    color: '#20140B',
  },
  moreSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#7E6A55',
    fontFamily: 'Jost-Regular',
  },
  moreCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#D4C3AD',
    backgroundColor: '#EFE9DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCloseText: {
    fontSize: 24,
    lineHeight: 26,
    color: '#8C6B46',
    marginTop: -2,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moreAction: {
    width: '48%',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6DCCF',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moreActionText: {
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    color: '#20140B',
  },

});
