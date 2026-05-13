/**
 * Home Dashboard — Aivaan's landing screen after connection.
 * Shows server status, quick actions, and feature cards.
 * Premium dark UI with glassmorphism cards.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '../../constants/theme';
import { testConnection, getServerUrl, clearServerUrl } from '../../services/api';

const { width } = Dimensions.get('window');

interface FeatureCard {
  emoji: string;
  title: string;
  description: string;
  route: string;
  color: string;
  gemmaFeature: string; // Which Gemma 4 feature powers this
}

const FEATURES: FeatureCard[] = [
  {
    emoji: '💬',
    title: 'AI Health Chat',
    description: 'Talk to your AI health assistant in any language',
    route: '/(tabs)/chat',
    color: Colors.primary,
    gemmaFeature: 'Multilingual + 256K Context',
  },
  {
    emoji: '📄',
    title: 'Scan Report',
    description: 'Extract & summarize medical documents instantly',
    route: '/(tabs)/scan',
    color: '#8B5CF6',
    gemmaFeature: 'Multimodal Vision',
  },
  {
    emoji: '🩺',
    title: 'Symptom Check',
    description: 'AI-powered triage with risk assessment',
    route: '/(tabs)/symptoms',
    color: Colors.accent,
    gemmaFeature: 'Function Calling + Thinking Mode',
  },
  {
    emoji: '🍛',
    title: 'Food Analysis',
    description: 'Snap food photo → calorie & nutrition breakdown',
    route: '/(tabs)/scan',
    color: '#22C55E',
    gemmaFeature: 'Multimodal Vision',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkServer();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  async function checkServer() {
    setServerStatus('checking');
    const result = await testConnection();
    setServerStatus(result.connected ? 'online' : 'offline');
    if (result.serverInfo) setServerInfo(result.serverInfo);
  }

  async function onRefresh() {
    setRefreshing(true);
    await checkServer();
    setRefreshing(false);
  }

  async function handleDisconnect() {
    await clearServerUrl();
    router.replace('/connect');
  }

  const statusColor =
    serverStatus === 'online' ? Colors.online :
    serverStatus === 'offline' ? Colors.offline :
    Colors.connecting;

  const statusText =
    serverStatus === 'online' ? 'Connected — All Local' :
    serverStatus === 'offline' ? 'Server Offline' :
    'Checking...';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.appName}>Aivaan</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleDisconnect}
          >
            <Text style={styles.settingsEmoji}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Server Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
          {serverInfo && (
            <View style={styles.serverDetails}>
              <Text style={styles.serverDetail}>
                🧠 Model: {serverInfo.model || 'gemma4:4b'}
              </Text>
              <Text style={styles.serverDetail}>
                🔒 {serverInfo.privacy || 'All processing local'}
              </Text>
            </View>
          )}
        </View>

        {/* Privacy Banner */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyEmoji}>🛡️</Text>
          <View style={styles.privacyTextContainer}>
            <Text style={styles.privacyTitle}>Privacy First</Text>
            <Text style={styles.privacyDesc}>
              Your health data never leaves your device. All AI runs locally via Gemma 4.
            </Text>
          </View>
        </View>

        {/* Feature Cards */}
        <Text style={styles.sectionTitle}>What can Aivaan do?</Text>
        <View style={styles.cardsGrid}>
          {FEATURES.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={styles.featureCard}
              onPress={() => router.push(feature.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.featureIconBg, { backgroundColor: feature.color + '20' }]}>
                <Text style={styles.featureEmoji}>{feature.emoji}</Text>
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.description}</Text>
              <View style={styles.gemmaTag}>
                <Text style={styles.gemmaTagText}>⚡ {feature.gemmaFeature}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tech Footer */}
        <View style={styles.techFooter}>
          <Text style={styles.techText}>
            Powered by Gemma 4 via Ollama • 100% Offline
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const CARD_WIDTH = (width - Spacing.xxl * 2 - Spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  appName: {
    fontSize: FontSize.display,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsEmoji: {
    fontSize: 20,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  serverDetails: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  serverDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  privacyBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  privacyEmoji: {
    fontSize: 28,
  },
  privacyTextContainer: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  privacyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  featureCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  featureIconBg: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  featureDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  gemmaTag: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  gemmaTagText: {
    fontSize: 9,
    color: Colors.accent,
    fontWeight: '600',
  },
  techFooter: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
  },
  techText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
