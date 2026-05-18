import React, { useState, useRef } from "react";
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
} from "react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../../constants/theme";
import { checkSymptoms } from "../../services/api";
import { ConnectionBadge } from "../../components/ConnectionBadge";
import { ThinkingBlock } from "../../components/ThinkingBlock";
import { Send, Activity } from "lucide-react-native";
import { describeInferenceError } from "../../services/errorMessages";
import { awardXP } from "../../services/gamification";
import { useRouter } from "expo-router";

interface SymptomMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  extractedData?: {
    primary?: string;
    associated?: string[];
  };
}

export default function SymptomsScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<SymptomMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  async function handleSend(text?: string) {
    const msgText = text || input.trim();
    if (!msgText || isLoading) return;

    setInput("");

    const userMsg: SymptomMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msgText,
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    setIsLoading(true);
    try {
      const apiMessages = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Use actual reasoning and extraction from the API response
      const response = await checkSymptoms(apiMessages, "en");

      const assistantMsg: SymptomMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          response.response ||
          "How long have you had this? Is it accompanied by anything else?",
        reasoning: response.reasoning,
        extractedData: response.extracted_data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
      awardXP(20, "symptom");
    } catch (e: any) {
      const friendly = describeInferenceError(e);
      const errMsg: SymptomMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Error: ${e.message || "Could not process symptoms"}`,
      };
      setMessages((prev) => [...prev, errMsg]);
      if (friendly.cta) {
        setTimeout(() => router.push(friendly.cta!.route), 100);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function renderMessage({ item }: { item: SymptomMessage }) {
    const isUser = item.role === "user";

    return (
      <View style={styles.messageWrapper}>
        {isUser ? (
          <View style={[styles.messageBubble, styles.userBubble]}>
            <Text style={styles.userText}>{item.content}</Text>
          </View>
        ) : (
          <View style={styles.assistantWrapper}>
            {item.reasoning && (
              <ThinkingBlock reasoning_text={item.reasoning} />
            )}

            {item.extractedData && (
              <View style={styles.extractedBox}>
                <Text style={styles.extractedTitle}>
                  [Extracted Data Preview]
                </Text>
                <Text style={styles.extractedItem}>
                  • Primary: {item.extractedData.primary}
                </Text>
                {item.extractedData.associated &&
                  item.extractedData.associated.length > 0 && (
                    <Text style={styles.extractedItem}>
                      • Associated: {item.extractedData.associated.join(", ")}
                    </Text>
                  )}
              </View>
            )}

            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>AI: "{item.content}"</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ConnectionBadge />
          <Text style={styles.headerTitle}>Symptom Checker</Text>
        </View>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Activity
            size={48}
            color={Colors.primary}
            style={{ marginBottom: Spacing.md }}
          />
          <Text style={styles.emptyTitle}>What's bothering you?</Text>
          <Text style={styles.emptySubtitle}>
            e.g., I have a headache and fever
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        {isLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>🧠 AI Reasoning...</Text>
          </View>
        )}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your symptoms..."
            placeholderTextColor={Colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!input.trim() || isLoading) && styles.submitButtonDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            <Send size={20} color={Colors.surface} />
          </TouchableOpacity>
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
    alignItems: "center",
    gap: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  messagesList: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  messageWrapper: {
    marginBottom: Spacing.lg,
  },
  assistantWrapper: {
    alignItems: "flex-start",
    maxWidth: "90%",
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    maxWidth: "80%",
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  userText: {
    ...Typography.bodyPrimary,
    color: "#FFFFFF",
  },
  assistantText: {
    ...Typography.bodyPrimary,
    color: Colors.textPrimary,
  },
  extractedBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
    width: "100%",
  },
  extractedTitle: {
    ...Typography.micro,
    fontWeight: "bold",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  extractedItem: {
    ...Typography.micro,
    color: Colors.textPrimary,
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  loadingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.micro,
    color: Colors.textSecondary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    color: Colors.textPrimary,
    ...Typography.bodyPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});
