/**
 * AnalysisScreen - Gen Z Edition
 * Shows viral video analysis results
 */

import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

export default function AnalysisScreen({ route, navigation }: any) {
  const { jobId, niche, viralCount } = route.params;

  // Mock data - replace with actual data from route.params
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
    { emoji: '🎬', label: 'hook in 3 seconds', score: 95 },
    { emoji: '🎵', label: 'trending sounds', score: 88 },
    { emoji: '✨', label: 'high production', score: 82 },
    { emoji: '#️⃣', label: 'smart hashtags', score: 90 },
    { emoji: '💬', label: 'engagement bait', score: 85 },
  ];

  return (
    <LinearGradient
      colors={['#0A0A0A', '#1A1A1A']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <Title style={styles.headerEmoji}>📊</Title>
          <Title style={styles.title}>viral analysis</Title>
          <Paragraph style={styles.subtitle}>
            what's working in {niche}
          </Paragraph>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          
          <Card style={styles.statCard}>
            <LinearGradient
              colors={['#FF006E', '#8338EC']}
              style={styles.statGradient}
            >
              <Title style={styles.statValue}>
                {(insights.avgViews / 1000000).toFixed(1)}M
              </Title>
              <Paragraph style={styles.statLabel}>avg views</Paragraph>
            </LinearGradient>
          </Card>

          <Card style={styles.statCard}>
            <LinearGradient
              colors={['#FFBE0B', '#FF006E']}
              style={styles.statGradient}
            >
              <Title style={styles.statValue}>
                {(insights.avgLikes / 1000).toFixed(0)}K
              </Title>
              <Paragraph style={styles.statLabel}>avg likes</Paragraph>
            </LinearGradient>
          </Card>

          <Card style={styles.statCard}>
            <LinearGradient
              colors={['#06FFA5', '#3A86FF']}
              style={styles.statGradient}
            >
              <Title style={styles.statValue}>
                {insights.avgEngagementRate}
              </Title>
              <Paragraph style={styles.statLabel}>engagement</Paragraph>
            </LinearGradient>
          </Card>

          <Card style={styles.statCard}>
            <LinearGradient
              colors={['#8338EC', '#3A86FF']}
              style={styles.statGradient}
            >
              <Title style={styles.statValue}>
                {insights.avgDuration}s
              </Title>
              <Paragraph style={styles.statLabel}>duration</Paragraph>
            </LinearGradient>
          </Card>

        </View>

        {/* Viral Patterns */}
        <Card style={styles.patternsCard}>
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={styles.patternsGradient}
          >
            <Title style={styles.sectionTitle}>viral patterns 🔥</Title>
            
            {viralPatterns.map((pattern, index) => (
              <View key={index} style={styles.patternItem}>
                <View style={styles.patternInfo}>
                  <Title style={styles.patternEmoji}>{pattern.emoji}</Title>
                  <Paragraph style={styles.patternLabel}>{pattern.label}</Paragraph>
                </View>
                
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreBar}>
                    <LinearGradient
                      colors={['#FFBE0B', '#FF006E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.scoreFill, { width: `${pattern.score}%` }]}
                    />
                  </View>
                  <Paragraph style={styles.scoreText}>{pattern.score}%</Paragraph>
                </View>
              </View>
            ))}
          </LinearGradient>
        </Card>

        {/* Best Time to Post */}
        <Card style={styles.timeCard}>
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={styles.timeGradient}
          >
            <Title style={styles.timeEmoji}>⏰</Title>
            <Title style={styles.timeTitle}>best time to post</Title>
            <Title style={styles.timeValue}>{insights.bestPostingTime}</Title>
            <Paragraph style={styles.timeHint}>
              based on {viralCount} viral videos
            </Paragraph>
          </LinearGradient>
        </Card>

        {/* Top Hashtags */}
        <Card style={styles.hashtagsCard}>
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={styles.hashtagsGradient}
          >
            <Title style={styles.sectionTitle}>top hashtags #️⃣</Title>
            
            <View style={styles.hashtagsGrid}>
              {insights.topHashtags.map((tag, index) => (
                <LinearGradient
                  key={index}
                  colors={['#FF006E', '#8338EC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.hashtagBadge}
                >
                  <Paragraph style={styles.hashtagText}>{tag}</Paragraph>
                </LinearGradient>
              ))}
            </View>
          </LinearGradient>
        </Card>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('VideoUpload', {
            jobId,
            niche,
            viralCount,
          })}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFBE0B', '#FF006E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <Title style={styles.continueButtonText}>
              upload my video 🚀
            </Title>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  headerEmoji: {
    fontSize: 64,
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 5,
    textTransform: 'lowercase',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textTransform: 'lowercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'transparent',
    borderRadius: 20,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 0,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'lowercase',
  },
  patternsCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  patternsGradient: {
    padding: 24,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textTransform: 'lowercase',
  },
  patternItem: {
    marginBottom: 20,
  },
  patternInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  patternEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  patternLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#0A0A0A',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  scoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 16,
    color: '#FFBE0B',
    fontWeight: '900',
    width: 45,
    textAlign: 'right',
  },
  timeCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  timeGradient: {
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 24,
  },
  timeEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  timeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B0B0B0',
    marginBottom: 10,
    textTransform: 'lowercase',
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFBE0B',
    marginBottom: 5,
  },
  timeHint: {
    fontSize: 12,
    color: '#666',
    textTransform: 'lowercase',
  },
  hashtagsCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    marginBottom: 30,
    overflow: 'hidden',
    elevation: 0,
  },
  hashtagsGradient: {
    padding: 24,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 24,
  },
  hashtagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hashtagBadge: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  hashtagText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  continueButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#FFBE0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
});
