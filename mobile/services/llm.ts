/**
 * Legacy entry point for on-device LLM helpers.
 *
 * Real implementation now lives in:
 *   - `services/modelInstall.ts`     (picker / download / paths)
 *   - `services/localInference.ts`   (LiteRT-LM wrapper, chat/symptoms/vision)
 *   - `services/whisperLocal.ts`     (whisper.rn STT)
 *   - `services/inferenceRouter.ts`  (edge vs device routing)
 *
 * This file just re-exports the surface that older call sites import so
 * nothing breaks during the hybrid migration. New code should target the
 * dedicated modules directly.
 */
import {
  pickModelFile as pickModelFileGeneric,
  downloadModel,
  getInstalledPath,
  ProgressCallback,
} from "./modelInstall";
import { localChat } from "./localInference";

/**
 * Picks the on-device Gemma 4 E2B model file. Kept under its original
 * name (`pickModelFile`) for backwards compatibility with the
 * commit-9a97560 call site in `chat.tsx`.
 */
export async function pickModelFile(): Promise<boolean> {
  try {
    await pickModelFileGeneric("llm");
    return true;
  } catch (e: any) {
    if (e?.message === "PICK_CANCELLED") return false;
    console.warn("pickModelFile:", e);
    return false;
  }
}

/**
 * Downloads the Gemma 4 E2B model from HuggingFace with progress.
 * Returns the absolute on-disk path.
 */
export async function downloadLLM(
  onProgress?: ProgressCallback,
): Promise<string> {
  return downloadModel("llm", onProgress);
}

/** Whether the LLM model file is currently installed on the device. */
export async function llmInstalledPath(): Promise<string | null> {
  return getInstalledPath("llm");
}

/**
 * Direct on-device chat call. Most callers should prefer
 * `inferenceRouter.routeChat` so the edge path is considered first.
 */
export async function generateLLMResponse(
  prompt: string,
  language: string = "en",
): Promise<string> {
  const { response } = await localChat([{ role: "user", content: prompt }], language);
  return response;
}
