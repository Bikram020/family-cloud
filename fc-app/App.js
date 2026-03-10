import React from 'react';
import { StatusBar, ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import UploadScreen from './src/screens/UploadScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  const { isAdmin } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f1a', paddingTop: insets.top }}>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#0f0f1a',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#1a1a2e',
          },
          tabBarActiveTintColor: '#6c5ce7',
          tabBarInactiveTintColor: '#555',
          tabBarIndicatorStyle: {
            backgroundColor: '#6c5ce7',
            height: 3,
            borderRadius: 2,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'none',
          },
          swipeEnabled: true,
          lazy: true,
        }}
      >
        {!isAdmin && (
          <Tab.Screen
            name="Gallery"
            component={GalleryScreen}
            options={{ tabBarLabel: '🖼 Cloud' }}
          />
        )}
        {!isAdmin && (
          <Tab.Screen
            name="Upload"
            component={UploadScreen}
            options={{ tabBarLabel: '⬆️ Upload' }}
          />
        )}
        {isAdmin && (
          <Tab.Screen
            name="Admin"
            component={AdminScreen}
            options={{ tabBarLabel: '👑 Admin' }}
          />
        )}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarLabel: '👤 Profile' }}
        />
      </Tab.Navigator>
    </View>
  );
}

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
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
        <NavigationContainer>
          <AppNavigation />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
