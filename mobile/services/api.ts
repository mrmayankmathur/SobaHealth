/**
 * Edge Server API Client
 * Handles all communication between the mobile app and the local FastAPI server.
 * The server IP is discovered via QR code scan and stored in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateLLMResponse } from './llm';

const STORAGE_KEY_SERVER_URL = '@aivaan_server_url';

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
    if (data.startsWith('http')) return data;
    return null;
  } catch {
    if (data.startsWith('http')) return data;
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
    return { connected: false, error: 'No server URL configured' };
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
    return { connected: false, error: e.message || 'Connection failed' };
  }
}

// =============================================================================
// API Methods — ON-DEVICE LLM
// =============================================================================

/**
 * Send a chat message to the AI health assistant using the on-device model.
 */
export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  language: string = 'en'
): Promise<{ response: string; language: string }> {
  // Construct Gemma instruction-tuned prompt
  let prompt = '';
  for (const m of messages) {
    prompt += `<start_of_turn>${m.role}\n${m.content}<end_of_turn>\n`;
  }
  prompt += `<start_of_turn>model\nRespond primarily in ${language}:\n`;

  const responseText = await generateLLMResponse(prompt);
  return { response: responseText.trim(), language };
}

/**
 * Check symptoms and get risk assessment using the on-device model.
 */
export async function checkSymptoms(
  messages: Array<{ role: string; content: string }>,
  language: string = 'en'
): Promise<{ response: string; urgency: string; reasoning?: string; extracted_data?: any }> {
  // Construct prompt forcing JSON output for structured symptom triage
  let prompt = '';
  for (const m of messages) {
    prompt += `<start_of_turn>${m.role}\n${m.content}<end_of_turn>\n`;
  }
  prompt += `<start_of_turn>model\n`;
  prompt += `Analyze the symptoms. Output MUST be valid JSON with keys: "response" (friendly message to user asking follow ups or giving advice), "urgency" ("emergency", "see_doctor", or "self_care"), "reasoning" (your logic chain), and "extracted_data" (primary and associated symptoms). Respond in ${language}.\n`;

  try {
    const rawResponse = await generateLLMResponse(prompt);
    
    // Extract JSON from LLM output block
    const jsonStart = rawResponse.indexOf('{');
    const jsonEnd = rawResponse.lastIndexOf('}') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = rawResponse.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonStr);
      return {
        response: parsed.response || 'Please provide more details about how you are feeling.',
        urgency: parsed.urgency || 'unknown',
        reasoning: parsed.reasoning || rawResponse,
        extracted_data: parsed.extracted_data || {}
      };
    } else {
      // Fallback if LLM fails to structure JSON
      return { 
        response: rawResponse, 
        urgency: 'unknown', 
        reasoning: 'Failed to format JSON logic.', 
        extracted_data: {} 
      };
    }
  } catch (err: any) {
    throw new Error(err.message || 'Symptom check failed to analyze via local LLM.');
  }
}

// =============================================================================
// API Methods — EDGE SERVER (For Heavy Vision tasks)
// =============================================================================

/**
 * Send audio for transcription (STT).
 */
export async function transcribeAudio(
  audioUri: string,
  language?: string
): Promise<{ transcript: string; detected_language: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Not connected to server');

  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);
  if (language) {
    formData.append('language', language);
  }

  const res = await fetch(`${serverUrl}/api/transcribe`, {
    method: 'POST',
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
  language: string = 'en'
): Promise<{ extracted_data: any; summary: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Not connected to server');

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'document.jpg',
  } as any);
  formData.append('language', language);

  const res = await fetch(`${serverUrl}/api/extract-document`, {
    method: 'POST',
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
  imageUri: string
): Promise<{ nutrition: any }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Not connected to server');

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'food.jpg',
  } as any);

  const res = await fetch(`${serverUrl}/api/analyze-food`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Food analysis failed: ${res.status}`);
  }

  return res.json();
}