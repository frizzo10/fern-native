import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';

import HomeScreen      from './src/screens/HomeScreen';
import FindScreen      from './src/screens/FindScreen';
import ShoppingScreen  from './src/screens/ShoppingScreen';
import RecipesScreen   from './src/screens/RecipesScreen';
import LoginScreen     from './src/screens/LoginScreen';
import ErrorBoundary   from './src/components/ErrorBoundary';
import { setupGlobalErrorHandler } from './src/lib/crashLogger';
import { useAuth }     from './src/hooks/useAuth';
import { useGeofence } from './src/hooks/useGeofence';
import { colors, radius, shadow } from './src/constants/tokens';
import { LocaleProvider, useTranslation } from './src/i18n/LocaleContext';
import { SyncProvider } from './src/hooks/SyncContext';
import { useSync } from './src/hooks/useSync';

const Tab = createBottomTabNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize:22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

function ArrivalBanner({ store, onShop, onDismiss }) {
  const { t } = useTranslation();
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:80 }).start();
    const timer = setTimeout(onDismiss, 45000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.banner, { transform:[{ translateY:slideAnim }] }]}>
      <Text style={styles.bannerEmoji}>🛒</Text>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{t('arrivedTitle', store.name)}</Text>
        <Text style={styles.bannerSub}>{t('arrivedSub')}</Text>
      </View>
      <TouchableOpacity style={styles.bannerBtn} onPress={onShop}>
        <Text style={styles.bannerBtnText}>{t('shopBtn')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={styles.bannerClose}>
        <Text style={styles.bannerCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
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

function MainApp({ user }) {
  const { t } = useTranslation();
  const [arrivedStore, setArrivedStore] = useState(null);

  const { data } = useSync(user);

  const { start: startGeofence } = useGeofence({
    stores: data.stores,
    onArrival: (store) => setArrivedStore(store),
  });

  useEffect(() => {
    if (user) {
      setupGlobalErrorHandler(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      startGeofence();
    }
  }, [user, (data.stores || []).length]);

  return (
    <NavigationContainer>
      <StatusBar style="light" />

      {arrivedStore && (
        <ArrivalBanner
          store={arrivedStore}
          onShop={() => setArrivedStore(null)}
          onDismiss={() => setArrivedStore(null)}
        />
      )}

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor:  colors.forest,
            borderTopColor:   'rgba(168,213,162,0.2)',
            borderTopWidth:   1,
            paddingBottom:    6,
            paddingTop:       6,
            height:           62,
          },
          tabBarActiveTintColor:   colors.orange,
          tabBarInactiveTintColor: 'rgba(168,213,162,0.45)',
          tabBarLabelStyle: {
            fontSize:      9,
            fontWeight:    '800',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginTop:     2,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          options={{ tabBarLabel: t('tabHome'), tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
        >
          {() => (
            <ErrorBoundary>
              <HomeScreen user={user} />
            </ErrorBoundary>
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Find"
          options={{ tabBarLabel: t('tabFind'), tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }}
        >
          {() => (
            <ErrorBoundary>
              <FindScreen user={user} />
            </ErrorBoundary>
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Shopping"
          options={{
            tabBarLabel: t('tabShop'),
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
          }}
        >
          {() => (
            <ErrorBoundary>
              <ShoppingScreen user={user} />
            </ErrorBoundary>
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Recipes"
          options={{ tabBarLabel: t('tabRecipes'), tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} /> }}
        >
          {() => (
            <ErrorBoundary>
              <RecipesScreen user={user} />
            </ErrorBoundary>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const { user, loading, signIn, signInWithGoogle } = useAuth();

  useEffect(() => { checkForUpdate(); }, []);

  if (loading) return null;

  // Wrap entire app in top-level ErrorBoundary + LocaleProvider so every
  // screen (including LoginScreen, before a user exists) can call useTranslation().
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <StatusBar style="light" />
        {user
          ? <SyncProvider user={user}><MainApp user={user} /></SyncProvider>
          : <LoginScreen onLogin={signIn} onLoginWithGoogle={signInWithGoogle} />
        }
      </LocaleProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  banner:          { position:'absolute', top:0, left:0, right:0, zIndex:999,
                     backgroundColor:colors.forest,
                     borderBottomWidth:1, borderBottomColor:'rgba(168,213,162,0.2)',
                     flexDirection:'row', alignItems:'center',
                     padding:12, paddingTop:52, gap:10, ...shadow.strong },
  bannerEmoji:     { fontSize:24 },
  bannerText:      { flex:1 },
  bannerTitle:     { fontSize:14, fontWeight:'800', color:colors.onFern },
  bannerSub:       { fontSize:12, color:colors.muted, marginTop:2 },
  bannerBtn:       { backgroundColor:colors.orange, borderRadius:radius.md,
                     paddingHorizontal:14, paddingVertical:8 },
  bannerBtnText:   { color:'#fff', fontWeight:'800', fontSize:13 },
  bannerClose:     { padding:6 },
  bannerCloseText: { color:'rgba(255,255,255,0.4)', fontSize:18 },
});

// Note: add this import at the top of App.js:
// import { setupGlobalErrorHandler } from './src/lib/crashLogger';
// And call it after user loads:
// useEffect(() => { if (user) setupGlobalErrorHandler(user.id); }, [user]);
