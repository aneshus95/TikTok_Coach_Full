/**
 * Scraping Screen
 * Shows real-time progress of viral video scraping
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Title,
  Paragraph,
  ProgressBar,
  Card,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService } from '../services/ApiService';
import LoadingAnimation from '../components/LoadingAnimation';

export default function ScrapingScreen({ route, navigation }: any) {
  const { jobId, niche, videoCount } = route.params;
  
  const [status, setStatus] = useState('starting');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initializing...');
  const [videosFetched, setVideosFetched] = useState(0);

  useEffect(() => {
    // Poll for status updates
    const pollInterval = setInterval(async () => {
      try {
        const result = await ApiService.checkScrapingStatus(jobId);
        
        setStatus(result.status);
        setProgress((result.data?.progress || 0) / 100);
        setMessage(result.data?.message || 'Processing...');
        setVideosFetched(result.data?.video_count || 0);

        // If complete, navigate to video upload
        if (result.status === 'complete') {
          clearInterval(pollInterval);
          setTimeout(() => {
            navigation.navigate('VideoUpload', {
              jobId,
              niche,
              viralCount: result.data?.video_count,
            });
          }, 2000);
        }

        // If error, show alert
        if (result.status === 'error') {
          clearInterval(pollInterval);
          Alert.alert(
            'Error',
            result.data?.message || 'Scraping failed',
            [
              {
                text: 'Try Again',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        }

      } catch (error: any) {
        if (__DEV__) console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, navigation]);

  const getStatusIcon = () => {
    switch (status) {
      case 'scraping':
        return '🔍';
      case 'analyzing':
        return '🧠';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'scraping':
        return 'Finding Viral Videos';
      case 'analyzing':
        return 'Analyzing Content';
      case 'complete':
        return 'Analysis Complete!';
      case 'error':
        return 'Error Occurred';
      default:
        return 'Starting...';
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.content}>
        
        {/* Status Card */}
        <Card style={styles.card}>
          <Card.Content>
            
            {/* Icon and Title */}
            <View style={styles.statusHeader}>
              <Title style={styles.statusIcon}>{getStatusIcon()}</Title>
              <Title style={styles.statusTitle}>{getStatusTitle()}</Title>
            </View>

            {/* Progress Info */}
            <View style={styles.infoContainer}>
              <Paragraph style={styles.infoLabel}>Niche:</Paragraph>
              <Paragraph style={styles.infoValue}>{niche}</Paragraph>
            </View>

            <View style={styles.infoContainer}>
              <Paragraph style={styles.infoLabel}>Target videos:</Paragraph>
              <Paragraph style={styles.infoValue}>{videoCount}</Paragraph>
            </View>

            {videosFetched > 0 && (
              <View style={styles.infoContainer}>
                <Paragraph style={styles.infoLabel}>Videos fetched:</Paragraph>
                <Paragraph style={styles.infoValue}>{videosFetched}</Paragraph>
              </View>
            )}

            {/* Progress Bar */}
            <ProgressBar
              progress={progress}
              color="#667eea"
              style={styles.progressBar}
            />

            <Paragraph style={styles.progressText}>
              {Math.round(progress * 100)}% Complete
            </Paragraph>

            {/* Status Message */}
            <Card style={styles.messageCard}>
              <Card.Content>
                <Paragraph style={styles.message}>{message}</Paragraph>
              </Card.Content>
            </Card>

            {/* Loading Indicator */}
            {status !== 'complete' && status !== 'error' && (
              <LoadingAnimation size={120} />
            )}

          </Card.Content>
        </Card>

        {/* Tips Card */}
        {status === 'scraping' && (
          <Card style={styles.tipCard}>
            <Card.Content>
              <Title style={styles.tipTitle}>💡 Did you know?</Title>
              <Paragraph style={styles.tipText}>
                We analyze viral videos for hook strategies, editing techniques, 
                audio choices, and engagement tactics to give you the most 
                comprehensive coaching possible!
              </Paragraph>
            </Card.Content>
          </Card>
        )}

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    elevation: 4,
    padding: 10,
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    fontSize: 64,
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: 'bold',
  },
  progressBar: {
    marginVertical: 20,
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  messageCard: {
    backgroundColor: '#f0f0f0',
    marginVertical: 15,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loader: {
    marginTop: 20,
  },
  tipCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    elevation: 2,
  },
  tipTitle: {
    fontSize: 18,
    marginBottom: 10,
    color: '#667eea',
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
