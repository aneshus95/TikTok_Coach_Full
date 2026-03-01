/**
 * HomeScreen - Gen Z Edition
 * Modern, vibrant, TikTok-inspired design
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {
  Title,
  Paragraph,
  Button,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

export default function HomeScreen({ navigation }: any) {
  const pulseAnim = new Animated.Value(1);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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
  }, []);

  return (
    <LinearGradient
      colors={['#FF006E', '#8338EC', '#3A86FF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        
        {/* Animated Logo/Icon */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.logo}>
            <Title style={styles.logoEmoji}>🚀</Title>
          </View>
        </Animated.View>

        {/* Title with Gradient Effect */}
        <View style={styles.titleContainer}>
          <Title style={styles.title}>TikTok</Title>
          <Title style={styles.titleGlow}>Viral Coach</Title>
        </View>

        {/* Tagline */}
        <Paragraph style={styles.tagline}>
          go viral or go home 💅
        </Paragraph>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Title style={styles.featureEmoji}>🔥</Title>
            <Paragraph style={styles.featureText}>Find Viral Trends</Paragraph>
          </View>
          
          <View style={styles.featureItem}>
            <Title style={styles.featureEmoji}>🤖</Title>
            <Paragraph style={styles.featureText}>AI Coaching</Paragraph>
          </View>
          
          <View style={styles.featureItem}>
            <Title style={styles.featureEmoji}>📈</Title>
            <Paragraph style={styles.featureText}>Boost Engagement</Paragraph>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('NicheSelection')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFBE0B', '#FF006E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Title style={styles.buttonText}>let's gooo 🎯</Title>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom Text */}
        <Paragraph style={styles.bottomText}>
          join 10k+ creators going viral
        </Paragraph>

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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  logoEmoji: {
    fontSize: 64,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
    letterSpacing: -2,
  },
  titleGlow: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFBE0B',
    textShadowColor: '#FF006E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginTop: -10,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 40,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 50,
  },
  featureItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 15,
    minWidth: 100,
    backdropFilter: 'blur(10px)',
  },
  featureEmoji: {
    fontSize: 32,
    marginBottom: 5,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 30,
    shadowColor: '#FFBE0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  bottomText: {
    marginTop: 30,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
});
