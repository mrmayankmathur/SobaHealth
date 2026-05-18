/**
 * On-device Speech-to-Text via whisper.rn
 *
 * Wraps the whisper.cpp React Native bindings so the rest of the app can
 * call `transcribeOnDevice(audioUri, language)` without caring about
 * context lifecycle or model file paths.
 *
 * The first call initialises the whisper context; subsequent calls reuse
 * it. The model file must already be installed (see `modelInstall.ts`).
 *
 * whisper.rn is intentionally imported lazily so the rest of the app can
 * load even on simulators / dev environments where the native module is
 * not yet linked (e.g. an iOS Simulator running an older prebuild).
 */
import { getInstalledPath, toNativePath } from "./modelInstall";

let whisperContextPromise: Promise<any> | null = null;
let lastLoadedPath: string | null = null;

async function loadWhisperModule(): Promise<any> {
  try {
    return await import("whisper.rn");
  } catch (e: any) {
    throw new Error(
      `WHISPER_NATIVE_MISSING: whisper.rn is not linked into this build. Run \`npx expo prebuild\` and rebuild the app. Original error: ${e?.message ?? e}`,
    );
  }
}

async function getContext(): Promise<any> {
  const path = await getInstalledPath("stt");
  if (!path) {
    throw new Error(
      "STT_MODEL_NOT_INSTALLED: pick or download the Whisper base model from the install screen",
    );
  }

  // If the user reinstalled to a different path, drop the cached context.
  if (whisperContextPromise && lastLoadedPath !== path) {
    whisperContextPromise = null;
  }

  if (!whisperContextPromise) {
    lastLoadedPath = path;
    whisperContextPromise = (async () => {
      const mod = await loadWhisperModule();
      const { initWhisper } = mod;
      return initWhisper({ filePath: path });
    })();
  }
  return whisperContextPromise;
}

export async function transcribeOnDevice(
  audioUri: string,
  language: string = "en",
): Promise<{ transcript: string; detected_language: string }> {
  const ctx = await getContext();
  console.log("Transcribing on-device from audio URI:", audioUri);
  const { promise } = ctx.transcribe(audioUri, {
    language,
  });
  const { result } = await promise;
  console.log("On-device transcription result:", result);
  return {
    transcript: (result ?? "").trim(),
    detected_language: language,
  };
}

/**
 * Best-effort cleanup. Called when switching to edge-only mode for a while
 * to free RAM. Subsequent calls will re-initialise the context.
 */
export async function releaseWhisper(): Promise<void> {
  if (!whisperContextPromise) return;
  try {
    const ctx = await whisperContextPromise;
    if (ctx && typeof ctx.release === "function") {
      await ctx.release();
    }
  } catch (e) {
    console.warn("releaseWhisper:", e);
  } finally {
    whisperContextPromise = null;
    lastLoadedPath = null;
  }
}
