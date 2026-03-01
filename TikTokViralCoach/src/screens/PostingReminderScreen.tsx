/**
 * PostingReminderScreen - Content Flow Edition
 * Daily posting reminders at optimal engagement time
 * Integrates with NotificationService for push notifications
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import { NotificationService, type ReminderSettings } from '../services/NotificationService';

// Time slot presets — key posting windows for creators
const TIME_PRESETS = [
  { label: '6 AM',  sublabel: 'Early risers',    hour: 6,  minute: 0 },
  { label: '12 PM', sublabel: 'Lunch peak',       hour: 12, minute: 0 },
  { label: '3 PM',  sublabel: 'Afternoon surge',  hour: 15, minute: 0 },
  { label: '7 PM',  sublabel: 'Prime time ⭐',    hour: 19, minute: 0 },
  { label: '9 PM',  sublabel: 'Night crowd',      hour: 21, minute: 0 },
];

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  route: any;
  navigation: any;
}

export default function PostingReminderScreen({ route, navigation }: Props) {
  const niche = route?.params?.niche ?? '';
  const optimalTimeRaw: string = route?.params?.optimalTime ?? '7-9 PM';

  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    hour: 19,
    minute: 0,
    niche,
    optimalTime: '7:00 PM',
  });
  const [selectedPreset, setSelectedPreset] = useState(3); // 7 PM default
  const [activeDays, setActiveDays] = useState([0, 1, 2, 3, 4, 5, 6]); // all days
  const [saving, setSaving] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadExistingSettings();

    // If an optimalTime was passed from analysis, parse and auto-select it
    if (optimalTimeRaw) {
      const parsed = NotificationService.parseOptimalTime(optimalTimeRaw);
      const closestPreset = TIME_PRESETS.reduce((best, p, i) =>
        Math.abs(p.hour - parsed.hour) < Math.abs(TIME_PRESETS[best].hour - parsed.hour) ? i : best, 0
      );
      setSelectedPreset(closestPreset);
      setSettings(prev => ({
        ...prev,
        hour: TIME_PRESETS[closestPreset].hour,
        minute: TIME_PRESETS[closestPreset].minute,
        optimalTime: TIME_PRESETS[closestPreset].label,
        niche,
      }));
    }
  }, []);

  useEffect(() => {
    if (settings.enabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [settings.enabled]);

  const loadExistingSettings = async () => {
    const saved = await NotificationService.loadSettings();
    if (saved.enabled) {
      setSettings(saved);
      const idx = TIME_PRESETS.findIndex(p => p.hour === saved.hour);
      if (idx !== -1) setSelectedPreset(idx);
      if (saved.activeDays) setActiveDays(saved.activeDays);
    }
  };

  const selectPreset = (index: number) => {
    const p = TIME_PRESETS[index];
    setSelectedPreset(index);
    setSettings(prev => ({
      ...prev,
      hour: p.hour,
      minute: p.minute,
      optimalTime: p.label,
    }));
  };

  const toggleDay = (dayIndex: number) => {
    setActiveDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleToggleReminder = async (value: boolean) => {
    if (value) {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications Blocked',
          'Please enable notifications in your device Settings to use daily reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setSettings(prev => ({ ...prev, enabled: value }));
  };

  const saveReminder = async () => {
    if (settings.enabled && activeDays.length === 0) {
      Alert.alert('No Days Selected', 'Please select at least one day for your reminder.');
      return;
    }
    setSaving(true);
    try {
      if (settings.enabled) {
        const success = await NotificationService.scheduleDailyReminder({
          ...settings,
          niche,
          activeDays,
        });
        if (success) {
          const dayLabel = activeDays.length === 7
            ? 'every day'
            : `on ${activeDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`;
          Alert.alert(
            'Reminder Set!',
            `You'll be reminded to post at ${settings.optimalTime} ${dayLabel}.`,
            [{ text: 'Got it' }]
          );
        } else {
          Alert.alert('Failed', 'Could not schedule reminder. Check notification permissions.');
        }
      } else {
        await NotificationService.cancelReminder();
        Alert.alert('Reminder Disabled', 'Your daily posting reminder has been turned off.');
      }
    } finally {
      setSaving(false);
    }
  };

  const preset = TIME_PRESETS[selectedPreset];

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Paragraph style={styles.backIcon}>←</Paragraph>
            </TouchableOpacity>
            <View style={styles.headerBadge}>
              <View style={styles.headerDot} />
              <Paragraph style={styles.headerBadgeText}>POSTING SCHEDULE</Paragraph>
            </View>
          </View>
          <Title style={styles.title}>Daily Reminder</Title>
          <Paragraph style={styles.subtitle}>
            Post at your peak time — every single day
          </Paragraph>
        </Animated.View>

        {/* Master toggle card */}
        <View style={styles.toggleCard}>
          {settings.enabled && <View style={styles.toggleCardGlow} />}
          <View style={styles.toggleCardInner}>
            <View style={styles.toggleLeft}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={[styles.bellOrb, settings.enabled && styles.bellOrbActive]}>
                  <Paragraph style={styles.bellIcon}>🔔</Paragraph>
                </View>
              </Animated.View>
              <View style={styles.toggleLabels}>
                <Paragraph style={styles.toggleTitle}>Daily Reminders</Paragraph>
                <Paragraph style={[styles.toggleSub, settings.enabled && styles.toggleSubActive]}>
                  {settings.enabled ? `Active — ${settings.optimalTime}` : 'Tap to enable'}
                </Paragraph>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: '#1E293B', true: '#00D4FF40' }}
              thumbColor={settings.enabled ? '#00D4FF' : '#334155'}
              ios_backgroundColor="#1E293B"
            />
          </View>
        </View>

        {/* Time picker */}
        <View style={styles.sectionHeader}>
          <View style={styles.dot} />
          <Paragraph style={styles.sectionLabel}>POSTING TIME</Paragraph>
          {optimalTimeRaw && (
            <View style={styles.optimalBadge}>
              <Paragraph style={styles.optimalBadgeText}>AI RECOMMENDED</Paragraph>
            </View>
          )}
        </View>

        <View style={styles.timeGrid}>
          {TIME_PRESETS.map((preset, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => selectPreset(i)}
              activeOpacity={0.75}
              style={[styles.timeChip, i === selectedPreset && styles.timeChipSelected]}
            >
              {i === selectedPreset && (
                <LinearGradient
                  colors={['#00D4FF', '#00FFB3']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Paragraph style={[styles.timeChipLabel, i === selectedPreset && styles.timeChipLabelSelected]}>
                {preset.label}
              </Paragraph>
              <Paragraph style={[styles.timeChipSub, i === selectedPreset && styles.timeChipSubSelected]}>
                {preset.sublabel}
              </Paragraph>
            </TouchableOpacity>
          ))}
        </View>

        {/* Days of week */}
        <View style={styles.sectionHeader}>
          <View style={styles.dot} />
          <Paragraph style={styles.sectionLabel}>ACTIVE DAYS</Paragraph>
        </View>

        <View style={styles.daysRow}>
          {DAYS.map((day, i) => {
            const active = activeDays.includes(i);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => toggleDay(i)}
                activeOpacity={0.75}
                style={[styles.dayChip, active && styles.dayChipActive]}
              >
                {active && (
                  <LinearGradient
                    colors={['#00D4FF30', '#00FFB320']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Paragraph style={[styles.dayText, active && styles.dayTextActive]}>{day}</Paragraph>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preview card */}
        <View style={styles.previewCard}>
          <View style={styles.previewLeft}>
            <View style={styles.previewIcon}>
              <Paragraph style={{ fontSize: 24 }}>📱</Paragraph>
            </View>
            <View>
              <Paragraph style={styles.previewTitle}>
                ⚡ Post Now — {preset.label} is your peak!
              </Paragraph>
              <Paragraph style={styles.previewBody}>
                Your audience is waiting. Time to post! 🚀
              </Paragraph>
              <Paragraph style={styles.previewApp}>Crescio AI  •  now</Paragraph>
            </View>
          </View>
        </View>

        {/* Stats insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightRow}>
            <View style={styles.dot} />
            <Paragraph style={styles.insightTitle}>WHY THIS MATTERS</Paragraph>
          </View>
          {[
            { stat: '3×', desc: 'more growth from posting consistently' },
            { stat: '47%', desc: 'higher reach during peak hours' },
            { stat: '80%', desc: 'of viral videos posted within optimal window' },
          ].map((item, i) => (
            <View key={i} style={[styles.insightItem, i < 2 && styles.insightItemBorder]}>
              <Paragraph style={styles.insightStat}>{item.stat}</Paragraph>
              <Paragraph style={styles.insightDesc}>{item.desc}</Paragraph>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={saveReminder} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={['#00D4FF', '#00FFB3']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              <Paragraph style={styles.saveBtnText}>
                {saving ? 'SAVING...' : settings.enabled ? 'SAVE REMINDER  →' : 'DISABLE REMINDER'}
              </Paragraph>
            </LinearGradient>
            {!saving && <View style={styles.saveBtnGlow} />}
          </TouchableOpacity>

          {/* Removed test notification button — not needed for production */}
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 56, paddingTop: Platform.OS === 'ios' ? 60 : 40 },

  // Header
  header: { marginBottom: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  backIcon: { fontSize: 22, color: '#00D4FF', fontWeight: '600', marginTop: -2 },
  headerBadge: { flexDirection: 'row', alignItems: 'center' },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00FFB3', marginRight: 8, shadowColor: '#00FFB3', shadowOpacity: 1, shadowRadius: 6 },
  headerBadgeText: { fontSize: 11, color: '#00FFB3', letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '900', color: '#E2F0FF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748B' },

  // Toggle card
  toggleCard: {
    borderRadius: 16, overflow: 'hidden', marginBottom: 28,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    position: 'relative',
  },
  toggleCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: '#00D4FF', opacity: 0.8,
  },
  toggleCardInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 20,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center' },
  bellOrb: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center',
    marginRight: 14, borderWidth: 1, borderColor: '#334155', overflow: 'visible',
  },
  bellOrbActive: {
    backgroundColor: '#00D4FF15', borderColor: '#00D4FF',
    shadowColor: '#00D4FF', shadowOpacity: 0.6, shadowRadius: 12,
  },
  bellIcon: { fontSize: 22, lineHeight: 28 },
  toggleLabels: {},
  toggleTitle: { fontSize: 16, fontWeight: '700', color: '#E2F0FF', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#64748B' },
  toggleSubActive: { color: '#00FFB3' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { fontSize: 11, color: '#64748B', letterSpacing: 2, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF', marginRight: 10 },
  optimalBadge: {
    marginLeft: 'auto',
    backgroundColor: '#00FFB315', borderWidth: 1, borderColor: '#00FFB340',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  optimalBadgeText: { fontSize: 9, color: '#00FFB3', letterSpacing: 1.5, fontWeight: '700' },

  // Time grid
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  timeChip: {
    width: '30%', backgroundColor: '#0C1220',
    borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 12, padding: 14, alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  timeChipSelected: { borderColor: 'transparent' },
  timeChipLabel: { fontSize: 16, fontWeight: '900', color: '#64748B', marginBottom: 2 },
  timeChipLabelSelected: { color: '#050810' },
  timeChipSub: { fontSize: 9, color: '#334155', letterSpacing: 0.5, textAlign: 'center' },
  timeChipSubSelected: { color: '#05081080' },

  // Days
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  dayChip: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  dayChipActive: { borderColor: '#00D4FF50' },
  dayText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  dayTextActive: { color: '#00D4FF' },

  // Preview
  previewCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  previewLeft: { flexDirection: 'row', alignItems: 'flex-start' },
  previewIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#00D4FF15', borderWidth: 1, borderColor: '#00D4FF30',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  previewTitle: { fontSize: 13, fontWeight: '700', color: '#E2F0FF', marginBottom: 4, flex: 1, flexWrap: 'wrap' },
  previewBody: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  previewApp: { fontSize: 10, color: '#334155', letterSpacing: 0.5 },

  // Insight card
  insightCard: {
    backgroundColor: '#0C1220', borderWidth: 1, borderColor: '#1E293B',
    borderRadius: 14, padding: 20, marginBottom: 28,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  insightTitle: { fontSize: 11, color: '#64748B', letterSpacing: 2, fontWeight: '700' },
  insightItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  insightItemBorder: { borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  insightStat: { fontSize: 22, fontWeight: '900', color: '#00D4FF', width: 56 },
  insightDesc: { flex: 1, fontSize: 13, color: '#64748B' },

  // Actions
  actions: {},
  saveBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 13, fontWeight: '900', color: '#050810', letterSpacing: 2 },
  saveBtnGlow: {
    height: 16, marginHorizontal: 40, borderRadius: 8,
    backgroundColor: '#00D4FF', opacity: 0.2,
    shadowColor: '#00D4FF', shadowOpacity: 0.8, shadowRadius: 12,
    marginTop: -4, marginBottom: 16,
  },
});
