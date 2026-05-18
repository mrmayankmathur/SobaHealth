# SobaHealth: Offline-First Edge AI Health Platform

SobaHealth is an offline-first, hybrid-routing multimodal AI health platform designed for zero-connectivity environments. By intelligently routing inference between a local Wi-Fi Edge Server and the client phone's on-device native runtimes, SobaHealth guarantees zero-latency, 100% private, and internet-independent clinical intelligence.

---

## 🏗️ Architecture: Edge AI

To ensure high performance while preserving complete privacy and remaining resilient to server dropouts, SobaHealth features a dynamic **Hybrid Inference Router**:

```text
                                  ┌───────────────────────────┐
                                  │   React Native Client     │
                                  │  (SQLite Local EHR RAG)   │
                                  └─────────────┬─────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │   Inference Router    │
                                    └─────┬───────────┬─────┘
                        (Server Active)   │           │   (Server Down / Offline)
                                          │           │
                    ┌─────────────────────▼─┐       ┌─▼─────────────────────┐
                    │   Edge Server Node    │       │   On-Device Native    │
                    │  (Local Wi-Fi Hub)    │       │   (Client Hardware)   │
                    ├───────────────────────┤       ├───────────────────────┤
                    │ • FastAPI             │       │ • LiteRT (TF Lite)    │
                    │ • Ollama (Gemma 4)    │       │ • whisper.spm (Native)│
                    │ • faster-whisper STT  │       │ • Zero Network Calls  │
                    └───────────────────────┘       └───────────────────────┘
```

When connected to a local edge hub (e.g., a laptop or private hot-spot), the router leverages the edge server's hardware for high-fidelity extraction and speed. If the server becomes unreachable, the router instantly and transparently switches to the **on-device native runtime** (LiteRT & local Whisper) without disrupting the user.

---

## ✨ Core AI Capabilities

SobaHealth leverages the advanced capabilities of the **Gemma 4** model family across both edge and local execution paths:

- **Clinical Symptom Triage**: Utilizes **Gemma 4's Function Calling** to strictly format outputs into structured JSON for safe, deterministic risk assessment, avoiding prompt injection or hallucination.
- **Risk Reasoning & Chain-of-Thought (CoT)**: Employs **Thinking Mode** to generate transparent reasoning chains inside `<think>` blocks, rendered in a beautifully styled clinical blockquote layout.
- **Multimodal Document & Nutrition Scanning**: Uses vision models on the Edge (or local heuristics fallbacks on-device) to extract structured clinical data from lab reports and perform detailed calorie breakdowns from food photos.
- **Contextual EHR Memory (SQLite RAG)**: Dynamically extracts and injects a patient's local SQLite electronic health record history (e.g., allergies, conditions, recent scans) directly into every query's prompt window, maintaining clinical personalization across both edge and on-device backends.
- **Native Multilingual Voice (STT)**: End-to-end push-to-talk voice client using `faster-whisper` on the edge or native Whisper on-device for offline Speech-to-Text transcription (English, Hindi, Tamil, Telugu) with automatic language detection and blank audio protection.

---

## 🛠️ Tech Stack

### Client (Mobile Application)

- **Core**: React Native, Expo, TypeScript
- **Database**: SQLite (`expo-sqlite` for offline RAG memory and local medical records)
- **Local Inference**:
  - **LiteRT (TensorFlow Lite)** for direct on-device execution of quantized Gemma models
  - **Whisper Native** for fully offline, on-device audio transcription
- **State & Routing**: `inferenceRouter` dynamic state manager

### Server (Edge Node)

- **API Framework**: Python, FastAPI
- **Text & Vision**: Ollama / Gemma 4
- **Audio Transcription**: `faster-whisper` (Offline STT)

---

## 🧠 Custom Clinical Fine-Tuning

To maximize accuracy in rural clinical settings, SobaHealth utilizes a custom-tuned Gemma 4 model:

- **Datasets**:
  - **MIMIC-IV-Ext-Instr**: 450k+ clinical instruction pairs for unstructured EHR note parsing.
  - **n2c2 (National NLP Clinical Challenges)**: Gold-standard medication and concept extraction templates for deterministic JSON formatting.
  - **TeleQnA & MedSynth**: Telemedical dialogues to bridge the gap between medical terminology and colloquial patient symptoms.
- **Optimization**: Fine-tuned via **LoRA** using **Unsloth** for 2x faster training and enhanced stability.
- **On-Device Path**: Merged weights are converted to native **LiteRT-LM** (.litertlm) format via the `ai-edge-torch` toolchain for optimized CPU inference.
- **Quantization**: Optimized with **TurboQuant-H** to maintain medical concept accuracy at sub-2GB memory footprints.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+), npm and Expo CLI for the mobile application.
- Python 3.9+ for the Edge Server backend.
- [Ollama](https://ollama.com/) installed and running locally with the Gemma 4 model (for the Edge Node).

### 1. Run the Edge Server Backend

**Terminal 1 — Ollama Daemon**

```bash
ollama serve
```

> _Leave this running. It listens on `http://127.0.0.1:11434`. If you get an "address already in use" error, Ollama is already running (via Mac app or launchd)—you can skip this terminal._

**Terminal 2 — Pull Model & Start FastAPI**

```bash
cd backend

# One-time setup: create venv and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Pull the model your backend expects
ollama pull gemma4:latest

# Run the server
python run.py
```

> **Note on Model Names:** The backend (`config.py`) defaults to `gemma4:latest`. If this tag isn't available, check your installed models (`ollama list`) and pull a real one (e.g., `ollama pull gemma4:latest`). Then override the environment variable without editing code:
>
> ```bash
> cd backend
> echo 'OLLAMA_MODEL=gemma4:latest' > .env
> python run.py
> ```

_For subsequent runs, simply ensure Ollama is serving, then `cd backend && source .venv/bin/activate && python run.py`._

### 2. Start the Mobile Client (Frontend)

Run Expo from the directory where it's already installed locally—no download needed:

```bash
cd mobile
npm start
# or alternatively: npx expo start
```

**Troubleshooting Cache/Permission Errors:**
If you see cache errors, clean the corrupted entries and retry:

```bash
npm cache verify
# or, more aggressively:
npm cache clean --force
```

If `npm cache verify` reports permission errors, your `~/.npm` got polluted by a prior `sudo npm run`. Reclaim ownership with:

```bash
sudo chown -R $(whoami) ~/.npm
```

### 3. Connect the App

- **Automatic Server Discovery**: Scan the QR code generated by the FastAPI server on startup to automatically discover and pair the mobile client to the Edge Node.
- **Offline Mode**: Go to Settings (`/connect`) in the app to switch preferred inference paths (Auto, Edge, or Device) or manage local model downloads.
