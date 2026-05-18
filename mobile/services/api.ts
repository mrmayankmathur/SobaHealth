/**
 * Edge Server API Client + Hybrid Inference Surface
 *
 * Owns the low-level fetch logic for talking to the FastAPI edge server
 * (`http://<lan-ip>:8000`). Every high-level inference call
 * (`sendChatMessage`, `checkSymptoms`, `extractDocument`, `analyzeFood`,
 * `transcribeAudio`) is now routed through `inferenceRouter` so the edge
 * path is preferred when reachable but on-device fallback kicks in
 * automatically.
 *
 * Local SQLite RAG context is built here and injected into every prompt
 * regardless of which backend serves the request, so personalisation
 * stays consistent across paths.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  routeChat,
  routeSymptoms,
  routeVision,
  routeSTT,
  invalidateHealthCache,
} from "./inferenceRouter";
import { getUserProfile, getHealthRecords } from "./database";

const STORAGE_KEY_SERVER_URL = "@sobahealth_server_url";

let _serverUrl: string | null = null;

export async function getServerUrl(): Promise<string | null> {
  if (_serverUrl) return _serverUrl;
  const stored = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
  if (stored) _serverUrl = stored;
  return _serverUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  _serverUrl = url;
  await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, url);
  invalidateHealthCache();
}

export async function clearServerUrl(): Promise<void> {
  _serverUrl = null;
  await AsyncStorage.removeItem(STORAGE_KEY_SERVER_URL);
  invalidateHealthCache();
}

export function parseQrData(data: string): string | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.host && parsed.port) {
      return `http://${parsed.host}:${parsed.port}`;
    }
    if (data.startsWith("http")) return data;
    return null;
  } catch {
    if (data.startsWith("http")) return data;
    return null;
  }
}

export async function testConnection(url?: string): Promise<{
  connected: boolean;
  serverInfo?: any;
  error?: string;
}> {
  const serverUrl = url || (await getServerUrl());
  if (!serverUrl) {
    return { connected: false, error: "No server URL configured" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${serverUrl}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return { connected: true, serverInfo: data };
    }
    return { connected: false, error: `Server returned ${response.status}` };
  } catch (e: any) {
    return { connected: false, error: e.message || "Connection failed" };
  }
}

// =============================================================================
// Local-first RAG context (works for both edge and device inference paths)
// =============================================================================

async function buildRagContext(): Promise<string> {
  try {
    const profile = await getUserProfile();
    const records = await getHealthRecords();

    if (!profile) return "";

    let context = `[PATIENT CONTEXT (DO NOT REPEAT TO USER)]\n`;
    context += `Name: ${profile.name}, Age: ${profile.age}, Gender: ${profile.gender}, Blood: ${profile.blood_group}\n`;

    try {
      const conditions = JSON.parse(profile.conditions);
      if (conditions.length > 0)
        context += `Medical Conditions: ${conditions.join(", ")}\n`;
    } catch {}

    try {
      const allergies = JSON.parse(profile.allergies);
      if (allergies.length > 0)
        context += `Allergies: ${allergies.join(", ")}\n`;
    } catch {}

    if (records && records.length > 0) {
      context += `\nRecent Health Records:\n`;
      records.slice(0, 3).forEach((r) => {
        context += `- [${new Date(r.created_at).toISOString().split("T")[0]} - ${r.type.toUpperCase()}] ${r.summary}\n`;
      });
    }

    context += `[/PATIENT CONTEXT]\n\n`;
    return context;
  } catch (e) {
    console.warn("Failed to build RAG context:", e);
    return "";
  }
}

function injectRag(
  messages: Array<{ role: string; content: string }>,
  ragContext: string,
): Array<{ role: string; content: string }> {
  if (!ragContext) return messages;
  const cloned = messages.map((m) => ({ ...m }));
  if (cloned.length === 0) {
    cloned.push({ role: "user", content: ragContext + "Hello" });
  } else {
    cloned[0].content = ragContext + cloned[0].content;
  }
  return cloned;
}

// =============================================================================
// High-level inference calls (route through inferenceRouter)
// =============================================================================

export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<{
  response: string;
  language: string;
  reasoning?: string;
  via?: "edge" | "device";
}> {
  const ragContext = await buildRagContext();
  const enrichedMessages = injectRag(messages, ragContext);

  const result = await routeChat(enrichedMessages, language, async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error("EDGE_NOT_CONFIGURED");
    const res = await fetch(`${serverUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: enrichedMessages,
        language,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `EDGE_UNREACHABLE: ${res.status}`);
    }
    const data = await res.json();
    return {
      response: data.response,
      language: data.language,
      reasoning: data.reasoning ?? data.thinking,
    };
  });

  return result;
}

export async function checkSymptoms(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<{
  response: string;
  urgency: string;
  reasoning?: string;
  extracted_data?: any;
  via?: "edge" | "device";
}> {
  const ragContext = await buildRagContext();
  const enrichedMessages = injectRag(messages, ragContext);

  const result = await routeSymptoms(enrichedMessages, language, async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error("EDGE_NOT_CONFIGURED");
    const res = await fetch(`${serverUrl}/api/symptom-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: enrichedMessages,
        language,
        use_thinking: true,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `EDGE_UNREACHABLE: ${res.status}`);
    }
    const data = await res.json();
    return {
      response: data.response,
      urgency: data.urgency,
      reasoning: data.thinking,
      extracted_data: { risk_flags: data.risk_flags },
    };
  });

  return result;
}

export async function transcribeAudio(
  audioUri: string,
  language?: string,
): Promise<{
  transcript: string;
  detected_language: string;
  via?: "edge" | "device";
}> {
  const lang = language || "en";
  const result = await routeSTT(audioUri, lang, async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error("EDGE_NOT_CONFIGURED");

    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/wav",
      name: "recording.wav",
    } as any);
    if (language) formData.append("language", language);

    const res = await fetch(`${serverUrl}/api/transcribe`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `EDGE_UNREACHABLE: ${res.status}`);
    }
    return res.json();
  });
  return result;
}

export async function extractDocument(
  imageUri: string,
  language: string = "en",
): Promise<{ extracted_data: any; summary: string; via?: "edge" | "device" }> {
  const prompt =
    "Extract the structured medical data from this document image. Return JSON with keys for test_name, value, unit, normal_range when relevant, plus a one-sentence patient-friendly summary.";

  const result = await routeVision(imageUri, prompt, language, async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error("EDGE_NOT_CONFIGURED");

    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: "image/jpeg",
      name: "document.jpg",
    } as any);
    formData.append("language", language);

    const res = await fetch(`${serverUrl}/api/extract-document`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `EDGE_UNREACHABLE: ${res.status}`);
    }
    const data = await res.json();
    return JSON.stringify({
      extracted_data: data.extracted_data,
      summary: data.summary,
    });
  });

  // On-device path returns plain text from the model; try to coerce.
  if (result.via === "device") {
    let extracted_data: any = {};
    let summary = result.text;
    const jsonStart = result.text.indexOf("{");
    const jsonEnd = result.text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        extracted_data = JSON.parse(result.text.substring(jsonStart, jsonEnd + 1));
        if (extracted_data.summary) summary = extracted_data.summary;
      } catch {}
    }
    return { extracted_data, summary, via: "device" };
  }

  try {
    const parsed = JSON.parse(result.text);
    return { ...parsed, via: result.via };
  } catch {
    return { extracted_data: {}, summary: result.text, via: result.via };
  }
}

export async function analyzeFood(
  imageUri: string,
): Promise<{ nutrition: any; via?: "edge" | "device" }> {
  const prompt =
    "Analyse this food image. Return JSON with keys: items (array of {name, approx_calories, macros}), summary (single short patient-friendly line).";

  const result = await routeVision(imageUri, prompt, "en", async () => {
    const serverUrl = await getServerUrl();
    if (!serverUrl) throw new Error("EDGE_NOT_CONFIGURED");

    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: "image/jpeg",
      name: "food.jpg",
    } as any);

    const res = await fetch(`${serverUrl}/api/analyze-food`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `EDGE_UNREACHABLE: ${res.status}`);
    }
    const data = await res.json();
    return JSON.stringify(data.nutrition);
  });

  if (result.via === "device") {
    let nutrition: any = { summary: result.text };
    const jsonStart = result.text.indexOf("{");
    const jsonEnd = result.text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        nutrition = JSON.parse(result.text.substring(jsonStart, jsonEnd + 1));
      } catch {}
    }
    return { nutrition, via: "device" };
  }

  try {
    const parsed = JSON.parse(result.text);
    return { nutrition: parsed, via: result.via };
  } catch {
    return { nutrition: { summary: result.text }, via: result.via };
  }
}
