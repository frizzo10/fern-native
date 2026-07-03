import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Text, View, StyleSheet, TouchableOpacity, Animated, Modal, Pressable, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

function AppNavigator({ user, signOut }) {
  const { t } = useLanguage();
  const [arrivedStore, setArrivedStore] = useState(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const navigationRef = React.useRef(null);

  // Mock stores — replace with sync from useSync
  const userStores = user ? [] : []; // populated from sync data

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

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
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
          navigationRef.current?.navigate('Home');
        }}
        onCookbooks={() => {
          setIsMoreOpen(false);
          navigationRef.current?.navigate('Recipes', { openTab: 'cookbooks', requestKey: String(Date.now()) });
        }}
        onHelp={() => {
          setIsMoreOpen(false);
          Alert.alert(t('more_help'), t('coming_soon'));
        }}
        onLogout={() => {
          setIsMoreOpen(false);
          signOut();
        }}
      />

      <Tab.Navigator
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
  const { user, loading, signInWithSupabase, signUpWithSupabase, signOut } = useAuth();
  console.log('📱 App rendering, current user:', user?.email || 'none', 'loading:', loading);

  useEffect(() => {
    checkForUpdate();
  }, []);

  if (loading) return null;

  if (user) {
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
        />
      </>
    );
  }

  return <AppNavigator user={user} signOut={signOut} />;
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
    <LanguageProvider>
      <MainAppContent />
    </LanguageProvider>
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
