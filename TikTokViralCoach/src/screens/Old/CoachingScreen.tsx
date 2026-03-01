/**
 * CoachingScreen - Gen Z Edition
 * Modern, engaging coaching results display
 */

import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService } from '../services/ApiService';

export default function CoachingScreen({ route, navigation }: any) {
  const { jobId, niche, analysisId } = route.params;
  
  const [coaching, setCoaching] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateCoaching();
  }, []);

  const generateCoaching = async () => {
    try {
      const response = await ApiService.generateCoaching({
        niche,
        analysis_id: analysisId,
        job_id: jobId,
      });
      
      setCoaching(response.coaching);
    } catch (error: any) {
      console.error('Coaching generation failed:', error);
      setCoaching('oops! failed to generate coaching. try again?');
    } finally {
      setLoading(false);
    }
  };

  const sections = parseCoaching(coaching);

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
          <Title style={styles.headerEmoji}>🎯</Title>
          <Title style={styles.title}>your coaching</Title>
          <Paragraph style={styles.subtitle}>
            personalized tips to go viral
          </Paragraph>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF006E" />
            <Paragraph style={styles.loadingText}>
              cooking up your tips... 🧠
            </Paragraph>
          </View>
        ) : (
          <>
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

            {/* Coaching Content */}
            {sections.map((section, index) => (
              <Card key={index} style={styles.sectionCard}>
                <LinearGradient
                  colors={['#2A2A2A', '#1A1A1A']}
                  style={styles.sectionGradient}
                >
                  {section.emoji && (
                    <Title style={styles.sectionEmoji}>{section.emoji}</Title>
                  )}
                  
                  {section.title && (
                    <Title style={styles.sectionTitle}>{section.title}</Title>
                  )}
                  
                  <Paragraph style={styles.sectionText}>
                    {section.content}
                  </Paragraph>
                </LinearGradient>
              </Card>
            ))}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              
              <TouchableOpacity
                onPress={() => navigation.navigate('Chat', { niche, coaching })}
                activeOpacity={0.8}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={['#06FFA5', '#3A86FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionButton}
                >
                  <Title style={styles.actionButtonText}>
                    ask questions 💬
                  </Title>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.popToTop()}
                activeOpacity={0.8}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={['#2A2A2A', '#1A1A1A']}
                  style={[styles.actionButton, styles.secondaryButton]}
                >
                  <Title style={styles.secondaryButtonText}>
                    analyze another 🔄
                  </Title>
                </LinearGradient>
              </TouchableOpacity>
              
            </View>

          </>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

// Helper function to parse coaching into sections
function parseCoaching(text: string): Array<{emoji?: string, title?: string, content: string}> {
  if (!text) return [];
  
  const sections: Array<{emoji?: string, title?: string, content: string}> = [];
  
  // Split by common section headers
  const lines = text.split('\n');
  let currentSection: {emoji?: string, title?: string, content: string} = { content: '' };
  
  // Emoji mapping for common headers
  const emojiMap: {[key: string]: string} = {
    'working': '✅',
    'strengths': '💪',
    'gaps': '⚠️',
    'improvements': '🚀',
    'actions': '🎯',
    'blueprint': '📋',
    'formula': '🔥',
    'hashtag': '#️⃣',
    'tips': '💡',
    'strategy': '🎨',
  };
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Check if it's a header
    const isHeader = trimmed.startsWith('#') || 
                    trimmed.startsWith('**') || 
                    /^[A-Z\s]+:/.test(trimmed) ||
                    /^\d+\./.test(trimmed);
    
    if (isHeader && currentSection.content) {
      sections.push(currentSection);
      currentSection = { content: '' };
    }
    
    if (isHeader) {
      // Extract title
      let title = trimmed.replace(/^#+\s*/, '')
                        .replace(/^\*\*/, '')
                        .replace(/\*\*$/, '')
                        .replace(/:\s*$/, '')
                        .toLowerCase();
      
      // Find matching emoji
      let emoji = '';
      for (const [key, value] of Object.entries(emojiMap)) {
        if (title.includes(key)) {
          emoji = value;
          break;
        }
      }
      
      currentSection.title = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      currentSection.emoji = emoji;
    } else if (trimmed) {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
    }
  });
  
  if (currentSection.content) {
    sections.push(currentSection);
  }
  
  return sections.length > 0 ? sections : [{ content: text }];
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
  loadingContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 20,
    color: '#B0B0B0',
    fontSize: 16,
    textTransform: 'lowercase',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  badge: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  sectionCard: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 0,
  },
  sectionGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 20,
  },
  sectionEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFBE0B',
    marginBottom: 15,
    textTransform: 'lowercase',
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  actionButtons: {
    marginTop: 20,
  },
  buttonWrapper: {
    marginBottom: 15,
  },
  actionButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#06FFA5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#333',
    shadowOpacity: 0,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  secondaryButtonText: {
    color: '#B0B0B0',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
});
