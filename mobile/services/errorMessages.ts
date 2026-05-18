/**
 * Maps the structured error codes thrown by the inference router and
 * its dependencies into user-friendly Alert payloads. Keeps the UI
 * screens free of long switch-case ladders and ensures we stay
 * consistent across tabs.
 */
import { Alert } from "react-native";
import { useRouter } from "expo-router";

export interface FriendlyError {
  title: string;
  message: string;
  /** Optional CTA label to surface alongside Cancel. */
  cta?: { label: string; route: "/connect" | "/onboarding" };
}

export function describeInferenceError(err: unknown): FriendlyError {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("MODEL_NOT_INSTALLED")) {
    return {
      title: "On-device model missing",
      message:
        "Pick or download the Gemma 4 E2B model file before using on-device AI.",
      cta: { label: "Open install", route: "/onboarding" },
    };
  }
  if (msg.includes("STT_MODEL_NOT_INSTALLED")) {
    return {
      title: "Speech model missing",
      message:
        "Pick or download the Whisper base model file to enable on-device push-to-talk.",
      cta: { label: "Open install", route: "/onboarding" },
    };
  }
  if (msg.includes("LITERT_NATIVE_MISSING") || msg.includes("WHISPER_NATIVE_MISSING")) {
    return {
      title: "Native module not linked",
      message:
        "Run `npx expo prebuild` and rebuild the app so the on-device runtime is included.",
    };
  }
  if (msg.includes("IOS_VISION_UNSUPPORTED")) {
    return {
      title: "On-device vision unavailable on iOS",
      message:
        "Vision currently requires the edge server on iOS. Switch to Auto or Edge mode, or use an Android device.",
      cta: { label: "Connect to edge", route: "/connect" },
    };
  }
  if (msg.includes("DEVICE_BELOW_REQUIREMENTS")) {
    return {
      title: "Device too small for on-device AI",
      message:
        msg.replace("DEVICE_BELOW_REQUIREMENTS:", "").trim() ||
        "Your phone does not meet the RAM / OS requirements for the quantized model.",
      cta: { label: "Connect to edge", route: "/connect" },
    };
  }
  if (msg.includes("LITERT_SEND_FAILED")) {
    return {
      title: "Inference Error",
      message:
        msg.replace("LITERT_SEND_FAILED:", "").trim() ||
        "The model failed to generate a response. Please try sending a shorter message.",
    };
  }
  if (msg.includes("DEVICE_FEATURE_UNAVAILABLE")) {
    return {
      title: "Feature unavailable on-device",
      message: msg.replace("DEVICE_FEATURE_UNAVAILABLE:", "").trim(),
      cta: { label: "Connect to edge", route: "/connect" },
    };
  }
  if (msg.includes("EDGE_NOT_CONFIGURED")) {
    return {
      title: "Edge server not configured",
      message:
        "Add the edge server URL or switch to Auto / Device mode in settings.",
      cta: { label: "Open connect", route: "/connect" },
    };
  }
  if (msg.includes("EDGE_UNREACHABLE")) {
    return {
      title: "Edge server unreachable",
      message:
        "Could not contact the FastAPI server. Make sure it is running on the same WiFi.",
      cta: { label: "Open connect", route: "/connect" },
    };
  }
  return {
    title: "AI request failed",
    message: msg || "Unknown error.",
  };
}

export function showInferenceError(
  err: unknown,
  router?: ReturnType<typeof useRouter>,
) {
  const f = describeInferenceError(err);
  const buttons: any[] = [{ text: "Dismiss", style: "cancel" }];
  if (f.cta && router) {
    buttons.unshift({
      text: f.cta.label,
      onPress: () => router.push(f.cta!.route),
    });
  }
  Alert.alert(f.title, f.message, buttons);
}
