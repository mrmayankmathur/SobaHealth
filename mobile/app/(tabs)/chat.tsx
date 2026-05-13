/**
 * AI Health Chat — Core feature of Aivaan.
 * Conversational health assistant powered by Gemma 4.
 * Supports text input AND push-to-talk voice recording.
 * Multi-language: responds in the user's selected language.
 * Chat history persisted to SQLite.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from '../../constants/theme';
import { sendChatMessage, transcribeAudio } from '../../services/api';
import { startRecording, stopRecording } from '../../services/recorder';
import { speak, stop as stopSpeech, getIsSpeaking } from '../../services/speech';
import * as SQLite from 'expo-sqlite';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const LANGUAGES = [
  { code: 'en', label: '🇬🇧 EN', name: 'English' },
  { code: 'hi', label: '🇮🇳 HI', name: 'Hindi' },
  { code: 'ta', label: '🇮🇳 TA', name: 'Tamil' },
  { code: 'te', label: '🇮🇳 TE', name: 'Telugu' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [error, setError] = useState<string | null>(null);
  const [isRecordingState, setIsRecordingState] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sessionIdRef = useRef<string>(Date.now().toString());

  useEffect(() => {
    loadChatHistory();
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecordingState) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecordingState]);

  /**
   * Load chat history from SQLite for the current session.
   */
  async function loadChatHistory() {
    try {
      const db = await SQLite.openDatabaseAsync('aivaan.db');

      // Load recent messages from the last session
      const rows = await db.getAllAsync<{
        id: string;
        role: string;
        content: string;
        created_at: number;
      }>(
        `SELECT id, role, content, created_at FROM chat_messages 
         ORDER BY created_at DESC LIMIT 50`
      );

      if (rows.length > 0) {
        const loaded: ChatMessage[] = rows.reverse().map((row) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: row.content,
          timestamp: new Date(row.created_at),
        }));
        setMessages(loaded);
        sessionIdRef.current = rows[0].id.split('-')[0] || Date.now().toString();
      } else {
        // No history — show welcome message
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content:
              "Hello! I'm Aivaan, your AI health assistant. 🏥\n\nI can help you with:\n• Understanding symptoms\n• Health questions\n• Medicine information\n• First-aid guidance\n\nHow can I help you today?\n\n⚠️ I'm not a doctor. Always consult a healthcare professional for medical advice.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      // Still show welcome message on error
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Hello! I'm Aivaan, your AI health assistant. 🏥\n\nHow can I help you today?",
          timestamp: new Date(),
        },
      ]);
    }
  }

  /**
   * Save a message to SQLite.
   */
  async function saveMessage(msg: ChatMessage) {
    try {
      const db = await SQLite.openDatabaseAsync('aivaan.db');
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, language, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          msg.id,
          sessionIdRef.current,
          msg.role,
          msg.content,
          selectedLang,
          msg.timestamp.getTime(),
        ]
      );
    } catch (e) {
      console.warn('Failed to save message:', e);
    }
  }

  /**
   * Handle sending a text message.
   */
  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    await saveMessage(userMsg);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setIsLoading(true);
    try {
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await sendChatMessage(apiMessages, selectedLang);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage(assistantMsg);

      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100
      );
    } catch (e: any) {
      setError(e.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Push-to-talk: Start recording voice.
   */
  async function handleStartRecording() {
    try {
      setError(null);
      await startRecording();
      setIsRecordingState(true);
      Vibration.vibrate(50); // Haptic feedback
    } catch (e: any) {
      setError(e.message || 'Failed to start recording');
    }
  }

  /**
   * Push-to-talk: Stop recording, transcribe, and send.
   */
  async function handleStopRecording() {
    try {
      setIsRecordingState(false);
      Vibration.vibrate(50);
      setIsTranscribing(true);

      const audioUri = await stopRecording();
      if (!audioUri) {
        setIsTranscribing(false);
        return;
      }

      // Transcribe via edge server (faster-whisper)
      const result = await transcribeAudio(audioUri, selectedLang);
      setIsTranscribing(false);

      if (result.transcript && result.transcript.trim()) {
        // Put transcribed text into input and auto-send
        setInput(result.transcript.trim());
        // Auto-send after a brief delay so user sees what was transcribed
        setTimeout(() => {
          setInput('');
          // Directly send the transcribed text
          sendTranscribedMessage(result.transcript.trim());
        }, 300);
      } else {
        setError('Could not understand the audio. Try again.');
      }
    } catch (e: any) {
      setIsRecordingState(false);
      setIsTranscribing(false);
      setError(e.message || 'Transcription failed');
    }
  }

  /**
   * Send a transcribed voice message directly.
   */
  async function sendTranscribedMessage(text: string) {
    setError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '🎤 ' + text,
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    await saveMessage(userMsg);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setIsLoading(true);
    try {
      const apiMessages = updatedMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content.replace(/^🎤 /, ''),
        }));

      const response = await sendChatMessage(apiMessages, selectedLang);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage(assistantMsg);

      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100
      );
    } catch (e: any) {
      setError(e.message || 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle TTS — read response aloud.
   */
  function handleReadAloud(text: string) {
    if (getIsSpeaking()) {
      stopSpeech();
    } else {
      speak(text, selectedLang);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user';
    const isVoice = item.content.startsWith('🎤 ');
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {!isUser && (
          <View style={styles.avatarRow}>
            <Text style={styles.avatar}>🏥</Text>
            <Text style={styles.avatarLabel}>Aivaan</Text>
            {/* TTS button on assistant messages */}
            <TouchableOpacity
              style={styles.ttsButton}
              onPress={() => handleReadAloud(item.content)}
            >
              <Text style={styles.ttsIcon}>🔊</Text>
            </TouchableOpacity>
          </View>
        )}
        {isUser && isVoice && (
          <Text style={styles.voiceBadge}>🎤 Voice</Text>
        )}
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
          selectable
        >
          {isVoice ? item.content.replace('🎤 ', '') : item.content}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Health Chat</Text>
          <Text style={styles.headerSubtitle}>
            Powered by Gemma 4 • Offline
          </Text>
        </View>

        {/* Language Selector */}
        <View style={styles.langRow}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langButton,
                selectedLang === lang.code && styles.langButtonActive,
              ]}
              onPress={() => setSelectedLang(lang.code)}
            >
              <Text
                style={[
                  styles.langText,
                  selectedLang === lang.code && styles.langTextActive,
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Offline Badge */}
      <View style={styles.offlineBadge}>
        <View style={styles.offlineDot} />
        <Text style={styles.offlineBadgeText}>
          🔒 AI Running Locally — Your data never leaves this device
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Gemma 4 is thinking...</Text>
        </View>
      )}

      {/* Transcribing indicator */}
      {isTranscribing && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.loadingText}>Transcribing speech...</Text>
        </View>
      )}

      {/* Recording indicator */}
      {isRecordingState && (
        <View style={styles.recordingBar}>
          <Animated.View
            style={[
              styles.recordingDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={styles.recordingText}>Recording... Release to send</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        {/* Mic Button — Push to talk */}
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecordingState && styles.micButtonActive,
          ]}
          onPressIn={handleStartRecording}
          onPressOut={handleStopRecording}
          disabled={isLoading || isTranscribing}
        >
          <Text style={styles.micIcon}>
            {isRecordingState ? '⏹' : '🎤'}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={
            selectedLang === 'hi'
              ? 'अपना सवाल यहाँ लिखें...'
              : 'Type your health question...'
          }
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!isLoading && !isRecordingState}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  langRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  langButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langButtonActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  langText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  langTextActive: {
    color: Colors.primary,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.safeMuted,
    gap: Spacing.sm,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.safe,
  },
  offlineBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.safe,
    fontWeight: '600',
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  messageBubble: {
    maxWidth: '85%',
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  avatar: {
    fontSize: 16,
  },
  avatarLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  ttsButton: {
    padding: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryMuted,
  },
  ttsIcon: {
    fontSize: 14,
  },
  voiceBadge: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: Colors.textPrimary,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.emergencyMuted,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.emergency,
  },
  recordingText: {
    fontSize: FontSize.sm,
    color: Colors.emergency,
    fontWeight: '600',
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.emergencyMuted,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.emergency,
    flex: 1,
  },
  errorDismiss: {
    fontSize: FontSize.lg,
    color: Colors.emergency,
    paddingLeft: Spacing.md,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  micButtonActive: {
    backgroundColor: Colors.emergencyMuted,
    borderColor: Colors.emergency,
  },
  micIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
