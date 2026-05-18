/**
 * Inference Router
 *
 * Single chokepoint that every tab uses to reach an LLM. Decides between
 * the edge FastAPI server (faster, fuller features) and the on-device
 * Gemma 4 E2B + whisper.rn stack (works without a laptop / WiFi).
 *
 * Modes (persisted in AsyncStorage so the choice survives restarts):
 *   - "auto":   try edge first if recent health probe was OK, fall back
 *               to device on timeout / connect error / 5xx.
 *   - "edge":   edge only. Throw a clear error if it isn't reachable.
 *   - "device": device only. Never touch the network, even if up.
 *
 * Health probes are cached for HEALTH_TTL_MS so we don't ping on every
 * keystroke. Call `invalidateHealthCache()` after the user changes the
 * server URL or comes back online.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUrl } from "./api";
import {
  localChat,
  localSymptomCheck,
  localVision,
  LocalSymptomResponse,
} from "./localInference";
import { transcribeOnDevice } from "./whisperLocal";
import { getDeviceCapability } from "./deviceCapability";
import {
  isInstalled,
  ModelKind,
} from "./modelInstall";

export type InferenceMode = "auto" | "edge" | "device";
export type ActivePath = "edge" | "device";

const MODE_STORAGE_KEY = "@soba_inference_mode";
const HEALTH_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 1500;

let cachedMode: InferenceMode | null = null;
let healthCache: { url: string; healthy: boolean; checkedAt: number } | null =
  null;
let lastActivePath: ActivePath = "edge";
const subscribers = new Set<(path: ActivePath, mode: InferenceMode) => void>();

// ---- Mode persistence ---------------------------------------------------

export async function getMode(): Promise<InferenceMode> {
  if (cachedMode) return cachedMode;
  const stored = (await AsyncStorage.getItem(MODE_STORAGE_KEY)) as
    | InferenceMode
    | null;
  cachedMode = stored ?? "auto";
  return cachedMode;
}

export async function setMode(mode: InferenceMode): Promise<void> {
  cachedMode = mode;
  await AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
  // A mode change might toggle the visible badge even before the next
  // request, so notify subscribers right away.
  notify(lastActivePath, mode);
}

export function subscribe(
  fn: (path: ActivePath, mode: InferenceMode) => void,
): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify(path: ActivePath, mode: InferenceMode) {
  lastActivePath = path;
  for (const fn of subscribers) {
    try {
      fn(path, mode);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function getLastActivePath(): ActivePath {
  return lastActivePath;
}

// ---- Health probe -------------------------------------------------------

export function invalidateHealthCache(): void {
  healthCache = null;
}

interface EdgeHealth {
  url: string | null;
  healthy: boolean;
  capabilities: string[];
}

async function probeEdge(force = false): Promise<EdgeHealth> {
  const url = await getServerUrl();
  if (!url) return { url: null, healthy: false, capabilities: [] };

  const now = Date.now();
  if (
    !force &&
    healthCache &&
    healthCache.url === url &&
    now - healthCache.checkedAt < HEALTH_TTL_MS
  ) {
    return { url, healthy: healthCache.healthy, capabilities: [] };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    const healthy = res.ok;
    let capabilities: string[] = [];
    if (healthy) {
      try {
        const body = await res.json();
        if (Array.isArray(body.capabilities)) capabilities = body.capabilities;
      } catch {
        // older edge servers won't return capabilities; treat as full set
      }
    }
    healthCache = { url, healthy, checkedAt: now };
    return { url, healthy, capabilities };
  } catch {
    healthCache = { url, healthy: false, checkedAt: now };
    return { url, healthy: false, capabilities: [] };
  }
}

// ---- Decision helper ----------------------------------------------------

type Capability = "chat" | "symptoms" | "vision" | "stt";

async function decideTarget(
  capability: Capability,
): Promise<{ target: ActivePath; edge?: EdgeHealth }> {
  const mode = await getMode();

  if (mode === "device") {
    await assertDeviceCan(capability);
    return { target: "device" };
  }

  const edge = await probeEdge();

  if (mode === "edge") {
    if (!edge.url) {
      throw new Error(
        "EDGE_NOT_CONFIGURED: no edge server URL. Open the connect screen or switch to Auto mode.",
      );
    }
    if (!edge.healthy) {
      throw new Error(
        `EDGE_UNREACHABLE: cannot reach ${edge.url}. Make sure the FastAPI server is running.`,
      );
    }
    return { target: "edge", edge };
  }

  // auto
  if (edge.healthy) return { target: "edge", edge };
  await assertDeviceCan(capability);
  return { target: "device", edge };
}

async function assertDeviceCan(capability: Capability): Promise<void> {
  const cap = await getDeviceCapability();
  if (cap.tier === "red") {
    throw new Error(`DEVICE_BELOW_REQUIREMENTS: ${cap.reason}`);
  }
  if (!cap.supports[capability]) {
    if (capability === "vision") {
      throw new Error(
        "IOS_VISION_UNSUPPORTED: on-device vision is not yet available on iOS. Switch to Auto or Edge mode for Scan.",
      );
    }
    throw new Error(
      `DEVICE_FEATURE_UNAVAILABLE: ${capability} is not supported on this device in on-device mode.`,
    );
  }
  // For the LLM-backed capabilities, verify the model is installed.
  if (capability !== "stt") {
    if (!(await isInstalled("llm"))) {
      throw new Error(
        "MODEL_NOT_INSTALLED: pick or download the Gemma 4 E2B model from the install screen.",
      );
    }
  } else {
    if (!(await isInstalled("stt"))) {
      throw new Error(
        "STT_MODEL_NOT_INSTALLED: pick or download the Whisper base model from the install screen.",
      );
    }
  }
}

function isAutoFallbackEligible(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message;
  return (
    m.includes("EDGE_UNREACHABLE") ||
    m.includes("AbortError") ||
    m.includes("Network request failed") ||
    m.includes("Server returned 5") ||
    m.includes("failed to fetch")
  );
}

// ---- Public routing API -------------------------------------------------

export interface ChatResult {
  response: string;
  language: string;
  via: ActivePath;
  /**
   * Optional reasoning chain (Gemma `<think>` blocks or a model-emitted
   * rationale). The edge `/api/chat` route may return this when the
   * multilingual / reasoning prompt template is in use; on-device chat
   * leaves it undefined.
   */
  reasoning?: string;
}

