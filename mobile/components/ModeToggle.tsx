import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../constants/theme";
import {
  InferenceMode,
  getMode,
  setMode,
} from "../services/inferenceRouter";
import {
  DeviceCapability,
  getDeviceCapability,
} from "../services/deviceCapability";
import { isInstalled } from "../services/modelInstall";

interface Props {
  onChange?: (mode: InferenceMode) => void;
}

const OPTIONS: { id: InferenceMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "edge", label: "Edge" },
  { id: "device", label: "Device" },
];

export function ModeToggle({ onChange }: Props) {
  const [mode, setLocalMode] = useState<InferenceMode>("auto");
  const [cap, setCap] = useState<DeviceCapability | null>(null);
  const [llmReady, setLlmReady] = useState(false);

  useEffect(() => {
    (async () => {
      setLocalMode(await getMode());
      setCap(await getDeviceCapability());
      setLlmReady(await isInstalled("llm"));
    })();
  }, []);

  const deviceDisabled =
    !cap || cap.tier === "red" || !llmReady;

  async function handlePick(next: InferenceMode) {
    if (next === "device" && deviceDisabled) {
      const reason = !cap
        ? "Device capability not yet detected."
        : cap.tier === "red"
          ? cap.reason
          : "On-device model is not installed. Install it from the onboarding flow first.";
      Alert.alert("Device mode unavailable", reason);
      return;
    }
    setLocalMode(next);
    await setMode(next);
    onChange?.(next);
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = opt.id === mode;
          const disabled = opt.id === "device" && deviceDisabled;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => handlePick(opt.id)}
              style={[
                styles.pill,
                active && styles.pillActive,
                disabled && styles.pillDisabled,
              ]}
              disabled={false /* let onPress show the alert */}
            >
              <Text
                style={[
                  styles.label,
                  active && styles.labelActive,
                  disabled && styles.labelDisabled,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.help}>
        {mode === "auto"
          ? "Edge server when reachable, on-device as fallback."
          : mode === "edge"
            ? "Edge server only. Calls fail if the laptop is unreachable."
            : "On-device only. The laptop is never contacted."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pill: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  label: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  labelActive: {
    color: "#FFFFFF",
  },
  labelDisabled: {
    color: Colors.textSecondary,
  },
  help: {
    ...Typography.micro,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.xs,
  },
});
