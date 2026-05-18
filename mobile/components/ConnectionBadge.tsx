import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../constants/theme";
import {
  ActivePath,
  InferenceMode,
  getMode,
  getLastActivePath,
  subscribe,
} from "../services/inferenceRouter";

interface Props {
  /**
   * Legacy prop for screens that pass an explicit edge connection state.
   * When omitted, the badge subscribes to the router so it reflects the
   * actual path the most recent call used.
   */
  status?: "connected" | "disconnected";
}

interface BadgeState {
  mode: InferenceMode;
  activePath: ActivePath;
}

export function ConnectionBadge({ status }: Props) {
  const [state, setState] = useState<BadgeState>({
    mode: "auto",
    activePath: getLastActivePath(),
  });

  useEffect(() => {
    if (status) return;
    let cancelled = false;
    (async () => {
      const mode = await getMode();
      if (!cancelled) setState({ mode, activePath: getLastActivePath() });
    })();
    const unsub = subscribe((path, mode) => {
      if (!cancelled) setState({ mode, activePath: path });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [status]);

  let label = "";
  let dotColor = Colors.online;

  if (status === "disconnected") {
    label = "Edge disconnected";
    dotColor = Colors.offline;
  } else if (status === "connected") {
    label = "Edge AI active";
    dotColor = Colors.online;
  } else if (state.mode === "device") {
    label = "On-device AI";
    dotColor = Colors.online;
  } else if (state.mode === "edge") {
    label = "Edge AI";
    dotColor = Colors.online;
  } else if (state.activePath === "device") {
    label = "Auto: on-device fallback";
    dotColor = Colors.warning;
  } else {
    label = "Auto: edge AI";
    dotColor = Colors.online;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    ...Typography.micro,
    color: Colors.textPrimary,
  },
});
