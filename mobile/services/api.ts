/**
 * Edge Server API Client
 * Handles all communication between the mobile app and the local FastAPI server.
 * The server IP is discovered via QR code scan and stored in AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateLLMResponse } from "./llm";

const STORAGE_KEY_SERVER_URL = "@sobahealth_server_url";

// Singleton state
let _serverUrl: string | null = null;

/**
 * Get the stored server URL, or null if not configured yet.
 */
export async function getServerUrl(): Promise<string | null> {
  if (_serverUrl) return _serverUrl;
  const stored = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
  if (stored) _serverUrl = stored;
  return _serverUrl;
}

/**
 * Save the server URL from QR code scan.
 */
export async function setServerUrl(url: string): Promise<void> {
  _serverUrl = url;
  await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, url);
}

/**
 * Clear the stored server URL (for re-scan).
 */
export async function clearServerUrl(): Promise<void> {
  _serverUrl = null;
  await AsyncStorage.removeItem(STORAGE_KEY_SERVER_URL);
}

/**
 * Parse QR code data from the edge server.
 */
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

/**
 * Test connection to the edge server.
 */
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
// API Methods — EDGE SERVER LLM (With Local SQLite RAG)
// =============================================================================

import { getUserProfile, getHealthRecords } from "./database";

/**
 * Builds the RAG context from the user's local SQLite profile and health records.
 */
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
    } catch (e) {}

    try {
      const allergies = JSON.parse(profile.allergies);
      if (allergies.length > 0)
        context += `Allergies: ${allergies.join(", ")}\n`;
    } catch (e) {}

    if (records && records.length > 0) {
      context += `\nRecent Health Records:\n`;
      // Take up to 3 most recent records for context
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

/**
 * Send a chat message to the AI health assistant running on the Edge Server.
 */
export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<{ response: string; language: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error("Not connected to server");

  const ragContext = await buildRagContext();

  // Clone messages and inject context into the first message or append as system
  const payloadMessages = [...messages];
  if (payloadMessages.length > 0) {
    payloadMessages[0].content = ragContext + payloadMessages[0].content;
  } else {
    payloadMessages.push({ role: "user", content: ragContext + "Hello" });
  }

  const res = await fetch(`${serverUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: payloadMessages,
      language,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat failed: ${res.status}`);
  }

  const data = await res.json();
  return { response: data.response, language: data.language };
}

/**
 * Check symptoms and get risk assessment using the Edge Server model.
 */
export async function checkSymptoms(
  messages: Array<{ role: string; content: string }>,
  language: string = "en",
): Promise<{
  response: string;
  urgency: string;
  reasoning?: string;
  extracted_data?: any;
}> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error("Not connected to server");

  const ragContext = await buildRagContext();

  const payloadMessages = [...messages];
  if (payloadMessages.length > 0) {
    payloadMessages[0].content = ragContext + payloadMessages[0].content;
  }

  const res = await fetch(`${serverUrl}/api/symptom-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: payloadMessages,
      language,
      use_thinking: true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Symptom check failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    response: data.response,
    urgency: data.urgency,
    reasoning: data.thinking,
    extracted_data: { risk_flags: data.risk_flags },
  };
}

// =============================================================================
// API Methods — EDGE SERVER (For Heavy Vision tasks)
// =============================================================================

/**
 * Send audio for transcription (STT).
 */
export async function transcribeAudio(
  audioUri: string,
  language?: string,
): Promise<{ transcript: string; detected_language: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error("Not connected to server");

  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    type: "audio/m4a",
    name: "recording.m4a",
  } as any);
  if (language) {
    formData.append("language", language);
  }

  const res = await fetch(`${serverUrl}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Transcription failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Extract data from a medical document image using Vision model on Edge.
 */
export async function extractDocument(
  imageUri: string,
  language: string = "en",
): Promise<{ extracted_data: any; summary: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error("Not connected to server");

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
    throw new Error(err.detail || `Extraction failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Analyze food image for nutrition data using Vision model on Edge.
 */
export async function analyzeFood(
  imageUri: string,
): Promise<{ nutrition: any }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error("Not connected to server");

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
    throw new Error(err.detail || `Food analysis failed: ${res.status}`);
  }

  return res.json();
}
