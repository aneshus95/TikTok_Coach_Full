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
  ActivityIndicator,
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

interface CoachingExtras {
  strengths?: { what: string; why_it_matters: string }[];
  improvements?: { what: string; how: string; impact: string }[];
  creative_ideas?: { idea: string; inspiration: string; how_to_execute: string }[];
  snapshot?: { honest_take?: string; keep_this?: string; fix_this?: string };
  posting_strategy?: { caption?: string; first_comment?: string; best_time?: string };
}

export default function InteractiveCoachingScreen({ route, navigation }: any) {
  const {
    videoUri,
    niche,
    analysisId,
    duration: videoDuration = 30,
    timestamps: passedTimestamps = [],
    viralInsights: passedViralInsights = [],
    extras: passedExtras = {} as CoachingExtras,
    scriptData: passedScriptData = null,
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
  const [extras] = useState<CoachingExtras>(passedExtras);
  const [nicheHooks, setNicheHooks] = useState<{technique?: string; visual?: string; audio?: string; text_overlay?: string}[]>([]);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewrites, setRewrites] = useState<any[]>([]);
  const [showRewrites, setShowRewrites] = useState(false);

  // Load niche hooks from playbook
  useEffect(() => {
    if (niche) {
      ApiService.getNicheHooks(niche)
        .then(data => setNicheHooks(data.hooks || []))
        .catch(() => {});
    }
  }, [niche]);

  // Viral research disabled — saving for Instagram feature
  // useEffect(() => { ... fetchViralResearch ... }, [analysisId]);

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
    }
  };

  const seekTo = (seconds: number) => {
    videoRef.current?.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleRewriteScript = async () => {
    // Build original script from timestamp observations
    const originalScript = suggestions
      .map(s => s.issues.map(iss => typeof iss === 'string' ? iss : '').join(' '))
      .filter(Boolean)
      .join(' ');

    // Fallback: use snapshot honest_take if no observations
    const scriptText = originalScript || extras?.snapshot?.honest_take || 'No script available';

    setRewriteLoading(true);
    try {
      const result = await ApiService.rewriteScript(scriptText, niche);
      setRewrites(result.rewrites || []);
      setShowRewrites(true);
    } catch (err: any) {
      console.error('Rewrite failed:', err);
    } finally {
      setRewriteLoading(false);
    }
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

        {/* ─── Coaching summary cards after all timestamps ─────────── */}
        {currentSuggestionIndex >= suggestions.length - 1 && !showSuggestion && (
          <View style={{ marginTop: 12 }}>

            {/* Strengths Card */}
            {extras.strengths && extras.strengths.length > 0 && (
              <View style={styles.extrasCard}>
                <View style={[styles.extrasTopBar, { backgroundColor: '#00FFB3' }]} />
                <View style={styles.extrasHeader}>
                  <Paragraph style={styles.extrasEmoji}>{'💪'}</Paragraph>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionLabelRow}>
                      <View style={[styles.dot, { backgroundColor: '#00FFB3' }]} />
                      <Paragraph style={[styles.sectionLabelText, { color: '#00FFB3' }]}>
                        WHAT YOU'RE DOING WELL
                      </Paragraph>
                    </View>
                  </View>
                </View>
                {extras.strengths.map((s, i) => (
                  <View key={i} style={styles.extrasItem}>
                    <Paragraph style={styles.extrasItemTitle}>{s.what}</Paragraph>
                    <Paragraph style={styles.extrasItemSub}>{s.why_it_matters}</Paragraph>
                  </View>
                ))}
              </View>
            )}

            {/* Improvements Card */}
            {extras.improvements && extras.improvements.length > 0 && (
              <View style={styles.extrasCard}>
                <View style={[styles.extrasTopBar, { backgroundColor: '#F59E0B' }]} />
                <View style={styles.extrasHeader}>
                  <Paragraph style={styles.extrasEmoji}>{'📈'}</Paragraph>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionLabelRow}>
                      <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                      <Paragraph style={[styles.sectionLabelText, { color: '#F59E0B' }]}>
                        AREAS TO IMPROVE
                      </Paragraph>
                    </View>
                  </View>
                </View>
                {extras.improvements.map((imp, i) => (
                  <View key={i} style={styles.extrasItem}>
                    <Paragraph style={styles.extrasItemTitle}>{imp.what}</Paragraph>
                    <Paragraph style={styles.extrasItemSub}>{imp.how}</Paragraph>
                    {imp.impact ? (
                      <View style={styles.impactBadge}>
                        <Paragraph style={styles.impactText}>{imp.impact}</Paragraph>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Creative Ideas Card */}
            {extras.creative_ideas && extras.creative_ideas.length > 0 && (
              <View style={styles.extrasCard}>
                <View style={[styles.extrasTopBar, { backgroundColor: '#00D4FF' }]} />
                <View style={styles.extrasHeader}>
                  <Paragraph style={styles.extrasEmoji}>{'💡'}</Paragraph>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionLabelRow}>
                      <View style={[styles.dot, { backgroundColor: '#00D4FF' }]} />
                      <Paragraph style={[styles.sectionLabelText, { color: '#00D4FF' }]}>
                        CREATIVE IDEAS FOR YOU
                      </Paragraph>
                    </View>
                  </View>
                </View>
                {extras.creative_ideas.map((idea, i) => (
                  <View key={i} style={styles.ideaItem}>
                    <View style={styles.ideaNumberBadge}>
                      <Paragraph style={styles.ideaNumber}>{i + 1}</Paragraph>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Paragraph style={styles.extrasItemTitle}>{idea.idea}</Paragraph>
                      {idea.inspiration ? (
                        <Paragraph style={styles.ideaInspiration}>{idea.inspiration}</Paragraph>
                      ) : null}
                      {idea.how_to_execute ? (
                        <Paragraph style={styles.extrasItemSub}>{idea.how_to_execute}</Paragraph>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Hooks Library from Playbook */}
            {nicheHooks.length > 0 && (
              <View style={styles.extrasCard}>
                <View style={[styles.extrasTopBar, { backgroundColor: '#E879F9' }]} />
                <View style={styles.extrasHeader}>
                  <Paragraph style={styles.extrasEmoji}>{'🪝'}</Paragraph>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sectionLabelRow}>
                      <View style={[styles.dot, { backgroundColor: '#E879F9' }]} />
                      <Paragraph style={[styles.sectionLabelText, { color: '#E879F9' }]}>
                        PROVEN HOOKS — {niche.toUpperCase()}
                      </Paragraph>
                    </View>
                  </View>
                </View>
                {nicheHooks.map((hook, i) => (
                  <View key={i} style={styles.extrasItem}>
                    {hook.technique ? (
                      <Paragraph style={styles.extrasItemTitle}>{hook.technique}</Paragraph>
                    ) : null}
                    {hook.text_overlay ? (
                      <Paragraph style={[styles.extrasItemSub, { color: '#E879F9', fontStyle: 'italic' }]}>
                        Text: "{hook.text_overlay}"
                      </Paragraph>
                    ) : null}
                    {hook.visual ? (
                      <Paragraph style={styles.extrasItemSub}>Visual: {hook.visual}</Paragraph>
                    ) : null}
                    {hook.audio ? (
                      <Paragraph style={styles.extrasItemSub}>Audio: {hook.audio}</Paragraph>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Rewrite Script */}
            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
              {!showRewrites && (
                <TouchableOpacity
                  onPress={handleRewriteScript}
                  disabled={rewriteLoading}
                  activeOpacity={0.85}
                  style={styles.rewriteBtn}
                >
                  {rewriteLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#E879F9" style={{ marginRight: 10 }} />
                      <Paragraph style={styles.rewriteBtnText}>REWRITING YOUR SCRIPT...</Paragraph>
                    </View>
                  ) : (
                    <Paragraph style={styles.rewriteBtnText}>REWRITE YOUR SCRIPT</Paragraph>
                  )}
                </TouchableOpacity>
              )}

              {showRewrites && rewrites.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <View style={[styles.dot, { backgroundColor: '#E879F9' }]} />
                    <Paragraph style={[styles.sectionLabelText, { color: '#E879F9' }]}>
                      SCRIPT REWRITES
                    </Paragraph>
                  </View>
                  {rewrites.map((rw, i) => (
                    <View key={i} style={styles.rewriteCard}>
                      <View style={[styles.rewriteTopBar, {
                        backgroundColor: i === 0 ? '#00D4FF' : i === 1 ? '#00FFB3' : '#F59E0B',
                      }]} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={[styles.rewriteBadge, {
                          borderColor: i === 0 ? '#00D4FF' : i === 1 ? '#00FFB3' : '#F59E0B',
                          backgroundColor: i === 0 ? '#00D4FF15' : i === 1 ? '#00FFB315' : '#F59E0B15',
                        }]}>
                          <Paragraph style={[styles.rewriteBadgeText, {
                            color: i === 0 ? '#00D4FF' : i === 1 ? '#00FFB3' : '#F59E0B',
                          }]}>{i + 1}</Paragraph>
                        </View>
                        <Paragraph style={styles.rewriteTitle}>{rw.style || `Rewrite ${i + 1}`}</Paragraph>
                      </View>

                      {rw.hook ? (
                        <View style={styles.rewriteSection}>
                          <Paragraph style={styles.rewriteSectionLabel}>HOOK</Paragraph>
                          <Paragraph style={styles.rewriteText}>{rw.hook}</Paragraph>
                        </View>
                      ) : null}

                      {rw.body ? (
                        <View style={styles.rewriteSection}>
                          <Paragraph style={styles.rewriteSectionLabel}>BODY</Paragraph>
                          <Paragraph style={styles.rewriteText}>{rw.body}</Paragraph>
                        </View>
                      ) : null}

                      {rw.cta ? (
                        <View style={styles.rewriteSection}>
                          <Paragraph style={styles.rewriteSectionLabel}>CTA</Paragraph>
                          <Paragraph style={styles.rewriteText}>{rw.cta}</Paragraph>
                        </View>
                      ) : null}

                      {rw.why_this_works ? (
                        <View style={styles.rewriteWhyBox}>
                          <Paragraph style={styles.rewriteWhyLabel}>WHY THIS WORKS</Paragraph>
                          <Paragraph style={styles.rewriteWhyText}>{rw.why_this_works}</Paragraph>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              {/* Write Next Script — loop nudge */}
              <TouchableOpacity
                onPress={() => {
                  // Build coaching feedback summary
                  const feedbackItems = suggestions.map(s =>
                    `At ${s.timestamp}s (${s.title}): ${s.issues.join('. ')} → Fix: ${s.suggestions.join('. ')}`
                  );
                  const strengthsSummary = (extras.strengths || []).map(s => s.what).join(', ');
                  const improvementsSummary = (extras.improvements || []).map(imp => `${imp.what}: ${imp.how}`).join('. ');

                  navigation.navigate('ScriptWriter', {
                    coachingFeedback: {
                      niche,
                      feedbackPoints: feedbackItems,
                      strengths: strengthsSummary,
                      improvements: improvementsSummary,
                      usedAiScript: !!passedScriptData,
                    },
                  });
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#00D4FF', '#00FFB3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextBtn}
                >
                  <Paragraph style={styles.nextBtnText}>
                    WRITE YOUR NEXT SCRIPT  →
                  </Paragraph>
                </LinearGradient>
              </TouchableOpacity>

              {/* Apply with AI Editor */}
              <TouchableOpacity
                onPress={() => {
                  const fixesSummary = suggestions
                    .flatMap(s => s.suggestions.map((fix, i) => `At ${s.timestamp}s: ${fix}`))
                    .join('\n');
                  navigation.navigate('VideoEditor', {
                    coachingPrompt: fixesSummary,
                    videoUri: videoUri,
                  });
                }}
                activeOpacity={0.85}
                style={styles.editorBtn}
              >
                <Paragraph style={styles.editorBtnText}>
                  APPLY FIXES WITH AI EDITOR
                </Paragraph>
              </TouchableOpacity>

              {/* Done */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Dashboard')}
                style={styles.skipBtn}
              >
                <Paragraph style={styles.skipText}>back to dashboard →</Paragraph>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
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
  editorBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF40',
    marginTop: 10,
  },
  editorBtnText: { fontSize: 12, fontWeight: '800', color: '#00D4FF', letterSpacing: 1.5 },
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

  // ── Extras Cards (Strengths, Improvements, Creative Ideas) ──
  extrasCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden',
    padding: 20,
  },
  extrasTopBar: {
    height: 3,
    marginHorizontal: -20, marginTop: -20, marginBottom: 18,
  },
  extrasHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
  },
  extrasEmoji: { fontSize: 28, marginRight: 12 },
  extrasItem: {
    backgroundColor: '#0A0F1A', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 10, padding: 14, marginBottom: 10,
  },
  extrasItemTitle: {
    fontSize: 14, fontWeight: '700', color: '#E2F0FF',
    lineHeight: 20, marginBottom: 4,
  },
  extrasItemSub: {
    fontSize: 13, color: '#94A3B8', lineHeight: 19,
  },
  impactBadge: {
    backgroundColor: '#F59E0B10', borderWidth: 1, borderColor: '#F59E0B30',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
    marginTop: 8, alignSelf: 'flex-start',
  },
  impactText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  ideaItem: {
    flexDirection: 'row',
    backgroundColor: '#0A0F1A', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 10, padding: 14, marginBottom: 10,
  },
  ideaNumberBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF40',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
  },
  ideaNumber: { fontSize: 13, fontWeight: '900', color: '#00D4FF' },
  ideaInspiration: {
    fontSize: 12, color: '#64748B', fontStyle: 'italic',
    lineHeight: 17, marginBottom: 4,
  },

  // ── Rewrite Script ─────────────────────────────────────
  rewriteBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#E879F910', borderWidth: 1, borderColor: '#E879F940',
  },
  rewriteBtnText: { fontSize: 12, fontWeight: '800', color: '#E879F9', letterSpacing: 1.5 },
  rewriteCard: {
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden',
    padding: 20, marginBottom: 12,
  },
  rewriteTopBar: {
    height: 3,
    marginHorizontal: -20, marginTop: -20, marginBottom: 18,
  },
  rewriteBadge: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rewriteBadgeText: { fontSize: 13, fontWeight: '900' },
  rewriteTitle: { fontSize: 15, fontWeight: '800', color: '#E2F0FF' },
  rewriteSection: { marginBottom: 12 },
  rewriteSectionLabel: {
    fontSize: 10, color: '#64748B', fontWeight: '700', letterSpacing: 2, marginBottom: 4,
  },
  rewriteText: { fontSize: 14, color: '#CBD5E1', lineHeight: 21 },
  rewriteWhyBox: {
    backgroundColor: '#E879F908', borderWidth: 1, borderColor: '#E879F925',
    borderRadius: 10, padding: 12, marginTop: 4,
  },
  rewriteWhyLabel: {
    fontSize: 10, color: '#E879F9', fontWeight: '700', letterSpacing: 2, marginBottom: 4,
  },
  rewriteWhyText: { fontSize: 13, color: '#94A3B8', lineHeight: 19 },
});
