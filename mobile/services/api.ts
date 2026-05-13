/**
 * Edge Server API Client
 * Handles all communication between the mobile app and the local FastAPI server.
 * The server IP is discovered via QR code scan and stored in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SERVER_URL = '@aivaan_server_url';
const DEFAULT_PORT = 8000;

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
 * Expected format: {"host": "192.168.x.x", "port": 8000}
 */
export function parseQrData(data: string): string | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.host && parsed.port) {
      return `http://${parsed.host}:${parsed.port}`;
    }
    // Also accept plain URL
    if (data.startsWith('http')) return data;
    return null;
  } catch {
    // Maybe it's just a plain URL
    if (data.startsWith('http')) return data;
    return null;
  }
}

/**
 * Test connection to the edge server.
 * Returns server info if connected, null if not.
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
// API Methods — Each maps to a FastAPI endpoint
// =============================================================================

/**
 * Send a chat message to the AI health assistant.
 */
export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  language: string = 'en'
): Promise<{ response: string; language: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Not connected to server');

  const res = await fetch(`${serverUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, language, stream: false }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }

  return res.json();
}

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
 * Extract data from a medical document image.
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
 * Check symptoms and get risk assessment.
 */
export async function checkSymptoms(
  messages: Array<{ role: string; content: string }>,
  language: string = 'en'
): Promise<{ response: string; urgency: string }> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) throw new Error('Not connected to server');

  const res = await fetch(`${serverUrl}/api/symptom-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, language }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Symptom check failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Analyze food image for nutrition data.
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
