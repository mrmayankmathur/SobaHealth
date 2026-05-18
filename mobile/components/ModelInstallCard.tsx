import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../constants/theme";
import {
  ModelKind,
  pickModelFile,
  downloadModel,
  isInstalled,
  removeModel,
  modelApproxSize,
  modelFileName,
  modelDownloadUrl,
} from "../services/modelInstall";

interface Props {
  kind: ModelKind;
  title: string;
  subtitle: string;
  onChange?: (installed: boolean) => void;
}

function bytesToHuman(n: number): string {
  if (n >= 1024 * 1024 * 1024)
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${n} B`;
}

export function ModelInstallCard({ kind, title, subtitle, onChange }: Props) {
  const [installed, setInstalled] = useState<boolean>(false);
  const [busy, setBusy] = useState<null | "pick" | "download">(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => setInstalled(await isInstalled(kind)))();
  }, [kind]);

  async function handlePick() {
    setError(null);
    setBusy("pick");
    try {
      await pickModelFile(kind);
      setInstalled(true);
      onChange?.(true);
    } catch (e: any) {
      if (e?.message !== "PICK_CANCELLED") setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setError(null);
    setProgress(0);
    setBusy("download");
    try {
      await downloadModel(kind, (p) => setProgress(p.fraction));
      setInstalled(true);
      onChange?.(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy("pick");
    try {
      await removeModel(kind);
      setInstalled(false);
      onChange?.(false);
    } finally {
      setBusy(null);
    }
  }

  const approxSize = bytesToHuman(modelApproxSize(kind));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: installed
                ? Colors.success + "22"
                : Colors.warning + "22",
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: installed ? Colors.success : Colors.warning },
            ]}
          >
            {installed ? "Installed" : "Not installed"}
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Text style={styles.meta}>
        File: {modelFileName(kind)} (~{approxSize})
      </Text>

      {busy === "download" && (
        <View style={styles.progressBlock}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            Downloading {(progress * 100).toFixed(1)}%
          </Text>
        </View>
      )}

      {error && (
        <Text style={styles.error} numberOfLines={4}>
          {error}
        </Text>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryButton, busy != null && styles.buttonDisabled]}
          disabled={busy != null}
          onPress={handlePick}
        >
          {busy === "pick" ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Pick file</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, busy != null && styles.buttonDisabled]}
          disabled={busy != null}
          onPress={handleDownload}
        >
          {busy === "download" ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Download</Text>
          )}
        </TouchableOpacity>
      </View>

      {installed && (
        <TouchableOpacity onPress={handleRemove} disabled={busy != null}>
          <Text style={styles.removeLink}>Remove and reinstall</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.hint} numberOfLines={3}>
        Tip: transfer {modelFileName(kind)} to your phone via AirDrop / USB,
        then use Pick file. Or hit Download to fetch from
        {" "}
        {modelDownloadUrl(kind).split("/").slice(2, 4).join("/")}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
  },
  meta: {
    ...Typography.micro,
    color: Colors.textSecondary,
    fontFamily: "Menlo",
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.micro,
    fontWeight: "700",
  },
  progressBlock: {
    gap: Spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.primary,
  },
  progressLabel: {
    ...Typography.micro,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyPrimary,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.secondary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
    ...Typography.bodyPrimary,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  removeLink: {
    ...Typography.micro,
    color: Colors.emergency,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  hint: {
    ...Typography.micro,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  error: {
    ...Typography.bodySecondary,
    color: Colors.emergency,
    backgroundColor: Colors.emergency + "11",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
