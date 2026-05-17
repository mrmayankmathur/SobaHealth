import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Vibration,
  Alert,
} from "react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../../constants/theme";
import { sendChatMessage, transcribeAudio } from "../../services/api";
import { startRecording, stopRecording } from "../../services/recorder";
import * as SQLite from "expo-sqlite";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import { ChatBubble } from "../../components/ChatBubble";
import { PTTButton } from "../../components/PTTButton";
import { Send, Trash2 } from "lucide-react-native";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingState, setIsRecordingState] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const sessionIdRef = useRef<string>(Date.now().toString());

  useEffect(() => {
    loadChatHistory();
  }, []);

  async function loadChatHistory() {
    try {
      const db = await SQLite.openDatabaseAsync("sobahealth.db");
      const rows = await db.getAllAsync<{
        id: string;
        role: string;
        content: string;
        created_at: number;
      }>(
        `SELECT id, role, content, created_at FROM chat_messages ORDER BY created_at DESC LIMIT 50`,
      );

      if (rows.length > 0) {
        const loaded: ChatMessage[] = rows.reverse().map((row) => ({
          id: row.id,
          role: row.role as "user" | "assistant",
          content: row.content,
          timestamp: new Date(row.created_at),
        }));
        setMessages(loaded);
        sessionIdRef.current =
          rows[0].id.split("-")[0] || Date.now().toString();
      } else {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! I am your AI health assistant.\n\nI can help you understand symptoms, answer health questions, or explain lab results.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (e) {
      console.warn("Failed to load chat history:", e);
    }
  }

  async function saveMessage(msg: ChatMessage) {
    try {
      const db = await SQLite.openDatabaseAsync("sobahealth.db");
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, language, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          msg.id,
          sessionIdRef.current,
          msg.role,
          msg.content,
          "en",
          msg.timestamp.getTime(),
        ],
      );
    } catch (e) {
      console.warn("Failed to save message:", e);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
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
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(apiMessages, "en");
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMessage(assistantMsg);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    } catch (e: any) {
      console.warn(e);
      Alert.alert(
        "Connection Error",
        e.message || "Could not reach the Edge Server.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartRecording() {
    try {
      await startRecording();
      setIsRecordingState(true);
      Vibration.vibrate(50);
    } catch (e) {
      console.warn(e);
    }
  }

  async function handleStopRecording() {
    try {
      setIsRecordingState(false);
      Vibration.vibrate(50);
      setIsLoading(true);

      const audioUri = await stopRecording();
      if (!audioUri) {
        setIsLoading(false);
        return;
      }

      const result = await transcribeAudio(audioUri, "en");
      if (result.transcript && result.transcript.trim()) {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "user",
          content: result.transcript.trim(),
          timestamp: new Date(),
        };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        await saveMessage(userMsg);
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );

        const apiMessages = updatedMessages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));
        const response = await sendChatMessage(apiMessages, "en");
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await saveMessage(assistantMsg);
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      }
    } catch (e: any) {
      console.warn(e);
      Alert.alert(
        "Transcription Error",
        e.message || "Could not process audio.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function clearHistory() {
    try {
      const db = await SQLite.openDatabaseAsync("sobahealth.db");
      await db.runAsync("DELETE FROM chat_messages");
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: "History cleared. How can I help you today?",
          timestamp: new Date(),
        },
      ]);
    } catch (e) {
      console.warn(e);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ConnectionBadge status="connected" />
          <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
            <Trash2 size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Medical Assistant</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item, index }) => (
          <ChatBubble
            role={item.role as "user" | "ai"}
            content={item.content}
            isStreaming={
              isLoading &&
              index === messages.length - 1 &&
              item.role === "assistant"
            }
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <View style={styles.inputArea}>
        {isLoading && !isRecordingState && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>AI is thinking...</Text>
          </View>
        )}

        {isRecordingState && (
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingText}>Release to send...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your message..."
            placeholderTextColor={Colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isLoading && !isRecordingState}
          />
          {input.trim().length > 0 ? (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={isLoading}
            >
              <Send size={20} color={Colors.surface} />
            </TouchableOpacity>
          ) : (
            <View style={styles.pttContainer}>
              <PTTButton
                onPressIn={handleStartRecording}
                onPressOut={handleStopRecording}
                isRecording={isRecordingState}
              />
            </View>
          )}
        </View>
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
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
  },
  messagesList: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  inputArea: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  loadingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.micro,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  recordingIndicator: {
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  recordingText: {
    ...Typography.micro,
    color: Colors.emergency,
    fontWeight: "bold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 14,
    paddingBottom: 14,
    color: Colors.textPrimary,
    ...Typography.bodyPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
  },
  pttContainer: {
    paddingHorizontal: 8,
  },
});
