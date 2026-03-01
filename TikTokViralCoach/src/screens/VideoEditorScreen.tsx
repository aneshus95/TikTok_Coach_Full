/**
 * VideoEditorScreen — AI Video Editor
 *
 * User Journey:
 *   1. Select   — Pick video from gallery
 *   2. Edit     — Describe your edit in plain language
 *   3. Generate — AI processes full video (progress indicator)
 *   4. Review   — Preview result: "Apply" / "Try Different Settings"
 *   5. Loop     — Back to Edit with updated video; stack more edits or download
 *
 * Key rules:
 *   - AI Edit processes the full video and replaces it directly (no stitching)
 *   - Edits stack: each applied edit permanently updates the video
 *   - Download always accessible on the main editing page
 */

import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  Platform,
  Linking,
  Dimensions,
  Share,
} from 'react-native';
import {Title, Paragraph, ActivityIndicator} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import DocumentPicker from 'react-native-document-picker';
import LoadingAnimation from '../components/LoadingAnimation';
import Video from 'react-native-video';
import {ApiService} from '../services/ApiService';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type EditorState = 'select' | 'edit' | 'generating' | 'review' | 'error';

type QuickToolType = 'aiedit';

interface VideoFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

interface AppliedEdit {
  tool: string;
  description: string;
}

