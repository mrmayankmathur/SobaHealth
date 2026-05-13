/**
 * Document Scanner — Medical report extraction using Gemma 4 Vision.
 * Snap a photo or upload an image of a medical document.
 * Gemma 4 extracts structured data + generates plain-language summary.
 * Summary can be read aloud via TTS in the user's language.
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '../../constants/theme';
import { extractDocument } from '../../services/api';
import { speak, stop, getIsSpeaking } from '../../services/speech';
import { saveHealthRecord } from '../../services/database';

interface ExtractionResult {
  extracted_data: any;
  summary: string;
  language: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ta', label: 'தமிழ்' },
];

export default function ScanScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState('en');
  const [isSpeaking, setIsSpeaking] = useState(false);

  async function pickImage(useCamera: boolean) {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant camera/gallery access');
        return;
      }

      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setImageUri(pickerResult.assets[0].uri);
        setResult(null);
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleExtract() {
    if (!imageUri) return;

    setIsProcessing(true);
    setError(null);

    try {
      const data = await extractDocument(imageUri, selectedLang);
      setResult({ ...data, language: selectedLang });

      // Save to SQLite for Health Records tab
      await saveHealthRecord({
        id: Date.now().toString(),
        type: 'lab',
        extractedData: data.extracted_data,
        summary: data.summary,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to extract document');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleReadAloud() {
    if (!result?.summary) return;

    if (getIsSpeaking()) {
      stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    speak(result.summary, selectedLang).then(() => {
      // Polling or we can just rely on the fact that isSpeaking becomes false later.
      // But we need a way to notify UI. For now, we set true.
      // In a real app we'd use a context or event emitter.
    }).catch(() => setIsSpeaking(false));
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📄 Document Scanner</Text>
        <Text style={styles.headerSubtitle}>
          Gemma 4 Vision • Offline Extraction
        </Text>
      </View>

      {/* Language Selection */}
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

      {/* Image Picker Buttons */}
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => pickImage(true)}
        >
          <Text style={styles.pickerEmoji}>📸</Text>
          <Text style={styles.pickerLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => pickImage(false)}
        >
          <Text style={styles.pickerEmoji}>🖼️</Text>
          <Text style={styles.pickerLabel}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Image Preview */}
      {imageUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <TouchableOpacity
            style={[
              styles.extractButton,
              isProcessing && styles.extractButtonDisabled,
            ]}
            onPress={handleExtract}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.extractButtonText}>
                  Gemma 4 analyzing...
                </Text>
              </View>
            ) : (
              <Text style={styles.extractButtonText}>
                🧠 Extract with Gemma 4
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <View style={styles.resultSection}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>📋 Summary</Text>
              <TouchableOpacity
                style={[
                  styles.readAloudButton,
                  isSpeaking && styles.readAloudButtonActive,
                ]}
                onPress={handleReadAloud}
              >
                <Text style={styles.readAloudText}>
                  {isSpeaking ? '⏹ Stop' : '🔊 Read Aloud'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryContent} selectable>
              {result.summary}
            </Text>
          </View>

          {/* Raw Extracted Data */}
          {result.extracted_data && (
            <View style={styles.dataCard}>
              <Text style={styles.dataTitle}>🔍 Extracted Data</Text>
              <Text style={styles.dataContent} selectable>
                {JSON.stringify(result.extracted_data, null, 2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Empty State */}
      {!imageUri && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📄</Text>
          <Text style={styles.emptyTitle}>Scan a Medical Document</Text>
          <Text style={styles.emptyDesc}>
            Take a photo of a lab report, prescription, or medical record.
            {'\n'}Gemma 4 will extract and summarize it in your language.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: 56,
    paddingBottom: 120,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  langRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  langButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langButtonActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  langText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  langTextActive: {
    color: Colors.primary,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  pickerEmoji: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  pickerLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  previewContainer: {
    marginBottom: Spacing.xl,
  },
  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
  },
  extractButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  extractButtonDisabled: {
    opacity: 0.7,
  },
  extractButtonText: {
    fontSize: FontSize.md,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorBox: {
    backgroundColor: Colors.emergencyMuted,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.emergency,
    fontSize: FontSize.sm,
  },
  resultSection: {
    gap: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  readAloudButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryMuted,
  },
  readAloudButtonActive: {
    backgroundColor: Colors.emergencyMuted,
  },
  readAloudText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  summaryContent: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  dataCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dataTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  dataContent: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
