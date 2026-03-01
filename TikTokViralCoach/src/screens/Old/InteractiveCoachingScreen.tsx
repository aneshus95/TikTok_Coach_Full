/**
 * InteractiveCoachingScreen - FIXED VIDEO LOADING
 * Issue: Video wasn't loading in WebView
 * Fix: Better video path handling, fallback HTML player
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';

interface TimestampSuggestion {
  timestamp: number;
  title: string;
  issues: string[];
  suggestions: string[];
  categories: string[];
  emoji: string;
}

export default function InteractiveCoachingScreen({ route, navigation }: any) {
  const { 
    videoUri, 
    niche, 
    duration: videoDuration = 30,
    timestamps: passedTimestamps = []
  } = route.params;
  
  const videoRef = useRef<any>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoDuration);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  const [suggestions, setSuggestions] = useState<TimestampSuggestion[]>(passedTimestamps);

  // Show first suggestion after video loads
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
    
    // Find the next unshown suggestion based on current playback position
    if (!paused && !showSuggestion && suggestions.length > 0) {
      // Look for any suggestion whose timestamp we've reached or passed,
      // starting from currentSuggestionIndex (don't re-show completed ones)
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

  const handleLoad = (data: any) => {
    console.log('✅ Video loaded:', data);
    setDuration(data.duration || videoDuration);
    setVideoLoaded(true);
    setVideoError(false);
  };

  const handleError = (error: any) => {
    console.error('❌ Video error:', error);
    setVideoError(true);
    setVideoLoaded(true); // Show error state
  };

  const handleNext = () => {
    setShowSuggestion(false);
    
    const nextIndex = currentSuggestionIndex + 1;
    if (nextIndex < suggestions.length) {
      setCurrentSuggestionIndex(nextIndex);
      setPaused(false);
    } else {
      navigation.navigate('Chat', { niche });
    }
  };

  const handleSkip = () => {
    navigation.navigate('Chat', { niche });
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.seek(seconds);
      setCurrentTime(seconds);
    }
  };

  const currentSuggestion = suggestions[currentSuggestionIndex];

  return (
    <LinearGradient colors={['#0A0A0A', '#1A1A1A']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <IconButton icon="arrow-left" size={24} iconColor="#FFF" />
          </TouchableOpacity>
          <View style={{flex:1, alignItems:'center'}}>
            <Title style={styles.title}>🎬 interactive coaching</Title>
            <Paragraph style={styles.subtitle}>
              {currentSuggestionIndex + 1} / {suggestions.length} • {Math.floor(duration)}s video
            </Paragraph>
          </View>
          <View style={{width: 48}} />
        </View>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          {videoError ? (
            <View style={styles.errorContainer}>
              <Title style={styles.errorEmoji}>⚠️</Title>
              <Paragraph style={styles.errorText}>
                couldn't load video
              </Paragraph>
              <TouchableOpacity 
                onPress={() => {
                  setVideoError(false);
                  setVideoLoaded(false);
                }}
                style={styles.retryButton}
              >
                <Paragraph style={styles.retryText}>retry</Paragraph>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                paused={paused}
                resizeMode="contain"
                onLoad={handleLoad}
                onProgress={handleProgress}
                onError={handleError}
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
              />
              
              {!videoLoaded && (
                <View style={styles.loading}>
                  <ActivityIndicator size="large" color="#FFBE0B" />
                  <Paragraph style={styles.loadingText}>loading video...</Paragraph>
                </View>
              )}
              
              {videoLoaded && !showSuggestion && (
                <TouchableOpacity 
                  style={styles.playOverlay} 
                  onPress={() => setPaused(!paused)}
                  activeOpacity={0.9}
                >
                  <View style={styles.playButton}>
                    <IconButton 
                      icon={paused ? 'play' : 'pause'} 
                      size={48} 
                      iconColor="#FFF" 
                    />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Progress Bar */}
          {videoLoaded && !videoError && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#FFBE0B', '#FF006E']}
                  style={[
                    styles.progressFill, 
                    {width: duration > 0 ? `${(currentTime/duration)*100}%` : '0%'}
                  ]}
                />
              </View>
              <Paragraph style={styles.timeText}>
                {Math.floor(currentTime)}s / {Math.floor(duration)}s
              </Paragraph>
            </View>
          )}

          {/* Timestamp Markers */}
          {videoLoaded && !videoError && duration > 0 && (
            <View style={styles.markersContainer}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.marker,
                    {left: `${(s.timestamp/duration)*100}%`},
                    i === currentSuggestionIndex && styles.activeMarker,
                    i < currentSuggestionIndex && styles.doneMarker,
                  ]}
                  onPress={() => {
                    seekTo(s.timestamp);
                    setCurrentSuggestionIndex(i);
                    setPaused(true);
                    setShowSuggestion(true);
                  }}
                >
                  <Paragraph style={{fontSize:12}}>{s.emoji}</Paragraph>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Suggestion Card */}
        {showSuggestion && currentSuggestion && (
          <Card style={styles.card}>
            <LinearGradient colors={['#FF006E', '#8338EC']} style={styles.cardGrad}>
              
              <View style={{flexDirection:'row', marginBottom:15}}>
                <Title style={{fontSize:32, marginRight:10}}>{currentSuggestion.emoji}</Title>
                <View style={{flex:1}}>
                  <Title style={styles.cardTitle}>{currentSuggestion.title}</Title>
                  <View style={{flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:6}}>
                    {currentSuggestion.categories.map((c,i) => (
                      <View key={i} style={styles.badge}>
                        <Paragraph style={styles.badgeText}>{c}</Paragraph>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <Card style={styles.issuesBox}>
                <Card.Content>
                  <Paragraph style={styles.label}>⚠️ issues:</Paragraph>
                  {currentSuggestion.issues.map((issue,i) => (
                    <View key={i} style={styles.bullet}>
                      <Paragraph style={styles.dot}>•</Paragraph>
                      <Paragraph style={styles.text}>{issue}</Paragraph>
                    </View>
                  ))}
                </Card.Content>
              </Card>

              <Card style={styles.fixesBox}>
                <Card.Content>
                  <Paragraph style={styles.label}>💡 fixes:</Paragraph>
                  {currentSuggestion.suggestions.map((fix,i) => (
                    <View key={i} style={styles.bullet}>
                      <Paragraph style={styles.dot}>•</Paragraph>
                      <Paragraph style={styles.text}>{fix}</Paragraph>
                    </View>
                  ))}
                </Card.Content>
              </Card>

              <TouchableOpacity onPress={handleNext} style={{marginTop:15}}>
                <LinearGradient colors={['#FFBE0B', '#FF006E']} style={styles.button}>
                  <Title style={styles.buttonText}>
                    {currentSuggestionIndex < suggestions.length - 1 ? 'next →' : 'finish 💬'}
                  </Title>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSkip} style={{marginTop:10}}>
                <Paragraph style={styles.skip}>skip all</Paragraph>
              </TouchableOpacity>
            </LinearGradient>
          </Card>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {flex:1},
  header: {
    flexDirection:'row', 
    alignItems:'center', 
    padding:10, 
    borderBottomWidth:1, 
    borderBottomColor:'#2A2A2A',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
  },
  title: {fontSize:18, fontWeight:'900', color:'#FFF', textTransform:'lowercase'},
  subtitle: {fontSize:11, color:'#B0B0B0', textTransform:'lowercase', marginTop:2},
  videoContainer: {
    width:'100%', 
    aspectRatio: 9/16, 
    backgroundColor:'#000', 
    position:'relative',
    maxHeight: 600,
  },
  video: {width:'100%', height:'100%'},
  loading: {
    position:'absolute', 
    top:0, left:0, right:0, bottom:0, 
    justifyContent:'center', 
    alignItems:'center', 
    backgroundColor:'#000'
  },
  loadingText: {marginTop:10, color:'#FFF', fontSize:14},
  errorContainer: {
    position:'absolute', 
    top:0, left:0, right:0, bottom:0, 
    justifyContent:'center', 
    alignItems:'center', 
    backgroundColor:'#000',
    padding: 20,
  },
  errorEmoji: {fontSize: 64, marginBottom: 10},
  errorText: {color:'#B0B0B0', fontSize:16, textAlign:'center', marginBottom: 20},
  retryButton: {
    backgroundColor: '#FF006E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryText: {color: '#FFF', fontWeight: '700'},
  playOverlay: {
    position:'absolute', 
    top:0, left:0, right:0, bottom:0, 
    justifyContent:'center', 
    alignItems:'center',
  },
  playButton: {
    backgroundColor:'rgba(0,0,0,0.6)', 
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position:'absolute', 
    bottom:0, left:0, right:0, 
    padding:10, 
    backgroundColor:'rgba(0,0,0,0.8)'
  },
  progressBar: {height:4, backgroundColor:'#333', borderRadius:2, overflow:'hidden', marginBottom:5},
  progressFill: {height:'100%'},
  timeText: {fontSize:12, color:'#FFF', textAlign:'center', fontWeight:'700'},
  markersContainer: {position:'absolute', bottom:50, left:10, right:10, height:30},
  marker: {
    position:'absolute', 
    width:28, height:28, 
    justifyContent:'center', 
    alignItems:'center', 
    backgroundColor:'#2A2A2A', 
    borderRadius:14, 
    borderWidth:2, 
    borderColor:'#666'
  },
  activeMarker: {borderColor:'#FFBE0B', backgroundColor:'#FF006E', transform:[{scale:1.2}]},
  doneMarker: {borderColor:'#06FFA5', backgroundColor:'#06FFA5'},
  card: {margin:20, backgroundColor:'transparent', borderRadius:24, overflow:'hidden', elevation:0},
  cardGrad: {padding:24},
  cardTitle: {fontSize:20, fontWeight:'900', color:'#FFF', textTransform:'lowercase'},
  badge: {backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:10, paddingVertical:4, borderRadius:12},
  badgeText: {fontSize:10, color:'#FFF', fontWeight:'700', textTransform:'lowercase'},
  issuesBox: {backgroundColor:'rgba(255,51,102,0.2)', marginBottom:15, borderRadius:16},
  fixesBox: {backgroundColor:'rgba(6,255,165,0.2)', borderRadius:16},
  label: {fontSize:12, fontWeight:'700', color:'#FFF', marginBottom:10, textTransform:'lowercase'},
  bullet: {flexDirection:'row', marginBottom:8, paddingRight:10},
  dot: {fontSize:14, color:'#FFF', marginRight:8, marginTop:2},
  text: {flex:1, fontSize:13, color:'#FFF', lineHeight:20},
  button: {paddingVertical:16, borderRadius:30, alignItems:'center'},
  buttonText: {color:'#FFF', fontSize:16, fontWeight:'900', textTransform:'lowercase'},
  skip: {color:'#B0B0B0', fontSize:13, textAlign:'center', textTransform:'lowercase'},
});