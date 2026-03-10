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
import notifee from '@notifee/react-native';
import { NotificationService } from './src/services/NotificationService';
import { ApiService } from './src/services/ApiService';
import { FCMService } from './src/services/FCMService';

const { DeviceId } = NativeModules;

// Auth
import LoginScreen from './src/screens/LoginScreen';

// Main
import DashboardScreen from './src/screens/DashboardScreen';
import TikTokConnectScreen from './src/screens/TikTokConnectScreen';
import VideoEditorScreen from './src/screens/VideoEditorScreen';

// Coaching flow
import NicheSelectionScreen from './src/screens/NicheSelectionScreen';
import VideoUploadScreen from './src/screens/VideoUploadScreen';
import InteractiveCoachingScreen from './src/screens/InteractiveCoachingScreen';

// Subscription
import SubscriptionScreen from './src/screens/SubscriptionScreen';

// Reminders (existing)
import PostingReminderScreen from './src/screens/PostingReminderScreen';

// Script Writer + Calendar
import ScriptWriterScreen from './src/screens/ScriptWriterScreen';
import ContentCalendarScreen from './src/screens/ContentCalendarScreen';

const Stack = createStackNavigator();

// Register foreground service — polls for AI edit completion in background
notifee.registerForegroundService((notification) => {
  return new Promise<void>(async (resolve) => {
    const taskId = notification.data?.taskId as string;
    if (!taskId) { resolve(); return; }

    const poll = async () => {
      try {
        const data = await ApiService.pollEditStatus(taskId);
        if (data.state === 'SUCCEEDED') {
          await AsyncStorage.setItem('last_edit_result', JSON.stringify(data));
          await NotificationService.showVideoReady();
          resolve();
          return true;
        }
        if (data.state === 'FAILED') {
          await NotificationService.showVideoFailed(data.error_message);
          resolve();
          return true;
        }
      } catch (e) {
        // Network error — keep polling
      }
      return false;
    };

    // Poll every 5s until done
    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 5000);

    // Also poll immediately
    const done = await poll();
    if (done) clearInterval(interval);
  });
});

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
  const [initialNavState, setInitialNavState] = useState<any>(undefined);

  useEffect(() => {
    (async () => {
      try {
        // Get hardware-based device ID
        try {
          const hwId = await DeviceId.getDeviceId();
          await AsyncStorage.setItem('device_id', hwId);
        } catch {
          let deviceId = await AsyncStorage.getItem('device_id');
          if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            await AsyncStorage.setItem('device_id', deviceId);
          }
        }

        const token = await AsyncStorage.getItem('auth_token');
        setIsLoggedIn(!!token);

        // Initialize FCM for push notifications
        try {
          FCMService.setupBackgroundHandler();
          FCMService.setupForegroundHandler();
          if (token) {
            FCMService.initialize();
          }
        } catch (fcmErr) {
          if (__DEV__) console.log('[FCM] Setup error:', fcmErr);
        }

        // Restore navigation state (so user returns to exact screen after app kill)
        if (token) {
          const saved = await AsyncStorage.getItem('nav_state');
          if (saved) {
            try { setInitialNavState(JSON.parse(saved)); } catch {}
          }
        }
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <SplashScreen />;

  return (
    <PaperProvider>
      <NavigationContainer
        initialState={initialNavState}
        onStateChange={(state) => {
          // Persist navigation state on every change
          AsyncStorage.setItem('nav_state', JSON.stringify(state)).catch(() => {});
        }}
      >
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
          <Stack.Screen name="InteractiveCoaching" component={InteractiveCoachingScreen} />

          {/* ── SUBSCRIPTION ── */}
          <Stack.Screen name="Subscription" component={SubscriptionScreen} />

          {/* ── POSTING REMINDERS ── */}
          <Stack.Screen name="PostingReminder" component={PostingReminderScreen} />

          {/* ── SCRIPT WRITER + CALENDAR ── */}
          <Stack.Screen name="ScriptWriter" component={ScriptWriterScreen} />
          <Stack.Screen name="ContentCalendar" component={ContentCalendarScreen} />
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
