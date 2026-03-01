/**
 * CoachingScreen - Content Flow Edition
 * Structured coaching display with data-dashboard aesthetic
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService } from '../services/ApiService';
import LoadingAnimation from '../components/LoadingAnimation';

function parseCoaching(text: string): Array<{ emoji?: string; title?: string; content: string }> {
  if (!text) return [];
  const sections: Array<{ emoji?: string; title?: string; content: string }> = [];
  const lines = text.split('\n');
  let current: { emoji?: string; title?: string; content: string } = { content: '' };

  const emojiMap: { [key: string]: string } = {
    working: '✅', strengths: '💪', gaps: '⚠️', improvements: '🚀',
    actions: '🎯', blueprint: '📋', formula: '🔥', hashtag: '#️⃣',
    tips: '💡', strategy: '📊',
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const isHeader = trimmed.startsWith('#') || trimmed.startsWith('**') ||
      /^[A-Z\s]+:/.test(trimmed) || /^\d+\./.test(trimmed);

    if (isHeader && current.content) { sections.push(current); current = { content: '' }; }

    if (isHeader) {
      const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      let emoji = '';
      for (const [key, val] of Object.entries(emojiMap)) {
        if (title.toLowerCase().includes(key)) { emoji = val; break; }
      }
      current.title = title;
      current.emoji = emoji;
    } else if (trimmed) {
      current.content += (current.content ? '\n' : '') + trimmed;
    }
  });

  if (current.content) sections.push(current);
  return sections.length > 0 ? sections : [{ content: text }];
}

export default function CoachingScreen({ route, navigation }: any) {
  const { jobId, niche, analysisId } = route.params;
  const [coaching, setCoaching] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { generateCoaching(); }, []);

  const generateCoaching = async () => {
    try {
      const response = await ApiService.generateCoaching({ niche, analysis_id: analysisId, job_id: jobId });
      setCoaching(response.coaching);
    } catch {
      setCoaching('Failed to generate coaching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sections = parseCoaching(coaching);

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Paragraph style={styles.statusText}>
                {loading ? 'GENERATING...' : 'COACHING READY'}
              </Paragraph>
            </View>
            <View style={styles.nicheBadge}>
              <Paragraph style={styles.nicheBadgeText}>{niche.toUpperCase()}</Paragraph>
            </View>
          </View>
          <Title style={styles.title}>Your Strategy</Title>
          <Paragraph style={styles.subtitle}>Personalized coaching based on viral analysis</Paragraph>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingCard}>
              <LoadingAnimation size={120} />
              <Paragraph style={styles.loadingTitle}>Analyzing your content...</Paragraph>
              <Paragraph style={styles.loadingSubtitle}>
                Comparing against viral benchmarks in {niche}
              </Paragraph>
              {['Processing video data', 'Identifying patterns', 'Building strategy'].map((step, i) => (
                <View key={i} style={styles.loadingStep}>
                  <View style={styles.loadingDot} />
                  <Paragraph style={styles.loadingStepText}>{step}</Paragraph>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            {sections.map((section, index) => (
              <View key={index} style={styles.sectionCard}>
                {section.title && (
                  <View style={styles.sectionTop}>
                    <View style={styles.glowBar} />
                    <View style={styles.sectionMeta}>
                      {section.emoji && (
                        <Paragraph style={styles.sectionEmoji}>{section.emoji}</Paragraph>
                      )}
                      <View>
                        <View style={styles.labelRow}>
                          <View style={styles.dot} />
                          <Paragraph style={styles.sectionIndexLabel}>
                            INSIGHT {index + 1}/{sections.length}
                          </Paragraph>
                        </View>
                        <Title style={styles.sectionTitle}>{section.title}</Title>
                      </View>
                    </View>
                  </View>
                )}
                <Paragraph style={styles.sectionText}>{section.content}</Paragraph>
              </View>
            ))}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Dashboard')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#00D4FF', '#00FFB3']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <Paragraph style={styles.primaryBtnText}>BACK TO DASHBOARD  →</Paragraph>
                </LinearGradient>
                <View style={styles.btnGlow} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.popToTop()}
                activeOpacity={0.8}
                style={styles.secondaryBtn}
              >
                <Paragraph style={styles.secondaryBtnText}>↺  ANALYZE ANOTHER VIDEO</Paragraph>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48, paddingTop: Platform.OS === 'ios' ? 60 : 40 },

  // Header
  header: { marginBottom: 28 },
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

  // Loading
  loadingContainer: { flex: 1, paddingTop: 20 },
  loadingCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 32, alignItems: 'center',
  },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#E2F0FF', marginTop: 20, marginBottom: 8 },
  loadingSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 28 },
  loadingStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start' },
  loadingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 12 },
  loadingStepText: { fontSize: 13, color: '#64748B' },

  // Section cards
  sectionCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },
  sectionTop: { padding: 20, paddingBottom: 0, position: 'relative' },
  glowBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#00D4FF', opacity: 0.6 },
  sectionMeta: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionEmoji: { fontSize: 28, marginRight: 14, marginTop: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 8 },
  sectionIndexLabel: { fontSize: 10, color: '#64748B', letterSpacing: 1.5, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#00D4FF', marginBottom: 0 },
  sectionText: { fontSize: 14, lineHeight: 24, color: '#94A3B8', padding: 20, paddingTop: 16 },

  // Actions
  actions: { marginTop: 12 },
  primaryBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 4 },
  primaryBtnText: { fontSize: 13, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  btnGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.2, marginBottom: 16,
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 12,
  },
  secondaryBtn: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, paddingVertical: 18, alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
});
