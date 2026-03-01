/**
 * HomeScreen - Content Flow Edition
 * Dark tech aesthetic with cyan glow, circuit-board feel
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

const FEATURES = [
  { icon: '📊', label: 'Viral Analytics' },
  { icon: '🤖', label: 'AI Coaching' },
  { icon: '📈', label: 'Growth Engine' },
];

const STATS = [
  { value: '10K+', label: 'CREATORS' },
  { value: '3.2M', label: 'VIEWS GENERATED' },
  { value: '8.5%', label: 'AVG ENGAGEMENT' },
];

export default function HomeScreen({ navigation }: any) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in on mount
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 800, useNativeDriver: true,
    }).start();

    // Pulse the logo orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Glow breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.12] });

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      {/* Background glow orb */}
      <Animated.View style={[styles.bgGlow, { opacity: glowOpacity }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.logoMark}>
            <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.logoGradient}>
              <Paragraph style={styles.logoSymbol}>{'»'}</Paragraph>
            </LinearGradient>
          </View>
          <Paragraph style={styles.appNameTop}>CONTENT FLOW</Paragraph>
          <View style={styles.versionBadge}>
            <Paragraph style={styles.versionText}>v2.0</Paragraph>
          </View>
        </View>

        {/* Hero section */}
        <View style={styles.hero}>
          <Animated.View style={[styles.orbWrapper, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.orbOuter}>
              <LinearGradient
                colors={['#00D4FF20', '#00FFB310']}
                style={styles.orbInner}
              >
                <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.orbCore}>
                  <Paragraph style={styles.orbIcon}>⚡</Paragraph>
                </LinearGradient>
              </LinearGradient>
            </View>
          </Animated.View>

          <Title style={styles.heroTitle}>Go Viral.</Title>
          <Title style={styles.heroTitleAccent}>Every Time.</Title>
          <Paragraph style={styles.heroSubtitle}>
            AI-powered content coaching that turns{'\n'}your videos into viral machines.
          </Paragraph>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {STATS.map((stat, i) => (
            <View key={i} style={styles.statItem}>
              <Paragraph style={styles.statValue}>{stat.value}</Paragraph>
              <Paragraph style={styles.statLabel}>{stat.label}</Paragraph>
              {i < STATS.length - 1 && <View style={styles.statDivider} />}
            </View>
          ))}
        </View>

        {/* Feature chips */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureChip}>
              <Paragraph style={styles.featureIcon}>{f.icon}</Paragraph>
              <Paragraph style={styles.featureLabel}>{f.label}</Paragraph>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NicheSelection')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00D4FF', '#00FFB3']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              <Paragraph style={styles.ctaText}>START MY FLOW  →</Paragraph>
            </LinearGradient>
            <View style={styles.ctaGlow} />
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <View style={styles.activeDot} />
            <Paragraph style={styles.trustText}>
              10,000+ creators growing right now
            </Paragraph>
          </View>
        </View>

      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  bgGlow: {
    position: 'absolute',
    top: -100, alignSelf: 'center',
    width: 400, height: 400,
    borderRadius: 200,
    backgroundColor: '#00D4FF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 48,
  },
  logoMark: { width: 32, height: 32, borderRadius: 8, overflow: 'hidden', marginRight: 10 },
  logoGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoSymbol: { fontSize: 16, fontWeight: '900', color: '#050810' },
  appNameTop: { flex: 1, fontSize: 14, fontWeight: '900', color: '#E2F0FF', letterSpacing: 4 },
  versionBadge: {
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF30',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  versionText: { fontSize: 10, color: '#00D4FF', letterSpacing: 1, fontWeight: '700' },

  // Hero
  hero: { alignItems: 'center', marginBottom: 40 },
  orbWrapper: { marginBottom: 32 },
  orbOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 1, borderColor: '#00D4FF30',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#00D4FF08',
  },
  orbInner: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
  },
  orbCore: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00D4FF', shadowOpacity: 1, shadowRadius: 20,
  },
  orbIcon: { fontSize: 32, lineHeight: 40 },

  heroTitle: {
    fontSize: 52, fontWeight: '900', color: '#E2F0FF',
    letterSpacing: -1, textAlign: 'center', lineHeight: 56,
  },
  heroTitleAccent: {
    fontSize: 52, fontWeight: '900', color: '#00D4FF',
    letterSpacing: -1, textAlign: 'center', lineHeight: 56,
    marginBottom: 20,
    textShadowColor: '#00D4FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  heroSubtitle: {
    fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 26,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 20,
    marginBottom: 24, position: 'relative',
  },
  statItem: { flex: 1, alignItems: 'center', position: 'relative' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#00D4FF', marginBottom: 4 },
  statLabel: { fontSize: 9, color: '#64748B', letterSpacing: 1.5, fontWeight: '700' },
  statDivider: {
    position: 'absolute', right: 0, top: '10%', bottom: '10%',
    width: 1, backgroundColor: '#1E293B',
  },

  // Features
  features: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 40 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
  },
  featureIcon: { fontSize: 14, marginRight: 6 },
  featureLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  // CTA
  ctaContainer: { alignItems: 'center' },
  ctaButton: {
    paddingVertical: 18, paddingHorizontal: 48,
    borderRadius: 14, alignItems: 'center',
    minWidth: 260,
  },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 3 },
  ctaGlow: {
    height: 20, marginHorizontal: 40, borderRadius: 10,
    backgroundColor: '#00D4FF', opacity: 0.2,
    shadowColor: '#00D4FF', shadowOpacity: 1, shadowRadius: 20,
    marginTop: -4,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  activeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FFB3',
    marginRight: 8, shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 6,
  },
  trustText: { fontSize: 13, color: '#64748B' },
});
