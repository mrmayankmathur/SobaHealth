/**
 * On-device Inference (LiteRT-LM / Gemma 4 E2B)
 *
 * Sits in front of `react-native-litert-lm` and exposes the same shape that
 * the rest of the app expects from the edge server, so the inference
 * router can swap between paths without callers caring.
 *
 * Capabilities:
 *   - chat:     plain text completion, returns trimmed string.
 *   - symptoms: JSON-coerced prompt that mimics the edge server's
 *               function-calling output (response/urgency/reasoning/extracted_data).
 *   - vision:   Android only. iOS XCFramework 0.3.7 lacks vision executor
 *               ops and will throw IOS_VISION_UNSUPPORTED.
 *
 * STT is handled by `whisperLocal.ts` because we ship a separate whisper.cpp
 * model for it.
 */
import { Platform } from "react-native";
import { getInstalledPath, toNativePath } from "./modelInstall";

let llmInstancePromise: Promise<any> | null = null;
let lastLoadedPath: string | null = null;

async function loadLitertModule(): Promise<any> {
  try {
    return await import("react-native-litert-lm");
  } catch (e: any) {
    throw new Error(
      `LITERT_NATIVE_MISSING: react-native-litert-lm is not linked into this build. Run \`npx expo prebuild\` and rebuild. Original error: ${e?.message ?? e}`,
    );
  }
}

async function getInstance(): Promise<any> {
  const path = await getInstalledPath("llm");
  if (!path) {
    throw new Error(
      "MODEL_NOT_INSTALLED: pick or download the Gemma 4 E2B litertlm file from the install screen",
    );
  }
  if (llmInstancePromise && lastLoadedPath !== path) {
    llmInstancePromise = null;
  }
  if (!llmInstancePromise) {
    lastLoadedPath = path;
    llmInstancePromise = (async () => {
      const mod = await loadLitertModule();
      const { createLLM } = mod;
      const llm = createLLM();
      await llm.loadModel(toNativePath(path), {
        backend: "cpu",
        maxTokens: 4096,
        systemPrompt:
          "You are a careful, concise, empathetic medical AI assistant. You give short, evidence-based answers and always advise seeing a clinician for serious or persistent symptoms. You never invent diagnoses.",
      });
      return llm;
    })();
  }
  return llmInstancePromise;
}

function languageName(code: string): string {
  return (
    {
      en: "English",
      hi: "Hindi",
      ta: "Tamil",
      te: "Telugu",
      bn: "Bengali",
      kn: "Kannada",
    }[code] ?? "English"
  );
}

// Helper to clean LiteRT-LM template wrappers and echoed prompts.
function cleanResponse(raw: string, prompt: string): string {
  let cleaned = raw.trim();

  // If the engine echoed the prompt at the start, strip it.
  if (cleaned.startsWith(prompt)) {
    cleaned = cleaned.substring(prompt.length).trim();
  }

  // Strip any echoed chat templates or turn wrappers.
  cleaned = cleaned
    .replace(/^<start_of_turn>model\s*/i, "")
    .replace(/^model\s*/i, "")
    .replace(/^<start_of_turn>user\s*/i, "")
    .replace(/^user\s*/i, "")
    .replace(/<end_of_turn>\s*$/i, "")
    .replace(/^ai assistant:\s*/i, "")
    .replace(/^assistant:\s*/i, "")
    .trim();

  return cleaned;
}

// Convert conversation into plain text without Gemma control tokens,
// because react-native-litert-lm applies templates automatically in C++.
function buildPlainTextPrompt(
  messages: Array<{ role: string; content: string }>,
  instruction?: string,
): string {
  // LiteRT-LM natively manages conversation history via its internal KV Cache.
  // We only pass the latest message to avoid quadratic context growth.
  const latestMessage = messages[messages.length - 1]?.content || "";
  if (instruction) {
    return `${instruction}\nPatient: ${latestMessage}`;
  }
  return latestMessage;
}

// ---- Chat ----------------------------------------------------------------

