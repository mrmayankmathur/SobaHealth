/**
 * Device Capability Gate
 *
 * Decides whether the current phone can host the on-device Gemma 4 E2B model
 * (~2.6 GB on disk, ~1.5 GB active RAM per LiteRT-LM docs) plus the
 * whisper.rn base model (~140 MB) without thrashing.
 *
 * Returns one of three tiers:
 *   - "green":  on the allowlist of validated chipsets AND sufficient RAM.
 *               Safe to default to device-only inference.
 *   - "yellow": enough RAM but chipset not validated. Allowed with a warning.
 *   - "red":    insufficient RAM or unsupported OS. On-device blocked, the
 *               app must use the edge server.
 *
 * iOS additionally cannot run vision or audio on-device today because the
 * react-native-litert-lm@0.3.7 XCFramework lacks compiled vision/audio
 * executor ops. We surface that as a separate flag so the UI can degrade.
 */
import * as Device from "expo-device";
import { Platform } from "react-native";

export type DeviceTier = "green" | "yellow" | "red";

export interface DeviceCapability {
  tier: DeviceTier;
  reason: string;
  totalMemoryGB: number;
  modelId: string;
  osVersion: string;
  supports: {
    chat: boolean;
    symptoms: boolean;
    vision: boolean;
    stt: boolean;
  };
}

// Minimum RAM the on-device path will tolerate. Below this we hard-block.
const MIN_RAM_BYTES = 6 * 1024 * 1024 * 1024;

// Apple identifiers (Device.modelId returns e.g. "iPhone15,2"). We accept
// iPhone 14 Pro and newer; iPad Pro M1 and newer.
const IOS_TIER1_PREFIXES = [
  "iPhone15,",
  "iPhone16,",
  "iPhone17,",
  "iPhone18,",
  "iPad13,",
  "iPad14,",
  "iPad16,",
];

// Android marketing names returned by Device.modelName, kept loose because
// vendor strings drift. The RAM check is the real safety net.
const ANDROID_TIER1_KEYWORDS = [
  "Pixel 8",
  "Pixel 9",
  "Pixel 10",
  "SM-S91", // Galaxy S23 family
  "SM-S92", // Galaxy S24 family
  "SM-S93", // Galaxy S25 family
  "SM-F94", // Galaxy Z Fold 5
  "SM-F95", // Galaxy Z Fold 6
  "ONEPLUS A6", // OnePlus 11/12 share prefixes
  "2401", // Xiaomi 14 series codes
];

function parseOsMajor(version: string): number {
  const first = version.split(".")[0];
  const n = parseInt(first, 10);
  return Number.isFinite(n) ? n : 0;
}

function isIosOnAllowlist(modelId: string): boolean {
  return IOS_TIER1_PREFIXES.some((p) => modelId.startsWith(p));
}

function isAndroidOnAllowlist(modelName: string): boolean {
  return ANDROID_TIER1_KEYWORDS.some((k) =>
    modelName.toUpperCase().includes(k.toUpperCase()),
  );
}

let cached: DeviceCapability | null = null;

export async function getDeviceCapability(
  force = false,
): Promise<DeviceCapability> {
  if (cached && !force) return cached;

  const totalMemory = Device.totalMemory ?? 0;
  const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
  const modelId = Device.modelId ?? Device.modelName ?? "unknown";
  const modelName = Device.modelName ?? modelId;
  const osVersion = Device.osVersion ?? String(Platform.Version) ?? "17.0";
  const osMajor = parseOsMajor(osVersion);

  const onAllowlist =
    Platform.OS === "ios"
      ? isIosOnAllowlist(modelId)
      : isAndroidOnAllowlist(modelName);

  // Hard blocks first.
  if (Platform.OS === "ios" && osMajor < 16) {
    cached = {
      tier: "red",
      reason: `iOS ${osVersion} is below the iOS 16 minimum for LiteRT-LM.`,
      totalMemoryGB,
      modelId,
      osVersion,
      supports: { chat: false, symptoms: false, vision: false, stt: false },
    };
    return cached;
  }
  if (Platform.OS === "android" && osMajor < 12) {
    cached = {
      tier: "red",
      reason: `Android ${osVersion} is below the Android 12 minimum.`,
      totalMemoryGB,
      modelId,
      osVersion,
      supports: { chat: false, symptoms: false, vision: false, stt: false },
    };
    return cached;
  }

  // If the device is on our validated tier-1 allowlist, we trust it has sufficient memory
  // (e.g. iPhone 15 Pro+ and newer have 8GB+ RAM) even if expo-device reports a sandboxed / low totalMemory.
  if (!onAllowlist && totalMemory > 0 && totalMemory < MIN_RAM_BYTES) {
    cached = {
      tier: "red",
      reason: `Only ${totalMemoryGB.toFixed(1)} GB RAM detected. The quantized Gemma 4 E2B model needs at least 6 GB to run safely.`,
      totalMemoryGB,
      modelId,
      osVersion,
      supports: { chat: false, symptoms: false, vision: false, stt: false },
    };
    return cached;
  }

  // iOS LiteRT-LM XCFramework limitation: vision + audio executor ops are
  // not yet shipped. Chat + symptoms work; vision falls back to edge.
  // whisper.rn provides STT independently on iOS, so STT stays available.
  const iosMultimodalGap = Platform.OS === "ios";

  if (onAllowlist) {
    cached = {
      tier: "green",
      reason: `${modelName} is on the validated tier-1 list with ${totalMemoryGB.toFixed(1)} GB RAM.`,
      totalMemoryGB,
      modelId,
      osVersion,
      supports: {
        chat: true,
        symptoms: true,
        vision: !iosMultimodalGap,
        stt: true,
      },
    };
    return cached;
  }

  cached = {
    tier: "yellow",
    reason: `${modelName} is not on our validated list but has ${totalMemoryGB.toFixed(1)} GB RAM. On-device mode may be slow or unstable.`,
    totalMemoryGB,
    modelId,
    osVersion,
    supports: {
      chat: true,
      symptoms: true,
      vision: !iosMultimodalGap,
      stt: true,
    },
  };
  return cached;
}

export function tierLabel(tier: DeviceTier): string {
  switch (tier) {
    case "green":
      return "Optimised";
    case "yellow":
      return "Compatible (beta)";
    case "red":
      return "Not supported";
  }
}
