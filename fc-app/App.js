// ============================================
// App.js — Main entry point (React Navigation v6)
// ============================================

import React from 'react';
import { StatusBar, ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import UploadScreen from './src/screens/UploadScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- Main tabs (shown after login) ---
function MainTabs() {
  const { isAdmin } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f0f1a' },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#0f0f1a',
          borderTopColor: '#1a1a2e',
          paddingTop: 4,
          height: 60,
        },
        tabBarActiveTintColor: '#6c5ce7',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tab.Screen
        name="Gallery"
        component={GalleryScreen}
        options={{
          title: 'My Cloud',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🖼</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{
          title: 'Upload',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>⬆️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>👤</Text>
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            title: 'Admin',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>👑</Text>
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

// --- App navigation ---
function AppNavigation() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' }}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: '#0f0f1a' },
              headerTintColor: '#fff',
              title: '',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
      <NavigationContainer>
        <AppNavigation />
      </NavigationContainer>
    </AuthProvider>
  );
}
