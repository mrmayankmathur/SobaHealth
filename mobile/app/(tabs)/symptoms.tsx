/**
 * Symptom Checker — AI-powered triage using Gemma 4.
 * Uses Gemma 4's Function Calling for structured risk extraction
 * and Thinking Mode to show the AI's reasoning chain.
 *
 * Multi-turn conversation: asks follow-up questions before assessment.
 * Urgency levels: 🟢 Self-Care | 🟡 See Doctor | 🔴 Emergency
 */
import { useState, useRef } from 'react';
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
} from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '../../constants/theme';
import { checkSymptoms } from '../../services/api';

interface SymptomMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  urgency?: string;
}

const URGENCY_CONFIG = {
  emergency: {
    color: Colors.emergency,
    bg: Colors.emergencyMuted,
    label: '🔴 EMERGENCY',
    message: 'Seek immediate medical attention!',
  },
  see_doctor: {
    color: Colors.urgent,
    bg: Colors.urgentMuted,
    label: '🟡 SEE DOCTOR',
    message: 'Schedule a doctor visit soon.',
  },
  self_care: {
    color: Colors.safe,
    bg: Colors.safeMuted,
    label: '🟢 SELF-CARE',
    message: 'Can likely be managed at home.',
  },
  gathering_info: {
    color: Colors.textMuted,
    bg: 'transparent',
    label: '',
    message: '',
  },
  unknown: {
    color: Colors.textMuted,
    bg: 'transparent',
    label: '',
    message: '',
  },
};

const QUICK_SYMPTOMS = [
  '🤒 Fever',
  '🤕 Headache',
  '🤮 Nausea',
  '😮‍💨 Breathing difficulty',
  '💔 Chest pain',
  '🤧 Cold & Cough',
];

export default function SymptomsScreen() {
  const [messages, setMessages] = useState<SymptomMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrgency, setCurrentUrgency] = useState<string>('unknown');
  const [selectedLang, setSelectedLang] = useState('en');
  const flatListRef = useRef<FlatList>(null);

  async function handleSend(text?: string) {
    const msgText = text || input.trim();
    if (!msgText || isLoading) return;

    setInput('');

    const userMsg: SymptomMessage = {
      id: Date.now().toString(),
      role: 'user',
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

      const response = await checkSymptoms(apiMessages, selectedLang);

      const assistantMsg: SymptomMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        urgency: response.urgency,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentUrgency(response.urgency);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const errMsg: SymptomMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ Error: ${e.message || 'Could not process symptoms'}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setCurrentUrgency('unknown');
  }

  function renderMessage({ item }: { item: SymptomMessage }) {
    const isUser = item.role === 'user';
    const urgencyConfig = item.urgency
      ? URGENCY_CONFIG[item.urgency as keyof typeof URGENCY_CONFIG]
      : null;

    return (
      <View>
        {/* Urgency Banner */}
        {urgencyConfig && urgencyConfig.label && (
          <View style={[styles.urgencyBanner, { backgroundColor: urgencyConfig.bg }]}>
            <Text style={[styles.urgencyLabel, { color: urgencyConfig.color }]}>
              {urgencyConfig.label}
            </Text>
            <Text style={[styles.urgencyMessage, { color: urgencyConfig.color }]}>
              {urgencyConfig.message}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {!isUser && (
            <View style={styles.avatarRow}>
              <Text style={styles.avatar}>🩺</Text>
              <Text style={styles.avatarLabel}>Symptom Analyzer</Text>
            </View>
          )}
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.assistantText,
            ]}
            selectable
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const showQuickSymptoms = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>🩺 Symptom Checker</Text>
            <Text style={styles.headerSubtitle}>
              Gemma 4 Function Calling + Thinking Mode
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetText}>New Check</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This is NOT a medical diagnosis. Always consult a doctor.
          </Text>
        </View>
      </View>

      {/* Quick Symptoms or Chat */}
      {showQuickSymptoms ? (
        <View style={styles.quickSection}>
          <Text style={styles.quickTitle}>What are you experiencing?</Text>
          <Text style={styles.quickSubtitle}>
            Describe your symptoms or tap a common one below
          </Text>
          <View style={styles.quickGrid}>
            {QUICK_SYMPTOMS.map((symptom) => (
              <TouchableOpacity
                key={symptom}
                style={styles.quickChip}
                onPress={() => handleSend(symptom)}
              >
                <Text style={styles.quickChipText}>{symptom}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.loadingText}>
            Gemma 4 analyzing symptoms...
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={
            selectedLang === 'hi'
              ? 'अपने लक्षण बताएं...'
              : 'Describe your symptoms...'
          }
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={() => handleSend()}
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
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  resetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  disclaimer: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  disclaimerText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '500',
  },
  quickSection: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
  },
  quickTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  quickSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  urgencyBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  urgencyLabel: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  urgencyMessage: {
    fontSize: FontSize.sm,
    marginTop: 2,
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
    color: Colors.accent,
    fontWeight: '700',
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
    backgroundColor: Colors.accentMuted,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontStyle: 'italic',
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
    backgroundColor: Colors.accent,
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
