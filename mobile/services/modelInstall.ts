/**
 * Unified Model Install
 *
 * Handles the two ways a user can place a model file on the phone:
 *   1. Pick an existing .litertlm / .bin file from the Files app (default,
 *      ideal for offline / low-bandwidth environments where the operator
 *      transfers the file via AirDrop or USB).
 *   2. Download the file from HuggingFace at runtime (~2.6 GB for the LLM,
 *      ~140 MB for whisper), with progress callbacks.
 *
 * Resolved local paths are persisted in AsyncStorage so subsequent launches
 * can boot straight into on-device inference without prompting again.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";

export type ModelKind = "llm" | "stt";

interface ModelSpec {
  /** Stable filename inside FileSystem.documentDirectory. */
  fileName: string;
  /** AsyncStorage key for the resolved on-disk path. */
  storageKey: string;
  /** Public download URL, used by `downloadModel`. */
  downloadUrl: string;
  /** Approximate download size in bytes; used for friendly UI strings only. */
  approxBytes: number;
  /** Lower bound used to detect partial / corrupted downloads. */
  minValidBytes: number;
}

const MODELS: Record<ModelKind, ModelSpec> = {
  llm: {
    fileName: "gemma-4-E2B-it.litertlm",
    storageKey: "@soba_llm_path",
    downloadUrl:
      "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm",
    approxBytes: 2.58 * 1024 * 1024 * 1024,
    minValidBytes: 1.5 * 1024 * 1024 * 1024,
  },
  stt: {
    fileName: "ggml-base.bin",
    storageKey: "@soba_stt_path",
    downloadUrl:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    approxBytes: 142 * 1024 * 1024,
    minValidBytes: 100 * 1024 * 1024,
  },
};

export interface InstallProgress {
  kind: ModelKind;
  bytesWritten: number;
  bytesTotal: number;
  fraction: number;
}

export type ProgressCallback = (p: InstallProgress) => void;

function stripFileScheme(path: string): string {
  return path.replace(/^file:\/\//, "");
}

/**
 * Returns the cached on-disk path for the given model, or null if it has
 * never been installed (or was deleted).
 */
export async function getInstalledPath(
  kind: ModelKind,
): Promise<string | null> {
  const spec = MODELS[kind];
  const stored = await AsyncStorage.getItem(spec.storageKey);
  if (!stored) return null;

  const info = await FileSystem.getInfoAsync(stored);
  if (!info.exists) {
    await AsyncStorage.removeItem(spec.storageKey);
    return null;
  }
  const size = info.size;
  if (size !== undefined && size < spec.minValidBytes) {
    // Stale partial download; clean up and force a re-install.
    await FileSystem.deleteAsync(stored, { idempotent: true });
    await AsyncStorage.removeItem(spec.storageKey);
    return null;
  }
  return stored;
}

export async function isInstalled(kind: ModelKind): Promise<boolean> {
  return (await getInstalledPath(kind)) !== null;
}

/**
 * Opens the document picker so the user can choose a model file they
 * already transferred to the phone. The chosen file is copied into the
 * app's sandbox so subsequent launches can find it.
 */
export async function pickModelFile(kind: ModelKind): Promise<string> {
  const spec = MODELS[kind];
  const picked = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (picked.canceled || !picked.assets || picked.assets.length === 0) {
    throw new Error("PICK_CANCELLED");
  }
  const asset = picked.assets[0];

  const destPath = `${FileSystem.documentDirectory}${spec.fileName}`;
  // If something is already there, remove it before the copy.
  await FileSystem.deleteAsync(destPath, { idempotent: true });
  await FileSystem.copyAsync({ from: asset.uri, to: destPath });

  const info = await FileSystem.getInfoAsync(destPath);
  const size = info.exists ? info.size ?? 0 : 0;
  if (!info.exists || size < spec.minValidBytes) {
    await FileSystem.deleteAsync(destPath, { idempotent: true });
    throw new Error(
      `MODEL_TOO_SMALL: picked file is ${(size / 1024 / 1024).toFixed(1)} MB which is below the expected size for ${kind === "llm" ? "Gemma 4 E2B" : "Whisper base"}`,
    );
  }

  await AsyncStorage.setItem(spec.storageKey, destPath);
  return destPath;
}

/**
 * Streams the model from its public URL into the app sandbox. Suitable for
 * users on good WiFi who would rather wait than transfer files manually.
 */
export async function downloadModel(
  kind: ModelKind,
  onProgress?: ProgressCallback,
): Promise<string> {
  const spec = MODELS[kind];
  const destPath = `${FileSystem.documentDirectory}${spec.fileName}`;

  // Clean any partial leftover from a previous attempt.
  const existing = await FileSystem.getInfoAsync(destPath);
  if (existing.exists) {
    await FileSystem.deleteAsync(destPath, { idempotent: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    spec.downloadUrl,
    destPath,
    {},
    (snapshot) => {
      const total =
        snapshot.totalBytesExpectedToWrite > 0
          ? snapshot.totalBytesExpectedToWrite
          : spec.approxBytes;
      const fraction = total > 0 ? snapshot.totalBytesWritten / total : 0;
      onProgress?.({
        kind,
        bytesWritten: snapshot.totalBytesWritten,
        bytesTotal: total,
        fraction,
      });
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(
      `DOWNLOAD_FAILED: HTTP ${result?.status ?? "unknown"} fetching ${kind} model`,
    );
  }

  const info = await FileSystem.getInfoAsync(destPath);
  const size = info.exists ? info.size ?? 0 : 0;
  if (!info.exists || size < spec.minValidBytes) {
    await FileSystem.deleteAsync(destPath, { idempotent: true });
    throw new Error(
      `DOWNLOAD_TOO_SMALL: downloaded file is ${(size / 1024 / 1024).toFixed(1)} MB, expected at least ${(spec.minValidBytes / 1024 / 1024).toFixed(0)} MB`,
    );
  }

  await AsyncStorage.setItem(spec.storageKey, destPath);
  return destPath;
}

/**
 * Wipe the recorded path and remove the on-disk file. Used by a "reinstall"
 * action in settings or to recover from a known-bad file.
 */
export async function removeModel(kind: ModelKind): Promise<void> {
  const spec = MODELS[kind];
  const stored = await AsyncStorage.getItem(spec.storageKey);
  if (stored) {
    await FileSystem.deleteAsync(stored, { idempotent: true });
  }
  await AsyncStorage.removeItem(spec.storageKey);
}

/**
 * LiteRT-LM expects POSIX paths without the `file://` scheme prefix.
 */
export function toNativePath(path: string): string {
  return stripFileScheme(path);
}

export function modelApproxSize(kind: ModelKind): number {
  return MODELS[kind].approxBytes;
}

export function modelDownloadUrl(kind: ModelKind): string {
  return MODELS[kind].downloadUrl;
}

export function modelFileName(kind: ModelKind): string {
  return MODELS[kind].fileName;
}
