# Usage & Build Guide

This playbook provides all necessary commands to set up, build, and run the SobaHealth Edge project locally.

## 1. Backend (Edge Server) Setup

The backend requires Python and Ollama.

### Prerequisites

- Python 3.9+
- [Ollama](https://ollama.com/) installed and running on your local machine.

### Installation & Execution

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   # or on Windows: .venv\Scripts\activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Pull the required model using Ollama (ensure Ollama is running). By default, the app might expect models like `llama3` or `gemma`:
   ```bash
   ollama pull gemma:2b
   # or the specific model configured in backend/app/config.py
   ```
5. Start the backend server:
   ```bash
   python run.py
   ```
   The server will start (typically on `http://0.0.0.0:8000`). You can view the API documentation by navigating to `http://localhost:8000/docs` in your browser.

## 2. Mobile App (Frontend) Setup

The mobile app is built with Expo.

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Expo CLI

### Installation

1. Open a terminal and navigate to the mobile directory:
   ```bash
   cd mobile
   ```
2. Install the Node modules:
   ```bash
   npm install
   ```

### Running the App via Expo

- **Start the Metro Bundler:**

  ```bash
  npx expo start
  ```

  This will open a terminal UI with a QR code. You can scan this with the **Expo Go** app on your physical device, or press `i` to open an iOS simulator, or `a` to open an Android emulator.

- **Run specifically on iOS Simulator:**

  ```bash
  npm run ios
  # OR
  npx expo run:ios
  ```

  _Note:_ Running `expo run:ios` attempts to build the native iOS code. If you encounter Xcode 16 errors (like `SwiftUICore` linking issues), it is often easier during development to use `npx expo start` and run it via the Expo Go app.

- **Run specifically on Android Emulator:**
  ```bash
  npm run android
  # OR
  npx expo run:android
  ```

### How to Use the App

1. Ensure your backend server (`python run.py`) is running on the same local network as your mobile device or emulator.
2. Open the mobile app.
3. If testing on a physical device, ensure the app is pointing to your computer's local IP address (e.g., `192.168.x.x`) instead of `localhost`.
4. Use the onboarding screens to connect the app to the Edge Server.
5. Once connected, you can navigate the tabs to use Chat, log Symptoms, or Scan documents. All AI processing will be handled securely by your local backend.
