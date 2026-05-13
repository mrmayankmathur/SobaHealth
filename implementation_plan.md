# Aivaan — Implementation Plan (v3)

> Final Revised Implementation Plan
>
> **Current Status (2026-05-13):**
> ✅ **Phase 1 (Foundation):** 100% Complete.
> ✅ **Phase 2 (Core Features):** 100% Complete. All core features built.
> 🚧 **Phase 3 (Polish):** 80% Complete. Records tab, offline badge, chat history done. Streaming WIP.
> 📋 **Next Steps:** Test on device, record demo video, write Kaggle submission.

## Architecture Flow

```
📱 React Native App (Expo) — installed as APK
│   ├── QR Code Scanner → connects to edge server
│   ├── Local SQLite (preferences, health records, chat history)
│   ├── TTS via expo-speech (fallback to server generated mp3)
│   ├── Audio recording via expo-av (push-to-talk)
│   └── 5 tabs: Home, Chat, Scan, Symptoms, Records
│
├── (Local WiFi / Hotspot — NO INTERNET)
│
🖥️ Edge Server (Your Laptop)
    ├── FastAPI (Python) — generates QR code on startup
    ├── Ollama → Gemma 4 E4B (all AI inference)
    │   ├── Function calling (structured symptom extraction)
    │   ├── Thinking mode (reasoning chain for risk analysis)
    │   ├── Vision (document scan, food analysis)
    │   └── 256K context (full history in single prompt)
    ├── faster-whisper (STT, offline)
    └── gTTS fallback (server-side TTS for Hindi/Tamil)
```

## Gemma 4 Feature Usage Map

| App Feature       | Gemma 4 Feature           | Why It Matters                                                  |
| ----------------- | ------------------------- | --------------------------------------------------------------- |
| Symptom Checker   | **Function Calling**      | Returns structured JSON via native tool use, not prompt hacking |
| Risk Analysis     | **Thinking Mode**         | Shows reasoning chain in UI ("AI reasoning...")                 |
| Document Scan     | **Multimodal Vision**     | Image → structured extraction                                   |
| Food Analysis     | **Multimodal Vision**     | Photo → calorie breakdown                                       |
| Full History Chat | **256K Context**          | Entire medical profile in single prompt                         |
| Multi-language    | **Native Multilingual**   | Hindi/Tamil/Telugu without translation APIs                     |
| Health Chatbot    | **Instruction Following** | Domain-constrained safe responses                               |

## SQLite Schema (Defined in Phase 1, used throughout)

```sql
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY,
  name TEXT, age INTEGER, gender TEXT,
  blood_group TEXT, conditions TEXT,  -- JSON array
  allergies TEXT,                     -- JSON array
  preferred_language TEXT DEFAULT 'en'
);

CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT, created_at INTEGER,
  session_type TEXT  -- 'health' | 'symptom' | 'nutrition'
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT, role TEXT,
  content TEXT, language TEXT,
  created_at INTEGER
);

CREATE TABLE health_records (
  id TEXT PRIMARY KEY,
  type TEXT,  -- 'lab' | 'prescription' | 'vaccination'
  extracted_data TEXT,  -- JSON
  summary TEXT,
  created_at INTEGER
);

CREATE TABLE health_trends (
  id TEXT PRIMARY KEY,
  metric TEXT,  -- 'bp_systolic' | 'glucose' | 'weight'
  value REAL, unit TEXT,
  recorded_at INTEGER
);
```

## Phase 1 — Foundation (Day 1)

1. ✅ Expo scaffold + tab navigation
2. ✅ FastAPI + Ollama wired (chat working)
3. ✅ QR connection flow
4. ✅ Health profile onboarding
5. ✅ SQLite schema (all tables)
6. ✅ TTS fallback chain
7. ✅ Test Ollama thinking mode (fallback to prompt-engineering `<think>` tags)

## Phase 2 — Core Features (Days 2–4)

8. ✅ Push-to-talk voice pipeline (recorder.ts + chat integration)
9. ✅ Document scanner (multimodal)
10. ✅ Symptom checker (function calling + thinking/fallback)
11. ✅ Multi-language toggle

## Phase 3 — Polish (Days 5–6)

12. 🚧 Streaming chat responses (FastAPI SSE -> React Native EventSource)
13. ✅ Offline indicator badge ("AI Running Locally")
14. ✅ Chat history from SQLite (load/save in chat.tsx)
15. ✅ Health records list (records.tsx tab)
16. ✅ UI polish, animations (pulse recording, fade-in dashboard)
17. ✅ Nutrition scan (food analysis via vision endpoint)

## Phase 4 — Demo & Submit (Days 7–8)

18. Write Priya's script (3 scenes) BEFORE recording
19. Record video
20. Kaggle writeup
21. GitHub cleanup + submit
