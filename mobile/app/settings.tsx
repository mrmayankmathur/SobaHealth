/**
 * Settings — Inference mode + model install management.
 *
 * Reached from the header gear icon on the chat tab. Lets the user:
 *   - flip between Auto / Edge / Device routing.
 *   - inspect the detected device capability tier.
 *   - reinstall / replace the on-device Gemma and Whisper models.
 *   - jump back to the connect screen to change the edge server URL.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../constants/theme";
import { ModeToggle } from "../components/ModeToggle";
import { ModelInstallCard } from "../components/ModelInstallCard";
import {
  getDeviceCapability,
  DeviceCapability,
  tierLabel,
} from "../services/deviceCapability";
import { getRoutingSnapshot } from "../services/inferenceRouter";

export default function SettingsScreen() {
  const router = useRouter();
  const [cap, setCap] = useState<DeviceCapability | null>(null);
  const [snapshot, setSnapshot] = useState<Awaited<
    ReturnType<typeof getRoutingSnapshot>
  > | null>(null);

  useEffect(() => {
    (async () => {
      setCap(await getDeviceCapability());
      setSnapshot(await getRoutingSnapshot());
    })();
  }, []);

  async function refreshSnapshot() {
    setSnapshot(await getRoutingSnapshot());
  }

  const tier = cap?.tier ?? "yellow";
  const tierColor =
    tier === "green"
      ? Colors.success
      : tier === "yellow"
        ? Colors.warning
        : Colors.emergency;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Text style={styles.section}>Inference mode</Text>
      <ModeToggle onChange={refreshSnapshot} />

      <Text style={styles.section}>Device</Text>
      {cap && (
        <View style={[styles.card, { borderColor: tierColor }]}>
          <Text style={styles.cardTitle}>{tierLabel(cap.tier)}</Text>
          <Text style={styles.cardBody}>{cap.reason}</Text>
          <Text style={styles.kv}>Model: {cap.modelId}</Text>
          <Text style={styles.kv}>OS: {Platform.OS} {cap.osVersion}</Text>
          <Text style={styles.kv}>
            RAM: {cap.totalMemoryGB.toFixed(2)} GB
          </Text>
          <Text style={styles.kv}>
            Supports: chat={String(cap.supports.chat)}, symptoms=
            {String(cap.supports.symptoms)}, vision=
            {String(cap.supports.vision)}, stt={String(cap.supports.stt)}
          </Text>
        </View>
      )}

      <Text style={styles.section}>Edge server</Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>
          {snapshot?.edgeUrl
            ? `${snapshot.edgeUrl} - ${
                snapshot.edgeHealthy ? "reachable" : "unreachable"
              }`
            : "Not configured"}
        </Text>
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => router.push("/connect")}
        >
          <Text style={styles.linkBtnText}>Change edge server</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>On-device models</Text>
      <ModelInstallCard
        kind="llm"
        title="Chat / Symptoms model"
        subtitle="Gemma 4 E2B (LiteRT-LM)."
        onChange={refreshSnapshot}
      />
      <ModelInstallCard
        kind="stt"
        title="Speech-to-text model"
        subtitle="Whisper base (ggml)."
        onChange={refreshSnapshot}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.base,
    paddingTop: 60,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
  },
  section: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.base,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  cardTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  cardBody: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
  },
  kv: {
    ...Typography.micro,
    color: Colors.textSecondary,
    fontFamily: "Menlo",
  },
  linkBtn: {
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  linkBtnText: {
    ...Typography.bodySecondary,
    color: Colors.primary,
    fontWeight: "600",
  },
});
