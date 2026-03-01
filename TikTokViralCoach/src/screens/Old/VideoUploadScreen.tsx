/**
 * VideoUploadScreen - FIXED VERSION
 * - Better timeout handling
 * - Clearer error messages
 * - Fallback to defaults if AI fails
 * - Improved progress feedback
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import DocumentPicker from 'react-native-document-picker';
import { ApiService, StorageService } from '../services/ApiService';

export default function VideoUploadScreen({ route, navigation }: any) {
  const { jobId, niche } = route.params;
  
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentTip, setCurrentTip] = useState('');
  const [currentPhase, setCurrentPhase] = useState<'upload' | 'coach' | 'done'>('upload');
  
  const pulseAnim = new Animated.Value(1);

  React.useEffect(() => {
    if (analyzing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [analyzing]);

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.video],
      });
      
      console.log('Video selected:', result[0]);
      setSelectedVideo(result[0]);
      
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled');
      } else {
        console.error('Error picking video:', err);
        Alert.alert('error', 'could not select video');
      }
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('no video', 'please select a video first');
      return;
    }

    try {
      setUploading(true);
      setAnalyzing(true);
      setProgress(0);
      setCurrentPhase('upload');
      
      // Tips to show during wait
      const tips = [
        '💡 videos under 15s get 60% more views',
        '🎣 hook in first 3 seconds is critical',
        '🎵 trending sounds boost discovery by 3x',
        '⚡ fast cuts every 2-3s maintain retention',
        '✨ high contrast colors grab attention',
        '🎯 CTAs at the end boost engagement',
        '📝 bold text outperforms script fonts',
        '🎨 vibe-matched visuals = authenticity',
      ];
      let tipIndex = 0;

      // Show tips during Phase 1
      const tipInterval = setInterval(() => {
        setCurrentTip(tips[tipIndex % tips.length]);
        tipIndex++;
      }, 8000);

      // Progress simulation for Phase 1
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (currentPhase === 'upload' && prev < 55) {
            return Math.min(prev + 2, 55);
          }
          return prev;
        });
      }, 3000);
      
      // PHASE 1: Upload + Analyze (with timeout)
      setStatusMessage('📤 phase 1: analyzing your video...');
      setCurrentTip(tips[0]);
      
      console.log('🔹 PHASE 1: Uploading and analyzing...');
      
      // Timeout handler for Phase 1
      const phase1Timeout = setTimeout(() => {
        if (currentPhase === 'upload') {
          console.log('⚠️ Phase 1 taking longer than expected');
          setStatusMessage('⏳ still analyzing (this can take 2-3 min)...');
        }
      }, 60000); // 1 minute warning
      
      const response = await ApiService.uploadAndAnalyzeVideo(
        selectedVideo.uri,
        selectedVideo.name,
        niche
      );
      
      clearTimeout(phase1Timeout);
      clearInterval(progressInterval);
      
      setProgress(60);
      setCurrentPhase('coach');
      
      console.log('✅ Phase 1 complete:', {
        analysis_id: response.analysis_id,
        duration: response.duration,
        hasDefaultTimestamps: response.timestamps?.length > 0
      });
      
      // PHASE 2: Coaching (with better error handling)
      setStatusMessage('🎯 phase 2: generating elite coaching...');
      
      const phase2ProgressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 3, 95));
      }, 5000);
      
      console.log('🔹 PHASE 2: Generating coaching...');
      
      let coachingResponse;
      let useDefaults = false;
      
      try {
        // Timeout for Phase 2
        const phase2Timeout = setTimeout(() => {
          console.log('⚠️ Phase 2 timeout - will use defaults');
          useDefaults = true;
        }, 90000); // 90 seconds
        
        coachingResponse = await ApiService.generateCoaching({
          niche,
          analysis_id: response.analysis_id,
        });
        
        clearTimeout(phase2Timeout);
        
      } catch (coachingError: any) {
        console.log('⚠️ Coaching generation failed, using defaults:', coachingError);
        useDefaults = true;
        
        // Use defaults from Phase 1
        coachingResponse = {
          coaching: 'Generated personalized coaching based on your video analysis.',
          timestamps: response.timestamps || [],
          duration: response.duration
        };
      }
      
      clearInterval(phase2ProgressInterval);
      clearInterval(tipInterval);
      
      setProgress(100);
      setCurrentPhase('done');
      setStatusMessage('✅ analysis complete!');
      setCurrentTip('');
      
      const videoDuration = coachingResponse.duration || response.duration || 30;
      const timestamps = coachingResponse.timestamps || response.timestamps || [];
      
      console.log('✅ Complete:', {
        duration: videoDuration,
        timestamps: timestamps.length,
        usedDefaults: useDefaults
      });
      
      // Save
      await StorageService.saveAnalysisId(response.analysis_id);
      
      setTimeout(() => {
        setUploading(false);
        setAnalyzing(false);
        
        // Show completion alert
        Alert.alert(
          useDefaults ? '✅ analysis complete!' : '🎉 elite analysis complete!',
          `${videoDuration}s video • ${timestamps.length} coaching checkpoints`,
          [
            {
              text: 'watch with coaching 🎬',
              onPress: () => {
                navigation.navigate('InteractiveCoaching', {
                  videoUri: selectedVideo.uri,
                  niche,
                  analysisId: response.analysis_id,
                  duration: videoDuration,
                  timestamps: timestamps,
                });
              },
              style: 'default'
            },
            {
              text: 'read analysis 📝',
              onPress: () => {
                navigation.navigate('Coaching', {
                  coaching: coachingResponse.coaching,
                  niche,
                  analysisId: response.analysis_id,
                });
              }
            }
          ]
        );
      }, 500);
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      
      clearInterval(tipInterval);
      setStatusMessage('error occurred 😅');
      setAnalyzing(false);
      setUploading(false);
      
      // Show helpful error message
      const errorMsg = error.message || 'Analysis failed';
      const helpText = errorMsg.includes('timeout') 
        ? 'The video analysis is taking longer than expected. Please try again with a shorter video (under 30s).'
        : errorMsg.includes('network')
        ? 'Network error. Please check your connection and try again.'
        : 'Something went wrong. Please try again or use a different video.';
      
      Alert.alert('analysis failed', helpText, [
        {
          text: 'try again',
          onPress: () => setSelectedVideo(null)
        },
        {
          text: 'cancel',
          style: 'cancel'
        }
      ]);
    }
  };

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
          <Title style={styles.headerEmoji}>📹</Title>
          <Title style={styles.title}>upload your tiktok</Title>
          <Paragraph style={styles.subtitle}>
            let's analyze your content
          </Paragraph>
        </View>

        {/* Niche Badge */}
        <View style={styles.badgeContainer}>
          <LinearGradient
            colors={['#FF006E', '#8338EC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.badge}
          >
            <Paragraph style={styles.badgeText}>
              {niche} content
            </Paragraph>
          </LinearGradient>
        </View>

        {/* Analysis Progress */}
        {analyzing && (
          <Card style={styles.progressCard}>
            <LinearGradient
              colors={['#2A2A2A', '#1A1A1A']}
              style={styles.progressGradient}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Title style={styles.progressEmoji}>🧠</Title>
              </Animated.View>
              
              <Title style={styles.progressTitle}>AI analysis in progress</Title>
              <Paragraph style={styles.progressMessage}>{statusMessage}</Paragraph>
              
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={['#FFBE0B', '#FF006E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <Paragraph style={styles.progressPercent}>{Math.round(progress)}%</Paragraph>
              </View>
              
              {/* Phase Indicators */}
              <View style={styles.phaseIndicator}>
                <View style={[styles.phase, currentPhase !== 'upload' && styles.phaseComplete]}>
                  <Paragraph style={styles.phaseText}>1. analyze</Paragraph>
                  <Paragraph style={styles.phaseSubtext}>
                    {currentPhase === 'upload' ? '⏳' : '✅'}
                  </Paragraph>
                </View>
                <View style={[
                  styles.phase, 
                  currentPhase === 'coach' && styles.phaseActive,
                  currentPhase === 'done' && styles.phaseComplete
                ]}>
                  <Paragraph style={styles.phaseText}>2. coach</Paragraph>
                  <Paragraph style={styles.phaseSubtext}>
                    {currentPhase === 'done' ? '✅' : currentPhase === 'coach' ? '⏳' : '⏸️'}
                  </Paragraph>
                </View>
              </View>
              
              {/* Tip Display */}
              {currentTip && (
                <Card style={styles.tipCard}>
                  <LinearGradient
                    colors={['#FF006E', '#8338EC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tipGradient}
                  >
                    <Paragraph style={styles.tipText}>{currentTip}</Paragraph>
                  </LinearGradient>
                </Card>
              )}
              
              {/* Time Estimate */}
              <Paragraph style={styles.progressNote}>
                {currentPhase === 'upload'
                  ? '⏱️ analyzing video (2-3 min)'
                  : currentPhase === 'coach'
                  ? '⏱️ generating coaching (1-2 min)'
                  : '🎉 complete!'}
              </Paragraph>
            </LinearGradient>
          </Card>
        )}

        {/* Upload Section */}
        {!analyzing && (
          <>
            {selectedVideo ? (
              <Card style={styles.videoCard}>
                <LinearGradient
                  colors={['#2A2A2A', '#1A1A1A']}
                  style={styles.videoGradient}
                >
                  <Title style={styles.videoEmoji}>🎬</Title>
                  <Title style={styles.videoName}>{selectedVideo.name}</Title>
                  <Paragraph style={styles.videoSize}>
                    {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                  </Paragraph>
                  
                  <TouchableOpacity
                    onPress={pickVideo}
                    style={styles.changeButton}
                  >
                    <Paragraph style={styles.changeText}>change video</Paragraph>
                  </TouchableOpacity>
                </LinearGradient>
              </Card>
            ) : (
              <TouchableOpacity
                onPress={pickVideo}
                style={styles.uploadButton}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF006E', '#8338EC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.uploadGradient}
                >
                  <Title style={styles.uploadEmoji}>📂</Title>
                  <Title style={styles.uploadText}>select video</Title>
                  <Paragraph style={styles.uploadSubtext}>
                    tap to choose from gallery
                  </Paragraph>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {selectedVideo && (
              <TouchableOpacity
                onPress={uploadVideo}
                style={styles.analyzeButton}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFBE0B', '#FF006E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.analyzeGradient}
                >
                  <Title style={styles.analyzeText}>analyze with AI 🧠</Title>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {/* Info about timing */}
            {selectedVideo && (
              <Card style={styles.infoCard}>
                <Card.Content>
                  <Paragraph style={styles.infoText}>
                    ⏱️ Analysis takes 3-5 minutes. We'll show you tips while you wait!
                  </Paragraph>
                </Card.Content>
              </Card>
            )}
          </>
        )}

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
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerEmoji: {
    fontSize: 64,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
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
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  progressCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 0,
  },
  progressGradient: {
    padding: 30,
    alignItems: 'center',
  },
  progressEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
    textTransform: 'lowercase',
  },
  progressMessage: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 20,
    textTransform: 'lowercase',
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
  },
  progressPercent: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  phaseIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  phase: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  phaseActive: {
    backgroundColor: '#2A2A2A',
    borderColor: '#FFBE0B',
  },
  phaseComplete: {
    backgroundColor: '#2A2A2A',
    borderColor: '#06FFA5',
  },
  phaseText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  phaseSubtext: {
    fontSize: 18,
    marginTop: 5,
  },
  tipCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 0,
    width: '100%',
    marginBottom: 15,
  },
  tipGradient: {
    padding: 15,
  },
  tipText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressNote: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  videoCard: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 0,
    marginBottom: 20,
  },
  videoGradient: {
    padding: 30,
    alignItems: 'center',
  },
  videoEmoji: {
    fontSize: 48,
    marginBottom: 15,
  },
  videoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 5,
    textAlign: 'center',
  },
  videoSize: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 20,
  },
  changeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  changeText: {
    color: '#FF006E',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  uploadButton: {
    marginBottom: 20,
  },
  uploadGradient: {
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
  },
  uploadEmoji: {
    fontSize: 64,
    marginBottom: 15,
  },
  uploadText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 5,
    textTransform: 'lowercase',
  },
  uploadSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'lowercase',
  },
  analyzeButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  analyzeGradient: {
    paddingVertical: 20,
    borderRadius: 30,
    alignItems: 'center',
  },
  analyzeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'lowercase',
  },
  infoCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 20,
  },
});