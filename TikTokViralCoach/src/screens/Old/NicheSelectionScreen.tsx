/**
 * NicheSelectionScreen - Updated (No Scraping)
 * Instant niche selection, goes straight to video upload
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { ApiService, StorageService } from '../services/ApiService';

const POPULAR_NICHES = [
  { name: 'GRWM', emoji: '💄', color: '#FF006E' },
  { name: 'Cooking', emoji: '👨‍🍳', color: '#FFBE0B' },
  { name: 'Fitness', emoji: '💪', color: '#06FFA5' },
  { name: 'Comedy', emoji: '😂', color: '#8338EC' },
  { name: 'Beauty', emoji: '✨', color: '#FF006E' },
  { name: 'Dance', emoji: '💃', color: '#3A86FF' },
  { name: 'DITL', emoji: '📱', color: '#FFBE0B' },
  { name: 'Tutorial', emoji: '📚', color: '#06FFA5' },
  { name: 'Gaming', emoji: '🎮', color: '#8338EC' },
  { name: 'Fashion', emoji: '👗', color: '#FF006E' },
];

export default function NicheSelectionScreen({ navigation }: any) {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!niche.trim()) {
      Alert.alert('oops! 👀', 'pick a niche first bestie');
      return;
    }

    setLoading(true);

    try {
      // Just register the niche (no scraping)
      const result = await ApiService.selectNiche(niche);
      
      // Save niche and job_id
      await StorageService.saveNiche(niche);
      if (result.job_id) {
        await StorageService.saveJobId(result.job_id);
      }

      // Go straight to video upload (no scraping screen)
      navigation.navigate('VideoUpload', {
        jobId: result.job_id,
        niche: niche,
      });

    } catch (error: any) {
      Alert.alert('error ://', error.message || 'something went wrong');
    } finally {
      setLoading(false);
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
          <Title style={styles.headerEmoji}>🎯</Title>
          <Title style={styles.title}>pick your vibe</Title>
          <Paragraph style={styles.subtitle}>
            what content do you make?
          </Paragraph>
        </View>

        {/* Custom Input */}
        <Card style={styles.inputCard}>
          <RNTextInput
            value={niche}
            onChangeText={setNiche}
            placeholder="type your niche..."
            placeholderTextColor="#666"
            style={styles.input}
          />
        </Card>

        {/* Popular Niches */}
        <Paragraph style={styles.sectionTitle}>or choose one 👇</Paragraph>
        
        <View style={styles.nicheGrid}>
          {POPULAR_NICHES.map((item) => (
            <TouchableOpacity
              key={item.name}
              onPress={() => setNiche(item.name)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={niche === item.name ? [item.color, '#8338EC'] : ['#2A2A2A', '#1A1A1A']}
                style={[
                  styles.nicheChip,
                  niche === item.name && styles.nicheChipSelected
                ]}
              >
                <Title style={styles.nicheEmoji}>{item.emoji}</Title>
                <Paragraph style={styles.nicheText}>{item.name}</Paragraph>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <LinearGradient
            colors={['#2A2A2A', '#1A1A1A']}
            style={styles.infoGradient}
          >
            <Title style={styles.infoTitle}>what happens next 👀</Title>
            
            <View style={styles.infoItem}>
              <Paragraph style={styles.infoEmoji}>📹</Paragraph>
              <Paragraph style={styles.infoText}>
                upload your tiktok video
              </Paragraph>
            </View>
            
            <View style={styles.infoItem}>
              <Paragraph style={styles.infoEmoji}>🧠</Paragraph>
              <Paragraph style={styles.infoText}>
                ai analyzes your content
              </Paragraph>
            </View>
            
            <View style={styles.infoItem}>
              <Paragraph style={styles.infoEmoji}>🔥</Paragraph>
              <Paragraph style={styles.infoText}>
                compare with viral videos
              </Paragraph>
            </View>
            
            <View style={styles.infoItem}>
              <Paragraph style={styles.infoEmoji}>🚀</Paragraph>
              <Paragraph style={styles.infoText}>
                get personalized tips to go viral
              </Paragraph>
            </View>
          </LinearGradient>
        </Card>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!niche.trim() || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={!niche.trim() || loading ? ['#444', '#333'] : ['#FFBE0B', '#FF006E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <Title style={styles.continueButtonText}>
              {loading ? 'loading... ⏳' : 'continue 🚀'}
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
  inputCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    marginBottom: 30,
    elevation: 0,
  },
  input: {
    padding: 20,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
    textTransform: 'lowercase',
  },
  nicheGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  nicheChip: {
    width: 105,
    padding: 15,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  nicheChipSelected: {
    shadowColor: '#FF006E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  nicheEmoji: {
    fontSize: 32,
    marginBottom: 5,
  },
  nicheText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    marginBottom: 30,
    overflow: 'hidden',
    elevation: 0,
  },
  infoGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
    textTransform: 'lowercase',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoEmoji: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#B0B0B0',
    flex: 1,
    textTransform: 'lowercase',
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
