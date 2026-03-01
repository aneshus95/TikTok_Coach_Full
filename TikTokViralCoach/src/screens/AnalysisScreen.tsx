/**
 * AnalysisScreen - Content Flow Edition
 * Includes "Set Posting Reminder" CTA wired to PostingReminderScreen
 */

import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

export default function AnalysisScreen({ route, navigation }: any) {
  const { jobId, niche, viralCount } = route.params;

  const insights = {
    avgViews: 2100000,
    avgLikes: 180000,
    avgComments: 5000,
    topHashtags: ['#grwm', '#makeup', '#getreadywithme', '#routine', '#viral'],
    bestPostingTime: '7-9 PM',
    avgEngagementRate: '8.5%',
    avgDuration: 45,
  };

  const viralPatterns = [
    { label: 'Hook in 3 seconds', score: 95, category: 'RETENTION' },
    { label: 'Trending sounds', score: 88, category: 'AUDIO' },
    { label: 'High production value', score: 82, category: 'QUALITY' },
    { label: 'Smart hashtags', score: 90, category: 'DISCOVERY' },
    { label: 'Engagement bait', score: 85, category: 'INTERACTION' },
  ];

  const stats = [
    { value: `${(insights.avgViews / 1000000).toFixed(1)}M`, label: 'AVG VIEWS', color: '#00D4FF' },
    { value: `${(insights.avgLikes / 1000).toFixed(0)}K`, label: 'AVG LIKES', color: '#00FFB3' },
    { value: insights.avgEngagementRate, label: 'ENGAGEMENT', color: '#38BDF8' },
    { value: `${insights.avgDuration}s`, label: 'AVG DURATION', color: '#00D4FF' },
  ];

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Paragraph style={styles.statusText}>ANALYSIS COMPLETE</Paragraph>
            </View>
            <View style={styles.nicheBadge}>
              <Paragraph style={styles.nicheBadgeText}>{niche.toUpperCase()}</Paragraph>
            </View>
          </View>
          <Title style={styles.title}>Insights Hub</Title>
          <Paragraph style={styles.subtitle}>Based on {viralCount || '50+'} viral videos in your niche</Paragraph>
        </View>

        <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>KEY METRICS</Paragraph></View>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statGlowBar, { backgroundColor: stat.color }]} />
              <Paragraph style={[styles.statValue, { color: stat.color }]}>{stat.value}</Paragraph>
              <Paragraph style={styles.statLabel}>{stat.label}</Paragraph>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>VIRAL PATTERNS</Paragraph></View>
        <View style={styles.card}>
          {viralPatterns.map((pattern, index) => (
            <View key={index} style={[styles.patternRow, index < viralPatterns.length - 1 && styles.patternBorder]}>
              <View style={styles.patternLeft}>
                <View style={styles.categoryTag}><Paragraph style={styles.categoryText}>{pattern.category}</Paragraph></View>
                <Paragraph style={styles.patternLabel}>{pattern.label}</Paragraph>
              </View>
              <View style={styles.patternRight}>
                <View style={styles.scoreBar}>
                  <LinearGradient colors={['#00D4FF', '#00FFB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.scoreFill, { width: `${pattern.score}%` }]} />
                </View>
                <Paragraph style={styles.scoreText}>{pattern.score}</Paragraph>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>PEAK POSTING WINDOW</Paragraph></View>
        <View style={styles.timeCard}>
          <LinearGradient colors={['#00D4FF10', '#00FFB308']} style={StyleSheet.absoluteFill} />
          <View style={styles.timeCardGlow} />
          <View style={styles.timeCardContent}>
            <View>
              <Paragraph style={styles.timeCardLabel}>OPTIMAL TIME</Paragraph>
              <Paragraph style={styles.timeCardValue}>{insights.bestPostingTime}</Paragraph>
              <Paragraph style={styles.timeCardHint}>Based on {viralCount || '50+'} viral videos</Paragraph>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('PostingReminder', { niche, optimalTime: insights.bestPostingTime })} activeOpacity={0.85}>
              <LinearGradient colors={['#00D4FF', '#00FFB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.reminderBtn}>
                <Paragraph style={styles.reminderBtnText}>🔔 Set Reminder</Paragraph>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.card, styles.halfCard]}>
            <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>COMMENTS</Paragraph></View>
            <Paragraph style={styles.bigStat}>{(insights.avgComments / 1000).toFixed(1)}K</Paragraph>
            <Paragraph style={styles.cardCaption}>avg per video</Paragraph>
          </View>
          <View style={[styles.card, styles.halfCard]}>
            <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>DURATION</Paragraph></View>
            <Paragraph style={styles.bigStat}>{insights.avgDuration}s</Paragraph>
            <Paragraph style={styles.cardCaption}>sweet spot length</Paragraph>
          </View>
        </View>

        <View style={styles.sectionHeader}><View style={styles.dot} /><Paragraph style={styles.sectionLabel}>TOP HASHTAGS</Paragraph></View>
        <View style={styles.card}>
          <View style={styles.hashtagGrid}>
            {insights.topHashtags.map((tag, index) => (
              <View key={index} style={styles.hashtagChip}><Paragraph style={styles.hashtagText}>{tag}</Paragraph></View>
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('VideoUpload', { jobId, niche, viralCount })} activeOpacity={0.85} style={styles.ctaWrapper}>
          <LinearGradient colors={['#00D4FF', '#00FFB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaButton}>
            <Paragraph style={styles.ctaText}>UPLOAD MY VIDEO  →</Paragraph>
          </LinearGradient>
          <View style={styles.ctaGlow} />
        </TouchableOpacity>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  header: { marginBottom: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  backBtnText: { fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00FFB3', marginRight: 8, shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 8 },
  statusText: { fontSize: 11, color: '#00FFB3', letterSpacing: 2, fontWeight: '700' },
  nicheBadge: { backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF40', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  nicheBadgeText: { fontSize: 11, color: '#00D4FF', letterSpacing: 1.5, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '900', color: '#E2F0FF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748B' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 11, color: '#64748B', letterSpacing: 2, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: { width: '47%', backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 18, overflow: 'hidden' },
  statGlowBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.8 },
  statValue: { fontSize: 28, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: '#64748B', letterSpacing: 1.5, fontWeight: '700' },
  card: { backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 20, marginBottom: 16 },
  patternRow: { paddingVertical: 14 },
  patternBorder: { borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  patternLeft: { marginBottom: 10 },
  categoryTag: { alignSelf: 'flex-start', backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF30', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
  categoryText: { fontSize: 9, color: '#00D4FF', letterSpacing: 1.5, fontWeight: '700' },
  patternLabel: { fontSize: 14, color: '#E2F0FF', fontWeight: '500' },
  patternRight: { flexDirection: 'row', alignItems: 'center' },
  scoreBar: { flex: 1, height: 4, backgroundColor: '#1E293B', borderRadius: 2, overflow: 'hidden', marginRight: 12 },
  scoreFill: { height: '100%', borderRadius: 2 },
  scoreText: { fontSize: 14, color: '#00D4FF', fontWeight: '900', width: 30, textAlign: 'right' },
  timeCard: { backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#00D4FF30', borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  timeCardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#00D4FF', opacity: 0.7 },
  timeCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  timeCardLabel: { fontSize: 10, color: '#64748B', letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  timeCardValue: { fontSize: 28, fontWeight: '900', color: '#00D4FF', marginBottom: 4 },
  timeCardHint: { fontSize: 11, color: '#334155' },
  reminderBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  reminderBtnText: { fontSize: 12, fontWeight: '900', color: '#050810', letterSpacing: 0.5 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: { flex: 1, marginBottom: 0 },
  bigStat: { fontSize: 26, fontWeight: '900', color: '#00D4FF', marginBottom: 4 },
  cardCaption: { fontSize: 12, color: '#64748B' },
  hashtagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hashtagChip: { backgroundColor: '#00D4FF10', borderWidth: 1, borderColor: '#00D4FF30', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  hashtagText: { fontSize: 13, color: '#00D4FF', fontWeight: '600' },
  ctaWrapper: { position: 'relative', marginTop: 12 },
  ctaButton: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 3 },
  ctaGlow: { position: 'absolute', bottom: -8, left: 40, right: 40, height: 16, backgroundColor: '#00D4FF', borderRadius: 8, opacity: 0.25, shadowColor: '#00D4FF', shadowOpacity: 1, shadowRadius: 16 },
});
