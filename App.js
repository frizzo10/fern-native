import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Text, View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import HomeScreen     from './src/screens/HomeScreen';
import FindScreen     from './src/screens/FindScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import FamilyScreen from './src/screens/FamilyScreen';
import RecipesScreen  from './src/screens/RecipesScreen';
import LoginScreen    from './src/screens/LoginScreen';
import { useAuth }    from './src/hooks/useAuth';
import { useGeofence } from './src/hooks/useGeofence';
import { colors, radius, shadow } from './src/constants/tokens';
import {

  useFonts,

  Jost_400Regular,

  Jost_700Bold,

} from '@expo-google-fonts/jost';

const Tab = createBottomTabNavigator();
const emoji = "..."

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

// Store arrival banner — slides down from top
function ArrivalBanner({ store, onShop, onDismiss }) {
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
        <Text style={styles.bannerTitle}>{store.name} — you've arrived</Text>
        <Text style={styles.bannerSub}>Ready to shop with Fern?</Text>
      </View>
      <TouchableOpacity style={styles.bannerBtn} onPress={onShop}>
        <Text style={styles.bannerBtnText}>Shop</Text>
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

export default function App() {
  const { user, loading, signIn } = useAuth();
  const [arrivedStore, setArrivedStore] = useState(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const openMoreMenu = () => {
    setShowMoreMenu(true);
  };

  const closeMoreMenu = () => {
    setShowMoreMenu(false);
  };


  // Mock stores — replace with sync from useSync
  const userStores = user ? [] : []; // populated from sync data

  const { start: startGeofence } = useGeofence({
    stores: userStores,
    onArrival: (store, distMeters) => {
      setArrivedStore(store);
    },
  });

  useEffect(() => {
    checkForUpdate();
  }, []);

  // Start geofencing once user is logged in
  useEffect(() => {
    if (user) startGeofence();
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLogin={signIn} />
      </>
    );
  }

  return (
    <NavigationContainer>
    {showMoreMenu && (

      <View

        style={{

          position: 'absolute',

          top: 0,

          left: 0,

          right: 0,

          bottom: 0,

          backgroundColor: 'rgba(0,0,0,0.5)',

          zIndex: 999,

        }}

      >

        <TouchableOpacity

          style={{ flex: 1 }}

          onPress={closeMoreMenu}

        />

        <View

          style={{

            backgroundColor: '#123F1C',

            padding: 20,

          }}

        >

          <Text

            style={{

              color: '#B59C48',

              textAlign: 'center',

              marginBottom: 20,

            }}

          >

            Buttons Displayed here

          </Text>

          {/* Your buttons */}

        </View>

      </View>

    )}
    <View style= {styles.headerSize}>

    <View style={styles.mainHeaderView}>

    <Image
      source={require('./assets/icon.png')}
      style={styles.headerImage}
    />
      <View>

        <Text style={styles.headerTextView}>
        fern
        </Text>

        <Text style={styles.headerTitle}>
          WEEKLY AD TO DINNER TABLE • PATENT{"\n"}PENDING
        </Text>

      </View>

    </View>
  ),

</View>
      <StatusBar style="light" />

      {/* Store arrival banner */}
      {arrivedStore && (
        <ArrivalBanner
          store={arrivedStore}
          onShop={() => { setArrivedStore(null); setActiveTab('Shopping'); }}
          onDismiss={() => setArrivedStore(null)}
        />
      )}

      <Tab.Navigator
        screenOptions={{
          headerShown: false,
            headerStyle: {
            backgroundColor: '#123F1C',},
            headerTintColor: '#fff',

          tabBarStyle: {
            backgroundColor: colors.forest,
            borderTopColor: 'rgba(168,200,162,0.2)',
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 70,
          },
          tabBarActiveTintColor:   colors.orange,
          tabBarInactiveTintColor: 'rgba(168,213,162,0.45)',
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginTop: 2,
          },
        }}
      >

        <Tab.Screen
          name="Home"
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
        >
          {() => <HomeScreen user={user} />}
        </Tab.Screen>
        <Tab.Screen
        name="Find"
        component={FindScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }}
        />
        <Tab.Screen
        name="Family"
        options={{
          tabBarLabel: 'FAMILYHUB',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📆" focused={focused} />,
        }}
        >
        {() => <FamilyScreen user={user} />}
        </Tab.Screen>
        <Tab.Screen
        name="Recipes"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} /> }}
        >
        {() => <RecipesScreen user={user} />}
        </Tab.Screen>

        <Tab.Screen
        name="MORE"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openMoreMenu();
            },
            }}
            options={{
              tabBarIcon: ({ focused }) => (
              <Ionicons
              name="ellipsis-horizontal"
              size={28}
              color={focused ? '#B59C48' : '#999'}
              />
              ),
              }}
              >
              {() => <RecipesScreen user={user} />}
              </Tab.Screen>

      </Tab.Navigator>
    </NavigationContainer>
  );
}


const styles = StyleSheet.create({
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
  bannerEmoji:    { fontSize: 24 },
  bannerText:     { flex: 1 },
  bannerTitle:    { fontSize: 14, fontWeight: '800', color: colors.onFern },
  bannerSub:      { fontSize: 12, color: colors.muted, marginTop: 2 },
  bannerBtn:      { backgroundColor: colors.orange, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  bannerBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  bannerClose:    { padding: 6 },
  bannerCloseText:{ color: 'rgba(255,255,255,0.4)', fontSize: 18 },

  headerSize:  { 
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20
    },

  headerImage: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
    marginRight: 20,
    marginTop: 30
    },

  headerTitle:{
    color: '#A8D5A2',
    fontSize: 8,
    fontFamily:'Jost_700Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    },

  mainHeaderView: {
    flexDirection: 'row',
    height: 50,
    paddingVertical: 0,
    alignItems: 'center',
    },

  headerTextView: {
    color: '#F5EFE6',
    marginTop: 20,
    fontFamily:'Jost_700Bold',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1,
  }

});
