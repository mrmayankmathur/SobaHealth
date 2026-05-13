# Aivaan: KinMind AI

Aivaan is an offline-first AI health assistant designed to provide personalized medical insights and health monitoring without requiring an active internet connection.

## Key Features
- **Offline Health Assistant**: Local AI processing using Gemma 4.
- **Symptom Checker**: Intelligent triage with risk assessment.
- **Document Scanner**: Extract data from medical reports using multimodal vision.
- **Multi-language Support**: Native support for English, Hindi, Tamil, Telugu, and more.
- **Push-to-Talk**: Voice-enabled interactions for better accessibility.

## Tech Stack
- **Mobile**: React Native (Expo) with SQLite for local persistence.
- **Edge Server**: FastAPI (Python) bridging to Ollama.
- **AI Models**: Gemma 4 (Text/Vision) and Faster-Whisper (STT).

## Getting Started
### Prerequisites
- [Ollama](https://ollama.com/) installed and running.
- Python 3.9+ for the edge server.
- Node.js and Expo for the mobile app.

### Installation
1. Clone the repository.
2. Follow the setup instructions in the `backend/` and `mobile/` directories.
