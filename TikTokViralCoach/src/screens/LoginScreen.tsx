/**
 * LoginScreen - Content Flow Edition
 * Email or phone login with OTP verification
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/ApiService';

type LoginStep = 'input' | 'otp';
type InputMode = 'email' | 'phone';

export default function LoginScreen({ navigation }: any) {
  const [step, setStep] = useState<LoginStep>('input');
  const [inputMode, setInputMode] = useState<InputMode>('email');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardFade = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const transitionCard = (callback: () => void) => {
    Animated.timing(cardFade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(cardFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const sendOtp = async () => {
    const trimmed = contact.trim();
    if (!trimmed) {
      Alert.alert('Required', `Please enter your ${inputMode === 'email' ? 'email address' : 'phone number'}.`);
      return;
    }
    setLoading(true);
    try {
      const response = await ApiService.sendOtp(trimmed, inputMode);
      if (__DEV__ && response.dev_otp) {
        setOtp(response.dev_otp);
      }
      transitionCard(() => setStep('otp'));
    } catch (e: any) {
      Alert.alert('Error', e.userMessage || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Enter Code', 'Please enter the verification code.');
      return;
    }
    setLoading(true);
    try {
      const result = await ApiService.verifyOtp(contact.trim(), otp.trim(), inputMode);
      await AsyncStorage.setItem('auth_token', result.token);
      await AsyncStorage.setItem('user_id', result.user_id);
      await AsyncStorage.setItem('user_contact', contact.trim());
      if (result.tier) await AsyncStorage.setItem('user_tier', result.tier);
      navigation.replace('Dashboard');
    } catch (e: any) {
      Alert.alert('Invalid Code', 'The code you entered is incorrect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.15] });

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      {/* Background glow */}
      <Animated.View style={[styles.bgGlow, { opacity: glowOpacity }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo area */}
          <Animated.View
            style={[styles.logoArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <LinearGradient colors={['#00D4FF', '#00FFB3']} style={styles.logoOrb}>
              <Paragraph style={styles.logoSymbol}>⚡</Paragraph>
            </LinearGradient>
            <Title style={styles.appName}>CONTENT FLOW</Title>
            <Paragraph style={styles.tagline}>Your TikTok growth engine</Paragraph>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, { opacity: cardFade }]}>
            {step === 'input' ? (
              <>
                {/* Email / Phone toggle */}
                <View style={styles.toggle}>
                  {(['email', 'phone'] as InputMode[]).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.toggleBtn, inputMode === mode && styles.toggleBtnActive]}
                      onPress={() => {
                        setInputMode(mode);
                        setContact('');
                      }}
                      activeOpacity={0.75}
                    >
                      {inputMode === mode && (
                        <LinearGradient
                          colors={['#00D4FF20', '#00FFB315']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Paragraph
                        style={[styles.toggleBtnText, inputMode === mode && styles.toggleBtnTextActive]}
                      >
                        {mode === 'email' ? '✉️  Email' : '📱  Phone'}
                      </Paragraph>
                    </TouchableOpacity>
                  ))}
                </View>

                <Paragraph style={styles.label}>
                  {inputMode === 'email' ? 'EMAIL ADDRESS' : 'PHONE NUMBER'}
                </Paragraph>
                <TextInput
                  style={styles.input}
                  value={contact}
                  onChangeText={setContact}
                  placeholder={inputMode === 'email' ? 'you@example.com' : '+1 234 567 8900'}
                  placeholderTextColor="#334155"
                  keyboardType={inputMode === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Paragraph style={styles.helperText}>
                  We'll send a 6-digit verification code to confirm your identity.
                </Paragraph>

                <TouchableOpacity onPress={sendOtp} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#00D4FF', '#00FFB3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.btn, loading && styles.btnDisabled]}
                  >
                    <Paragraph style={styles.btnText}>
                      {loading ? 'SENDING...' : 'SEND CODE  →'}
                    </Paragraph>
                  </LinearGradient>
                  <View style={styles.btnGlow} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.otpHeader}>
                  <View style={styles.otpIconWrap}>
                    <Paragraph style={styles.otpIcon}>
                      {inputMode === 'email' ? '✉️' : '📱'}
                    </Paragraph>
                  </View>
                  <Title style={styles.otpTitle}>Check your {inputMode}</Title>
                  <Paragraph style={styles.otpSubtitle}>
                    We sent a 6-digit code to{'\n'}
                    <Paragraph style={styles.contactHighlight}>{contact}</Paragraph>
                  </Paragraph>
                </View>

                <Paragraph style={styles.label}>VERIFICATION CODE</Paragraph>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="• • • • • •"
                  placeholderTextColor="#334155"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                <TouchableOpacity onPress={verifyOtp} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient
                    colors={['#00D4FF', '#00FFB3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.btn, loading && styles.btnDisabled]}
                  >
                    <Paragraph style={styles.btnText}>
                      {loading ? 'VERIFYING...' : 'VERIFY & LOGIN  →'}
                    </Paragraph>
                  </LinearGradient>
                  <View style={styles.btnGlow} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => transitionCard(() => { setStep('input'); setOtp(''); })}
                  style={styles.backLink}
                  activeOpacity={0.7}
                >
                  <Paragraph style={styles.backLinkText}>← Change {inputMode}</Paragraph>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={sendOtp}
                  style={styles.resendLink}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Paragraph style={styles.resendLinkText}>Resend code</Paragraph>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <View style={styles.activeDot} />
            <Paragraph style={styles.footerText}>10,000+ creators growing right now</Paragraph>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#00D4FF',
  },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoOrb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#00D4FF',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  logoSymbol: { fontSize: 34, fontWeight: '900', color: '#050810', lineHeight: 42 },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#E2F0FF',
    letterSpacing: 4,
    marginBottom: 6,
  },
  tagline: { fontSize: 14, color: '#64748B' },

  // Card
  card: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
  },

  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#050810',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 24,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleBtnActive: {},
  toggleBtnText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  toggleBtnTextActive: { color: '#00D4FF' },

  // Input
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#E2F0FF',
    marginBottom: 14,
  },
  helperText: { fontSize: 12, color: '#64748B', marginBottom: 22, lineHeight: 18 },

  // OTP step
  otpHeader: { alignItems: 'center', marginBottom: 28 },
  otpIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#00D4FF15',
    borderWidth: 1,
    borderColor: '#00D4FF30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  otpIcon: { fontSize: 28, lineHeight: 36 },
  otpTitle: { fontSize: 22, fontWeight: '900', color: '#E2F0FF', marginBottom: 8 },
  otpSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  contactHighlight: { color: '#00D4FF', fontWeight: '700' },
  otpInput: { textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: 8 },

  // Button
  btn: {
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 14, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  btnGlow: {
    height: 16,
    marginHorizontal: 40,
    borderRadius: 8,
    backgroundColor: '#00D4FF',
    opacity: 0.15,
    marginTop: -4,
    marginBottom: 4,
  },

  // Links
  backLink: { alignItems: 'center', paddingVertical: 12 },
  backLinkText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  resendLink: { alignItems: 'center', paddingVertical: 8 },
  resendLinkText: { fontSize: 13, color: '#00D4FF', fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFB3',
    marginRight: 8,
    shadowColor: '#00FFB3',
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  footerText: { fontSize: 13, color: '#64748B' },
});
