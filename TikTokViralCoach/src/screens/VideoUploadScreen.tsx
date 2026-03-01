/**
 * VideoUploadScreen - Content Flow Edition
 * Dark tech aesthetic, upload + analysis progress
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import DocumentPicker from 'react-native-document-picker';
import Video from 'react-native-video';
import LottieView from 'lottie-react-native';
import { ApiService, StorageService } from '../services/ApiService';

const TIPS = [
  '💡 Videos under 15s get 60% more views',
  '🎣 Hook in the first 3 seconds is critical',
  '🎵 Trending sounds boost discovery by 3×',
  '⚡ Fast cuts every 2-3s maintain retention',
  '✨ High-contrast colors grab attention',
  '🎯 CTAs at the end boost engagement',
  '📝 Bold text outperforms script fonts',
  '🎨 Authentic visuals beat overproduced ones',
];

export default function VideoUploadScreen({ route, navigation }: any) {
  const { jobId, niche } = route.params;

  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentTip, setCurrentTip] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'upload' | 'coach' | 'done'>('upload');
  const [maxVideoDuration, setMaxVideoDuration] = useState(30);
  const [userTier, setUserTier] = useState('free');
  const [videoDurationOk, setVideoDurationOk] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Fetch tier limits on mount
  useEffect(() => {
    ApiService.getUsageStatus()
      .then((res) => {
        if (res.max_video_duration) setMaxVideoDuration(res.max_video_duration);
        if (res.tier) setUserTier(res.tier);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (analyzing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [analyzing]);

  const animateProgress = (toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 600,
      useNativeDriver: false,
    }).start();
  };

  const pickVideo = async () => {
    try {
      setVideoDurationOk(false);
      const result = await DocumentPicker.pick({ type: [DocumentPicker.types.video] });
      setSelectedVideo(result[0]);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Could not select video');
      }
    }
  };

  const onVideoLoad = (meta: any) => {
    const dur = meta.duration || 0;
    if (dur > maxVideoDuration) {
      const nextTier = userTier === 'free' ? 'Growth' : userTier === 'growth' ? 'Pro' : '';
      const upgradeMsg = nextTier
        ? `Upgrade to ${nextTier} for longer videos.`
        : 'You are on the highest plan.';
      Alert.alert(
        'Video Too Long',
        `Your video is ${Math.round(dur)}s but your ${userTier} plan allows up to ${maxVideoDuration}s. ${upgradeMsg}`,
        [{ text: 'OK', onPress: () => { setSelectedVideo(null); navigation.navigate('Dashboard'); } }],
      );
      return;
    }
    setVideoDurationOk(true);
  };

  const uploadVideo = async () => {
    if (!selectedVideo) return;

    setAnalyzing(true);
    setProgress(0);
    animateProgress(0);
    setCurrentPhase('upload');

    let tipIndex = 0;
    setCurrentTip(TIPS[0]);
    const tipInterval = setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
      setCurrentTip(TIPS[tipIndex]);
    }, 7000);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + 1.5, 55);
        animateProgress(next);
        return next;
      });
    }, 2500);

    try {
      setStatusMessage('Uploading & analyzing video...');

      const phase1Timeout = setTimeout(() => {
        setStatusMessage('Still analyzing — this can take 2-3 min...');
      }, 60000);

      const response = await ApiService.uploadAndAnalyzeVideo(
        selectedVideo.uri,
        selectedVideo.name,
        niche
      );
      clearTimeout(phase1Timeout);
      clearInterval(progressInterval);

      setProgress(60);
      animateProgress(60);
      setCurrentPhase('coach');
      setStatusMessage('Generating personalized coaching...');

      const p2Interval = setInterval(() => {
        setProgress(prev => {
          const next = Math.min(prev + 2, 95);
          animateProgress(next);
          return next;
        });
      }, 4000);

      let coachingResponse;
      try {
        coachingResponse = await ApiService.generateCoaching({
          niche,
          analysis_id: response.analysis_id,
        });
      } catch {
        coachingResponse = {
          coaching: 'Personalized coaching based on your video analysis.',
          timestamps: response.timestamps || [],
          duration: response.duration,
        };
      }

      clearInterval(p2Interval);
      clearInterval(tipInterval);

      setProgress(100);
      animateProgress(100);
      setCurrentPhase('done');
      setStatusMessage('Analysis complete!');

      await StorageService.saveAnalysisId(response.analysis_id);

      const videoDuration = coachingResponse.duration || response.duration || 30;
      const timestamps = coachingResponse.timestamps || response.timestamps || [];
      const viralInsights = response.viral_insights || coachingResponse.viral_insights || [];

      setTimeout(() => {
        setAnalyzing(false);
        Alert.alert(
          '✅ Analysis Complete',
          `${Math.floor(videoDuration)}s video • ${timestamps.length} coaching points`,
          [
            {
              text: '🎬 Interactive Coaching',
              onPress: () => navigation.navigate('InteractiveCoaching', {
                videoUri: selectedVideo.uri,
                niche,
                analysisId: response.analysis_id,
                duration: videoDuration,
                timestamps,
                viralInsights,
              }),
            },
            {
              text: '📝 Read Analysis',
              onPress: () => navigation.navigate('Coaching', {
                coaching: coachingResponse.coaching,
                niche,
                analysisId: response.analysis_id,
              }),
            },
          ]
        );
      }, 600);
    } catch (error: any) {
      clearInterval(tipInterval);
      clearInterval(progressInterval);
      setAnalyzing(false);

      // Duration exceeded for tier
      if (error.tierInfo?.max_duration || error.response?.status === 413) {
        const tier = error.tierInfo?.tier || 'free';
        const maxDur = error.tierInfo?.max_duration || 30;
        const vidDur = error.tierInfo?.video_duration
          ? `${Math.round(error.tierInfo.video_duration)}s`
          : '';
        const nextTier = tier === 'free' ? 'Growth' : tier === 'growth' ? 'Pro' : '';
        const upgradeMsg = nextTier
          ? `Upgrade to ${nextTier} for longer videos.`
          : 'You are on the highest plan.';

        Alert.alert(
          'Video Too Long',
          `Duration exceeded ${maxDur} seconds${vidDur ? ` (your video: ${vidDur})` : ''}. ${upgradeMsg}`,
          [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }],
        );
        return;
      }

      // Usage limit reached
      if (error.upgradeRequired || error.response?.status === 429) {
        const tier = error.tierInfo?.tier || 'free';
        const nextTier = tier === 'free' ? 'Growth' : tier === 'growth' ? 'Pro' : '';
        const msg = nextTier
          ? `${error.userMessage || 'Usage limit reached.'} Upgrade to ${nextTier} to continue.`
          : error.userMessage || 'Usage limit reached.';

        Alert.alert('Limit Reached', msg, [
          { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
        ]);
        return;
      }

      // Session expired
      if (error.sessionExpired) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
        return;
      }

      // Generic errors
      const msg = (error.message || '').toLowerCase();
      const help = msg.includes('timeout')
        ? 'Analysis timed out. Try a shorter video.'
        : msg.includes('network')
        ? 'Network error. Check your connection and try again.'
        : error.userMessage || 'Something went wrong. Please try again.';

      Alert.alert('Analysis Failed', help, [
        { text: 'Try Again', onPress: () => setSelectedVideo(null) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      {/* Hidden video to check duration locally before upload */}
      {selectedVideo && !videoDurationOk && (
        <Video
          source={{ uri: selectedVideo.uri }}
          paused
          muted
          onLoad={onVideoLoad}
          onError={() => setVideoDurationOk(true)}
          style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }}
        />
      )}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, analyzing && styles.statusDotActive]} />
              <Paragraph style={[styles.statusText, analyzing && styles.statusTextActive]}>
                {analyzing ? 'ANALYZING' : 'READY'}
              </Paragraph>
            </View>
            <View style={styles.nicheBadge}>
              <Paragraph style={styles.nicheBadgeText}>{niche.toUpperCase()}</Paragraph>
            </View>
          </View>
          <Title style={styles.title}>Upload Video</Title>
          <Paragraph style={styles.subtitle}>Upload your TikTok for AI-powered analysis</Paragraph>
        </View>

        {/* Analysis Progress */}
        {analyzing && (
          <View style={styles.analysisCard}>
            <View style={styles.cardTopBar} />

            <View style={styles.analysisCenter}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LottieView
                  source={require('../assets/star-loader.json')}
                  autoPlay
                  loop
                  style={styles.starLoader}
                />
              </Animated.View>

              <Title style={styles.analysisTitle}>AI Analysis Running</Title>
              <Paragraph style={styles.analysisStatus}>{statusMessage}</Paragraph>
            </View>

            {/* Progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                  <LinearGradient
                    colors={['#00D4FF', '#00FFB3']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                <View style={styles.progressGlowDot} />
              </View>
              <Paragraph style={styles.progressPct}>{Math.round(progress)}%</Paragraph>
            </View>

            {/* Phase indicators */}
            <View style={styles.phases}>
              {[
                { key: 'upload', label: 'ANALYZE', step: 1 },
                { key: 'coach', label: 'COACH', step: 2 },
                { key: 'done', label: 'COMPLETE', step: 3 },
              ].map(({ key, label, step }) => {
                const isActive = currentPhase === key;
                const isDone =
                  (key === 'upload' && (currentPhase === 'coach' || currentPhase === 'done')) ||
                  (key === 'coach' && currentPhase === 'done');
                return (
                  <View key={key} style={styles.phaseItem}>
                    <View style={[
                      styles.phaseDot,
                      isActive && styles.phaseDotActive,
                      isDone && styles.phaseDotDone,
                    ]}>
                      <Paragraph style={styles.phaseStep}>
                        {isDone ? '✓' : step}
                      </Paragraph>
                    </View>
                    <Paragraph style={[
                      styles.phaseLabel,
                      isActive && styles.phaseLabelActive,
                      isDone && styles.phaseLabelDone,
                    ]}>
                      {label}
                    </Paragraph>
                  </View>
                );
              })}
            </View>

            {/* Tip card */}
            {currentTip !== '' && (
              <View style={styles.tipCard}>
                <View style={styles.tipDot} />
                <Paragraph style={styles.tipText}>{currentTip}</Paragraph>
              </View>
            )}

            <Paragraph style={styles.timeNote}>
              {currentPhase === 'upload'
                ? '⏱ Analyzing video — 2-3 min'
                : currentPhase === 'coach'
                ? '⏱ Building coaching — 1-2 min'
                : '🎉 Wrapping up...'}
            </Paragraph>
          </View>
        )}

        {/* Upload UI */}
        {!analyzing && (
          <>
            {!selectedVideo ? (
              <TouchableOpacity onPress={pickVideo} activeOpacity={0.85}>
                <View style={styles.dropZone}>
                  <View style={styles.dropZoneInner}>
                    <View style={styles.uploadIcon}>
                      <LinearGradient colors={['#00D4FF20', '#00FFB310']} style={styles.uploadIconGrad}>
                        <Paragraph style={styles.uploadEmoji}>📂</Paragraph>
                      </LinearGradient>
                    </View>
                    <Title style={styles.dropTitle}>Select Video</Title>
                    <Paragraph style={styles.dropSubtitle}>Tap to choose from your gallery</Paragraph>
                    <View style={styles.dropHint}>
                      <Paragraph style={styles.dropHintText}>MP4 • MOV • up to 500MB</Paragraph>
                    </View>
                  </View>
                  <LinearGradient
                    colors={['#00D4FF', '#00FFB3']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.dropZoneBorder}
                  />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.videoCard}>
                <View style={styles.cardTopBar} />
                <View style={styles.videoInfo}>
                  <View style={styles.videoThumb}>
                    <Paragraph style={{ fontSize: 32 }}>🎬</Paragraph>
                  </View>
                  <View style={styles.videoMeta}>
                    <Paragraph style={styles.videoName} numberOfLines={2}>
                      {selectedVideo.name}
                    </Paragraph>
                    <Paragraph style={styles.videoSize}>
                      {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                    </Paragraph>
                    <View style={styles.videoReady}>
                      <View style={styles.readyDot} />
                      <Paragraph style={styles.readyText}>Ready to analyze</Paragraph>
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={pickVideo} style={styles.changeBtn}>
                  <Paragraph style={styles.changeBtnText}>Change Video</Paragraph>
                </TouchableOpacity>
              </View>
            )}

            {selectedVideo && (
              <>
                <TouchableOpacity
                  onPress={uploadVideo}
                  activeOpacity={0.85}
                  disabled={!videoDurationOk}
                  style={styles.analyzeWrapper}
                >
                  <LinearGradient
                    colors={videoDurationOk ? ['#00D4FF', '#00FFB3'] : ['#1E293B', '#334155']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.analyzeBtn}
                  >
                    <Paragraph style={styles.analyzeBtnText}>
                      {videoDurationOk ? 'ANALYZE WITH AI  →' : 'CHECKING VIDEO...'}
                    </Paragraph>
                  </LinearGradient>
                  {videoDurationOk && <View style={styles.analyzeBtnGlow} />}
                </TouchableOpacity>

                <View style={styles.infoBar}>
                  <View style={styles.infoBarDot} />
                  <Paragraph style={styles.infoBarText}>
                    Analysis takes 3-5 minutes. We'll show you tips while you wait.
                  </Paragraph>
                </View>
              </>
            )}
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
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#334155', marginRight: 8 },
  statusDotActive: { backgroundColor: '#00FFB3', shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 8 },
  statusText: { fontSize: 11, color: '#334155', letterSpacing: 2, fontWeight: '700' },
  statusTextActive: { color: '#00FFB3' },
  nicheBadge: { backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF40', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  nicheBadgeText: { fontSize: 11, color: '#00D4FF', letterSpacing: 1.5, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '900', color: '#E2F0FF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748B' },

  // Analysis card
  analysisCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden', padding: 24,
  },
  cardTopBar: { height: 2, backgroundColor: '#00D4FF', marginHorizontal: -24, marginTop: -24, marginBottom: 28, opacity: 0.7 },
  analysisCenter: { alignItems: 'center', marginBottom: 28 },
  starLoader: { width: 100, height: 100, marginBottom: 16 },
  analysisTitle: { fontSize: 22, fontWeight: '900', color: '#E2F0FF', marginBottom: 6 },
  analysisStatus: { fontSize: 13, color: '#64748B', textAlign: 'center' },

  // Progress
  progressSection: { marginBottom: 24 },
  progressTrack: {
    height: 6, backgroundColor: '#1E293B', borderRadius: 3,
    overflow: 'hidden', marginBottom: 8, position: 'relative',
  },
  progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  progressGlowDot: {
    position: 'absolute', right: 0, top: -3, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#00D4FF',
    shadowColor: '#00D4FF', shadowOpacity: 1, shadowRadius: 8,
  },
  progressPct: { fontSize: 13, color: '#00D4FF', fontWeight: '900', textAlign: 'right', letterSpacing: 0.5 },

  // Phases
  phases: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  phaseItem: { alignItems: 'center', flex: 1 },
  phaseDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center',
    marginBottom: 6, borderWidth: 1, borderColor: '#334155',
  },
  phaseDotActive: { backgroundColor: '#00D4FF20', borderColor: '#00D4FF', shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 8 },
  phaseDotDone: { backgroundColor: '#00FFB320', borderColor: '#00FFB3' },
  phaseStep: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  phaseLabel: { fontSize: 9, color: '#334155', letterSpacing: 1.5, fontWeight: '700' },
  phaseLabelActive: { color: '#00D4FF' },
  phaseLabelDone: { color: '#00FFB3' },

  // Tip
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#00D4FF08', borderWidth: 1, borderColor: '#00D4FF20',
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 12, marginTop: 3 },
  tipText: { flex: 1, fontSize: 13, color: '#94A3B8', lineHeight: 20 },
  timeNote: { fontSize: 11, color: '#334155', textAlign: 'center', letterSpacing: 0.5 },

  // Drop zone
  dropZone: {
    marginBottom: 20, borderRadius: 16, overflow: 'hidden',
    position: 'relative',
  },
  dropZoneInner: {
    backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 48, alignItems: 'center',
  },
  dropZoneBorder: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, opacity: 0.6,
  },
  uploadIcon: { width: 80, height: 80, borderRadius: 40, marginBottom: 20 },
  uploadIconGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  uploadEmoji: { fontSize: 36, lineHeight: 44 },
  dropTitle: { fontSize: 24, fontWeight: '900', color: '#E2F0FF', marginBottom: 8 },
  dropSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  dropHint: {
    backgroundColor: '#00D4FF10', borderWidth: 1, borderColor: '#00D4FF30',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
  },
  dropHintText: { fontSize: 11, color: '#00D4FF', letterSpacing: 1, fontWeight: '600' },

  // Video card
  videoCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden', marginBottom: 20, padding: 20,
  },
  videoInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  videoThumb: {
    width: 60, height: 60, borderRadius: 12,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  videoMeta: { flex: 1 },
  videoName: { fontSize: 15, fontWeight: '700', color: '#E2F0FF', marginBottom: 4 },
  videoSize: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  videoReady: { flexDirection: 'row', alignItems: 'center' },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FFB3', marginRight: 6, shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 6 },
  readyText: { fontSize: 11, color: '#00FFB3', fontWeight: '600', letterSpacing: 0.5 },
  changeBtn: { alignSelf: 'flex-start' },
  changeBtnText: { fontSize: 13, color: '#00D4FF', fontWeight: '600' },

  // Analyze button
  analyzeWrapper: { position: 'relative', marginBottom: 16 },
  analyzeBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  analyzeBtnText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 3 },
  analyzeBtnGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.2,
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 12,
    marginTop: -4,
  },
  infoBar: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 10, padding: 14,
  },
  infoBarDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748B', marginRight: 10, marginTop: 3 },
  infoBarText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18 },
});
