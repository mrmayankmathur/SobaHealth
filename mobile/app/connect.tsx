/**
 * Connect to Server Screen
 * First screen users see. Scans QR code from the edge server
 * to discover its local IP address. Also supports manual IP entry.
 *
 * This is the foundation — if this doesn't work, nothing works.
 */
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../constants/theme";
import { setServerUrl, testConnection, parseQrData } from "../services/api";
import { setMode } from "../services/inferenceRouter";
import { isInstalled } from "../services/modelInstall";
import { getDeviceCapability } from "../services/deviceCapability";

const { width } = Dimensions.get("window");

type ConnectionStatus = "idle" | "testing" | "connected" | "failed";

export default function ConnectScreen() {
  const router = useRouter();
  const [manualIp, setManualIp] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [canSkipToDevice, setCanSkipToDevice] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const cap = await getDeviceCapability();
      const llmReady = await isInstalled("llm");
      setCanSkipToDevice(cap.tier !== "red" && llmReady);
    })();
  }, []);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Pulse animation for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  async function handleConnect(url: string) {
    setStatus("testing");
    setStatusMessage("Connecting to SobaHealth server...");

    const result = await testConnection(url);

    if (result.connected) {
      setStatus("connected");
      setStatusMessage("Connected! Starting SobaHealth...");
      await setServerUrl(url);

      // Brief delay so user sees the success state
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 1000);
    } else {
      setStatus("failed");
      setStatusMessage(result.error || "Could not connect to server");
    }
  }

  function handleManualConnect() {
    let ip = manualIp.trim();
    if (!ip) {
      Alert.alert("Error", "Please enter the server IP address");
      return;
    }
    if (!ip.startsWith("http")) {
      ip = `http://${ip}`;
    }
    if (!ip.includes(":8000") && !ip.match(/:\d+$/)) {
      ip = `${ip}:8000`;
    }
    handleConnect(ip);
  }

  async function handleSkipToDevice() {
    await setMode("device");
    router.replace("/(tabs)");
  }

  // QR code scanning would go here — for now we use manual IP entry
  // (expo-camera barcode scanning will be added when deps install)

  const statusColor =
    status === "connected"
      ? Colors.success
      : status === "failed"
        ? Colors.emergency
        : status === "testing"
          ? Colors.connecting
          : Colors.textSecondary;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        {/* Logo / Brand */}
        <Animated.View
          style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🏥</Text>
          </View>
        </Animated.View>

        <Text style={styles.title}>SobaHealth</Text>
        <Text style={styles.subtitle}>Offline AI Health Assistant</Text>
        <Text style={styles.description}>
          Connect to your local SobaHealth server to get started.{"\n"}
          No internet required — everything stays private.
        </Text>

        {/* Connection Status */}
        {status !== "idle" && (
          <View style={[styles.statusBanner, { borderColor: statusColor }]}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Manual IP Entry */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Server IP Address</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="192.168.1.45"
              placeholderTextColor={Colors.textSecondary}
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.connectButton,
                status === "testing" && styles.connectButtonDisabled,
              ]}
              onPress={handleManualConnect}
              disabled={status === "testing"}
            >
              <Text style={styles.connectButtonText}>
                {status === "testing" ? "..." : "Connect"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Run the server on your laptop, then enter its IP here.{"\n"}
            Find your IP: run `ifconfig` or check WiFi settings.
          </Text>
        </View>

        {canSkipToDevice && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipToDevice}
          >
            <Text style={styles.skipButtonText}>
              Skip — run on-device only
            </Text>
            <Text style={styles.skipButtonHint}>
              Use the Gemma 4 E2B model installed on this phone. You can switch
              back to the edge server any time from settings.
            </Text>
          </TouchableOpacity>
        )}

        {/* Privacy badge */}
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            All data stays on your local network. Zero cloud.
          </Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xxl,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.secondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  iconEmoji: {
    fontSize: 44,
  },
  title: {
    ...Typography.h1,
    fontSize: 32, // overriding h1 for a larger title here
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    ...Typography.h2,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  description: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 22,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    width: "100%",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  statusText: {
    ...Typography.bodySecondary,
    fontWeight: "500",
    flex: 1,
  },
  inputSection: {
    width: "100%",
    marginTop: Spacing.xxl,
  },
  inputLabel: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    color: Colors.textPrimary,
    ...Typography.bodyPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  connectButton: {
    height: 50,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyPrimary,
    fontWeight: "700",
  },
  hint: {
    ...Typography.micro,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  privacyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success + "15",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  privacyIcon: {
    fontSize: 16,
  },
  privacyText: {
    ...Typography.micro,
    color: Colors.success,
    fontWeight: "500",
  },
  skipButton: {
    marginTop: Spacing.lg,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
    alignItems: "center",
    gap: Spacing.xs,
  },
  skipButtonText: {
    ...Typography.bodyPrimary,
    color: Colors.primary,
    fontWeight: "700",
  },
  skipButtonHint: {
    ...Typography.micro,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
