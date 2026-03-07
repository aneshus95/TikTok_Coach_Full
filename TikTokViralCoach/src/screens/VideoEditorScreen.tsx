/**
 * VideoEditorScreen — Interactive Segment-Based Video Editor
 *
 * Features:
 *   1. Select   — Pick video from gallery
 *   2. Edit     — Video with thumbnail filmstrip + drag handles
 *   3. Tools    — Cut, Trim, AI Edit, Auto Captions, Speed, Filters
 *   4. AI Edit  — Type prompt -> Gemini processes segment -> preview -> accept/reject
 *   5. Auto Captions — Gemini transcribes -> pick timing/font/animation -> live preview
 *   6. Speed Control — 0.5x to 3x per segment
 *   7. Filters  — Color presets applied as overlay
 *   8. Export   — Stitch all segments with effects into final video
 */

import React, {useState, useRef, useEffect, useCallback} from 'react';
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
  Image,
  PanResponder,
  ActivityIndicator,
  Text,
} from 'react-native';
import {Title, Paragraph} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import DocumentPicker from 'react-native-document-picker';
import Video from 'react-native-video';
import {ApiService} from '../services/ApiService';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const FILMSTRIP_HEIGHT = 48;
const FILMSTRIP_PADDING = 16;
const FILMSTRIP_WIDTH = SCREEN_WIDTH - FILMSTRIP_PADDING * 2;
const HANDLE_WIDTH = 14;

// ── Interfaces ──

interface Thumbnail {
  time: number;
  url: string;
}

interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  type: 'original' | 'edited';
  editedFilename?: string;
  editedUrl?: string;
  prompt?: string;
  speed?: number;
}

interface CaptionWord {
  word: string;
  start_time: number;
  end_time: number;
}

// ── Presets ──

type CaptionTimingMode = 'word' | 'phrase' | 'sentence' | 'single-pop';
type CaptionFontStyle = 'bold-sans' | 'outlined' | 'neon' | 'classic' | 'minimal' | 'impact';
type CaptionAnimation = 'none' | 'fade' | 'pop' | 'slide-up' | 'typewriter' | 'karaoke';
type ActiveTool = 'none' | 'captions' | 'speed' | 'filters';
type EditorState = 'select' | 'editor' | 'ai_processing' | 'ai_preview' | 'viral_processing' | 'viral_preview';

const TIMING_MODES: {key: CaptionTimingMode; label: string; desc: string}[] = [
  {key: 'word', label: 'Word by Word', desc: 'Each word highlights as spoken'},
  {key: 'phrase', label: 'Phrase', desc: '3-5 words at a time'},
  {key: 'sentence', label: 'Sentence', desc: 'Full sentence appears'},
  {key: 'single-pop', label: 'Single Pop', desc: 'One big word at a time'},
];

const FONT_STYLES: {key: CaptionFontStyle; label: string; preview: any}[] = [
  {key: 'bold-sans', label: 'Bold', preview: {fontWeight: '900' as const, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 4}},
  {key: 'outlined', label: 'Outline', preview: {fontWeight: '800' as const, color: '#FFFFFF', textShadowColor: '#000000', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 8}},
  {key: 'neon', label: 'Neon', preview: {fontWeight: '700' as const, color: '#00D4FF', textShadowColor: '#00D4FF', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 12}},
  {key: 'classic', label: 'Classic', preview: {fontWeight: '600' as const, color: '#FFDD00', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3}},
  {key: 'minimal', label: 'Minimal', preview: {fontWeight: '400' as const, color: '#FFFFFF'}},
  {key: 'impact', label: 'Impact', preview: {fontWeight: '900' as const, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: {width: 3, height: 3}, textShadowRadius: 6}},
];

const ANIMATIONS: {key: CaptionAnimation; label: string}[] = [
  {key: 'none', label: 'None'},
  {key: 'fade', label: 'Fade'},
  {key: 'pop', label: 'Pop'},
  {key: 'slide-up', label: 'Slide Up'},
  {key: 'typewriter', label: 'Typewriter'},
  {key: 'karaoke', label: 'Karaoke'},
];

const FILTERS: {key: string; label: string; overlay: any; dot: string}[] = [
  {key: 'none', label: 'None', overlay: null, dot: '#333'},
  {key: 'warm', label: 'Warm', overlay: {backgroundColor: 'rgba(255,140,50,0.15)'}, dot: '#FF8C32'},
  {key: 'cool', label: 'Cool', overlay: {backgroundColor: 'rgba(50,100,255,0.15)'}, dot: '#3264FF'},
  {key: 'vintage', label: 'Vintage', overlay: {backgroundColor: 'rgba(180,140,80,0.2)'}, dot: '#B48C50'},
  {key: 'high-contrast', label: 'Hi-Con', overlay: {backgroundColor: 'rgba(0,0,0,0.1)'}, dot: '#888'},
  {key: 'bw', label: 'B&W', overlay: {backgroundColor: 'rgba(128,128,128,0.4)'}, dot: '#999'},
  {key: 'vibrant', label: 'Vibrant', overlay: {backgroundColor: 'rgba(255,0,100,0.08)'}, dot: '#FF0064'},
];

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.5, 2, 3];

const PRESET_NICHES = [
  'beauty', 'business', 'comedy', 'cooking', 'dance', 'education',
  'fashion', 'fitness', 'gaming', 'motivation', 'music', 'pets', 'tech', 'travel',
];