export async function routeChat(
  messages: Array<{ role: string; content: string }>,
  language: string,
  edgeFn: () => Promise<{ response: string; language: string; reasoning?: string }>,
): Promise<ChatResult> {
  const mode = await getMode();
  const { target } = await decideTarget("chat");
  try {
    if (target === "edge") {
      const r = await edgeFn();
      notify("edge", mode);
      return { ...r, via: "edge" };
    }
    const r = await localChat(messages, language);
    notify("device", mode);
    return { ...r, via: "device" };
  } catch (e) {
    if (mode === "auto" && target === "edge" && isAutoFallbackEligible(e)) {
      invalidateHealthCache();
      await assertDeviceCan("chat");
      const r = await localChat(messages, language);
      notify("device", mode);
      return { ...r, via: "device" };
    }
    throw e;
  }
}

export interface SymptomResult extends LocalSymptomResponse {
  via: ActivePath;
}

export async function routeSymptoms(
  messages: Array<{ role: string; content: string }>,
  language: string,
  edgeFn: () => Promise<LocalSymptomResponse>,
): Promise<SymptomResult> {
  const mode = await getMode();
  const { target } = await decideTarget("symptoms");
  try {
    if (target === "edge") {
      const r = await edgeFn();
      notify("edge", mode);
      return { ...r, via: "edge" };
    }
    const r = await localSymptomCheck(messages, language);
    notify("device", mode);
    return { ...r, via: "device" };
  } catch (e) {
    if (mode === "auto" && target === "edge" && isAutoFallbackEligible(e)) {
      invalidateHealthCache();
      await assertDeviceCan("symptoms");
      const r = await localSymptomCheck(messages, language);
      notify("device", mode);
      return { ...r, via: "device" };
    }
    throw e;
  }
}

export interface VisionResult {
  text: string;
  via: ActivePath;
}

export async function routeVision(
  imageUri: string,
  prompt: string,
  language: string,
  edgeFn: () => Promise<string>,
): Promise<VisionResult> {
  const mode = await getMode();
  const { target } = await decideTarget("vision");
  try {
    if (target === "edge") {
      const r = await edgeFn();
      notify("edge", mode);
      return { text: r, via: "edge" };
    }
    const r = await localVision(imageUri, prompt, language);
    notify("device", mode);
    return { text: r, via: "device" };
  } catch (e) {
    if (mode === "auto" && target === "edge" && isAutoFallbackEligible(e)) {
      invalidateHealthCache();
      await assertDeviceCan("vision");
      const r = await localVision(imageUri, prompt, language);
      notify("device", mode);
      return { text: r, via: "device" };
    }
    throw e;
  }
}

export interface SttResult {
  transcript: string;
  detected_language: string;
  via: ActivePath;
}

export async function routeSTT(
  audioUri: string,
  language: string,
  edgeFn: () => Promise<{ transcript: string; detected_language: string }>,
): Promise<SttResult> {
  const mode = await getMode();
  const { target } = await decideTarget("stt");
  try {
    if (target === "edge") {
      const r = await edgeFn();
      notify("edge", mode);
      return { ...r, via: "edge" };
    }
    const r = await transcribeOnDevice(audioUri, language);
    notify("device", mode);
    return { ...r, via: "device" };
  } catch (e) {
    if (mode === "auto" && target === "edge" && isAutoFallbackEligible(e)) {
      invalidateHealthCache();
      await assertDeviceCan("stt");
      const r = await transcribeOnDevice(audioUri, language);
      notify("device", mode);
      return { ...r, via: "device" };
    }
    throw e;
  }
}

// ---- Convenience for UI -------------------------------------------------

export async function getRoutingSnapshot(): Promise<{
  mode: InferenceMode;
  lastActive: ActivePath;
  edgeUrl: string | null;
  edgeHealthy: boolean;
  llmModelInstalled: boolean;
  sttModelInstalled: boolean;
  device: Awaited<ReturnType<typeof getDeviceCapability>>;
}> {
  const [mode, edge, llmInstalled, sttInstalled, device] = await Promise.all([
    getMode(),
    probeEdge(),
    isInstalled("llm" as ModelKind),
    isInstalled("stt" as ModelKind),
    getDeviceCapability(),
  ]);
  return {
    mode,
    lastActive: lastActivePath,
    edgeUrl: edge.url,
    edgeHealthy: edge.healthy,
    llmModelInstalled: llmInstalled,
    sttModelInstalled: sttInstalled,
    device,
  };
}
