import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

import HomeScreen     from './src/screens/HomeScreen';
import FindScreen     from './src/screens/FindScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import RecipesScreen  from './src/screens/RecipesScreen';
import LoginScreen    from './src/screens/LoginScreen';
import { useAuth }    from './src/hooks/useAuth';
import { colors }     from './src/constants/tokens';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

// Check for OTA updates on launch
async function checkForUpdate() {
  if (__DEV__) return; // skip in development
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Reload silently — user won't notice
      await Updates.reloadAsync();
    }
  } catch (e) {
    // Silently fail — app still works on cached version
    console.log('OTA check failed:', e.message);
  }
}

export default function App() {
  const { user, loading, signIn, signOut } = useAuth();

  useEffect(() => {
    checkForUpdate();
  }, []);

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
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.forest,
            borderTopColor: 'rgba(168,213,162,0.2)',
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 62,
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
          name="Shopping"
          options={{
            tabBarLabel: 'Shop',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
          }}
        >
          {() => <ShoppingScreen user={user} />}
        </Tab.Screen>
        <Tab.Screen
          name="Recipes"
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} /> }}
        >
          {() => <RecipesScreen user={user} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
