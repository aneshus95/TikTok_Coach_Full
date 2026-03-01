/**
 * InteractiveCoachingScreen - Content Flow Edition
 * FIXED: Video player no longer clips.
 * - videoWrapper uses a fixed pixel height (not aspectRatio) so nothing cuts off
 * - Progress bar, marker dots, and time row are all OUTSIDE videoWrapper
 * - Markers use a dedicated scrubberArea with enough vertical space so dots
 *   are never clipped by overflow:hidden
 * - Active marker shows an emoji + floating label below
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import LoadingAnimation from '../components/LoadingAnimation';
import { ApiService } from '../services/ApiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tall enough for portrait TikTok video, short enough to leave room for controls
const VIDEO_HEIGHT = Math.min(SCREEN_WIDTH * (16 / 9), 420);

interface TimestampSuggestion {
  timestamp: number;
  title: string;
  issues: string[];
  suggestions: string[];
  categories: string[];
  emoji: string;
}

interface ViralInsight {
  creator: string;
  tiktok_link?: string;
  what_they_did: string;
  why_it_worked: string;
  views: string;
  idea_for_you: string;
  _content_gap?: string;
  _winning_format?: string;
  _trending_sounds?: string[];
}

export default function InteractiveCoachingScreen({ route, navigation }: any) {
  const {
    videoUri,
    niche,
    analysisId,
    duration: videoDuration = 30,
    timestamps: passedTimestamps = [],
    viralInsights: passedViralInsights = [],
  } = route.params;

  const videoRef = useRef<any>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoDuration);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showViralInsights, setShowViralInsights] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [suggestions] = useState<TimestampSuggestion[]>(passedTimestamps);
  const [viralInsights, setViralInsights] = useState<ViralInsight[]>(passedViralInsights);
  const [viralLoading, setViralLoading] = useState(false);

  // Fetch viral insights in background (separate from upload to avoid worker crash)
  useEffect(() => {
    if (viralInsights.length === 0 && analysisId) {
      setViralLoading(true);
      ApiService.fetchViralResearch(analysisId)
        .then((res) => {
          if (res.viral_insights && res.viral_insights.length > 0) {
            setViralInsights(res.viral_insights);
          }
        })
        .catch((err) => console.log('Viral research fetch failed:', err))
        .finally(() => setViralLoading(false));
    }
  }, [analysisId]);

  useEffect(() => {
    if (videoLoaded && suggestions.length > 0 && !showSuggestion) {
      const timer = setTimeout(() => {
        setCurrentSuggestionIndex(0);
        setPaused(true);
        setShowSuggestion(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [videoLoaded]);

  const handleProgress = (data: any) => {
    setCurrentTime(data.currentTime);
    if (!paused && !showSuggestion && suggestions.length > 0) {
      const nextIndex = suggestions.findIndex(
        (s, i) => i >= currentSuggestionIndex && data.currentTime >= s.timestamp
      );
      if (nextIndex !== -1) {
        setCurrentSuggestionIndex(nextIndex);
        setPaused(true);
        setShowSuggestion(true);
      }
    }
  };

  const handleNext = () => {
    setShowSuggestion(false);
    const nextIndex = currentSuggestionIndex + 1;
    if (nextIndex < suggestions.length) {
      setCurrentSuggestionIndex(nextIndex);
      setPaused(false);
    } else {
      setPaused(true);
      setShowViralInsights(true);
    }
  };

  const seekTo = (seconds: number) => {
    videoRef.current?.seek(seconds);
    setCurrentTime(seconds);
  };

  const currentSuggestion = suggestions[currentSuggestionIndex];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>

      {/* ─── Fixed header ──────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backBtn}>
          <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Title style={styles.headerTitle}>Interactive Coaching</Title>
          <View style={styles.headerMeta}>
            <View style={styles.progressPips}>
              {suggestions.map((_, i) => (
                <View key={i} style={[
                  styles.pip,
                  i < currentSuggestionIndex && styles.pipDone,
                  i === currentSuggestionIndex && styles.pipActive,
                ]} />
              ))}
            </View>
            <Paragraph style={styles.headerCount}>
              {currentSuggestionIndex + 1} / {suggestions.length}
            </Paragraph>
          </View>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.headerDivider} />

      {/* ─── Scrollable body ───────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ─── Video wrapper — fixed height, no overflow:hidden below it ─── */}
        <View style={[styles.videoWrapper, { height: VIDEO_HEIGHT }]}>
          {videoError ? (
            <View style={styles.errorState}>
              <Paragraph style={styles.errorEmoji}>⚠️</Paragraph>
              <Paragraph style={styles.errorTitle}>Video Unavailable</Paragraph>
              <TouchableOpacity
                onPress={() => { setVideoError(false); setVideoLoaded(false); }}
                style={styles.retryBtn}
              >
                <Paragraph style={styles.retryText}>RETRY</Paragraph>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={StyleSheet.absoluteFill}
                paused={paused}
                resizeMode="contain"
                onLoad={(data: any) => {
                  setDuration(data.duration || videoDuration);
                  setVideoLoaded(true);
                  setVideoError(false);
                }}
                onProgress={handleProgress}
                onError={() => { setVideoError(true); setVideoLoaded(true); }}
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
              />

              {!videoLoaded && (
                <View style={styles.videoOverlay}>
                  <LoadingAnimation size={120} />
                  <Paragraph style={styles.videoLoadingText}>Loading video...</Paragraph>
                </View>
              )}

              {videoLoaded && !showSuggestion && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={() => setPaused(!paused)}
                  activeOpacity={0.9}
                >
                  <View style={styles.playButtonWrapper}>
                    <View style={styles.playButton}>
                      <Paragraph style={styles.playIcon}>
                        {paused ? '▶' : '❚❚'}
                      </Paragraph>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ─── Controls — completely outside videoWrapper ─── */}
        {videoLoaded && !videoError && (
          <View style={styles.controlsBlock}>

            {/* Scrubber: track + floating markers above it */}
            <View style={styles.scrubberOuter}>

              {/* Marker dots live here — above the track, never clipped */}
              <View style={styles.markersRow}>
                {suggestions.map((s, i) => {
                  const pct = duration > 0 ? (s.timestamp / duration) * 100 : 0;
                  const isActive = i === currentSuggestionIndex;
                  const isDone = i < currentSuggestionIndex;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        seekTo(s.timestamp);
                        setCurrentSuggestionIndex(i);
                        setPaused(true);
                        setShowSuggestion(true);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={[
                        styles.markerTouchable,
                        { left: `${pct}%` },
                      ]}
                    >
                      <View style={[
                        styles.markerDot,
                        isActive && styles.markerDotActive,
                        isDone && styles.markerDotDone,
                      ]}>
                        <Paragraph style={isActive ? styles.markerEmojiActive : styles.markerEmoji}>
                          {s.emoji}
                        </Paragraph>
                      </View>
                      {/* Floating label on active marker */}
                      {isActive && (
                        <View style={styles.markerLabel}>
                          <Paragraph style={styles.markerLabelText} numberOfLines={1}>
                            {s.title}
                          </Paragraph>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Track bar */}
              <View style={styles.track}>
                <LinearGradient
                  colors={['#00D4FF', '#00FFB3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.trackFill, { width: `${progress}%` }]}
                />
              </View>

            </View>

            {/* Time labels */}
            <View style={styles.timeRow}>
              <Paragraph style={styles.timeText}>{Math.floor(currentTime)}s</Paragraph>
              <Paragraph style={styles.timeText}>{Math.floor(duration)}s</Paragraph>
            </View>

          </View>
        )}

        {/* ─── Coaching card ─────────────────────────────────── */}
        {showSuggestion && currentSuggestion && (
          <View style={styles.coachCard}>

            <LinearGradient
              colors={['#00D4FF', '#00FFB3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardTopBar}
            />

            {/* Header row */}
            <View style={styles.cardHeader}>
              <Paragraph style={styles.cardEmoji}>{currentSuggestion.emoji}</Paragraph>
              <View style={styles.cardTitleBlock}>
                <View style={styles.labelRow}>
                  <View style={styles.dot} />
                  <Paragraph style={styles.cardLabel}>COACHING POINT</Paragraph>
                </View>
                <Title style={styles.cardTitle}>{currentSuggestion.title}</Title>
                <View style={styles.categoriesRow}>
                  {currentSuggestion.categories.map((c, i) => (
                    <View key={i} style={styles.categoryChip}>
                      <Paragraph style={styles.categoryText}>{c}</Paragraph>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Issues */}
            <View style={styles.issuesSection}>
              <View style={styles.sectionLabelRow}>
                <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                <Paragraph style={[styles.sectionLabelText, { color: '#EF4444' }]}>
                  ISSUES DETECTED
                </Paragraph>
              </View>
              {currentSuggestion.issues.map((issue, i) => (
                <View key={i} style={styles.listItem}>
                  <Paragraph style={styles.listItemSymbol}>—</Paragraph>
                  <Paragraph style={styles.listItemText}>{issue}</Paragraph>
                </View>
              ))}
            </View>

            {/* Fixes */}
            <View style={styles.fixesSection}>
              <View style={styles.sectionLabelRow}>
                <View style={[styles.dot, { backgroundColor: '#00FFB3' }]} />
                <Paragraph style={[styles.sectionLabelText, { color: '#00FFB3' }]}>
                  RECOMMENDED FIXES
                </Paragraph>
              </View>
              {currentSuggestion.suggestions.map((fix, i) => (
                <View key={i} style={styles.listItem}>
                  <Paragraph style={styles.listItemSymbol}>→</Paragraph>
                  <Paragraph style={styles.listItemText}>{fix}</Paragraph>
                </View>
              ))}
            </View>

            {/* Next / Finish */}
            <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
              <LinearGradient
                colors={['#00D4FF', '#00FFB3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtn}
              >
                <Paragraph style={styles.nextBtnText}>
                  {currentSuggestionIndex < suggestions.length - 1
                    ? 'NEXT INSIGHT  →'
                    : 'SEE WHAT TOP CREATORS DID  →'}
                </Paragraph>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Dashboard')}
              style={styles.skipBtn}
            >
              <Paragraph style={styles.skipText}>back to dashboard →</Paragraph>
            </TouchableOpacity>

          </View>
        )}

        {/* ─── Viral Insights card ─────────────────────────────── */}
        {showViralInsights && viralLoading && viralInsights.length === 0 && (
          <View style={styles.viralCard}>
            <LinearGradient
              colors={['#FF6B00', '#FF2D87']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
            >
              <Title style={{ fontSize: 18, fontWeight: '900', color: '#FFF' }}>
                Researching Top Creators...
              </Title>
            </LinearGradient>
            <View style={{ padding: 32, alignItems: 'center' }}>
              <LoadingAnimation size={120} />
              <Paragraph style={{ color: '#94A3B8', marginTop: 16, textAlign: 'center', fontSize: 13 }}>
                Searching for viral videos with similar content in {niche}
              </Paragraph>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Dashboard')}
              style={[styles.skipBtn, { marginHorizontal: 16, marginBottom: 16 }]}
            >
              <Paragraph style={styles.skipText}>skip to dashboard →</Paragraph>
            </TouchableOpacity>
          </View>
        )}
        {showViralInsights && !viralLoading && viralInsights.length === 0 && (
          <View style={styles.viralCard}>
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Paragraph style={{ color: '#94A3B8', textAlign: 'center', fontSize: 14 }}>
                No viral research available for this video.
              </Paragraph>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Dashboard')}
              style={[styles.skipBtn, { marginHorizontal: 16, marginBottom: 16 }]}
            >
              <Paragraph style={styles.skipText}>go to dashboard →</Paragraph>
            </TouchableOpacity>
          </View>
        )}
        {showViralInsights && viralInsights.length > 0 && (
          <View style={styles.viralCard}>
            <LinearGradient
              colors={['#FF6B00', '#FF2D87']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardTopBar}
            />

            {/* Header */}
            <View style={styles.cardHeader}>
              <Paragraph style={styles.cardEmoji}>🔥</Paragraph>
              <View style={styles.cardTitleBlock}>
                <View style={styles.labelRow}>
                  <View style={[styles.dot, { backgroundColor: '#FF6B00' }]} />
                  <Paragraph style={[styles.cardLabel, { color: '#FF6B00' }]}>VIRAL RESEARCH</Paragraph>
                </View>
                <Title style={[styles.cardTitle, { color: '#FF6B00' }]}>
                  What Top Creators Did
                </Title>
                <Paragraph style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Real viral videos with similar content in {niche}
                </Paragraph>
              </View>
            </View>

            {/* Content gap + winning format (from first insight's metadata) */}
            {viralInsights[0]?._content_gap ? (
              <View style={styles.viralGapCard}>
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Paragraph style={[styles.sectionLabelText, { color: '#EF4444' }]}>
                    WHAT YOUR VIDEO IS MISSING
                  </Paragraph>
                </View>
                <Paragraph style={styles.listItemText}>{viralInsights[0]._content_gap}</Paragraph>
              </View>
            ) : null}

            {viralInsights[0]?._winning_format ? (
              <View style={styles.viralFormatCard}>
                <View style={styles.sectionLabelRow}>
                  <View style={[styles.dot, { backgroundColor: '#00FFB3' }]} />
                  <Paragraph style={[styles.sectionLabelText, { color: '#00FFB3' }]}>
                    WINNING FORMAT
                  </Paragraph>
                </View>
                <Paragraph style={styles.listItemText}>{viralInsights[0]._winning_format}</Paragraph>
              </View>
            ) : null}

            {/* Trending sounds */}
            {viralInsights[0]?._trending_sounds && viralInsights[0]._trending_sounds.length > 0 ? (
              <View style={styles.viralSoundsRow}>
                <Paragraph style={{ fontSize: 10, color: '#64748B', letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 }}>
                  TRENDING SOUNDS
                </Paragraph>
                {viralInsights[0]._trending_sounds.map((sound, i) => (
                  <View key={i} style={styles.soundChip}>
                    <Paragraph style={styles.soundChipText}>🎵 {sound}</Paragraph>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Individual insights */}
            {viralInsights.map((insight, i) => (
              <View key={i} style={styles.viralInsightItem}>
                <View style={styles.viralInsightHeader}>
                  <View style={styles.viralRankBadge}>
                    <Paragraph style={styles.viralRankText}>{i + 1}</Paragraph>
                  </View>
                  <View style={{ flex: 1 }}>
                    {insight.creator?.startsWith('@') && insight.tiktok_link ? (
                      <TouchableOpacity onPress={() => Linking.openURL(insight.tiktok_link!)}>
                        <Paragraph style={[styles.viralCreator, { color: '#00D4FF', textDecorationLine: 'underline' }]}>
                          {insight.creator}
                        </Paragraph>
                      </TouchableOpacity>
                    ) : (
                      <Paragraph style={styles.viralCreator}>{insight.creator}</Paragraph>
                    )}
                    {insight.views ? (
                      <Paragraph style={styles.viralViews}>{insight.views}</Paragraph>
                    ) : null}
                  </View>
                </View>

                {insight.tiktok_link ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(insight.tiktok_link!)}
                    style={styles.tiktokLinkBtn}
                  >
                    <Paragraph style={styles.tiktokLinkText}>
                      {insight.tiktok_link.includes('tiktok.com/search') ? 'Find Similar TikToks ↗'
                        : insight.tiktok_link.includes('tiktok.com/') ? 'View on TikTok ↗'
                        : 'View Source ↗'}
                    </Paragraph>
                  </TouchableOpacity>
                ) : null}

                <Paragraph style={styles.viralWhat}>{insight.what_they_did}</Paragraph>

                <View style={styles.viralWhyBox}>
                  <Paragraph style={{ fontSize: 9, color: '#FF6B00', letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 }}>
                    WHY IT WORKED
                  </Paragraph>
                  <Paragraph style={styles.listItemText}>{insight.why_it_worked}</Paragraph>
                </View>

                <View style={styles.viralIdeaBox}>
                  <Paragraph style={{ fontSize: 9, color: '#00D4FF', letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 }}>
                    STEAL THIS IDEA
                  </Paragraph>
                  <Paragraph style={[styles.listItemText, { color: '#E2F0FF' }]}>{insight.idea_for_you}</Paragraph>
                </View>
              </View>
            ))}

            {/* Done */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Dashboard')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FF6B00', '#FF2D87']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtn}
              >
                <Paragraph style={styles.nextBtnText}>
                  BACK TO DASHBOARD  →
                </Paragraph>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowViralInsights(false);
                setCurrentSuggestionIndex(0);
                setShowSuggestion(true);
                setPaused(true);
                seekTo(suggestions[0]?.timestamp || 0);
              }}
              style={styles.skipBtn}
            >
              <Paragraph style={styles.skipText}>← review coaching points again</Paragraph>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const DOT_SIZE = 18;
const DOT_SIZE_ACTIVE = 26;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#050810',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center',
  },
  backBtnText: { fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 15, fontWeight: '900', color: '#E2F0FF',
    letterSpacing: 0.5, marginBottom: 4,
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressPips: { flexDirection: 'row', gap: 4 },
  pip: { width: 14, height: 4, borderRadius: 2, backgroundColor: '#1E293B' },
  pipDone: { backgroundColor: '#00FFB3' },
  pipActive: { backgroundColor: '#00D4FF', width: 22 },
  headerCount: { fontSize: 11, color: '#64748B', letterSpacing: 1 },
  headerSpacer: { width: 40 },
  headerDivider: { height: 1, backgroundColor: '#1E293B' },

  // ── Scroll ───────────────────────────────────────────────
  scrollContent: { paddingBottom: 48 },

  // ── Video ────────────────────────────────────────────────
  // Fixed height — no aspectRatio, no overflow:hidden on its children
  videoWrapper: {
    width: '100%',
    backgroundColor: '#000',
    // overflow visible so nothing inside is clipped
    overflow: 'hidden', // keep this only on the video itself
  },

  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000',
  },
  videoLoadingText: { marginTop: 12, color: '#64748B', fontSize: 13 },

  playButtonWrapper: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  playButton: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderWidth: 1.5, borderColor: '#00D4FF',
    justifyContent: 'center', alignItems: 'center',
  },
  playIcon: { fontSize: 28, color: '#00D4FF', textAlign: 'center' },

  errorState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000', padding: 24,
  },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 15, color: '#64748B', marginBottom: 20, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF',
    borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { fontSize: 12, color: '#00D4FF', fontWeight: '700', letterSpacing: 1.5 },

  // ── Controls (below video, never clipped) ────────────────
  controlsBlock: {
    backgroundColor: '#050810',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 0,
  },

  // Scrubber outer: markers row stacked above the track
  scrubberOuter: {
    marginBottom: 6,
  },

  // Marker row: same width as track, positioned so dots sit just above the track
  markersRow: {
    position: 'relative',
    height: DOT_SIZE_ACTIVE + 24, // dot + label
    marginBottom: 4,
  },

  // Each marker touchable is absolutely positioned along the row
  markerTouchable: {
    position: 'absolute',
    bottom: 0,                        // anchor to bottom of markersRow = top of track
    transform: [{ translateX: -(DOT_SIZE / 2) }],
    alignItems: 'center',
  },

  markerDot: {
    width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2,
    backgroundColor: '#1E293B',
    borderWidth: 2, borderColor: '#334155',
    justifyContent: 'center', alignItems: 'center',
  },
  markerDotActive: {
    width: DOT_SIZE_ACTIVE, height: DOT_SIZE_ACTIVE, borderRadius: DOT_SIZE_ACTIVE / 2,
    backgroundColor: '#00D4FF', borderColor: '#00D4FF',
    shadowColor: '#00D4FF', shadowOpacity: 1, shadowRadius: 12,
    elevation: 8,
    // Re-centre: active is wider, compensate translateX
    transform: [{ translateX: -(DOT_SIZE_ACTIVE / 2) + (DOT_SIZE / 2) }],
  },
  markerDotDone: { backgroundColor: '#00FFB3', borderColor: '#00FFB3' },
  markerEmoji: { fontSize: 9 },
  markerEmojiActive: { fontSize: 13 },

  // Floating label above the active dot
  markerLabel: {
    position: 'absolute',
    bottom: DOT_SIZE_ACTIVE + 4,
    backgroundColor: '#00D4FF',
    borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    minWidth: 60, maxWidth: 110,
    alignItems: 'center',
  },
  markerLabelText: {
    fontSize: 9, color: '#050810', fontWeight: '800',
    letterSpacing: 0.3, textAlign: 'center',
  },

  // Track
  track: {
    height: 4, backgroundColor: '#1E293B',
    borderRadius: 2, overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 2 },

  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11, color: '#64748B', fontWeight: '700', letterSpacing: 0.8,
  },

  // ── Coach card ───────────────────────────────────────────
  coachCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden',
    padding: 24,
  },
  cardTopBar: {
    height: 3,
    marginHorizontal: -24, marginTop: -24, marginBottom: 22,
  },
  cardHeader: { flexDirection: 'row', marginBottom: 20 },
  cardEmoji: { fontSize: 34, marginRight: 14, marginTop: 2 },
  cardTitleBlock: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 8 },
  cardLabel: { fontSize: 10, color: '#64748B', letterSpacing: 2, fontWeight: '700' },
  cardTitle: {
    fontSize: 18, fontWeight: '900', color: '#E2F0FF',
    marginBottom: 10, lineHeight: 24,
  },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    backgroundColor: '#00D4FF10', borderWidth: 1, borderColor: '#00D4FF30',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  categoryText: { fontSize: 10, color: '#00D4FF', fontWeight: '700', letterSpacing: 0.5 },

  issuesSection: {
    backgroundColor: '#EF444410', borderWidth: 1, borderColor: '#EF444430',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  fixesSection: {
    backgroundColor: '#00FFB310', borderWidth: 1, borderColor: '#00FFB330',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionLabelText: { fontSize: 10, letterSpacing: 2, fontWeight: '700' },

  listItem: { flexDirection: 'row', marginBottom: 6 },
  listItemSymbol: { fontSize: 13, color: '#64748B', marginRight: 8, width: 14 },
  listItemText: { flex: 1, fontSize: 13, color: '#94A3B8', lineHeight: 20 },

  nextBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  nextBtnText: { fontSize: 13, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  skipBtn: { marginTop: 14, alignItems: 'center' },
  skipText: { fontSize: 12, color: '#334155', letterSpacing: 0.5 },

  // ── Viral Insights ────────────────────────────────────
  viralCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#FF6B0040',
    borderRadius: 16, overflow: 'hidden',
    padding: 24,
  },
  viralGapCard: {
    backgroundColor: '#EF444410', borderWidth: 1, borderColor: '#EF444430',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  viralFormatCard: {
    backgroundColor: '#00FFB310', borderWidth: 1, borderColor: '#00FFB330',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  viralSoundsRow: {
    backgroundColor: '#00D4FF08', borderWidth: 1, borderColor: '#00D4FF20',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  soundChip: {
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF30',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 6, alignSelf: 'flex-start',
  },
  soundChipText: { fontSize: 12, color: '#00D4FF', fontWeight: '600' },
  viralInsightItem: {
    backgroundColor: '#0A0F1A', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 12, padding: 16, marginBottom: 12,
  },
  viralInsightHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  viralRankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FF6B0020', borderWidth: 1, borderColor: '#FF6B00',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  viralRankText: { fontSize: 13, fontWeight: '900', color: '#FF6B00' },
  viralCreator: { fontSize: 14, fontWeight: '700', color: '#E2F0FF' },
  viralViews: { fontSize: 11, color: '#FF6B00', fontWeight: '600', marginTop: 2 },
  tiktokLinkBtn: {
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF40',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 8,
  },
  tiktokLinkText: { fontSize: 11, color: '#00D4FF', fontWeight: '700' },
  viralWhat: { fontSize: 13, color: '#94A3B8', lineHeight: 20, marginBottom: 10 },
  viralWhyBox: {
    backgroundColor: '#FF6B0008', borderWidth: 1, borderColor: '#FF6B0025',
    borderRadius: 8, padding: 10, marginBottom: 8,
  },
  viralIdeaBox: {
    backgroundColor: '#00D4FF08', borderWidth: 1, borderColor: '#00D4FF25',
    borderRadius: 8, padding: 10,
  },
});