export async function localChat(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<{ response: string; language: string }> {
  const llm = await getInstance();
  const prompt = buildPlainTextPrompt(messages);

  if (typeof llm.resetConversation === "function") {
    llm.resetConversation();
  }

  try {
    const raw = await llm.sendMessage(prompt);
    const cleaned = cleanResponse(raw ?? "", prompt);
    return { response: cleaned, language };
  } catch (error: any) {
    if (error.message && error.message.includes("sendMessage failed")) {
      throw new Error(
        "LITERT_SEND_FAILED: The AI model failed to process this prompt. The input may be too long.",
      );
    }
    throw error;
  }
}

// ---- Symptoms ------------------------------------------------------------

export interface LocalSymptomResponse {
  response: string;
  urgency: string;
  reasoning?: string;
  extracted_data?: any;
}

function safeJsonExtract(raw: string): any | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = raw.substring(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export async function localSymptomCheck(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<LocalSymptomResponse> {
  const llm = await getInstance();
  const lang = languageName(language);
  const instruction =
    `Analyze the symptoms. Output ONLY a single valid JSON object, no preamble, with these exact keys:\n` +
    `  "response": string, friendly message asking a clarifying follow-up or giving next-step advice.\n` +
    `  "urgency": one of "emergency", "see_doctor", "self_care", or "gathering_info".\n` +
    `  "reasoning": string, a brief chain of thought.\n` +
    `  "extracted_data": object with "primary" (string) and "associated" (array of strings).\n` +
    `Respond in ${lang}.\n`;
  const prompt = buildPlainTextPrompt(messages, instruction);
  let raw: string | null = null;

  if (typeof llm.resetConversation === "function") {
    llm.resetConversation();
  }

  try {
    raw = await llm.sendMessage(prompt);
  } catch (error: any) {
    if (error.message && error.message.includes("sendMessage failed")) {
      throw new Error(
        "LITERT_SEND_FAILED: The AI model failed to process this prompt. The input may be too long.",
      );
    }
    throw error;
  }
  const cleaned = cleanResponse(raw ?? "", prompt);
  const parsed = safeJsonExtract(cleaned);

  if (!parsed) {
    return {
      response: cleaned,
      urgency: "gathering_info",
      reasoning: "Local model did not return parseable JSON; showing raw text.",
      extracted_data: {},
    };
  }
  return {
    response:
      typeof parsed.response === "string"
        ? parsed.response
        : "Please describe how you are feeling in a bit more detail.",
    urgency:
      typeof parsed.urgency === "string" ? parsed.urgency : "gathering_info",
    reasoning:
      typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
    extracted_data: parsed.extracted_data ?? {},
  };
}

// ---- Vision (Android only) ----------------------------------------------

export async function localVision(
  imageUri: string,
  prompt: string,
  language: string = "en",
): Promise<string> {
  if (Platform.OS === "ios") {
    throw new Error(
      "IOS_VISION_UNSUPPORTED: on-device vision is not yet available on iOS (react-native-litert-lm XCFramework lacks vision executor ops). Connect to the edge server or use an Android device.",
    );
  }
  const llm = await getInstance();
  if (typeof llm.sendMessageWithImage !== "function") {
    throw new Error(
      "LITERT_VISION_UNAVAILABLE: installed react-native-litert-lm version does not expose sendMessageWithImage. Upgrade the package.",
    );
  }
  const fullPrompt = `${prompt}\n\nRespond in ${languageName(language)}.`;
  const raw = await llm.sendMessageWithImage(
    fullPrompt,
    imageUri.replace(/^file:\/\//, ""),
  );
  return (raw ?? "").trim();
}

/**
 * Drop the LLM instance to free RAM (e.g. when the user pins back to
 * edge-only mode). The next call will reload from disk.
 */
export async function releaseLocalInference(): Promise<void> {
  if (!llmInstancePromise) return;
  try {
    const llm = await llmInstancePromise;
    if (llm && typeof llm.release === "function") {
      await llm.release();
    }
  } catch (e) {
    console.warn("releaseLocalInference:", e);
  } finally {
    llmInstancePromise = null;
    lastLoadedPath = null;
  }
}

/**
 * Reset the conversation cache inside the model (useful when starting a
 * fresh chat session so prior messages don't leak through).
 */
export async function resetLocalConversation(): Promise<void> {
  if (!llmInstancePromise) return;
  try {
    const llm = await llmInstancePromise;
    if (llm && typeof llm.resetConversation === "function") {
      llm.resetConversation();
    }
  } catch (e) {
    console.warn("resetLocalConversation:", e);
  }
}
