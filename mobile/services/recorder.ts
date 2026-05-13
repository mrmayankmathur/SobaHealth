/**
 * Audio Recorder Service — Push-to-talk voice capture.
 * Records audio using expo-av, returns the file URI for transcription.
 * Designed for the offline voice pipeline:
 *   Record → Send to Edge Server → faster-whisper STT → text
 */
import { Audio } from 'expo-av';

let recording: Audio.Recording | null = null;

/**
 * Request microphone permission.
 */
export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Start recording audio.
 * Uses m4a format for best compatibility with iOS and faster-whisper.
 */
export async function startRecording(): Promise<void> {
  const hasPermission = await requestMicPermission();
  if (!hasPermission) {
    throw new Error('Microphone permission not granted');
  }

  // Configure audio mode for recording
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  // Use HIGH_QUALITY preset — produces .m4a which faster-whisper handles well
  const { recording: newRecording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = newRecording;
}

/**
 * Stop recording and return the audio file URI.
 * Returns null if no recording was in progress.
 */
export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    // Reset audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    return uri;
  } catch (error) {
    console.error('Error stopping recording:', error);
    recording = null;
    return null;
  }
}

/**
 * Check if currently recording.
 */
export function isRecording(): boolean {
  return recording !== null;
}
