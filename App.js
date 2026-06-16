import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import HomeScreen     from './src/screens/HomeScreen';
import FindScreen     from './src/screens/FindScreen';
import ShoppingScreen from './src/screens/ShoppingScreen';
import RecipesScreen  from './src/screens/RecipesScreen';
import { colors }     from './src/constants/tokens';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  );
}

export default function App() {
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
          tabBarInactiveTintColor: 'rgba(168,213,162,0.5)',
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
          component={HomeScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
        />
        <Tab.Screen
          name="Find"
          component={FindScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} /> }}
        />
        <Tab.Screen
          name="Shopping"
          component={ShoppingScreen}
          options={{
            tabBarLabel: 'Shop',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Recipes"
          component={RecipesScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
