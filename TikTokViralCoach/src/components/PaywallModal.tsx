/**
 * PaywallModal — shown when user hits usage limit (429) or video duration limit (413)
 */

import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

interface PaywallModalProps {
  visible: boolean;
  message: string;
  tier: string;
  onUpgrade: () => void;
  onDismiss: () => void;
}

export default function PaywallModal({ visible, message, tier, onUpgrade, onDismiss }: PaywallModalProps) {
  const isFreeTrial = tier === 'free';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Paragraph style={styles.icon}>{isFreeTrial ? '🔒' : '📊'}</Paragraph>
          </View>

          <Title style={styles.title}>
            {isFreeTrial ? 'Free Trial Ended' : 'Limit Reached'}
          </Title>

          <Paragraph style={styles.message}>{message}</Paragraph>

          {isFreeTrial ? (
            <Paragraph style={styles.sub}>
              Upgrade to unlock unlimited video coaching, AI tools, and longer videos.
            </Paragraph>
          ) : (
            <Paragraph style={styles.sub}>
              Upgrade to Pro for higher limits and 20-minute video support.
            </Paragraph>
          )}

          <TouchableOpacity onPress={onUpgrade} activeOpacity={0.8}>
            <LinearGradient
              colors={['#00D4FF', '#00FFB3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeBtn}
            >
              <Paragraph style={styles.upgradeBtnText}>Upgrade Now</Paragraph>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
            <Paragraph style={styles.dismissText}>Maybe Later</Paragraph>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0C1220',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    color: '#E2F0FF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#F59E0B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: '#050810',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  dismissBtn: {
    paddingVertical: 8,
  },
  dismissText: {
    color: '#64748B',
    fontSize: 14,
  },
});
