/**
 * TikTokConnectScreen - OAuth via WebView
 * Connects the user's TikTok account using TikTok Login Kit (OAuth 2.0)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Paragraph, ActivityIndicator } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { WebView } from 'react-native-webview';
import LoadingAnimation from '../components/LoadingAnimation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/ApiService';

// The backend will supply the full TikTok OAuth URL
// This redirect URI must match what is registered in the TikTok Developer Portal
const TIKTOK_REDIRECT_PREFIX = 'https://tiktokcoachapp.onrender.com/api/tiktok/callback';
const LOCAL_REDIRECT_PREFIX = 'http://10.0.2.2:5000/api/tiktok/callback';

export default function TikTokConnectScreen({ navigation }: any) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const webViewRef = useRef<any>(null);

  const startOAuth = async () => {
    setLoadingUrl(true);
    try {
      const result = await ApiService.getTikTokAuthUrl();
      setAuthUrl(result.auth_url);
    } catch (e: any) {
      Alert.alert(
        'Error',
        'Could not start TikTok authorization. Please check your connection and try again.'
      );
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleNavigationChange = async (navState: any) => {
    const url: string = navState.url || '';

    // Intercept redirect to our callback URL
    const isCallback =
      url.startsWith(TIKTOK_REDIRECT_PREFIX) ||
      url.startsWith(LOCAL_REDIRECT_PREFIX) ||
      url.includes('/api/tiktok/callback');

    if (isCallback) {
      // Parse the code from the URL
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      const stateMatch = url.match(/[?&]state=([^&]+)/);

      if (codeMatch && codeMatch[1]) {
        const code = decodeURIComponent(codeMatch[1]);
        const state = stateMatch ? decodeURIComponent(stateMatch[1]) : '';
        await exchangeCode(code, state);
      } else if (url.includes('error=')) {
        const errorMatch = url.match(/error=([^&]+)/);
        const error = errorMatch ? errorMatch[1] : 'unknown';
        Alert.alert('Authorization Failed', `TikTok returned an error: ${error}. Please try again.`);
        setAuthUrl(null);
      }
    }
  };

  const exchangeCode = async (code: string, state: string) => {
    setAuthUrl(null);
    setWebViewLoading(false);
    try {
      const result = await ApiService.exchangeTikTokCode(code, state);
      await AsyncStorage.setItem('tiktok_access_token', result.access_token);
      if (result.refresh_token) {
        await AsyncStorage.setItem('tiktok_refresh_token', result.refresh_token);
      }
      setConnected(true);
    } catch (e: any) {
      Alert.alert('Connection Failed', 'Could not complete TikTok authorization. Please try again.');
    }
  };

  const handleSuccess = () => {
    navigation.replace('Dashboard');
  };

  // Success state
  if (connected) {
    return (
      <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
        <View style={styles.successContainer}>
          <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.successOrb}>
            <Paragraph style={styles.successIcon}>✓</Paragraph>
          </LinearGradient>
          <Paragraph style={styles.successTitle}>TikTok Connected!</Paragraph>
          <Paragraph style={styles.successSub}>
            Your account is now linked. We'll load your analytics and insights on the dashboard.
          </Paragraph>
          <TouchableOpacity onPress={handleSuccess} activeOpacity={0.85}>
            <LinearGradient
              colors={['#00D4FF', '#00FFB3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Paragraph style={styles.continueBtnText}>GO TO DASHBOARD  →</Paragraph>
            </LinearGradient>
            <View style={styles.continueBtnGlow} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // OAuth WebView state
  if (authUrl) {
    return (
      <View style={styles.webViewContainer}>
        {/* Header */}
        <LinearGradient colors={['#050810', '#0C1220']} style={styles.webViewHeader}>
          <TouchableOpacity
            onPress={() => setAuthUrl(null)}
            style={styles.webViewBack}
            activeOpacity={0.7}
          >
            <Paragraph style={styles.webViewBackText}>✕</Paragraph>
          </TouchableOpacity>
          <Paragraph style={styles.webViewTitle}>Connect TikTok</Paragraph>
          <View style={styles.webViewTikTokBadge}>
            <Paragraph style={styles.webViewTikTokText}>♪</Paragraph>
          </View>
        </LinearGradient>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => setWebViewLoading(true)}
          onLoadEnd={() => setWebViewLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          style={styles.webView}
          renderLoading={() => (
            <View style={styles.webViewLoader}>
              <LoadingAnimation size={120} />
              <Paragraph style={styles.webViewLoaderText}>Loading TikTok...</Paragraph>
            </View>
          )}
        />

        {webViewLoading && (
          <View style={styles.webViewOverlay}>
            <LoadingAnimation size={120} />
          </View>
        )}
      </View>
    );
  }

  // Landing / intro state
  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <View style={styles.content}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Paragraph style={styles.backBtnText}>←</Paragraph>
        </TouchableOpacity>

        {/* TikTok icon */}
        <View style={styles.iconArea}>
          <LinearGradient
            colors={['#00D4FF20', '#00FFB315']}
            style={styles.iconRing}
          >
            <View style={styles.iconInner}>
              <Paragraph style={styles.tiktokSymbol}>♪</Paragraph>
            </View>
          </LinearGradient>
        </View>

        <Paragraph style={styles.title}>Connect Your{'\n'}TikTok Account</Paragraph>
        <Paragraph style={styles.subtitle}>
          Link your TikTok to unlock personalized analytics, engagement tracking, and smart posting reminders.
        </Paragraph>

        {/* Permissions list */}
        <View style={styles.permCard}>
          <Paragraph style={styles.permTitle}>We'll access:</Paragraph>
          {[
            { icon: '👤', label: 'Your public profile info' },
            { icon: '📊', label: 'Video views, likes, comments, shares' },
            { icon: '📈', label: 'Follower count and engagement metrics' },
            { icon: '📅', label: 'Posting history and frequency' },
          ].map((item, i) => (
            <View key={i} style={styles.permRow}>
              <Paragraph style={styles.permIcon}>{item.icon}</Paragraph>
              <Paragraph style={styles.permLabel}>{item.label}</Paragraph>
            </View>
          ))}
          <View style={styles.permDivider} />
          <Paragraph style={styles.permNote}>
            We never post on your behalf or access private messages.
          </Paragraph>
        </View>

        {/* Connect button */}
        <TouchableOpacity
          onPress={startOAuth}
          disabled={loadingUrl}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#00D4FF', '#00FFB3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.connectBtn, loadingUrl && styles.connectBtnDisabled]}
          >
            {loadingUrl ? (
              <ActivityIndicator color="#050810" size="small" />
            ) : (
              <Paragraph style={styles.connectBtnText}>CONNECT WITH TIKTOK  →</Paragraph>
            )}
          </LinearGradient>
          <View style={styles.connectBtnGlow} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.skipLink}
          activeOpacity={0.7}
        >
          <Paragraph style={styles.skipLinkText}>Skip for now</Paragraph>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backBtnText: { fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2 },

  iconArea: { alignItems: 'center', marginBottom: 32 },
  iconRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: '#00D4FF30',
    justifyContent: 'center', alignItems: 'center',
  },
  iconInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#000', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  tiktokSymbol: { fontSize: 36, color: '#fff', lineHeight: 44 },

  title: {
    fontSize: 32, fontWeight: '900', color: '#E2F0FF',
    textAlign: 'center', lineHeight: 40, marginBottom: 14,
  },
  subtitle: {
    fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },

  // Permissions card
  permCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 20, marginBottom: 28,
  },
  permTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginBottom: 14 },
  permRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  permIcon: { fontSize: 18, marginRight: 14, lineHeight: 24 },
  permLabel: { fontSize: 14, color: '#E2F0FF' },
  permDivider: { height: 1, backgroundColor: '#1E293B', marginVertical: 14 },
  permNote: { fontSize: 12, color: '#64748B', lineHeight: 18 },

  // Connect button
  connectBtn: { paddingVertical: 17, borderRadius: 14, alignItems: 'center' },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  connectBtnGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.15, marginTop: -4, marginBottom: 14,
  },

  skipLink: { alignItems: 'center' },
  skipLinkText: { fontSize: 14, color: '#64748B' },

  // Success state
  successContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  successOrb: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 20, elevation: 10,
  },
  successIcon: { fontSize: 44, fontWeight: '900', color: '#050810', lineHeight: 52 },
  successTitle: { fontSize: 28, fontWeight: '900', color: '#E2F0FF', marginBottom: 14, textAlign: 'center' },
  successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  continueBtn: { paddingVertical: 17, paddingHorizontal: 40, borderRadius: 14, alignItems: 'center' },
  continueBtnText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  continueBtnGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.15, marginTop: -4,
  },

  // WebView state
  webViewContainer: { flex: 1, backgroundColor: '#050810' },
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  webViewBack: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  webViewBackText: { fontSize: 16, color: '#E2F0FF', fontWeight: '700' },
  webViewTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#E2F0FF' },
  webViewTikTokBadge: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#000', justifyContent: 'center', alignItems: 'center',
  },
  webViewTikTokText: { fontSize: 18, color: '#fff' },
  webView: { flex: 1 },
  webViewLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050810' },
  webViewLoaderText: { color: '#64748B', marginTop: 14, fontSize: 14 },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05081080',
    justifyContent: 'center', alignItems: 'center',
  },
});
