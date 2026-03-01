/**
 * App.tsx - Content Flow v3.0
 * Auth-aware navigation: Login → Dashboard → Features
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, NativeModules } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

const { DeviceId } = NativeModules;

// Auth
import LoginScreen from './src/screens/LoginScreen';

// Main
import DashboardScreen from './src/screens/DashboardScreen';
import TikTokConnectScreen from './src/screens/TikTokConnectScreen';
import VideoEditorScreen from './src/screens/VideoEditorScreen';

// Coaching flow (existing)
import NicheSelectionScreen from './src/screens/NicheSelectionScreen';
import VideoUploadScreen from './src/screens/VideoUploadScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import CoachingScreen from './src/screens/CoachingScreen';
import InteractiveCoachingScreen from './src/screens/InteractiveCoachingScreen';
import ChatScreen from './src/screens/ChatScreen';

// Subscription
import SubscriptionScreen from './src/screens/SubscriptionScreen';

// Reminders (existing)
import PostingReminderScreen from './src/screens/PostingReminderScreen';

const Stack = createStackNavigator();

function SplashScreen() {
  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.splash}>
      <ActivityIndicator color="#00D4FF" size="large" />
    </LinearGradient>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Get hardware-based device ID (ANDROID_ID, hashed)
      // Persists across reinstalls — only resets on factory reset
      try {
        const hwId = await DeviceId.getDeviceId();
        await AsyncStorage.setItem('device_id', hwId);
      } catch {
        // Fallback if native module fails (e.g., emulator)
        let deviceId = await AsyncStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
          await AsyncStorage.setItem('device_id', deviceId);
        }
      }

      const token = await AsyncStorage.getItem('auth_token');
      setIsLoggedIn(!!token);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <SplashScreen />;

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={isLoggedIn ? 'Dashboard' : 'Login'}
          screenOptions={{ headerShown: false }}
        >
          {/* ── AUTH ── */}
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* ── MAIN DASHBOARD ── */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="TikTokConnect" component={TikTokConnectScreen} />
          <Stack.Screen name="VideoEditor" component={VideoEditorScreen} />

          {/* ── CONTENT COACHING FLOW ── */}
          <Stack.Screen name="NicheSelection" component={NicheSelectionScreen} />
          <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
          <Stack.Screen name="Analysis" component={AnalysisScreen} />
          <Stack.Screen name="Coaching" component={CoachingScreen} />
          <Stack.Screen name="InteractiveCoaching" component={InteractiveCoachingScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />

          {/* ── SUBSCRIPTION ── */}
          <Stack.Screen name="Subscription" component={SubscriptionScreen} />

          {/* ── POSTING REMINDERS ── */}
          <Stack.Screen name="PostingReminder" component={PostingReminderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
