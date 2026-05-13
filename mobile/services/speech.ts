import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { getServerUrl } from './api';

let currentSound: Audio.Sound | null = null;
let isSpeaking = false;

export async function speak(text: string, language: string = 'en') {
  if (isSpeaking) {
    await stop();
  }

  isSpeaking = true;

  const langMap: Record<string, string> = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
  };

  const code = langMap[language] || 'en-US';

  try {
    // First, attempt native device TTS
    // We wrap this in a promise to catch errors that happen during speaking
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        language: code,
        rate: 0.9,
        onDone: () => {
          isSpeaking = false;
          resolve();
        },
        onError: (e) => {
          console.warn('Native TTS failed:', e);
          reject(new Error('Native TTS failed'));
        },
      });
      
      // If it doesn't fail immediately, we assume it started. 
      // Sometimes native TTS fails silently, so a robust app might use a timeout
      // but for this hackathon, we rely on the onError callback.
    });
  } catch (err) {
    console.log('Falling back to edge server TTS for language:', language);
    // Fallback to Edge Server TTS
    try {
      const serverUrl = await getServerUrl();
      if (!serverUrl) throw new Error('No server URL');

      const response = await fetch(`${serverUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) throw new Error('Server TTS failed');

      // Play the returned audio
      // In Expo, we can play directly from a URI
      // But fetch returns a stream. We'll use the URL directly with expo-av if possible,
      // or we can just send the parameters in a GET request.
      // Wait, to use expo-av with a remote URL that needs POST body is hard.
      // Let's modify the backend call to a GET request with query params for the fallback!
      // Actually, since we already made it POST, let's just make it a GET in the API or download the file.
      
      // Alternative: Just use the URL directly with GET
      const fallbackUrl = `${serverUrl}/api/tts_get?text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}`;
      
      const { sound } = await Audio.Sound.createAsync({ uri: fallbackUrl });
      currentSound = sound;
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          isSpeaking = false;
          sound.unloadAsync();
        }
      });
      
      await sound.playAsync();

    } catch (fallbackErr) {
      console.error('Both native and fallback TTS failed:', fallbackErr);
      isSpeaking = false;
    }
  }
}

export async function stop() {
  if (isSpeaking) {
    Speech.stop();
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    isSpeaking = false;
  }
}

export function getIsSpeaking() {
    return isSpeaking;
}
