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
  TextInput,
  Linking,
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

interface TrendingIdea {
  title: string;
  description: string;
  format: string;
  hashtags: string[];
  difficulty: string;
  why_trending: string;
  suggested_sound: string | null;
  tiktok_link: string | null;
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

  // Trending ideas state
  const [trendingIdeas, setTrendingIdeas] = useState<TrendingIdea[]>([]);
  const [trendingNiche, setTrendingNiche] = useState('TikTok');
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingFetched, setTrendingFetched] = useState(false);
  const [customNicheInput, setCustomNicheInput] = useState('');
  const trendingRequestId = useRef(0);

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

      // Load saved niche for trending ideas
      const savedNiche = await AsyncStorage.getItem('current_niche');
      if (savedNiche) setTrendingNiche(savedNiche);

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
    } catch {}
  };

  const fetchStats = async (token: string) => {
    try {
      const data = await ApiService.getTikTokStats(token);
      setStats(data);
    } catch {}
  };

  const fetchRecentVideos = async (token: string) => {
    try {
      const data = await ApiService.getTikTokVideos(token);
      setRecentVideos(data.slice(0, 5));
    } catch {}
  };

  const fetchTrendingIdeas = async (niche: string) => {
    // Increment request ID so stale responses from previous fetches are ignored
    const myRequestId = ++trendingRequestId.current;
    setTrendingLoading(true);
    try {
      const data = await ApiService.getTrendingIdeas(niche);
      // Only apply results if this is still the latest request
      if (myRequestId === trendingRequestId.current) {
        setTrendingIdeas(data.ideas || []);
        setTrendingFetched(true);
      }
    } catch (e) {
      if (myRequestId === trendingRequestId.current) {
        if (__DEV__) console.log('Trending ideas fetch error:', e);
      }
    } finally {
      if (myRequestId === trendingRequestId.current) {
        setTrendingLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
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
          {/* TRENDING IDEAS — TOP SECTION      */}
          {/* ══════════════════════════════════ */}
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.dot, { backgroundColor: '#00FFB3' }]} />
                <Paragraph style={[styles.sectionLabel, { color: '#00FFB3' }]}>
                  TRENDING IN {trendingNiche.toUpperCase()}
                </Paragraph>
              </View>
              <TouchableOpacity
                onPress={() => fetchTrendingIdeas(trendingNiche)}
                disabled={trendingLoading}
                style={styles.trendingRefreshBtn}
              >
                <Paragraph style={styles.trendingRefreshText}>
                  {trendingLoading ? '...' : '↻'}
                </Paragraph>
              </TouchableOpacity>
            </View>

            {/* Custom Niche Input */}
            <View style={styles.customNicheRow}>
              <TextInput
                style={styles.customNicheInput}
                placeholder="Type any niche..."
                placeholderTextColor="#475569"
                value={customNicheInput}
                onChangeText={setCustomNicheInput}
                onSubmitEditing={() => {
                  const val = customNicheInput.trim();
                  if (val) {
                    setTrendingNiche(val);
                    setTrendingIdeas([]);
                    fetchTrendingIdeas(val);
                  }
                }}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={() => {
                  const val = customNicheInput.trim();
                  if (val) {
                    setTrendingNiche(val);
                    setTrendingIdeas([]);
                    fetchTrendingIdeas(val);
                  }
                }}
                style={styles.customNicheBtn}
              >
                <Paragraph style={styles.customNicheBtnText}>Go</Paragraph>
              </TouchableOpacity>
            </View>

            {/* Niche Quick Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nicheChipRow}>
              {['TikTok', 'Fitness', 'Comedy', 'Beauty', 'Food', 'Tech', 'Fashion', 'Music'].map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => {
                    setTrendingNiche(n);
                    setCustomNicheInput('');
                    setTrendingIdeas([]);
                    fetchTrendingIdeas(n);
                  }}
                  style={[
                    styles.nicheChip,
                    trendingNiche === n && styles.nicheChipActive,
                  ]}
                >
                  <Paragraph
                    style={[
                      styles.nicheChipText,
                      trendingNiche === n && styles.nicheChipTextActive,
                    ]}
                  >
                    {n}
                  </Paragraph>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Loading State */}
            {trendingLoading && !trendingIdeas.length && (
              <View style={styles.trendingLoadingWrap}>
                <LoadingAnimation size={80} />
                <Paragraph style={styles.trendingLoadingText}>
                  Searching for trending {trendingNiche} content...
                </Paragraph>
              </View>
            )}

            {/* Trending Ideas Cards */}
            {trendingIdeas.map((idea, i) => (
              <View key={i} style={styles.ideaCard}>
                <View style={styles.ideaTop}>
                  <View style={styles.ideaFormatBadge}>
                    <Paragraph style={styles.ideaFormatText}>{idea.format}</Paragraph>
                  </View>
                  <View style={[
                    styles.ideaDiffBadge,
                    { backgroundColor: idea.difficulty === 'Easy' ? '#00FFB315' : idea.difficulty === 'Medium' ? '#F59E0B15' : '#EF444415' },
                  ]}>
                    <Paragraph style={[
                      styles.ideaDiffText,
                      { color: idea.difficulty === 'Easy' ? '#00FFB3' : idea.difficulty === 'Medium' ? '#F59E0B' : '#EF4444' },
                    ]}>
                      {idea.difficulty}
                    </Paragraph>
                  </View>
                </View>
                <Paragraph style={styles.ideaTitle}>{idea.title}</Paragraph>
                <Paragraph style={styles.ideaDesc}>{idea.description}</Paragraph>
                {idea.why_trending ? (
                  <Paragraph style={styles.ideaWhy}>{idea.why_trending}</Paragraph>
                ) : null}
                {idea.suggested_sound ? (
                  <View style={styles.ideaSoundRow}>
                    <Paragraph style={styles.soundIcon}>♪</Paragraph>
                    <Paragraph style={styles.ideaSoundName}>{idea.suggested_sound}</Paragraph>
                  </View>
                ) : null}
                {idea.hashtags && idea.hashtags.length > 0 && (
                  <View style={styles.ideaHashtags}>
                    {idea.hashtags.slice(0, 4).map((tag: string, j: number) => (
                      <View key={j} style={styles.hashtagChip}>
                        <Paragraph style={styles.hashtagText}>{tag}</Paragraph>
                      </View>
                    ))}
                  </View>
                )}
                {idea.tiktok_link && /^https?:\/\/(www\.)?tiktok\.com\//i.test(idea.tiktok_link) ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(idea.tiktok_link!)}
                    style={styles.tiktokLinkBtn}
                    activeOpacity={0.7}
                  >
                    <Paragraph style={styles.tiktokLinkIcon}>▶</Paragraph>
                    <Paragraph style={styles.tiktokLinkText}>View on TikTok</Paragraph>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {/* Empty State */}
            {!trendingLoading && trendingFetched && trendingIdeas.length === 0 && (
              <View style={styles.trendingLoadingWrap}>
                <Paragraph style={styles.trendingLoadingText}>
                  No trending ideas found. Tap ↻ to retry.
                </Paragraph>
              </View>
            )}
          </View>

          {/* ══════════════════════════════════ */}
          {/* FEATURE CARDS                      */}
          {/* ══════════════════════════════════ */}
          <View style={styles.sectionHeader}>
            <View style={styles.dot} />
            <Paragraph style={styles.sectionLabel}>FEATURES</Paragraph>
          </View>

          {/* Content Creation Coaching */}
          <TouchableOpacity
            onPress={() => navigation.navigate('NicheSelection')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00D4FF18', '#00FFB312']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featureCard}
            >
              <View style={styles.featureCardInner}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#00D4FF20', borderColor: '#00D4FF40' }]}>
                  <Paragraph style={styles.featureCardIcon}>🎯</Paragraph>
                </View>
                <View style={styles.featureCardContent}>
                  <Paragraph style={styles.featureCardTitle}>Content Creation Coaching</Paragraph>
                  <Paragraph style={styles.featureCardDesc}>
                    Upload your video and get AI-powered feedback to go viral in your niche
                  </Paragraph>
                </View>
                <Paragraph style={styles.featureArrow}>→</Paragraph>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* AI Video Editor */}
          <TouchableOpacity
            onPress={() => navigation.navigate('VideoEditor')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00FFB318', '#00D4FF12']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featureCard}
            >
              <View style={styles.featureCardInner}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#00FFB320', borderColor: '#00FFB340' }]}>
                  <Paragraph style={styles.featureCardIcon}>🎬</Paragraph>
                </View>
                <View style={styles.featureCardContent}>
                  <Paragraph style={styles.featureCardTitle}>AI Video Editor</Paragraph>
                  <Paragraph style={styles.featureCardDesc}>
                    Quick tools to enhance your videos — captions, reframe, highlights and more
                  </Paragraph>
                </View>
                <Paragraph style={styles.featureArrow}>→</Paragraph>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Posting Reminder */}
          <TouchableOpacity
            onPress={() => navigation.navigate('PostingReminder', { niche: '', optimalTime: '7-9 PM' })}
            activeOpacity={0.85}
            style={styles.reminderCard}
          >
            <View style={styles.reminderLeft}>
              <Paragraph style={styles.reminderIcon}>🔔</Paragraph>
              <View>
                <Paragraph style={styles.reminderTitle}>Daily Posting Reminder</Paragraph>
                <Paragraph style={styles.reminderSub}>Set your optimal posting time</Paragraph>
              </View>
            </View>
            <Paragraph style={styles.reminderArrow}>→</Paragraph>
          </TouchableOpacity>

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

  // Feature Cards
  featureCard: {
    borderRadius: 16, borderWidth: 1, borderColor: '#00D4FF20',
    marginBottom: 14,
  },
  featureCardInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 20 },
  featureIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 16,
    overflow: 'visible',
  },
  featureCardIcon: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  featureCardContent: { flex: 1 },
  featureCardTitle: { fontSize: 16, fontWeight: '900', color: '#E2F0FF', marginBottom: 6 },
  featureCardDesc: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 12 },
  featureChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureChip: {
    backgroundColor: '#00D4FF10', borderWidth: 1, borderColor: '#00D4FF25',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  featureChipText: { fontSize: 10, color: '#00D4FF', fontWeight: '700' },
  featureArrow: { fontSize: 20, color: '#00D4FF', fontWeight: '700', alignSelf: 'center' },

  // Reminder Card
  reminderCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  reminderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  reminderIcon: { fontSize: 22, marginRight: 14, lineHeight: 28 },
  reminderTitle: { fontSize: 15, fontWeight: '700', color: '#E2F0FF', marginBottom: 2 },
  reminderSub: { fontSize: 12, color: '#64748B' },
  reminderArrow: { fontSize: 18, color: '#64748B', fontWeight: '700' },

  // Trending Ideas
  trendingSection: { marginTop: 8 },
  trendingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  trendingRefreshBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#00FFB330',
    justifyContent: 'center', alignItems: 'center',
  },
  trendingRefreshText: { fontSize: 18, color: '#00FFB3', fontWeight: '700' },
  customNicheRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8,
  },
  customNicheInput: {
    flex: 1, backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: '#E2F0FF', fontSize: 14,
  },
  customNicheBtn: {
    backgroundColor: '#00FFB3', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11,
  },
  customNicheBtnText: { color: '#050810', fontWeight: '800', fontSize: 14 },
  nicheChipRow: { marginBottom: 16, flexGrow: 0 },
  nicheChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B', marginRight: 8,
  },
  nicheChipActive: { backgroundColor: '#00FFB318', borderColor: '#00FFB360' },
  nicheChipText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  nicheChipTextActive: { color: '#00FFB3' },
  trendingLoadingWrap: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 14,
    padding: 28, alignItems: 'center', justifyContent: 'center',
  },
  trendingLoadingText: { color: '#64748B', fontSize: 13, marginTop: 10, textAlign: 'center' },
  ideaCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  ideaTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  ideaFormatBadge: {
    backgroundColor: '#00D4FF18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  ideaFormatText: { fontSize: 10, color: '#00D4FF', fontWeight: '800', textTransform: 'uppercase' },
  ideaDiffBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  ideaDiffText: { fontSize: 10, fontWeight: '800' },
  ideaTitle: { fontSize: 15, fontWeight: '800', color: '#E2F0FF', marginBottom: 6 },
  ideaDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 20, marginBottom: 8 },
  ideaWhy: { fontSize: 12, color: '#00D4FF', lineHeight: 18, marginBottom: 8, fontStyle: 'italic' },
  ideaHashtags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hashtagChip: {
    backgroundColor: '#00FFB310', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  hashtagText: { fontSize: 11, color: '#00FFB3', fontWeight: '600' },
  tiktokLinkBtn: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: '#EE1D5218', borderWidth: 1, borderColor: '#EE1D5240',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  tiktokLinkIcon: { fontSize: 12, color: '#EE1D52', marginRight: 6, fontWeight: '700' },
  tiktokLinkText: { fontSize: 12, color: '#EE1D52', fontWeight: '700' },
  ideaSoundRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    backgroundColor: '#00D4FF08', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  soundIcon: { fontSize: 13, color: '#00D4FF', marginRight: 8, fontWeight: '700' },
  ideaSoundName: { fontSize: 12, color: '#00D4FF', flex: 1 },
});
