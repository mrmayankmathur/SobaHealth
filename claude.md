# SobaHealth Edge - Project Index (claude.md)

Welcome to the SobaHealth Edge documentation. SobaHealth Edge is an offline AI Health Assistant app. It consists of a React Native (Expo) mobile application for the user interface and a FastAPI backend server that runs local AI models to ensure complete privacy and offline capabilities.

## Playbooks Reference

This index provides links to the detailed playbooks which cover all the context of the project.

- [Architecture Flow](./architecture.md): Detailed explanation of the system architecture, component interactions, and data flow between the mobile app and the Edge server.
- [Usage & Build Guide](./usage.md): Comprehensive instructions on how to set up, build, and run both the mobile application and the backend server, including Expo commands.
- [API Reference](./api.md): Detailed documentation of the backend REST endpoints and how the mobile app interacts with them.

---

### Project Structure Overview

```text
gemma4_project/
├── backend/            # Python FastAPI Edge Server
│   ├── run.py          # Entry point for the server
│   ├── requirements.txt# Python dependencies
│   └── app/            # Main application module
│       ├── main.py     # FastAPI app initialization
│       ├── routers/    # API endpoints (chat, voice, vision, etc.)
│       └── services/   # Business logic (Ollama, Whisper)
└── mobile/             # React Native Expo Mobile App
    ├── package.json    # Node dependencies and scripts
    ├── app/            # Expo Router screens (tabs, chat, onboard)
    ├── components/     # Reusable UI components
    └── services/       # Frontend business logic (api, llm, speech)
```
