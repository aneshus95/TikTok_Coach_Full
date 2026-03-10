/**
 * DashboardScreen - TikTok Analytics Hub
 * Main screen after login: engagement stats, posting reminders, quick actions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingAnimation from '../components/LoadingAnimation';
import { ApiService, StorageService } from '../services/ApiService';

interface TikTokProfile {
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
  bio: string;
}

interface EngagementStats {
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  avg_engagement_rate: number;
  videos_this_week: number;
  days_since_last_post: number;
  posting_streak: number;
}

interface RecentVideo {
  id: string;
  title: string;
  cover_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  create_time: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysSinceColor(days: number): string {
  if (days === 0) return '#00FFB3';
  if (days <= 1) return '#00D4FF';
  if (days <= 3) return '#F59E0B';
  return '#EF4444';
}

function postingStatusMessage(days: number): string {
  if (days === 0) return 'You posted today!';
  if (days === 1) return 'Posted yesterday — keep it up';
  if (days === 2) return 'You missed yesterday. Post today!';
  if (days <= 4) return `${days} days without posting — your reach is dropping`;
  return `${days} days inactive — urgent: post now to recover!`;
}

function engagementLabel(rate: number): string {
  if (rate >= 8) return 'Excellent';
  if (rate >= 5) return 'Good';
  if (rate >= 2) return 'Average';
  return 'Needs Work';
}

export default function DashboardScreen({ navigation }: any) {
  const [profile, setProfile] = useState<TikTokProfile | null>(null);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [tiktokConnected, setTikTokConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userContact, setUserContact] = useState('');
  const [usageInfo, setUsageInfo] = useState<any>(null);
  const [dataError, setDataError] = useState('');


  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const alertGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(alertGlow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(alertGlow, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // Check if video edit completed while app was dead
    AsyncStorage.getItem('last_edit_result').then(editRaw => {
      if (editRaw) {
        try {
          const result = JSON.parse(editRaw);
          if (result.video_url && result.video_filename) {
            navigation.navigate('VideoEditor');
            return;
          }
        } catch {}
      }
    });

    // Check if coaching result completed while app was dead
    AsyncStorage.getItem('coaching_result_ready').then(ready => {
      if (ready) {
        try {
          const { data, videoUri, niche: nicheName, scriptData: sd } = JSON.parse(ready);
          if (data?.analysis_id) {
            AsyncStorage.removeItem('coaching_result_ready');
            navigation.navigate('InteractiveCoaching', {
              videoUri, niche: nicheName,
              analysisId: data.analysis_id,
              duration: data.duration || 30,
              timestamps: data.timestamps || [],
              viralInsights: data.viral_insights || [],
              extras: data.extras || {},
              scriptData: sd || null,
            });
            return;
          }
        } catch {}
      }
      // Check for pending (still analyzing) coaching task
      AsyncStorage.getItem('pending_coaching_task').then(pending => {
        if (pending) {
          try {
            const { taskId, niche: savedNiche } = JSON.parse(pending);
            if (taskId && savedNiche) {
              navigation.navigate('VideoUpload', { jobId: null, niche: savedNiche });
              return;
            }
          } catch {}
        }
        // Check for pending (still processing) video edit
        AsyncStorage.getItem('pending_edit_task').then(editTask => {
          if (editTask) {
            navigation.navigate('VideoEditor');
          }
        });
      });
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const contact = await AsyncStorage.getItem('user_contact');
      if (contact) setUserContact(contact);

      // Load usage status
      try {
        const usage = await ApiService.getUsageStatus();
        setUsageInfo(usage);
      } catch {}

      const tiktokToken = await AsyncStorage.getItem('tiktok_access_token');
      if (tiktokToken) {
        setTikTokConnected(true);
        await Promise.all([
          fetchProfile(tiktokToken),
          fetchStats(tiktokToken),
          fetchRecentVideos(tiktokToken),
        ]);
      } else {
        setTikTokConnected(false);
      }

      // Don't auto-fetch on mount — let user pick a niche or tap refresh
    } catch (e) {
      if (__DEV__) console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchProfile = async (token: string) => {
    try {
      const data = await ApiService.getTikTokProfile(token);
      setProfile(data);
    } catch {
      setDataError('Could not load TikTok profile. Pull down to retry.');
    }
  };

  const fetchStats = async (token: string) => {
    try {
      const data = await ApiService.getTikTokStats(token);
      setStats(data);
    } catch {
      setDataError('Could not load analytics. Pull down to retry.');
    }
  };

  const fetchRecentVideos = async (token: string) => {
    try {
      const data = await ApiService.getTikTokVideos(token);
      setRecentVideos(data.slice(0, 5));
    } catch {
      // Non-critical — don't override more important errors
    }
  };


  const handleRefresh = () => {
    setRefreshing(true);
    setDataError('');
    loadData();
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          // Invalidate session on backend (best-effort)
          await ApiService.logout();
          // Clear all user-specific keys (preserves device_id)
          await StorageService.logoutClear();
          await AsyncStorage.removeItem('nav_state');
          navigation.replace('Login');
        },
      },
    ]);
  };

  const alertOpacity = alertGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.0] });

  if (loading) {
    return (
      <LinearGradient colors={['#050810', '#0C1220']} style={styles.loadingContainer}>
        <LoadingAnimation size={120} />
        <Paragraph style={styles.loadingText}>Loading your dashboard...</Paragraph>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00D4FF" />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Paragraph style={styles.greeting}>Welcome back</Paragraph>
              <Title style={styles.headerTitle}>Your Dashboard</Title>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Paragraph style={styles.logoutIcon}>⎋</Paragraph>
            </TouchableOpacity>
          </View>

          {/* Error banner */}
          {dataError ? (
            <TouchableOpacity onPress={handleRefresh} style={{
              backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF444440',
              borderRadius: 12, padding: 12, marginBottom: 12,
            }}>
              <Paragraph style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>
                {dataError}
              </Paragraph>
            </TouchableOpacity>
          ) : null}

          {/* ══════════════════════════════════ */}
          {/* USAGE / TIER BANNER                */}
          {/* ══════════════════════════════════ */}
          {usageInfo && (
            <View style={styles.usageBanner}>
              <View style={styles.usageBannerLeft}>
                <Paragraph style={styles.usageTierLabel}>
                  {usageInfo.tier === 'free' ? 'FREE TRIAL' : usageInfo.tier.toUpperCase()}
                </Paragraph>
                <Paragraph style={styles.usageSummary}>
                  {usageInfo.tier === 'free'
                    ? `${usageInfo.free_trial?.remaining ?? 0} of ${usageInfo.free_trial?.limit ?? 3} uses left`
                    : `${usageInfo.usage?.video_analysis?.used ?? 0}/${usageInfo.usage?.video_analysis?.limit ?? 0} analyses this month`
                  }
                </Paragraph>
              </View>
              {(usageInfo.tier === 'free' || usageInfo.tier === 'growth') && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Subscription')}
                  style={styles.usageUpgradeBtn}
                >
                  <Paragraph style={styles.usageUpgradeText}>Upgrade</Paragraph>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ══════════════════════════════════ */}
          {/* FEATURES — 2-Column Grid           */}
          {/* ══════════════════════════════════ */}
          <View style={styles.sectionHeader}>
            <View style={styles.dot} />
            <Paragraph style={styles.sectionLabel}>FEATURES</Paragraph>
          </View>

          <View style={styles.featureGrid}>
            <View style={styles.featureGridRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('NicheSelection')}
                activeOpacity={0.85}
                style={[styles.gridCard, { borderColor: '#00D4FF30' }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: '#00D4FF15' }]}>
                  <Paragraph style={styles.gridIcon}>🎯</Paragraph>
                </View>
                <Paragraph style={styles.gridCardTitle}>Content Coaching</Paragraph>
                <Paragraph style={styles.gridCardSub}>AI-powered video feedback</Paragraph>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('VideoEditor')}
                activeOpacity={0.85}
                style={[styles.gridCard, { borderColor: '#00FFB330' }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: '#00FFB315' }]}>
                  <Paragraph style={styles.gridIcon}>🎬</Paragraph>
                </View>
                <Paragraph style={styles.gridCardTitle}>AI Video Editor</Paragraph>
                <Paragraph style={styles.gridCardSub}>Make Viral & Copy Style</Paragraph>
              </TouchableOpacity>
            </View>

            <View style={styles.featureGridRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ScriptWriter')}
                activeOpacity={0.85}
                style={[styles.gridCard, { borderColor: '#E879F930' }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: '#E879F915' }]}>
                  <Paragraph style={styles.gridIcon}>{'✍️'}</Paragraph>
                </View>
                <Paragraph style={styles.gridCardTitle}>AI Script Writer</Paragraph>
                <Paragraph style={styles.gridCardSub}>Scripts, hooks & hashtags</Paragraph>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ContentCalendar')}
                activeOpacity={0.85}
                style={[styles.gridCard, { borderColor: '#F59E0B30' }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: '#F59E0B15' }]}>
                  <Paragraph style={styles.gridIcon}>{'📅'}</Paragraph>
                </View>
                <Paragraph style={styles.gridCardTitle}>Content Calendar</Paragraph>
                <Paragraph style={styles.gridCardSub}>Plan & track your posts</Paragraph>
              </TouchableOpacity>
            </View>

            <View style={styles.featureGridRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('PostingReminder', { niche: '', optimalTime: '7-9 PM' })}
                activeOpacity={0.85}
                style={[styles.gridCard, { borderColor: '#8B5CF630' }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: '#8B5CF615' }]}>
                  <Paragraph style={styles.gridIcon}>🔔</Paragraph>
                </View>
                <Paragraph style={styles.gridCardTitle}>Post Reminder</Paragraph>
                <Paragraph style={styles.gridCardSub}>Set optimal posting times</Paragraph>
              </TouchableOpacity>
              <View style={styles.gridCard} />
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', marginTop: 16, fontSize: 14 },
  content: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 48 },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  greeting: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#E2F0FF' },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center',
  },

  // Usage banner
  usageBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0C1220', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B',
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 20,
  },
  usageBannerLeft: { flex: 1 },
  usageTierLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#00D4FF', marginBottom: 2 },
  usageSummary: { fontSize: 13, color: '#94A3B8' },
  usageUpgradeBtn: {
    backgroundColor: '#00D4FF18', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#00D4FF40',
  },
  usageUpgradeText: { fontSize: 12, fontWeight: '700', color: '#00D4FF' },
  logoutIcon: { fontSize: 18, color: '#64748B', fontWeight: '700' },

  // Connect Card
  connectCard: {
    borderRadius: 16, borderWidth: 1, borderColor: '#00D4FF30', padding: 20, marginBottom: 24,
  },
  connectTop: { flexDirection: 'row', alignItems: 'center' },
  tiktokIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  tiktokIconText: { fontSize: 22, color: '#fff' },
  connectInfo: { flex: 1 },
  connectTitle: { fontSize: 16, fontWeight: '700', color: '#E2F0FF', marginBottom: 4 },
  connectSub: { fontSize: 13, color: '#64748B' },
  connectArrow: { fontSize: 20, color: '#00D4FF', fontWeight: '700' },

  // Profile Card
  profileCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 20, marginBottom: 16, overflow: 'hidden',
  },
  profileCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#00D4FF', opacity: 0.7,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#00D4FF40' },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#00D4FF20', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#00D4FF40',
  },
  avatarInitial: { fontSize: 24, fontWeight: '900', color: '#00D4FF' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#00D4FF', justifyContent: 'center', alignItems: 'center',
  },
  verifiedIcon: { fontSize: 10, color: '#050810', fontWeight: '900' },
  profileInfo: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: '900', color: '#E2F0FF', marginBottom: 2 },
  username: { fontSize: 13, color: '#00D4FF', marginBottom: 6 },
  bio: { fontSize: 12, color: '#64748B', lineHeight: 18 },

  profileStats: { flexDirection: 'row' },
  profileStat: { flex: 1, alignItems: 'center', position: 'relative' },
  profileStatValue: { fontSize: 18, fontWeight: '900', color: '#00D4FF', marginBottom: 2 },
  profileStatLabel: { fontSize: 9, color: '#64748B', letterSpacing: 0.5 },
  statDivider: { position: 'absolute', right: 0, top: '15%', bottom: '15%', width: 1, backgroundColor: '#1E293B' },

  // Alert Card
  alertCard: { marginBottom: 16, borderRadius: 14, borderWidth: 1, borderColor: '#F59E0B30' },
  alertGradient: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  alertGradientInner: { borderRadius: 13 },
  alertIcon: { fontSize: 22, marginRight: 14, lineHeight: 28 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  alertSub: { fontSize: 12, color: '#64748B' },

  // Stats
  statsSection: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 8 },
  sectionLabel: { fontSize: 11, color: '#64748B', letterSpacing: 2, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 10 },
  statsGrid: { gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  statCardWide: { flex: 1.4 },
  statCardLabel: { fontSize: 9, color: '#64748B', letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
  statCardValue: { fontSize: 26, fontWeight: '900', color: '#E2F0FF' },
  statCardSub: { fontSize: 10, color: '#64748B', marginTop: 2 },
  statCardIcon: { fontSize: 16, marginBottom: 4, lineHeight: 22 },

  streakCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
  },
  streakLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  streakIcon: { fontSize: 26, marginRight: 14, lineHeight: 34 },
  streakTitle: { fontSize: 15, fontWeight: '700', color: '#E2F0FF', marginBottom: 2 },
  streakSub: { fontSize: 12, color: '#64748B' },
  streakBadge: { alignItems: 'center', minWidth: 50 },
  streakCount: { fontSize: 32, fontWeight: '900', color: '#F59E0B' },
  streakDays: { fontSize: 9, color: '#F59E0B', letterSpacing: 1.5, fontWeight: '700' },

  lastPostRow: { flexDirection: 'row', alignItems: 'center' },
  lastPostDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  lastPostText: { fontSize: 13, color: '#64748B' },

  // Videos
  videosSection: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  videoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  videoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  videoThumb: { width: 54, height: 80, borderRadius: 8, marginRight: 14, overflow: 'hidden' },
  videoThumbImg: { width: '100%', height: '100%' },
  videoThumbPlaceholder: {
    width: '100%', height: '100%', backgroundColor: '#111827',
    justifyContent: 'center', alignItems: 'center',
  },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 13, color: '#E2F0FF', fontWeight: '600', marginBottom: 8 },
  videoMeta: { flexDirection: 'row', gap: 12 },
  videoStat: { fontSize: 12, color: '#64748B' },

  // Feature Grid
  featureGrid: { marginBottom: 20 },
  featureGridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridCard: {
    flex: 1, backgroundColor: '#0C1220', borderWidth: 1, borderRadius: 16,
    padding: 18, alignItems: 'center',
  },
  gridIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  gridIcon: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  gridCardTitle: {
    fontSize: 14, fontWeight: '800', color: '#E2F0FF',
    textAlign: 'center', marginBottom: 4,
  },
  gridCardSub: {
    fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 16,
  },

});