export default function VideoEditorScreen({navigation}: any) {
  // ── Core state ──
  const [editorState, setEditorState] = useState<EditorState>('select');

  // ── Video data ──
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(1080);
  const [videoHeight, setVideoHeight] = useState(1920);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── Playback ──
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<any>(null);

  // ── Selection handles ──
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  // ── Segments ──
  const [segments, setSegments] = useState<Segment[]>([]);

  // ── AI Edit ──
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState('');
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
  const [aiPreviewFilename, setAiPreviewFilename] = useState<string | null>(null);
  const [aiSegmentIndex, setAiSegmentIndex] = useState<number | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // ── Export ──
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // ── Tool Panel ──
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');

  // ── Captions ──
  const [captionWords, setCaptionWords] = useState<CaptionWord[]>([]);
  const [captionTimingMode, setCaptionTimingMode] = useState<CaptionTimingMode>('word');
  const [captionFontStyle, setCaptionFontStyle] = useState<CaptionFontStyle>('bold-sans');
  const [captionAnimation, setCaptionAnimation] = useState<CaptionAnimation>('pop');
  const [captionEnabled, setCaptionEnabled] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);

  // ── Filter ──
  const [activeFilter, setActiveFilter] = useState('none');

  // ── Make Viral ──
  const [showNichePicker, setShowNichePicker] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [viralTaskId, setViralTaskId] = useState<string | null>(null);
  const [viralStatus, setViralStatus] = useState('');
  const [viralPreviewUrl, setViralPreviewUrl] = useState<string | null>(null);
  const [viralEditSummary, setViralEditSummary] = useState('');
  const [viralPreviewPlaying, setViralPreviewPlaying] = useState(false);

  // ── Animations ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const captionAnimValue = useRef(new Animated.Value(1)).current;
  const prevCaptionTextRef = useRef('');

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Trigger caption animation on style/animation change ──
  const triggerCaptionAnim = useCallback(() => {
    captionAnimValue.setValue(0);
    Animated.spring(captionAnimValue, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [captionAnimValue]);

  useEffect(() => { triggerCaptionAnim(); }, [captionFontStyle]);
  useEffect(() => { if (captionAnimation !== 'none') triggerCaptionAnim(); }, [captionAnimation]);

  // ── Video Selection ──
  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.video],
      });
      const file = result[0];
      if (!file?.uri) return;

      setUploading(true);
      setVideoUri(file.uri);

      const data = await ApiService.editorUpload(file.uri, file.name || 'video.mp4');

      setVideoFilename(data.video_filename);
      setVideoUrl(data.video_url);
      setVideoDuration(data.duration);
      setVideoWidth(data.width || 1080);
      setVideoHeight(data.height || 1920);
      setThumbnails(data.thumbnails || []);
      setSelectionStart(0);
      setSelectionEnd(data.duration);

      setSegments([{
        id: 'seg_0',
        startTime: 0,
        endTime: data.duration,
        type: 'original',
        speed: 1,
      }]);

      setEditorState('editor');
      setUploading(false);
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        const msg = err?.response?.data?.error || err?.message || 'Unknown error';
        console.log('[EDITOR] Upload failed:', msg, err);
        Alert.alert('Upload Failed', msg);
      }
      setUploading(false);
    }
  };

  // ── Playback Controls ──
  const togglePlay = () => setIsPlaying(!isPlaying);

  const onVideoProgress = (data: any) => {
    setCurrentTime(data.currentTime);
  };

  const seekTo = (time: number) => {
    videoRef.current?.seek(time);
    setCurrentTime(time);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Current playback speed based on segment ──
  const currentSegment = segments.find(s => currentTime >= s.startTime && currentTime < s.endTime);
  const playbackRate = currentSegment?.speed || 1;

  // ── Handle Dragging ──
  const selStartRef = useRef(selectionStart);
  const selEndRef = useRef(selectionEnd);
  const durationRef = useRef(videoDuration);
  useEffect(() => { selStartRef.current = selectionStart; }, [selectionStart]);
  useEffect(() => { selEndRef.current = selectionEnd; }, [selectionEnd]);
  useEffect(() => { durationRef.current = videoDuration; }, [videoDuration]);

  const timeToX = (time: number) => (time / Math.max(durationRef.current, 0.1)) * FILMSTRIP_WIDTH;
  const xToTime = (x: number) => Math.max(0, Math.min((x / FILMSTRIP_WIDTH) * durationRef.current, durationRef.current));
  const timeToXRender = (time: number) => (time / Math.max(videoDuration, 0.1)) * FILMSTRIP_WIDTH;

  const startGrabRef = useRef(0);
  const endGrabRef = useRef(0);

  const startPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startGrabRef.current = selStartRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const newTime = xToTime(timeToX(startGrabRef.current) + gesture.dx);
        if (newTime < selEndRef.current - 0.5) {
          setSelectionStart(Math.max(0, newTime));
        }
      },
      onPanResponderRelease: () => {
        videoRef.current?.seek(selStartRef.current);
      },
    })
  ).current;

  const endPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        endGrabRef.current = selEndRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const newTime = xToTime(timeToX(endGrabRef.current) + gesture.dx);
        if (newTime > selStartRef.current + 0.5) {
          setSelectionEnd(Math.min(durationRef.current, newTime));
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // ── Select Full Video ──
  const selectAll = () => {
    setSelectionStart(0);
    setSelectionEnd(videoDuration);
  };

  // ── Cut (split at current time) ──
  const handleCut = () => {
    if (currentTime <= 0.5 || currentTime >= videoDuration - 0.5) {
      Alert.alert('Cannot Cut', 'Move playhead to where you want to split.');
      return;
    }

    const newSegments: Segment[] = [];
    for (const seg of segments) {
      if (currentTime > seg.startTime && currentTime < seg.endTime) {
        newSegments.push({
          ...seg,
          id: `seg_${Date.now()}_a`,
          endTime: currentTime,
        });
        newSegments.push({
          ...seg,
          id: `seg_${Date.now()}_b`,
          startTime: currentTime,
          type: 'original',
          editedFilename: undefined,
          editedUrl: undefined,
          prompt: undefined,
        });
      } else {
        newSegments.push(seg);
      }
    }
    setSegments(newSegments);
  };

  // ── Trim (remove selected range) ──
  const handleTrim = () => {
    if (selectionStart <= 0 && selectionEnd >= videoDuration) {
      Alert.alert('Cannot Trim', 'Select a portion of the video first.');
      return;
    }

    const newSegments: Segment[] = [];
    for (const seg of segments) {
      if (seg.startTime >= selectionStart && seg.endTime <= selectionEnd) {
        continue;
      }
      if (seg.startTime < selectionStart && seg.endTime > selectionStart) {
        newSegments.push({...seg, endTime: selectionStart, id: `seg_${Date.now()}_t`});
      } else if (seg.startTime < selectionEnd && seg.endTime > selectionEnd) {
        newSegments.push({...seg, startTime: selectionEnd, id: `seg_${Date.now()}_t2`});
      } else if (seg.endTime <= selectionStart || seg.startTime >= selectionEnd) {
        newSegments.push(seg);
      }
    }

    if (newSegments.length === 0) {
      Alert.alert('Cannot Trim', 'This would remove the entire video.');
      return;
    }

    setSegments(newSegments);
    const minTime = Math.min(...newSegments.map(s => s.startTime));
    const maxTime = Math.max(...newSegments.map(s => s.endTime));
    setSelectionStart(minTime);
    setSelectionEnd(maxTime);
  };

  // ── AI Edit ──
  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Enter a prompt', 'Describe what you want to do with the selected segment.');
      return;
    }
    if (!videoFilename) return;

    setEditorState('ai_processing');
    setAiStatus('Submitting edit...');

    try {
      const segIdx = segments.findIndex(s => s.startTime <= selectionStart && s.endTime >= selectionStart);
      setAiSegmentIndex(segIdx >= 0 ? segIdx : 0);

      const data = await ApiService.editorSegmentEdit(
        videoFilename,
        selectionStart,
        selectionEnd,
        aiPrompt.trim(),
      );

      setAiTaskId(data.task_id);
      setAiStatus('AI is editing your segment...');

      const maxWait = 60 * 60 * 1000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 5000));

        try {
          const status = await ApiService.editorPollSegment(data.task_id);

          if (status.state === 'SUCCEEDED') {
            setAiPreviewUrl(status.video_url);
            setAiPreviewFilename(status.video_filename);
            setEditorState('ai_preview');
            return;
          }

          if (status.state === 'FAILED') {
            throw new Error(status.error_message || 'AI edit failed');
          }

          if (status.state === 'ANALYZING') setAiStatus('Analyzing your video...');
          else if (status.state === 'RESEARCHING') setAiStatus('Planning the edit...');
          else if (status.state === 'RENDERING') setAiStatus('Rendering...');
          else setAiStatus('Processing...');
        } catch (pollErr: any) {
          if (pollErr.message?.includes('failed')) throw pollErr;
        }
      }

      throw new Error('Edit timed out');
    } catch (err: any) {
      Alert.alert('Edit Failed', err.message || 'Something went wrong. Try again.');
      setEditorState('editor');
    }
  };

  // ── Accept AI Edit ──
  const handleAcceptEdit = () => {
    if (aiSegmentIndex === null || !aiPreviewFilename) return;

    const newSegments = [...segments];
    const targetSeg = newSegments[aiSegmentIndex];

    if (targetSeg) {
      const beforeSegments: Segment[] = [];
      const afterSegments: Segment[] = [];

      if (selectionStart > targetSeg.startTime) {
        beforeSegments.push({
          id: `seg_${Date.now()}_pre`,
          startTime: targetSeg.startTime,
          endTime: selectionStart,
          type: 'original',
        });
      }

      if (selectionEnd < targetSeg.endTime) {
        afterSegments.push({
          id: `seg_${Date.now()}_post`,
          startTime: selectionEnd,
          endTime: targetSeg.endTime,
          type: 'original',
        });
      }

      newSegments.splice(aiSegmentIndex, 1,
        ...beforeSegments,
        {
          id: `seg_${Date.now()}_edited`,
          startTime: selectionStart,
          endTime: selectionEnd,
          type: 'edited',
          editedFilename: aiPreviewFilename,
          editedUrl: aiPreviewUrl || undefined,
          prompt: aiPrompt,
        },
        ...afterSegments,
      );
    }

    setSegments(newSegments);
    setEditorState('editor');
    setAiPrompt('');
    setAiPreviewUrl(null);
    setAiPreviewFilename(null);
    setAiSegmentIndex(null);
  };

  // ── Reject AI Edit ──
  const handleRejectEdit = () => {
    setEditorState('editor');
    setAiPreviewUrl(null);
    setAiPreviewFilename(null);
    setAiSegmentIndex(null);
  };

  // ── Make Viral ──
  const viralCancelledRef = useRef(false);

  const handleMakeViral = async (niche: string) => {
    if (!videoFilename || editorState === 'viral_processing') return;
    viralCancelledRef.current = false;
    setShowNichePicker(false);
    setEditorState('viral_processing');
    setViralStatus('Starting...');

    try {
      const data = await ApiService.editorMakeViral(videoFilename, niche);
      setViralTaskId(data.task_id);

      const maxWait = 60 * 60 * 1000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        if (viralCancelledRef.current) return;
        await new Promise(r => setTimeout(r, 5000));
        if (viralCancelledRef.current) return;

        try {
          const status = await ApiService.editorPollViral(data.task_id);

          if (status.state === 'SUCCEEDED') {
            if (viralCancelledRef.current) return;
            setViralPreviewUrl(status.video_url);
            setViralEditSummary(status.edit_summary || '');
            if (Array.isArray(status.captions) && status.captions.length > 0) {
              setCaptionWords(status.captions);
              setCaptionEnabled(true);
            }
            setEditorState('viral_preview');
            return;
          }

          if (status.state === 'FAILED') {
            throw new Error(status.error_message || 'Make Viral failed');
          }

          const statusMap: Record<string, string> = {
            'TRANSCRIBING': 'Transcribing audio...',
            'SEARCHING': 'Searching trending styles...',
            'ANALYZING': 'Analyzing your video...',
            'RESEARCHING': 'Researching edit techniques...',
            'RENDERING': 'Rendering viral edit...',
          };
          setViralStatus(statusMap[status.state] || 'Processing...');
        } catch (pollErr: any) {
          if (pollErr.message?.includes('failed')) throw pollErr;
        }
      }
      throw new Error('Timed out');
    } catch (err: any) {
      if (viralCancelledRef.current) return;
      const msg = err?.response?.data?.error || err?.message || 'Something went wrong.';
      console.log('[MAKE_VIRAL] Failed:', msg, 'videoFilename:', videoFilename);
      Alert.alert('Make Viral Failed', msg);
      setEditorState('editor');
    }
  };

  // ── Transcribe (Auto Captions) ──
  const handleTranscribe = async () => {
    if (!videoFilename) return;
    setCaptionLoading(true);
    try {
      const data = await ApiService.editorTranscribe(videoFilename);
      setCaptionWords(data.words || []);
      setCaptionEnabled(true);
    } catch (err: any) {
      Alert.alert('Transcription Failed', err.message || 'Could not generate captions.');
    } finally {
      setCaptionLoading(false);
    }
  };

  // ── Get current caption text for overlay ──
  const getCurrentCaption = useCallback((): {text: string; words?: {word: string; active: boolean}[]} | null => {
    const showSample = activeTool === 'captions' && captionWords.length === 0;
    if (!captionEnabled && !showSample) return null;

    if (showSample) {
      return {text: 'Your captions here'};
    }

    const t = currentTime;

    switch (captionTimingMode) {
      case 'single-pop': {
        const w = captionWords.find(cw => t >= cw.start_time && t <= cw.end_time);
        return w ? {text: w.word} : null;
      }
      case 'word': {
        const idx = captionWords.findIndex(cw => t >= cw.start_time && t <= cw.end_time);
        if (idx < 0) return null;
        const start = Math.max(0, idx - 2);
        const end = Math.min(captionWords.length, idx + 3);
        const context = captionWords.slice(start, end);
        const activeIdx = idx - start;
        return {
          text: context.map(cw => cw.word).join(' '),
          words: context.map((cw, i) => ({word: cw.word, active: i === activeIdx})),
        };
      }
      case 'phrase': {
        const phraseSize = 4;
        for (let i = 0; i < captionWords.length; i += phraseSize) {
          const phrase = captionWords.slice(i, i + phraseSize);
          const pStart = phrase[0]?.start_time ?? 0;
          const pEnd = phrase[phrase.length - 1]?.end_time ?? 0;
          if (t >= pStart && t <= pEnd + 0.3) {
            return {text: phrase.map(cw => cw.word).join(' ')};
          }
        }
        return null;
      }
      case 'sentence': {
        const windowSize = 3;
        const windowStart = Math.floor(t / windowSize) * windowSize;
        const windowEnd = windowStart + windowSize;
        const inWindow = captionWords.filter(cw => cw.start_time >= windowStart && cw.start_time < windowEnd);
        if (inWindow.length === 0) return null;
        return {text: inWindow.map(cw => cw.word).join(' ')};
      }
    }
  }, [captionEnabled, captionWords, currentTime, captionTimingMode, activeTool]);

  // ── Trigger animation when caption text changes during playback ──
  useEffect(() => {
    const caption = getCurrentCaption();
    const captionText = caption?.text || '';
    if (captionText && captionText !== prevCaptionTextRef.current) {
      prevCaptionTextRef.current = captionText;
      if (captionAnimation !== 'none' && captionAnimation !== 'karaoke') {
        triggerCaptionAnim();
      }
    }
  }, [currentTime]);

  // ── Set speed for current segment ──
  const setSegmentSpeed = (speed: number) => {
    const idx = segments.findIndex(s => selectionStart >= s.startTime && selectionStart < s.endTime);
    if (idx >= 0) {
      const newSegs = [...segments];
      newSegs[idx] = {...newSegs[idx], speed};
      setSegments(newSegs);
    }
  };

  // ── Get current segment speed for speed panel display ──
  const getCurrentSegmentSpeed = (): number => {
    const seg = segments.find(s => selectionStart >= s.startTime && selectionStart < s.endTime);
    return seg?.speed || 1;
  };

  // ── Export ──
  const handleExport = async () => {
    if (!videoFilename || segments.length === 0) return;

    setExporting(true);
    try {
      const stitchSegments = segments.map(seg => ({
        type: seg.type,
        start_time: seg.startTime,
        end_time: seg.endTime,
        edited_filename: seg.editedFilename,
        speed: seg.speed || 1,
      }));

      const captionsData = captionEnabled && captionWords.length > 0 ? {
        enabled: true,
        words: captionWords,
        timing_mode: captionTimingMode,
        font_style: captionFontStyle,
        animation: captionAnimation,
      } : undefined;

      const result = await ApiService.editorStitch(
        videoFilename,
        stitchSegments,
        activeFilter !== 'none' ? activeFilter : undefined,
        captionsData,
      );
      setExportUrl(result.video_url);

      Alert.alert(
        'Export Complete',
        'Your video is ready!',
        [
          {text: 'Share', onPress: () => Share.share({url: result.video_url, message: result.video_url})},
          {text: 'Open', onPress: () => Linking.openURL(result.video_url)},
          {text: 'OK'},
        ],
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export video.');
    } finally {
      setExporting(false);
    }
  };

  // ── New Video ──
  const handleNewVideo = () => {
    setEditorState('select');
    setVideoUri(null);
    setVideoFilename(null);
    setVideoUrl(null);
    setVideoDuration(0);
    setThumbnails([]);
    setSegments([]);
    setAiPrompt('');
    setExportUrl(null);
    setCurrentTime(0);
    setActiveTool('none');
    setCaptionWords([]);
    setCaptionEnabled(false);
    setActiveFilter('none');
  };

  // ── Caption animation style ──
  const getCaptionAnimStyle = () => {
    switch (captionAnimation) {
      case 'fade':
      case 'typewriter':
        return {opacity: captionAnimValue};
      case 'pop':
        return {
          opacity: captionAnimValue,
          transform: [{scale: captionAnimValue.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0.3, 1.15, 1],
          })}],
        };
      case 'slide-up':
        return {
          opacity: captionAnimValue,
          transform: [{translateY: captionAnimValue.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
          })}],
        };
      default:
        return {};
    }
  };

  // ── Get font style for captions ──
  const getCaptionFontPreview = () => {
    return FONT_STYLES.find(f => f.key === captionFontStyle)?.preview || {};
  };

  // ══════════════════════════════════════
  // RENDERS
  // ══════════════════════════════════════

  // ── Render: SELECT state ──
  const renderSelect = () => (
    <View style={styles.selectContainer}>
      <View style={styles.selectIcon}>
        <Paragraph style={styles.selectIconText}>{'🎬'}</Paragraph>
      </View>
      <Title style={styles.selectTitle}>Video Editor</Title>
      <Paragraph style={styles.selectDesc}>
        Select a video to start editing. Cut, trim, add captions, speed, filters, and AI effects.
      </Paragraph>
      <TouchableOpacity onPress={pickVideo} disabled={uploading}>
        <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.selectBtn}>
          {uploading ? (
            <ActivityIndicator color="#050810" />
          ) : (
            <Paragraph style={styles.selectBtnText}>SELECT VIDEO</Paragraph>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── Render: Filmstrip ──
  const renderFilmstrip = () => {
    const startX = timeToXRender(selectionStart);
    const endX = timeToXRender(selectionEnd);
    const playheadX = timeToXRender(currentTime);

    return (
      <View style={styles.filmstripContainer}>
        <View style={styles.timeLabels}>
          <Paragraph style={styles.timeText}>{formatTime(selectionStart)}</Paragraph>
          <Paragraph style={styles.timeText}>{formatTime(currentTime)}</Paragraph>
          <Paragraph style={styles.timeText}>{formatTime(selectionEnd)}</Paragraph>
        </View>

        <View style={styles.filmstrip}>
          <View style={styles.thumbRow}>
            {thumbnails.map((thumb, i) => (
              <Image
                key={i}
                source={{uri: thumb.url}}
                style={[styles.thumbImg, {width: FILMSTRIP_WIDTH / Math.max(thumbnails.length, 1)}]}
                resizeMode="cover"
              />
            ))}
          </View>

          <View style={[styles.dimOverlay, {left: 0, width: startX}]} />
          <View style={[styles.dimOverlay, {left: endX, right: 0, width: undefined}]} />

          <View style={[styles.selectionBorder, {left: startX, width: endX - startX}]} />

          {segments.filter(s => s.type === 'edited').map((seg, i) => (
            <View
              key={i}
              style={[styles.editedMarker, {
                left: timeToXRender(seg.startTime),
                width: timeToXRender(seg.endTime) - timeToXRender(seg.startTime),
              }]}
            />
          ))}

          <View
            style={[styles.handle, styles.handleLeft, {left: startX - HANDLE_WIDTH}]}
            {...startPanResponder.panHandlers}
          >
            <View style={styles.handleBar} />
          </View>

          <View
            style={[styles.handle, styles.handleRight, {left: endX}]}
            {...endPanResponder.panHandlers}
          >
            <View style={styles.handleBar} />
          </View>

          <View style={[styles.playhead, {left: playheadX - 1}]} />
        </View>

        <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn}>
          <Paragraph style={styles.selectAllText}>Select All</Paragraph>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render: Caption Overlay (on video) ──
  const renderCaptionOverlay = () => {
    const caption = getCurrentCaption();
    if (!caption) return null;

    const fontStyle = getCaptionFontPreview();
    const isLargeSingle = captionTimingMode === 'single-pop';
    const fontSize = isLargeSingle ? 36 : 22;

    return (
      <Animated.View
        style={[styles.captionOverlay, getCaptionAnimStyle()]}
        pointerEvents="none"
      >
        {caption.words && captionAnimation === 'karaoke' ? (
          <View style={styles.captionWordRow}>
            {caption.words.map((w, i) => (
              <Text
                key={i}
                style={[
                  styles.captionText,
                  fontStyle,
                  {fontSize},
                  w.active && {color: '#00FFB3', transform: [{scale: 1.2}]},
                ]}
              >
                {w.word}{' '}
              </Text>
            ))}
          </View>
        ) : caption.words ? (
          <View style={styles.captionWordRow}>
            {caption.words.map((w, i) => (
              <Text
                key={i}
                style={[
                  styles.captionText,
                  fontStyle,
                  {fontSize},
                  w.active && {color: '#00FFB3'},
                ]}
              >
                {w.word}{' '}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={[styles.captionText, fontStyle, {fontSize}]}>
            {caption.text}
          </Text>
        )}
      </Animated.View>
    );
  };

  // ── Render: Filter Overlay (on video) ──
  const renderFilterOverlay = () => {
    if (activeFilter === 'none') return null;
    const filter = FILTERS.find(f => f.key === activeFilter);
    if (!filter?.overlay) return null;
    return <View style={[StyleSheet.absoluteFill, filter.overlay]} pointerEvents="none" />;
  };

  // ── Render: Caption Panel ──
  const renderCaptionPanel = () => (
    <View style={styles.toolPanel}>
      <Paragraph style={styles.sectionLabel}>AUTO CAPTIONS</Paragraph>

      {/* Generate / Toggle */}
      <View style={styles.captionTopRow}>
        {captionWords.length === 0 ? (
          <TouchableOpacity onPress={handleTranscribe} disabled={captionLoading}>
            <LinearGradient colors={captionLoading ? ['#1E293B', '#1E293B'] : ['#00D4FF', '#00FFB3']} style={styles.captionGenBtn}>
              {captionLoading ? (
                <ActivityIndicator color="#94A3B8" size="small" />
              ) : (
                <Paragraph style={styles.captionGenText}>GENERATE CAPTIONS</Paragraph>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setCaptionEnabled(!captionEnabled)}
            style={[styles.captionToggle, captionEnabled && styles.captionToggleActive]}
          >
            <Paragraph style={[styles.captionToggleText, captionEnabled && {color: '#050810'}]}>
              {captionEnabled ? 'CAPTIONS ON' : 'CAPTIONS OFF'}
            </Paragraph>
          </TouchableOpacity>
        )}
      </View>

      {/* Timing Mode */}
      <Paragraph style={styles.panelSubLabel}>Timing</Paragraph>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {TIMING_MODES.map(tm => (
          <TouchableOpacity
            key={tm.key}
            onPress={() => setCaptionTimingMode(tm.key)}
            style={[styles.chip, captionTimingMode === tm.key && styles.chipActive]}
          >
            <Paragraph style={[styles.chipText, captionTimingMode === tm.key && styles.chipTextActive]}>
              {tm.label}
            </Paragraph>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Font Style */}
      <Paragraph style={styles.panelSubLabel}>Font Style</Paragraph>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {FONT_STYLES.map(fs => (
          <TouchableOpacity
            key={fs.key}
            onPress={() => {
              setCaptionFontStyle(fs.key);
              if (!captionEnabled && captionWords.length > 0) setCaptionEnabled(true);
            }}
            style={[styles.fontChip, captionFontStyle === fs.key && styles.chipActive]}
          >
            <Text style={[{fontSize: 18, marginBottom: 2}, fs.preview]}>Aa</Text>
            <Paragraph style={[styles.chipLabel, captionFontStyle === fs.key && styles.chipTextActive]}>
              {fs.label}
            </Paragraph>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Animation */}
      <Paragraph style={styles.panelSubLabel}>Animation</Paragraph>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {ANIMATIONS.map(anim => (
          <TouchableOpacity
            key={anim.key}
            onPress={() => setCaptionAnimation(anim.key)}
            style={[styles.chip, captionAnimation === anim.key && styles.chipActive]}
          >
            <Paragraph style={[styles.chipText, captionAnimation === anim.key && styles.chipTextActive]}>
              {anim.label}
            </Paragraph>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Render: Speed Panel ──
  const renderSpeedPanel = () => {
    const curSpeed = getCurrentSegmentSpeed();
    const seg = segments.find(s => selectionStart >= s.startTime && selectionStart < s.endTime);

    return (
      <View style={styles.toolPanel}>
        <Paragraph style={styles.sectionLabel}>SPEED</Paragraph>
        {seg && (
          <Paragraph style={styles.panelHint}>
            Segment: {formatTime(seg.startTime)} — {formatTime(seg.endTime)}
          </Paragraph>
        )}
        <View style={styles.speedRow}>
          {SPEED_OPTIONS.map(sp => (
            <TouchableOpacity
              key={sp}
              onPress={() => setSegmentSpeed(sp)}
              style={[styles.speedBtn, curSpeed === sp && styles.speedBtnActive]}
            >
              <Paragraph style={[styles.speedBtnText, curSpeed === sp && styles.speedBtnTextActive]}>
                {sp}x
              </Paragraph>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // ── Render: Filter Panel ──
  const renderFilterPanel = () => (
    <View style={styles.toolPanel}>
      <Paragraph style={styles.sectionLabel}>FILTERS</Paragraph>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[styles.filterChip, activeFilter === f.key && styles.chipActive]}
          >
            <View style={[styles.filterDot, {backgroundColor: f.dot}]} />
            <Paragraph style={[styles.chipLabel, activeFilter === f.key && styles.chipTextActive]}>
              {f.label}
            </Paragraph>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Render: Segment List ──
  const renderSegmentList = () => (
    <View style={styles.segmentList}>
      <Paragraph style={styles.sectionLabel}>SEGMENTS</Paragraph>
      {segments.map((seg, i) => (
        <View key={seg.id} style={[
          styles.segmentItem,
          seg.type === 'edited' && styles.segmentItemEdited,
        ]}>
          <View style={styles.segmentInfo}>
            <Paragraph style={styles.segmentTime}>
              {formatTime(seg.startTime)} — {formatTime(seg.endTime)}
              {seg.speed && seg.speed !== 1 ? ` (${seg.speed}x)` : ''}
            </Paragraph>
            <Paragraph style={styles.segmentType}>
              {seg.type === 'edited' ? `AI: ${seg.prompt?.slice(0, 30)}...` : 'Original'}
            </Paragraph>
          </View>
          {seg.type === 'edited' && (
            <TouchableOpacity
              onPress={() => {
                const newSegs = [...segments];
                newSegs[i] = {...seg, type: 'original', editedFilename: undefined, editedUrl: undefined, prompt: undefined};
                setSegments(newSegs);
              }}
              style={styles.revertBtn}
            >
              <Paragraph style={styles.revertText}>Undo</Paragraph>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

  // ── Render: Niche Picker ──
  const renderNichePicker = () => (
    <View style={styles.nichePickerOverlay}>
      <View style={styles.nichePickerCard}>
        <Paragraph style={styles.sectionLabel}>SELECT YOUR NICHE</Paragraph>
        <Paragraph style={styles.nichePickerDesc}>
          AI will apply editing styles popular in your niche
        </Paragraph>

        <View style={styles.nicheChipGrid}>
          {PRESET_NICHES.map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => {
                setSelectedNiche(n);
                handleMakeViral(n);
              }}
              style={[styles.nicheChip, selectedNiche === n && styles.chipActive]}
            >
              <Paragraph style={[styles.nicheChipText, selectedNiche === n && styles.chipTextActive]}>
                {n.charAt(0).toUpperCase() + n.slice(1)}
              </Paragraph>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setSelectedNiche('others')}
            style={[styles.nicheChip, selectedNiche === 'others' && styles.chipActive]}
          >
            <Paragraph style={[styles.nicheChipText, selectedNiche === 'others' && styles.chipTextActive]}>
              Others
            </Paragraph>
          </TouchableOpacity>
        </View>

        {selectedNiche === 'others' && (
          <View style={styles.customNicheRow}>
            <TextInput
              style={styles.customNicheInput}
              placeholder="Type your niche..."
              placeholderTextColor="#64748B"
              value={customNiche}
              onChangeText={setCustomNiche}
              maxLength={30}
            />
            <TouchableOpacity
              onPress={() => {
                if (customNiche.trim()) handleMakeViral(customNiche.trim().toLowerCase());
              }}
              disabled={!customNiche.trim()}
            >
              <LinearGradient
                colors={customNiche.trim() ? ['#00D4FF', '#00FFB3'] : ['#1E293B', '#1E293B']}
                style={styles.customNicheGoBtn}
              >
                <Paragraph style={[styles.customNicheGoText, !customNiche.trim() && {color: '#64748B'}]}>GO</Paragraph>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => setShowNichePicker(false)} style={styles.nichePickerCancel}>
          <Paragraph style={styles.cancelText}>Cancel</Paragraph>
        </TouchableOpacity>
      </View>
    </View>
  );


  // Plan review removed — pipeline runs straight through
  // ── Render: Viral Processing state ──
  const renderViralProcessing = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#00FFB3" />
      <Title style={styles.processingTitle}>Making it Viral</Title>
      <Paragraph style={styles.processingStatus}>{viralStatus}</Paragraph>
      <Paragraph style={styles.processingHint}>
        AI is applying niche-optimized edits: captions, effects, zoom, color grading, and pacing
      </Paragraph>
      <TouchableOpacity
        onPress={() => { viralCancelledRef.current = true; setEditorState('editor'); }}
        style={styles.cancelBtn}
      >
        <Paragraph style={styles.cancelText}>Cancel</Paragraph>
      </TouchableOpacity>
    </View>
  );

  // ── Render: Viral Preview state ──
  const renderViralPreview = () => (
    <View style={styles.previewContainer}>
      <Paragraph style={styles.sectionLabel}>VIRAL EDIT PREVIEW</Paragraph>

      <TouchableOpacity
        onPress={() => setViralPreviewPlaying(!viralPreviewPlaying)}
        activeOpacity={0.9}
        style={styles.previewVideoContainer}
      >
        {viralPreviewUrl && (
          <Video
            source={{uri: viralPreviewUrl}}
            style={styles.previewVideo}
            resizeMode="contain"
            paused={!viralPreviewPlaying}
            repeat
          />
        )}
        {!viralPreviewPlaying && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Paragraph style={styles.playIcon}>{'▶'}</Paragraph>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {viralEditSummary ? (
        <View style={styles.viralSummaryBox}>
          <Paragraph style={styles.viralSummaryLabel}>EDITS APPLIED</Paragraph>
          <Paragraph style={styles.viralSummaryText}>{viralEditSummary}</Paragraph>
        </View>
      ) : null}

      <View style={styles.previewActions}>
        <TouchableOpacity onPress={() => setEditorState('editor')} style={styles.rejectBtn}>
          <Paragraph style={styles.rejectText}>BACK</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (viralPreviewUrl) {
            setExportUrl(viralPreviewUrl);
            Alert.alert(
              'Viral Edit Ready',
              'Your viral-optimized video is ready!',
              [
                {text: 'Share', onPress: () => Share.share({url: viralPreviewUrl, message: viralPreviewUrl})},
                {text: 'Open', onPress: () => Linking.openURL(viralPreviewUrl)},
                {text: 'OK'},
              ],
            );
          }
        }}>
          <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.acceptBtn}>
            <Paragraph style={styles.acceptText}>USE THIS</Paragraph>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render: EDITOR state ──
  const renderEditor = () => (
    <View style={styles.editorContainer}>
      {/* Make Viral Button */}
      <TouchableOpacity onPress={() => setShowNichePicker(true)} style={styles.makeViralBtn}>
        <LinearGradient
          colors={['#FF6B00', '#FF2D87']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={styles.makeViralGradient}
        >
          <Paragraph style={styles.makeViralIcon}>{'🔥'}</Paragraph>
          <Paragraph style={styles.makeViralText}>MAKE VIRAL</Paragraph>
        </LinearGradient>
      </TouchableOpacity>

      {/* Niche Picker Modal */}
      {showNichePicker && renderNichePicker()}

      {/* Video Player with overlays */}
      <TouchableOpacity onPress={togglePlay} activeOpacity={0.9} style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{uri: videoUrl || videoUri || ''}}
          style={styles.video}
          resizeMode="contain"
          paused={!isPlaying}
          onProgress={onVideoProgress}
          rate={playbackRate}
          repeat
        />
        {renderFilterOverlay()}
        {renderCaptionOverlay()}
        {!isPlaying && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Paragraph style={styles.playIcon}>{'▶'}</Paragraph>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Filmstrip with handles */}
      {renderFilmstrip()}

      {/* Tool Buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolScroll}>
        <TouchableOpacity onPress={handleCut} style={styles.toolBtn}>
          <Paragraph style={styles.toolIcon}>{'✂'}</Paragraph>
          <Paragraph style={styles.toolLabel}>Cut</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleTrim} style={styles.toolBtn}>
          <Paragraph style={styles.toolIcon}>{'✏'}</Paragraph>
          <Paragraph style={styles.toolLabel}>Trim</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity onPress={selectAll} style={styles.toolBtn}>
          <Paragraph style={styles.toolIcon}>{'⬜'}</Paragraph>
          <Paragraph style={styles.toolLabel}>Select All</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTool(activeTool === 'captions' ? 'none' : 'captions')}
          style={[styles.toolBtn, activeTool === 'captions' && styles.toolBtnActive]}
        >
          <Paragraph style={styles.toolIcon}>{'💬'}</Paragraph>
          <Paragraph style={[styles.toolLabel, activeTool === 'captions' && {color: '#00D4FF'}]}>Captions</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTool(activeTool === 'speed' ? 'none' : 'speed')}
          style={[styles.toolBtn, activeTool === 'speed' && styles.toolBtnActive]}
        >
          <Paragraph style={styles.toolIcon}>{'⚡'}</Paragraph>
          <Paragraph style={[styles.toolLabel, activeTool === 'speed' && {color: '#00D4FF'}]}>Speed</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTool(activeTool === 'filters' ? 'none' : 'filters')}
          style={[styles.toolBtn, activeTool === 'filters' && styles.toolBtnActive]}
        >
          <Paragraph style={styles.toolIcon}>{'🎨'}</Paragraph>
          <Paragraph style={[styles.toolLabel, activeTool === 'filters' && {color: '#00D4FF'}]}>Filters</Paragraph>
        </TouchableOpacity>
      </ScrollView>

      {/* Tool Panels */}
      {activeTool === 'captions' && renderCaptionPanel()}
      {activeTool === 'speed' && renderSpeedPanel()}
      {activeTool === 'filters' && renderFilterPanel()}

      {/* Segment List */}
      {renderSegmentList()}

      {/* Export + New Video */}
      <View style={styles.bottomActions}>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.exportBtn}>
            {exporting ? (
              <ActivityIndicator color="#050810" />
            ) : (
              <Paragraph style={styles.exportBtnText}>EXPORT VIDEO</Paragraph>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNewVideo} style={styles.newVideoBtn}>
          <Paragraph style={styles.newVideoText}>Choose Different Video</Paragraph>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render: AI Processing state ──
  const renderAiProcessing = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color="#00D4FF" />
      <Title style={styles.processingTitle}>Editing Segment</Title>
      <Paragraph style={styles.processingStatus}>{aiStatus}</Paragraph>
      <Paragraph style={styles.processingHint}>
        {formatTime(selectionStart)} — {formatTime(selectionEnd)}
      </Paragraph>
      <TouchableOpacity
        onPress={() => setEditorState('editor')}
        style={styles.cancelBtn}
      >
        <Paragraph style={styles.cancelText}>Cancel</Paragraph>
      </TouchableOpacity>
    </View>
  );

  // ── Render: AI Preview state ──
  const renderAiPreview = () => (
    <View style={styles.previewContainer}>
      <Paragraph style={styles.sectionLabel}>PREVIEW EDITED SEGMENT</Paragraph>

      <TouchableOpacity
        onPress={() => setPreviewPlaying(!previewPlaying)}
        activeOpacity={0.9}
        style={styles.previewVideoContainer}
      >
        {aiPreviewUrl && (
          <Video
            source={{uri: aiPreviewUrl}}
            style={styles.previewVideo}
            resizeMode="contain"
            paused={!previewPlaying}
            repeat
          />
        )}
        {!previewPlaying && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Paragraph style={styles.playIcon}>{'▶'}</Paragraph>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <Paragraph style={styles.previewPrompt}>"{aiPrompt}"</Paragraph>

      <View style={styles.previewActions}>
        <TouchableOpacity onPress={handleRejectEdit} style={styles.rejectBtn}>
          <Paragraph style={styles.rejectText}>REJECT</Paragraph>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAcceptEdit}>
          <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.acceptBtn}>
            <Paragraph style={styles.acceptText}>ACCEPT</Paragraph>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Main Render ──
  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{opacity: fadeAnim}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backBtnText}>{'←'}</Paragraph>
            </TouchableOpacity>
            <View style={{flex: 1}}>
              <Title style={styles.title}>Video Editor</Title>
            </View>
          </View>

          {editorState === 'select' && renderSelect()}
          {editorState === 'editor' && renderEditor()}
          {/* AI Edit disabled for v1 launch */}
          {editorState === 'viral_processing' && renderViralProcessing()}
          {editorState === 'viral_preview' && renderViralPreview()}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {flex: 1},
  content: {paddingBottom: 40},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backBtnText: {color: '#00D4FF', fontSize: 20, lineHeight: 22},
  title: {color: '#FFFFFF', fontSize: 22, fontWeight: '700'},

  // Select state
  selectContainer: {alignItems: 'center', paddingTop: 80, paddingHorizontal: 32},
  selectIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,212,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  selectIconText: {fontSize: 36},
  selectTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8},
  selectDesc: {color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20},
  selectBtn: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  selectBtnText: {color: '#050810', fontSize: 16, fontWeight: '700', textAlign: 'center'},

  // Editor state
  editorContainer: {paddingHorizontal: 16},

  // Video player
  videoContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  video: {width: '100%', height: '100%'},
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,212,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {color: '#FFFFFF', fontSize: 24, marginLeft: 4},

  // Caption overlay
  captionOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 12,
    right: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  captionText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
  },

  // Filmstrip
  filmstripContainer: {marginBottom: 16},
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  timeText: {color: '#94A3B8', fontSize: 11},
  filmstrip: {
    height: FILMSTRIP_HEIGHT,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'visible',
    position: 'relative',
  },
  thumbRow: {
    flexDirection: 'row',
    height: FILMSTRIP_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbImg: {height: FILMSTRIP_HEIGHT},
  dimOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,8,16,0.7)',
  },
  selectionBorder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#00D4FF',
    borderRadius: 4,
  },
  editedMarker: {
    position: 'absolute',
    bottom: 0,
    height: 4,
    backgroundColor: '#00FFB3',
    borderRadius: 2,
  },
  handle: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: HANDLE_WIDTH,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  handleLeft: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  handleRight: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  handleBar: {
    width: 3,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  playhead: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 2,
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  selectAllBtn: {alignSelf: 'flex-end', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2},
  selectAllText: {color: '#00D4FF', fontSize: 12},

  // Tool buttons
  toolScroll: {
    marginBottom: 16,
  },
  toolBtn: {
    alignItems: 'center',
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 72,
    marginRight: 8,
  },
  toolBtnActive: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  toolIcon: {fontSize: 18, marginBottom: 2},
  toolLabel: {color: '#94A3B8', fontSize: 11},

  // Tool panels (shared)
  toolPanel: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  panelSubLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  panelHint: {color: '#64748B', fontSize: 12, marginBottom: 8},

  // Chips (shared)
  chipScroll: {marginBottom: 4},
  chip: {
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  chipActive: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  chipText: {color: '#94A3B8', fontSize: 12, fontWeight: '600'},
  chipTextActive: {color: '#00D4FF'},
  chipLabel: {color: '#94A3B8', fontSize: 10, textAlign: 'center'},

  // Font style chips
  fontChip: {
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 60,
  },

  // Caption panel
  captionTopRow: {marginBottom: 4},
  captionGenBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  captionGenText: {color: '#050810', fontSize: 13, fontWeight: '700'},
  captionToggle: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  captionToggleActive: {
    backgroundColor: '#00FFB3',
    borderColor: '#00FFB3',
  },
  captionToggleText: {color: '#94A3B8', fontSize: 13, fontWeight: '700'},

  // Speed panel
  speedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedBtn: {
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  speedBtnActive: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  speedBtnText: {color: '#94A3B8', fontSize: 14, fontWeight: '700'},
  speedBtnTextActive: {color: '#00D4FF'},

  // Filter panel
  filterChip: {
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 56,
  },
  filterDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
  },

  // AI Edit section
  aiSection: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {color: '#00D4FF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8},
  aiHint: {color: '#64748B', fontSize: 12, marginBottom: 12},
  aiInput: {
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  aiBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  aiBtnText: {color: '#050810', fontSize: 14, fontWeight: '700'},

  // Segment list
  segmentList: {marginBottom: 20},
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  segmentItemEdited: {borderColor: '#00FFB3'},
  segmentInfo: {flex: 1},
  segmentTime: {color: '#FFFFFF', fontSize: 13, fontWeight: '600'},
  segmentType: {color: '#64748B', fontSize: 11, marginTop: 2},
  revertBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  revertText: {color: '#94A3B8', fontSize: 11},

  // Bottom actions
  bottomActions: {alignItems: 'center', marginBottom: 20},
  exportBtn: {
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 12,
    marginBottom: 12,
  },
  exportBtnText: {color: '#050810', fontSize: 16, fontWeight: '700'},
  newVideoBtn: {paddingVertical: 8},
  newVideoText: {color: '#64748B', fontSize: 13},

  // AI Processing
  processingContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  processingTitle: {color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 24},
  processingStatus: {color: '#00D4FF', fontSize: 14, marginTop: 8},
  processingHint: {color: '#64748B', fontSize: 12, marginTop: 4},
  cancelBtn: {
    marginTop: 32,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
  },
  cancelText: {color: '#94A3B8', fontSize: 13},

  // AI Preview
  previewContainer: {paddingHorizontal: 16, paddingTop: 8},
  previewVideoContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  previewVideo: {width: '100%', height: '100%'},
  previewPrompt: {color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 20, fontStyle: 'italic'},
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  rejectBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  rejectText: {color: '#EF4444', fontSize: 14, fontWeight: '700'},
  acceptBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  acceptText: {color: '#050810', fontSize: 14, fontWeight: '700'},

  // Make Viral button
  makeViralBtn: {marginBottom: 12},
  makeViralGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  makeViralIcon: {fontSize: 20, marginRight: 8},
  makeViralText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1},

  // Niche picker
  nichePickerOverlay: {
    backgroundColor: 'rgba(5,8,16,0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  nichePickerCard: {},
  nichePickerDesc: {color: '#94A3B8', fontSize: 13, marginBottom: 16},
  nicheChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  nicheChip: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  nicheChipText: {color: '#94A3B8', fontSize: 13, fontWeight: '600'},
  customNicheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  customNicheInput: {
    flex: 1,
    backgroundColor: '#050810',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  customNicheGoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  customNicheGoText: {color: '#050810', fontSize: 14, fontWeight: '700'},
  nichePickerCancel: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },

  // Viral edit summary
  viralSummaryBox: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  viralSummaryLabel: {color: '#00FFB3', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6},
  viralSummaryText: {color: '#CBD5E1', fontSize: 13, lineHeight: 20},

  // Plan styles removed
});
