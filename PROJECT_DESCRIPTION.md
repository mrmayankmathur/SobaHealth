# SobaHealth (Aarogyamitra AI): Comprehensive Project Overview

## 1. Executive Summary & Mission
SobaHealth (internally concept-named Aarogyamitra AI) is an **offline-first, multimodal, and multilingual clinical AI copilot**. It is fundamentally designed to democratize high-level healthcare intelligence by completely decoupling AI capabilities from internet dependency.

**The Problem:** Over 3 billion people globally, particularly in the Global South, rural areas, and disaster zones, lack reliable internet access. Consequently, they are locked out of the AI revolution. In these low-resource environments, the lack of medical specialists and language barriers lead to delayed or incorrect medical decisions and preventable health crises. Cloud-based AI systems fail here because they require constant connectivity and send highly sensitive health data to remote servers.

**The Solution:** SobaHealth provides a sophisticated AI health assistant that runs entirely on local hardware. It utilizes a **Dynamic Hybrid Edge Architecture** that routes medical queries either to a local edge node (like a clinic's laptop or village Raspberry Pi) or directly on the user's mobile device. It guarantees zero-latency, 100% private, and internet-independent clinical intelligence.

---

## 2. Target Audience & Deployment Scenarios
SobaHealth is not a generic "ChatGPT wrapper"; it is mission-specific infrastructure for offline intelligence. 

*   **Rural Healthcare Workers (ASHA workers in India):** Providing second-opinion triage and symptom checking in local languages.
*   **Low-Connectivity Clinics:** Acting as a local digital records system (EHR) combined with a medical reasoning engine.
*   **Disaster Response Teams:** Operating reliably in areas where network infrastructure has been destroyed.
*   **Privacy-Conscious Individuals:** Users who refuse to upload their personal medical data, lab reports, or symptom histories to cloud providers.

---

## 3. Core Architectural Paradigm: The "Decoupled Edge"
The system utilizes a brilliant three-tier architecture to balance performance constraints of low-cost mobile devices with the heavy compute requirements of modern LLMs.

### Tier 1: The Client (Mobile App)
*   **Technology:** React Native & Expo (TypeScript).
*   **Role:** Acts as the lightweight interface. It handles the UI, local SQLite database for Electronic Health Records (EHR) and user preferences, offline Text-to-Speech (TTS), and audio recording for Push-to-Talk interactions.
*   **Data Persistence:** Uses Expo SQLite for "Offline RAG" (Retrieval-Augmented Generation). It stores patient profiles, allergies, past conditions, and lab data directly on the phone.

### Tier 2: The Edge Server (Main Brain)
*   **Technology:** Python, FastAPI, Ollama.
*   **Role:** The heavy lifter. This runs on a local device (laptop, hub) connected via a local Wi-Fi hotspot (no internet routing required). It runs larger, highly capable models (like quantized Gemma 4 31B/27B) and faster-whisper for rapid Speech-to-Text.

### Tier 3: On-Device Native (Fallback Brain)
*   **Technology:** LiteRT (TensorFlow Lite), `whisper.rn` (native whisper).
*   **Role:** The absolute failsafe. If the Edge Server goes down or the user walks out of Wi-Fi range, SobaHealth instantly falls back to running a smaller model (like Gemma 4 E2B) directly on the phone's CPU. 

### The `inferenceRouter` (The Traffic Cop)
The magic of the architecture is the `inferenceRouter.ts`. It intelligently decides where to send a query. It probes the Edge Server's health; if it's up, it sends the complex query there. If the server times out or crashes, the router seamlessly processes the query using the on-device LiteRT model, ensuring the user experiences zero disruption.

---

## 4. Key AI Capabilities & Gemma 4 Integration
SobaHealth leverages the specific advanced capabilities of the **Gemma 4** model family:

1.  **Clinical Symptom Triage via Function Calling:** Instead of relying on brittle prompt engineering, the system uses Gemma 4's native function calling to strictly format symptom analysis into deterministic, structured JSON. This prevents hallucination and ensures safe risk assessment.
2.  **Risk Reasoning (Chain-of-Thought):** It employs Gemma's "Thinking Mode". For clinical decisions, the AI generates a transparent reasoning chain inside `<think>` blocks, which the UI renders as a "clinical reasoning" drop-down. This provides explainability for *why* a triage decision was made.
3.  **Multimodal Document & Nutrition Scanning:** Users can scan lab reports, prescriptions, or even food plates. The Vision capabilities of Gemma 4 extract structured data from medical documents and perform macro/calorie breakdowns from food photos.
4.  **Native Multilingual Voice (Push-To-Talk):** Designed for low-literacy users, the app features an end-to-end voice interface. Using local Whisper models, it transcribes audio (English, Hindi, Tamil, Telugu) locally, processes the text, and speaks the answer back using local TTS—all without external translation APIs.
5.  **Contextual EHR Memory (SQLite RAG):** SobaHealth injects the patient's local SQLite history (allergies, recent scans, baselines) into every prompt. The AI remembers the patient perfectly, entirely locally.

---

## 5. Technology Stack Breakdown
*   **Frontend:** React Native, Expo, Expo SQLite, `expo-av` (audio), `expo-speech` (TTS).
*   **Backend (Local Node):** Python 3.9+, FastAPI (API routing), Uvicorn.
*   **AI Inference:** 
    *   *Text:* Ollama (serving Gemma 4), LiteRT (on-device).
    *   *Speech:* `faster-whisper` (Edge), native Whisper (Device).
*   **Database:** SQLite (Frontend RAG & State), local file storage.

---

## 6. The Production Fine-Tuning Strategy (Phase 5)
To transition from a powerful general model to a specialized clinical expert, the project includes a sophisticated optimization pipeline:
1.  **Dataset Curation:** Aggregating specialized clinical datasets like MIMIC-IV-Ext-Instr (unstructured clinical notes), n2c2 (concept extraction), and TeleQnA (telemedical conversational bridging).
2.  **LoRA Fine-Tuning:** Using tools like `unsloth` to perform parameter-efficient fine-tuning on Gemma 4 E2B-it, specifically teaching it clinical instruction following and deterministic output generation.
3.  **Quantization & On-Device Conversion:** Merging the weights and converting the model to `.litertlm` (LiteRT-LM) via `ai-edge-torch`. This applies advanced quantization (TurboQuant-H) to shrink the model footprint under 2GB, allowing it to run smoothly on standard Android phone CPUs without draining the battery.

---

## 7. Why This Project Matters
SobaHealth represents a paradigm shift. It proves that cutting-edge AI is not restricted to high-bandwidth, cloud-connected, affluent demographics. By packaging high-fidelity reasoning, vision, and speech processing into an infrastructure that requires exactly zero bytes of internet data to function, SobaHealth makes life-saving clinical intelligence as accessible as the smartphone in a user's pocket.