export default function VideoEditorScreen({navigation}: any) {
  // ── Tier limits ──
  const [maxVideoDuration, setMaxVideoDuration] = useState(30);
  const [userTier, setUserTier] = useState('free');

  // ── Core state machine ──
  const [editorState, setEditorState] = useState<EditorState>('select');

  // ── Original video (from gallery, never changes) ──
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Current video state (cumulative — updated after each tool application) ──
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [currentVideoFilename, setCurrentVideoFilename] = useState<string | null>(null);

  // ── Generation state ──
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedVideoFilename, setGeneratedVideoFilename] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Review playback ──
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── Download ──
  const [downloading, setDownloading] = useState(false);

  // ── Applied edits history ──
  const [appliedEdits, setAppliedEdits] = useState<AppliedEdit[]>([]);

  // ── AI Edit ──
  const [activeQuickTool, setActiveQuickTool] = useState<QuickToolType | null>('aiedit');
  const [quickToolResult, setQuickToolResult] = useState<any>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState('');

  // ── Refs ──
  const videoRef = useRef<any>(null);
  const reviewVideoRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {toValue: 1, duration: 600, useNativeDriver: true}).start();
    ApiService.getUsageStatus()
      .then((res) => {
        if (res.max_video_duration) setMaxVideoDuration(res.max_video_duration);
        if (res.tier) setUserTier(res.tier);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (editorState === 'generating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.05, duration: 1200, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 1200, useNativeDriver: true}),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [editorState]);

  // ──────────────────────────
  // VIDEO SELECTION
  // ──────────────────────────

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.video],
        copyTo: 'cachesDirectory',
      });
      const file = result[0];
      const playableUri = file.fileCopyUri || file.uri;
      setVideoFile({
        uri: playableUri,
        name: file.name || 'video.mp4',
        size: file.size || 0,
        type: file.type || 'video/mp4',
      });
      // Reset everything for a fresh session
      setCurrentVideoUrl(null);
      setCurrentVideoFilename(null);
      setAppliedEdits([]);
      setEditorState('edit');
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveQuickTool('aiedit');
      setQuickToolResult(null);
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Could not select video. Please try again.');
      }
    }
  };

  // ──────────────────────────
  // VIDEO EVENTS
  // ──────────────────────────

  const onVideoLoad = (data: any) => {
    const dur = data.duration || 0;
    setVideoDuration(dur);

    // Duration check — block immediately if video exceeds tier limit
    if (dur > maxVideoDuration) {
      const nextTier = userTier === 'free' ? 'Growth' : userTier === 'growth' ? 'Pro' : '';
      const upgradeMsg = nextTier
        ? `Upgrade to ${nextTier} for longer videos.`
        : 'You are on the highest plan.';
      Alert.alert(
        'Video Too Long',
        `Your video is ${Math.round(dur)}s but your ${userTier} plan allows up to ${maxVideoDuration}s. ${upgradeMsg}`,
        [{text: 'OK', onPress: () => { setVideoFile(null); setEditorState('select'); navigation.navigate('Dashboard'); }}],
      );
      return;
    }

    if (videoRef.current) {
      videoRef.current.seek(0);
    }
  };

  const onVideoProgress = (data: any) => {
    setCurrentTime(data.currentTime || 0);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const formatTime = (s: number): string => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ──────────────────────────
  // AI EDIT
  // ──────────────────────────

  const TOOL_LABELS: Record<QuickToolType, string> = {
    aiedit: 'AI Editing',
  };

  const applyQuickTool = async () => {
    if (!activeQuickTool) return;

    setEditorState('generating');
    setStatusMessage(`${TOOL_LABELS[activeQuickTool]}...`);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {toValue: 0.2, duration: 500, useNativeDriver: false}).start();

    try {
      const formData = new FormData();

      // Add video source
      if (currentVideoFilename) {
        formData.append('video_filename', currentVideoFilename);
      } else if (videoFile) {
        formData.append('video', {
          uri: videoFile.uri,
          type: videoFile.type || 'video/mp4',
          name: videoFile.name || 'video.mp4',
        } as any);
      }

      // Add AI edit prompt
      formData.append('prompt', aiEditPrompt);

      Animated.timing(progressAnim, {toValue: 0.5, duration: 3000, useNativeDriver: false}).start();

      const result = await ApiService.applyQuickTool(activeQuickTool, formData);

      Animated.timing(progressAnim, {toValue: 1, duration: 400, useNativeDriver: false}).start();

      setQuickToolResult(result);
      setGeneratedVideoUrl(result.video_url);
      setGeneratedVideoFilename(result.video_filename);
      setEditorState('review');
    } catch (e: any) {
      setEditorState('error');
      setErrorMessage(e.userMessage || e.message || `Failed to apply ${activeQuickTool}.`);
    }
  };

  const handleQuickToolApply = () => {
    // Quick tools directly replace the video (no stitch)
    if (generatedVideoUrl && generatedVideoFilename) {
      setCurrentVideoUrl(generatedVideoUrl);
      setCurrentVideoFilename(generatedVideoFilename);
      setAppliedEdits(prev => [
        ...prev,
        {tool: activeQuickTool || 'unknown', description: TOOL_LABELS[activeQuickTool!] || activeQuickTool || ''},
      ]);
    }
    // Reset
    setGeneratedVideoUrl(null);
    setGeneratedVideoFilename(null);
    setQuickToolResult(null);
    setActiveQuickTool('aiedit');
    setReviewPlaying(false);
    setVideoError(null);
    setIsPlaying(false);
    setEditorState('edit');
  };

  // ──────────────────────────
  // DOWNLOAD
  // ──────────────────────────

  const handleDownload = async () => {
    const url = currentVideoUrl || (videoFile ? videoFile.uri : null);
    if (!url) return;

    setDownloading(true);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        Alert.alert('Download Started', 'The video is opening in your browser. Use "Save video" to save it.');
      } else {
        await Share.share({
          message: `Here is your edited video: ${url}`,
          url,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not download video. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ──────────────────────────
  // ERROR RECOVERY
  // ──────────────────────────

  const handleRetry = () => {
    setEditorState(videoFile ? 'edit' : 'select');
    setGeneratedVideoUrl(null);
    setGeneratedVideoFilename(null);
    setQuickToolResult(null);
    progressAnim.setValue(0);
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleNewVideo = () => {
    setEditorState('select');
    setVideoFile(null);
    setCurrentVideoUrl(null);
    setCurrentVideoFilename(null);
    setVideoDuration(0);
    setCurrentTime(0);
    setAppliedEdits([]);
    setActiveQuickTool('aiedit');
    setQuickToolResult(null);
    progressAnim.setValue(0);
  };

  // ──────────────────────────
  // RENDER HELPERS
  // ──────────────────────────

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const currentVideoSource = currentVideoUrl
    ? {uri: currentVideoUrl}
    : videoFile
      ? {uri: videoFile.uri}
      : null;

  // ──────────────────────────
  // RENDER
  // ──────────────────────────

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Animated.View style={{opacity: fadeAnim}}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={{flex: 1}}>
              <View style={styles.headerBadge}>
                <View style={styles.headerDot} />
                <Paragraph style={styles.headerBadgeText}>AI VIDEO EDITOR</Paragraph>
              </View>
              <Title style={styles.title}>Edit Studio</Title>
            </View>
            <View style={styles.veoBadge}>
              <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.veoBadgeGrad}>
                <Paragraph style={styles.veoBadgeText}>AI EDIT</Paragraph>
              </LinearGradient>
            </View>
          </View>

          {/* ════════════════════════════════════
              STATE: SELECT
              ════════════════════════════════════ */}
          {editorState === 'select' && (
            <View>
              <Paragraph style={styles.intro}>
                Select a video and describe your edit in plain language. AI watches your video and makes it happen.
              </Paragraph>

              <TouchableOpacity onPress={pickVideo} activeOpacity={0.85}>
                <LinearGradient colors={['#0C1220', '#111827']} style={styles.uploadArea}>
                  <View style={styles.uploadIconWrap}>
                    <View style={styles.uploadIconBg}>
                      <Paragraph style={styles.uploadIcon}>{'🎬'}</Paragraph>
                    </View>
                  </View>
                  <Paragraph style={styles.uploadTitle}>Select Video</Paragraph>
                  <Paragraph style={styles.uploadSub}>MP4, MOV, AVI — up to 100MB</Paragraph>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.howItWorks}>
                <View style={styles.sectionHeader}>
                  <View style={styles.dot} />
                  <Paragraph style={styles.sectionLabel}>HOW IT WORKS</Paragraph>
                </View>
                {[
                  {step: '1', text: 'Select a video from your gallery'},
                  {step: '2', text: 'Describe your edit in plain language'},
                  {step: '3', text: 'AI analyzes audio + visuals and makes precise edits'},
                  {step: '4', text: 'Preview the result — apply or try different settings'},
                  {step: '5', text: 'Stack multiple edits for the perfect video'},
                  {step: '6', text: 'Download your finished video'},
                ].map((item, i) => (
                  <View key={i} style={styles.howStep}>
                    <View style={styles.howStepNum}>
                      <Paragraph style={styles.howStepNumText}>{item.step}</Paragraph>
                    </View>
                    <Paragraph style={styles.howStepText}>{item.text}</Paragraph>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ════════════════════════════════════
              STATE: EDIT — Main Editing Page
              ════════════════════════════════════ */}
          {editorState === 'edit' && (videoFile || currentVideoUrl) && (
            <View>
              {/* ── Video Player ── */}
              <View style={styles.videoPlayerWrap}>
                {currentVideoSource && (
                  <Video
                    ref={videoRef}
                    source={currentVideoSource}
                    style={styles.videoPlayer}
                    paused={!isPlaying}
                    resizeMode="contain"
                    onLoad={onVideoLoad}
                    onProgress={onVideoProgress}
                    onError={(e: any) => {
                      if (__DEV__) console.log('Video playback error:', e?.nativeEvent?.error || e);
                    }}
                    repeat={true}
                    useTextureView={false}
                    bufferConfig={{
                      minBufferMs: 5000,
                      maxBufferMs: 30000,
                      bufferForPlaybackMs: 2500,
                      bufferForPlaybackAfterRebufferMs: 5000,
                    }}
                  />
                )}
                <TouchableOpacity style={styles.playOverlay} onPress={togglePlay} activeOpacity={0.8}>
                  {!isPlaying && (
                    <View style={styles.playBtn}>
                      <Paragraph style={styles.playBtnText}>{'▶'}</Paragraph>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.timeBadge}>
                  <Paragraph style={styles.timeBadgeText}>
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </Paragraph>
                </View>
              </View>

              {/* ── Applied edits indicator ── */}
              {appliedEdits.length > 0 && (
                <View style={styles.editsAppliedBadge}>
                  <View style={styles.editsAppliedDot} />
                  <Paragraph style={styles.editsAppliedText}>
                    {appliedEdits.length} edit{appliedEdits.length > 1 ? 's' : ''} applied
                  </Paragraph>
                </View>
              )}

              {/* ── AI Edit Panel ── */}
              {activeQuickTool === 'aiedit' && (
                <View style={styles.toolPanel}>
                  <Paragraph style={styles.toolPanelTitle}>AI Edit</Paragraph>
                  <Paragraph style={styles.toolPanelSub}>
                    Describe your edit — AI watches your video and makes it happen
                  </Paragraph>
                  <TextInput
                    style={styles.aiEditInput}
                    placeholder="e.g. Make it black and white after 5 seconds, remove the background noise, zoom in on my face at the start..."
                    placeholderTextColor="#334155"
                    value={aiEditPrompt}
                    onChangeText={setAiEditPrompt}
                    multiline
                    maxLength={2000}
                    textAlignVertical="top"
                  />
                  <Paragraph style={styles.aiEditHint}>
                    {aiEditPrompt.length}/2000 — AI analyzes audio + visuals to make precise edits
                  </Paragraph>
                  <TouchableOpacity
                    onPress={applyQuickTool}
                    activeOpacity={0.85}
                    disabled={!aiEditPrompt.trim()}>
                    <LinearGradient
                      colors={aiEditPrompt.trim() ? ['#00D4FF', '#00FFB3'] : ['#1E293B', '#1E293B']}
                      start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                      style={styles.toolApplyBtn}>
                      <Paragraph style={[styles.toolApplyBtnText, !aiEditPrompt.trim() && {color: '#64748B'}]}>
                        APPLY AI EDIT
                      </Paragraph>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── DOWNLOAD button ── */}
              {(currentVideoUrl || videoFile) && (
                <TouchableOpacity
                  onPress={handleDownload}
                  activeOpacity={0.85}
                  disabled={downloading}
                  style={styles.downloadWrap}>
                  <View style={[styles.downloadBtn, downloading && {opacity: 0.6}]}>
                    {downloading ? (
                      <View style={styles.downloadingRow}>
                        <ActivityIndicator color="#00D4FF" size="small" />
                        <Paragraph style={[styles.downloadBtnTextOutline, {marginLeft: 10}]}>SAVING...</Paragraph>
                      </View>
                    ) : (
                      <Paragraph style={styles.downloadBtnTextOutline}>
                        DOWNLOAD {currentVideoUrl ? 'EDITED ' : ''}VIDEO
                      </Paragraph>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {/* ── Choose different video ── */}
              <TouchableOpacity onPress={handleNewVideo} style={styles.newVideoBtn} activeOpacity={0.75}>
                <Paragraph style={styles.newVideoText}>Choose Different Video</Paragraph>
              </TouchableOpacity>

              <Paragraph style={styles.disclaimer}>
                AI tools process your full video. Original stays untouched.
              </Paragraph>
            </View>
          )}

          {/* ════════════════════════════════════
              STATE: GENERATING
              ════════════════════════════════════ */}
          {editorState === 'generating' && (
            <View style={styles.genContainer}>
              <Animated.View style={[styles.genOrb, {transform: [{scale: pulseAnim}]}]}>
                <LinearGradient colors={['#00D4FF20', '#00FFB315']} style={styles.genOrbOuter}>
                  <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.genOrbInner}>
                    <LoadingAnimation size={80} />
                  </LinearGradient>
                </LinearGradient>
              </Animated.View>

              <Paragraph style={styles.genTitle}>Processing Video</Paragraph>
              <Paragraph style={styles.genStatus}>{statusMessage}</Paragraph>

              <View style={styles.progressWrap}>
                <Animated.View style={[styles.progressBar, {width: progressWidth}]} />
              </View>

              <View style={styles.genInfo}>
                <View style={styles.genInfoRow}>
                  <View style={[styles.genInfoDot, {backgroundColor: '#00FFB3'}]} />
                  <Paragraph style={styles.genInfoText}>
                    Processing full video with AI
                  </Paragraph>
                </View>
              </View>

              <TouchableOpacity onPress={handleRetry} style={styles.cancelBtn} activeOpacity={0.7}>
                <Paragraph style={styles.cancelBtnText}>Cancel</Paragraph>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════════════════════════════
              STATE: REVIEW
              ════════════════════════════════════ */}
          {editorState === 'review' && (
            <View>
              <View style={styles.reviewHeader}>
                <Paragraph style={styles.reviewTitle}>AI Edit Ready</Paragraph>
                <Paragraph style={styles.reviewSub}>
                  Preview your edited video. Apply or try different settings.
                </Paragraph>
              </View>

              {/* Video preview */}
              <View style={styles.resultCard}>
                <View style={styles.resultGlow} />
                <View style={styles.reviewPlayerWrap}>
                  {generatedVideoUrl ? (
                    <Video
                      ref={reviewVideoRef}
                      source={{uri: generatedVideoUrl}}
                      style={styles.reviewPlayer}
                      paused={!reviewPlaying}
                      resizeMode="contain"
                      repeat={true}
                      onError={(e: any) => {
                        if (__DEV__) console.log('Review video error:', e?.nativeEvent?.error || e);
                        setVideoError('Could not play video. The server may still be processing.');
                      }}
                      useTextureView={false}
                      bufferConfig={{
                        minBufferMs: 5000,
                        maxBufferMs: 30000,
                        bufferForPlaybackMs: 2500,
                        bufferForPlaybackAfterRebufferMs: 5000,
                      }}
                    />
                  ) : (
                    <View style={styles.reviewPlayerFallback}>
                      <Paragraph style={styles.fallbackIcon}>!</Paragraph>
                      <Paragraph style={styles.fallbackText}>Video not available</Paragraph>
                    </View>
                  )}

                  {videoError ? (
                    <View style={styles.videoErrorOverlay}>
                      <Paragraph style={styles.videoErrorIcon}>!</Paragraph>
                      <Paragraph style={styles.videoErrorText}>{videoError}</Paragraph>
                      <TouchableOpacity onPress={() => setVideoError(null)} style={styles.videoErrorDismiss}>
                        <Paragraph style={styles.videoErrorDismissText}>Dismiss</Paragraph>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.reviewPlayOverlay}
                      onPress={() => setReviewPlaying(!reviewPlaying)}
                      activeOpacity={0.8}>
                      {!reviewPlaying && (
                        <View style={styles.reviewPlayBtn}>
                          <Paragraph style={styles.reviewPlayBtnText}>{'▶'}</Paragraph>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Meta bar */}
                <View style={styles.reviewMeta}>
                  <View style={styles.reviewMetaBadge}>
                    <Paragraph style={styles.reviewMetaBadgeText}>AI EDIT</Paragraph>
                  </View>
                  <Paragraph style={styles.reviewMetaText}>AI Edit complete</Paragraph>
                </View>
              </View>

              {/* AI edit result metadata */}
              {quickToolResult && (
                <View style={styles.editSummaryCard}>
                  <View style={styles.editSummaryRow}>
                    <Paragraph style={styles.editSummaryLabel}>RESULT</Paragraph>
                    <Paragraph style={styles.editSummaryValue}>
                      {quickToolResult.description || 'AI Edit applied successfully'}
                    </Paragraph>
                  </View>
                </View>
              )}

              {/* ── Action buttons ── */}
              <TouchableOpacity onPress={handleQuickToolApply} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#00FFB3', '#00D4FF']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.satisfiedBtn}>
                  <Paragraph style={styles.satisfiedBtnText}>APPLY</Paragraph>
                </LinearGradient>
                <View style={[styles.generateGlow, {backgroundColor: '#00FFB3'}]} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEditorState('edit');
                  setGeneratedVideoUrl(null);
                  setReviewPlaying(false);
                  setVideoError(null);
                }}
                style={styles.tryAgainBtn}
                activeOpacity={0.75}>
                <Paragraph style={styles.tryAgainText}>Try Different Settings</Paragraph>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════════════════════════════
              STATE: ERROR
              ════════════════════════════════════ */}
          {editorState === 'error' && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIconWrap}>
                <Paragraph style={styles.errorIcon}>!</Paragraph>
              </View>
              <Paragraph style={styles.errorTitle}>Processing Failed</Paragraph>
              <Paragraph style={styles.errorMessage}>{errorMessage}</Paragraph>

              <View style={styles.errorTips}>
                <Paragraph style={styles.errorTipsTitle}>Tips for better results:</Paragraph>
                {[
                  'Try describing your edit more specifically',
                  'Shorter videos process faster and more reliably',
                  'Make sure your video has clear audio and visuals',
                  'Check your internet connection if the error persists',
                ].map((tip, i) => (
                  <View key={i} style={styles.errorTipRow}>
                    <Paragraph style={styles.errorBullet}>-</Paragraph>
                    <Paragraph style={styles.errorTipText}>{tip}</Paragraph>
                  </View>
                ))}
              </View>

              <TouchableOpacity onPress={handleRetry} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#00D4FF', '#00FFB3']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.retryBtn}>
                  <Paragraph style={styles.retryBtnText}>TRY AGAIN</Paragraph>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

// ════════════════════════════════════════
// STYLES
// ════════════════════════════════════════

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 60},

  // ── Header ──
  header: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20},
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  backBtnText: {fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2},
  headerBadge: {flexDirection: 'row', alignItems: 'center', marginBottom: 4},
  headerDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FFB3', marginRight: 8},
  headerBadgeText: {fontSize: 11, color: '#00FFB3', letterSpacing: 2, fontWeight: '700'},
  title: {fontSize: 28, fontWeight: '900', color: '#E2F0FF'},
  veoBadge: {borderRadius: 10, overflow: 'hidden'},
  veoBadgeGrad: {paddingHorizontal: 12, paddingVertical: 6},
  veoBadgeText: {fontSize: 11, fontWeight: '900', color: '#050810', letterSpacing: 1},

  intro: {fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 24},

  // ── Section header ──
  sectionHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  sectionLabel: {fontSize: 11, color: '#64748B', letterSpacing: 2, fontWeight: '700'},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 10},

  // ── SELECT STATE ──
  uploadArea: {
    borderWidth: 1, borderColor: '#1E293B', borderStyle: 'dashed',
    borderRadius: 16, padding: 40, alignItems: 'center', marginBottom: 28,
  },
  uploadIconWrap: {marginBottom: 16},
  uploadIconBg: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#111827', borderWidth: 1.5, borderColor: '#00D4FF40',
    overflow: 'visible',
  },
  uploadIcon: {fontSize: 36, lineHeight: 44, textAlign: 'center'},
  uploadTitle: {fontSize: 18, fontWeight: '900', color: '#E2F0FF', marginBottom: 6},
  uploadSub: {fontSize: 13, color: '#64748B'},
  howItWorks: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, padding: 18,
  },
  howStep: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  howStepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF30',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  howStepNumText: {fontSize: 13, fontWeight: '900', color: '#00D4FF'},
  howStepText: {flex: 1, fontSize: 13, color: '#94A3B8', lineHeight: 20},

  // ── EDIT STATE ──
  videoPlayerWrap: {
    backgroundColor: '#000', borderRadius: 14, overflow: 'hidden',
    marginBottom: 12, position: 'relative', aspectRatio: 9 / 16,
    maxHeight: SCREEN_WIDTH * 0.85, alignSelf: 'center',
  },
  videoPlayer: {width: '100%', height: '100%'},
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,212,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  playBtnText: {fontSize: 24, color: '#050810', fontWeight: '900', marginLeft: 3},
  timeBadge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(5,8,16,0.85)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  timeBadgeText: {fontSize: 11, color: '#E2F0FF', fontWeight: '600'},

  // Applied edits badge
  editsAppliedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#00FFB310', borderWidth: 1, borderColor: '#00FFB330',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12,
  },
  editsAppliedDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#00FFB3', marginRight: 8,
  },
  editsAppliedText: {fontSize: 12, color: '#00FFB3', fontWeight: '700'},

  // ── Glow effect ──
  generateGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.15, marginTop: -4, marginBottom: 12,
  },

  // ── Download button ──
  downloadWrap: {marginTop: 16, marginBottom: 10},
  downloadBtn: {
    paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#00D4FF40',
  },
  downloadBtnTextOutline: {fontSize: 14, fontWeight: '900', color: '#00D4FF', letterSpacing: 2},
  downloadingRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},

  // ── New video / disclaimer ──
  newVideoBtn: {paddingVertical: 12, alignItems: 'center', marginBottom: 8},
  newVideoText: {fontSize: 13, color: '#64748B'},
  disclaimer: {fontSize: 12, color: '#334155', textAlign: 'center', lineHeight: 18},

  // ── GENERATING STATE ──
  genContainer: {alignItems: 'center', paddingTop: 20},
  genOrb: {marginBottom: 32},
  genOrbOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 1, borderColor: '#00D4FF30',
    justifyContent: 'center', alignItems: 'center',
  },
  genOrbInner: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 20,
  },
  genTitle: {fontSize: 22, fontWeight: '900', color: '#E2F0FF', marginBottom: 12, textAlign: 'center'},
  genStatus: {fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 28, lineHeight: 22},
  progressWrap: {
    width: '100%', height: 4, backgroundColor: '#1E293B',
    borderRadius: 2, overflow: 'hidden', marginBottom: 32,
  },
  progressBar: {
    height: '100%', borderRadius: 2, backgroundColor: '#00D4FF',
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 6,
  },
  genInfo: {
    width: '100%', backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 28,
  },
  genInfoRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  genInfoDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#00D4FF', marginRight: 12,
  },
  genInfoText: {flex: 1, fontSize: 13, color: '#64748B', lineHeight: 20},
  cancelBtn: {paddingVertical: 12},
  cancelBtnText: {fontSize: 14, color: '#334155'},

  // ── REVIEW STATE ──
  reviewHeader: {alignItems: 'center', marginBottom: 20},
  checkOrb: {
    marginBottom: 14,
  },
  checkText: {fontSize: 48, textAlign: 'center'},
  reviewTitle: {fontSize: 22, fontWeight: '900', color: '#E2F0FF', marginBottom: 8, textAlign: 'center', lineHeight: 32},
  reviewSub: {fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, paddingHorizontal: 12},

  resultCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative',
  },
  resultGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#00FFB3', opacity: 0.7,
  },

  reviewPlayerWrap: {backgroundColor: '#000', height: SCREEN_WIDTH * 1.2, position: 'relative'},
  reviewPlayer: {width: '100%', height: '100%'},
  reviewPlayerFallback: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827',
  },
  fallbackIcon: {fontSize: 32, color: '#334155', fontWeight: '900', marginBottom: 8},
  fallbackText: {fontSize: 14, color: '#64748B'},
  reviewPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewPlayBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,255,179,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
  reviewPlayBtnText: {fontSize: 26, color: '#050810', fontWeight: '900', marginLeft: 4},

  videoErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,8,16,0.9)', justifyContent: 'center',
    alignItems: 'center', padding: 24,
  },
  videoErrorIcon: {fontSize: 32, color: '#EF4444', fontWeight: '900', marginBottom: 12},
  videoErrorText: {fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18, marginBottom: 16},
  videoErrorDismiss: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  videoErrorDismissText: {fontSize: 12, color: '#00D4FF', fontWeight: '700'},

  reviewMeta: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0C1220',
  },
  reviewMetaBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: '#00FFB320', borderWidth: 1, borderColor: '#00FFB340',
    marginRight: 10,
  },
  reviewMetaBadgeText: {fontSize: 9, fontWeight: '900', color: '#00FFB3', letterSpacing: 1},
  reviewMetaText: {flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18},

  editSummaryCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  editSummaryRow: {marginBottom: 4},
  editSummaryLabel: {fontSize: 10, color: '#64748B', letterSpacing: 1.5, fontWeight: '700', marginBottom: 4},
  editSummaryValue: {fontSize: 13, color: '#E2F0FF', lineHeight: 20},

  satisfiedBtn: {paddingVertical: 18, borderRadius: 14, alignItems: 'center'},
  satisfiedBtnText: {fontSize: 15, fontWeight: '900', color: '#050810', letterSpacing: 2},

  tryAgainBtn: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 24,
  },
  tryAgainText: {fontSize: 14, color: '#00D4FF', fontWeight: '600'},

  // ── ERROR STATE ──
  errorContainer: {alignItems: 'center', paddingTop: 20},
  errorIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF444440',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  errorIcon: {fontSize: 36, color: '#EF4444', fontWeight: '900'},
  errorTitle: {fontSize: 22, fontWeight: '900', color: '#EF4444', marginBottom: 12, textAlign: 'center'},
  errorMessage: {fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24},
  errorTips: {
    width: '100%', backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 28,
  },
  errorTipsTitle: {fontSize: 13, fontWeight: '700', color: '#94A3B8', marginBottom: 12},
  errorTipRow: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8},
  errorBullet: {color: '#64748B', marginRight: 10, fontSize: 14},
  errorTipText: {flex: 1, fontSize: 13, color: '#64748B', lineHeight: 20},
  retryBtn: {paddingVertical: 17, paddingHorizontal: 48, borderRadius: 14, alignItems: 'center'},
  retryBtnText: {fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 2},

  // ── AI EDIT PANEL ──
  toolPanel: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  toolPanelTitle: {fontSize: 16, fontWeight: '900', color: '#E2F0FF', marginBottom: 14},
  toolPanelSub: {fontSize: 11, color: '#64748B', letterSpacing: 1.5, fontWeight: '700', marginBottom: 8, marginTop: 12},
  toolApplyBtn: {paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16},
  toolApplyBtnText: {fontSize: 13, fontWeight: '900', color: '#050810', letterSpacing: 2},

  aiEditInput: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 12, padding: 14, color: '#E2F0FF', fontSize: 14,
    minHeight: 100, maxHeight: 160, marginTop: 8, lineHeight: 20,
  },
  aiEditHint: {fontSize: 11, color: '#334155', marginTop: 6, textAlign: 'right'},
});
