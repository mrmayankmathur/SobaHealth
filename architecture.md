# Architecture Flow

## Overview

SobaHealth Edge is designed as a privacy-first, offline-capable AI Health Assistant. The architecture is split into two main components:

1. **Frontend:** A React Native mobile application built with Expo.
2. **Backend (Edge Server):** A local Python server using FastAPI that interfaces with local AI models (like Ollama for text/LLM and Whisper for speech-to-text).

This separation allows the heavy AI processing to be offloaded to a local server (e.g., a laptop or local network device) while keeping the mobile client lightweight and ensuring no personal health data leaves the local network.

## 1. Mobile App (Frontend)

The mobile app is built using **Expo** and **React Native**. It uses **Expo Router** for navigation.

### Key Components:

- **`mobile/app/` (Screens):**
  - `(tabs)/`: The main bottom tab navigation containing `index.tsx` (home), `chat.tsx`, `records.tsx`, `scan.tsx`, and `symptoms.tsx`.
  - `onboarding.tsx`: Initial user setup.
  - `connect.tsx`: Handles the discovery and connection to the local Edge Server.
- **`mobile/components/`:**
  - UI elements like `ChatBubble.tsx`, `PTTButton.tsx` (Push-To-Talk), and `TrendCard.tsx`.
- **`mobile/services/`:**
  - `api.ts`: Manages REST communication with the FastAPI backend.
  - `llm.ts`: Handles the logic for interacting with the AI models.
  - `speech.ts` & `recorder.ts`: Manages audio recording for voice input and text-to-speech for AI responses.
  - `database.ts`: Local data persistence (e.g., using Expo SQLite or AsyncStorage).

## 2. Edge Server (Backend)

The backend is a **FastAPI** application designed to run locally.

### Key Components:

- **`backend/run.py`:** The main entry point that starts the Uvicorn server on the configured host and port.
- **`backend/app/routers/`:**
  - `chat.py`: Handles text-based LLM queries.
  - `voice.py`: Handles audio uploads and transcription.
  - `vision.py`: Handles image uploads for multimodal analysis.
  - `symptoms.py`: Specialized endpoints for processing health symptoms.
  - `tts.py`: Handles text-to-speech conversion.
  - `discovery.py`: Endpoints for the mobile app to discover the server on the local network.
- **`backend/app/services/`:**
  - `ollama_service.py`: Interfaces with the local Ollama daemon to run large language models (e.g., Llama 3, Gemma).
  - `whisper_service.py`: Interfaces with local Whisper models for processing audio inputs into text.
  - `prompt_templates.py`: Contains the system prompts tailored for the health assistant persona.

## System Data Flow

1. **Connection:** The mobile app discovers and connects to the Edge Server via the local network (managed by `connect.tsx` and the `discovery` router).
2. **User Interaction:** The user interacts via text (`chat.tsx`), voice (`PTTButton.tsx`), or image upload (`scan.tsx`).
3. **Transmission:** The frontend services (`api.ts`, `llm.ts`) format the payload and send a HTTP request to the Edge Server.
4. **Processing:**
   - **Voice:** The `voice.py` router receives audio, uses `whisper_service.py` to transcribe it to text, and passes the text to the LLM.
   - **Text:** The `chat.py` or `symptoms.py` router receives text and uses `ollama_service.py` to generate an AI response.
   - **Vision:** The `vision.py` router uses multimodal LLM capabilities to analyze images.
5. **Response:** The FastAPI server returns the AI's response to the mobile app.
6. **Output:** The mobile app displays the response in the UI and optionally reads it out loud using TTS services.
