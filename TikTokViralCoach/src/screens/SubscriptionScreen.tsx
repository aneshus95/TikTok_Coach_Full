/**
 * SubscriptionScreen — tier comparison + Google Play subscription purchase flow
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingAnimation from '../components/LoadingAnimation';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Subscription,
  type Purchase,
} from 'react-native-iap';
import { ApiService } from '../services/ApiService';

// Subscription product IDs — must match Google Play Console
const SUBSCRIPTION_SKUS = ['growth_monthly', 'pro_monthly'];

const TIERS = [
  {
    id: 'free',
    name: 'Free Trial',
    price: '$0',
    period: '',
    color: '#64748B',
    features: [
      '50 lifetime uses',
      '30 sec max video',
      'Basic TikTok analytics',
      'Posting reminders',
    ],
    productId: null as string | null,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$19.99',
    period: '/month',
    color: '#00D4FF',
    popular: true,
    features: [
      '15 video analyses/month',
      '20 AI tools/month',
      '20 ffmpeg tools/month',
      '10 min max video',
      'Full TikTok analytics',
      'Posting reminders',
    ],
    productId: 'growth_monthly',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$39.99',
    period: '/month',
    color: '#00FFB3',
    features: [
      '40 video analyses/month',
      '50 AI tools/month',
      '50 ffmpeg tools/month',
      '20 min max video',
      'Full TikTok analytics',
      'Posting reminders',
    ],
    productId: 'pro_monthly',
  },
];

export default function SubscriptionScreen({ navigation }: any) {
  const [currentTier, setCurrentTier] = useState('free');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [iapConnected, setIapConnected] = useState(false);
  const [subscriptionProducts, setSubscriptionProducts] = useState<Subscription[]>([]);

  useEffect(() => {
    loadTier();
    initializeIAP();

    // Listen for successful purchases
    const purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (__DEV__) console.log('[IAP] Purchase updated:', purchase.productId);

      try {
        // Finish the transaction (acknowledge on Android)
        await finishTransaction({ purchase, isConsumable: false });

        // Verify with our backend
        const result = await ApiService.verifySubscription(
          purchase.purchaseToken || '',
          purchase.productId || '',
          purchase.transactionId || '',
        );

        // Update local state
        await AsyncStorage.setItem('user_tier', result.tier);
        setCurrentTier(result.tier);
        setPurchasing(null);

        Alert.alert(
          'Upgrade Successful!',
          `You are now on the ${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} plan.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } catch (error: any) {
        if (__DEV__) console.error('[IAP] Backend verification failed:', error);
        setPurchasing(null);
        Alert.alert('Error', 'Purchase completed but verification failed. Please contact support.');
      }
    });

    // Listen for purchase errors
    const errorSub = purchaseErrorListener((error: any) => {
      if (__DEV__) console.error('[IAP] Purchase error:', error);
      setPurchasing(null);

      // Don't alert on user cancellation
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
      }
    });

    // Cleanup on unmount
    return () => {
      purchaseSub?.remove();
      errorSub?.remove();
      endConnection();
    };
  }, []);

  const initializeIAP = async () => {
    try {
      const connected = await initConnection();
      if (connected) {
        setIapConnected(true);
        if (__DEV__) console.log('[IAP] Connected to store');

        // Fetch subscription products from Google Play
        const products = await getSubscriptions({ skus: SUBSCRIPTION_SKUS });
        setSubscriptionProducts(products);
        if (__DEV__) console.log('[IAP] Fetched subscriptions:', products.length);

        // Update display prices from store (overrides hardcoded prices)
        // This shows the actual localized price from Google Play
      }
    } catch (error) {
      if (__DEV__) console.error('[IAP] Init failed:', error);
      // IAP not available (emulator, no Play Store, etc.)
    }
  };

  const loadTier = async () => {
    try {
      const usage = await ApiService.getUsageStatus();
      setCurrentTier(usage.tier);
    } catch {
      // Always default to 'free' — never trust AsyncStorage for tier (client-spoofable)
      setCurrentTier('free');
    }
    setLoading(false);
  };

  const handlePurchase = async (tier: typeof TIERS[number]) => {
    if (!tier.productId) return;

    // Must be logged in to subscribe
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      Alert.alert('Login Required', 'Please log in first to subscribe.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }

    if (!iapConnected) {
      Alert.alert('Store Unavailable', 'Could not connect to Google Play. Please try again later.');
      return;
    }

    setPurchasing(tier.id);
    try {
      // Find the subscription product to get the offerToken
      const product = subscriptionProducts.find(
        (p: Subscription) => p.productId === tier.productId,
      );

      if (!product) {
        Alert.alert('Error', 'Subscription product not found. Please try again later.');
        setPurchasing(null);
        return;
      }

      // Get the offer token (required for Android subscriptions)
      const offerToken = product.subscriptionOfferDetails?.[0]?.offerToken;

      if (Platform.OS === 'android' && offerToken) {
        await requestSubscription({
          sku: tier.productId,
          subscriptionOffers: [{ sku: tier.productId, offerToken }],
        });
      } else {
        // iOS fallback (future) or Android without offerToken
        await requestSubscription({ sku: tier.productId });
      }

      // Purchase result handled by purchaseUpdatedListener above
    } catch (error: any) {
      if (__DEV__) console.error('[IAP] Request error:', error);
      setPurchasing(null);

      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong.');
      }
    }
  };

  // Get the store price if available, otherwise show hardcoded price
  const getDisplayPrice = (tier: typeof TIERS[number]) => {
    if (!tier.productId) return tier.price;
    const product = subscriptionProducts.find(
      (p: Subscription) => p.productId === tier.productId,
    );
    if (product?.subscriptionOfferDetails?.[0]?.pricingPhases?.pricingPhaseList?.[0]) {
      return product.subscriptionOfferDetails[0].pricingPhases.pricingPhaseList[0].formattedPrice;
    }
    return tier.price;
  };

  if (loading) {
    return (
      <LinearGradient colors={['#050810', '#0C1220']} style={styles.loading}>
        <LoadingAnimation size={120} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#050810', '#0C1220']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Paragraph style={styles.backText}>{'<-'} Back</Paragraph>
        </TouchableOpacity>

        <Title style={styles.title}>Choose Your Plan</Title>
        <Paragraph style={styles.subtitle}>
          Unlock AI-powered video coaching and editing tools
        </Paragraph>

        {/* Tier Cards */}
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          const isHigher = TIERS.findIndex(t => t.id === tier.id) > TIERS.findIndex(t => t.id === currentTier);
          const displayPrice = getDisplayPrice(tier);

          return (
            <View
              key={tier.id}
              style={[
                styles.tierCard,
                { borderColor: isCurrent ? tier.color : '#1E293B' },
                tier.popular && styles.popularCard,
              ]}
            >
              {tier.popular && (
                <View style={styles.popularBadge}>
                  <Paragraph style={styles.popularText}>MOST POPULAR</Paragraph>
                </View>
              )}

              <View style={styles.tierHeader}>
                <Title style={[styles.tierName, { color: tier.color }]}>{tier.name}</Title>
                <View style={styles.priceRow}>
                  <Paragraph style={styles.price}>{displayPrice}</Paragraph>
                  {tier.period ? (
                    <Paragraph style={styles.period}>{tier.period}</Paragraph>
                  ) : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {tier.features.map((feat, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Paragraph style={[styles.checkmark, { color: tier.color }]}>+</Paragraph>
                    <Paragraph style={styles.featureText}>{feat}</Paragraph>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={[styles.currentBadge, { borderColor: tier.color }]}>
                  <Paragraph style={[styles.currentText, { color: tier.color }]}>
                    Current Plan
                  </Paragraph>
                </View>
              ) : isHigher ? (
                <TouchableOpacity
                  onPress={() => handlePurchase(tier)}
                  activeOpacity={0.8}
                  disabled={purchasing === tier.id}
                >
                  <LinearGradient
                    colors={tier.id === 'pro' ? ['#00FFB3', '#00D4FF'] : ['#00D4FF', '#00FFB3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.upgradeBtn}
                  >
                    {purchasing === tier.id ? (
                      <ActivityIndicator color="#050810" size="small" />
                    ) : (
                      <Paragraph style={styles.upgradeBtnText}>
                        Upgrade to {tier.name}
                      </Paragraph>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <Paragraph style={styles.footer}>
          Subscriptions are billed monthly through Google Play.{'\n'}
          Cancel anytime from your Google Play settings.
        </Paragraph>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#00D4FF', fontSize: 15 },
  title: {
    color: '#E2F0FF',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: '#0C1220',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    marginBottom: 16,
  },
  popularCard: {
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#00D4FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  popularText: {
    color: '#050810',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierName: {
    fontSize: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
    marginLeft: 8,
  },
  price: {
    color: '#E2F0FF',
    fontSize: 22,
    fontWeight: '900',
  },
  period: {
    color: '#64748B',
    fontSize: 13,
    marginLeft: 2,
  },
  featureList: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '800',
    marginRight: 10,
    width: 18,
  },
  featureText: {
    color: '#94A3B8',
    fontSize: 13,
    flex: 1,
  },
  currentBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  currentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#050810',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
