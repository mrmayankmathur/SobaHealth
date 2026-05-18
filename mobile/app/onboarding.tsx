import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../constants/theme";
import { saveUserProfile } from "../services/database";
import {
  getDeviceCapability,
  DeviceCapability,
  tierLabel,
} from "../services/deviceCapability";
import { ModelInstallCard } from "../components/ModelInstallCard";
import { ModeToggle } from "../components/ModeToggle";
import { setMode } from "../services/inferenceRouter";

type Step = "profile" | "model";

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [cap, setCap] = useState<DeviceCapability | null>(null);

  useEffect(() => {
    (async () => setCap(await getDeviceCapability()))();
  }, []);

  async function handleSaveProfile() {
    if (!name || !age) {
      Alert.alert("Missing info", "Please provide at least your name and age.");
      return;
    }
    setIsSaving(true);
    try {
      await saveUserProfile({
        name,
        age: parseInt(age, 10) || 0,
        gender,
        conditions: conditions.split(",").map((s) => s.trim()).filter(Boolean),
        allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setStep("model");
    } catch {
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinish(target: "edge" | "tabs") {
    if (target === "edge") {
      router.replace("/connect");
    } else {
      router.replace("/(tabs)");
    }
  }

  if (step === "profile") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.stepLabel}>Step 1 of 2</Text>
          <Text style={styles.title}>Health Profile</Text>
          <Text style={styles.subtitle}>
            Help SobaHealth provide personalised advice.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              keyboardType="numeric"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Gender</Text>
            <TextInput
              style={styles.input}
              value={gender}
              onChangeText={setGender}
              placeholder="Male / Female / Other"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Medical Conditions (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={conditions}
              onChangeText={setConditions}
              placeholder="e.g. Diabetes, Hypertension"
              placeholderTextColor={Colors.textSecondary}
            />

            <Text style={styles.label}>Allergies (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. Peanuts, Penicillin"
              placeholderTextColor={Colors.textSecondary}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              <Text style={styles.buttonText}>
                {isSaving ? "Saving..." : "Save & Continue"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // step === "model"
  const tier = cap?.tier ?? "yellow";
  const tierColor =
    tier === "green"
      ? Colors.success
      : tier === "yellow"
        ? Colors.warning
        : Colors.emergency;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.stepLabel}>Step 2 of 2</Text>
      <Text style={styles.title}>On-device AI</Text>
      <Text style={styles.subtitle}>
        Pick or download the AI models that let SobaHealth keep working when
        the edge laptop is unreachable. You can do this later from settings.
      </Text>

      {cap && (
        <View style={[styles.capCard, { borderColor: tierColor }]}>
          <Text style={styles.capTitle}>
            Your device: {tierLabel(cap.tier)}
          </Text>
          <Text style={styles.capDetail}>{cap.reason}</Text>
          {cap.tier === "red" && (
            <Text style={styles.capWarn}>
              On-device AI is disabled. The app will only work while connected
              to the edge server.
            </Text>
          )}
          {Platform.OS === "ios" && cap.tier !== "red" && (
            <Text style={styles.capInfo}>
              Heads up: on-device vision is currently not available on iOS.
              The Scan tab will need the edge server until LiteRT-LM ships iOS
              vision support. STT works on-device via Whisper.
            </Text>
          )}
        </View>
      )}

      {cap?.tier !== "red" && (
        <>
          <ModelInstallCard
            kind="llm"
            title="Chat / Symptoms model"
            subtitle="Gemma 4 E2B (LiteRT-LM). Powers chat, symptom triage, and Android vision."
          />
          <ModelInstallCard
            kind="stt"
            title="Speech-to-text model"
            subtitle="Whisper base (ggml). Powers push-to-talk transcription on-device."
          />

          <View style={styles.modeBlock}>
            <Text style={styles.modeBlockTitle}>Default inference mode</Text>
            <ModeToggle
              onChange={async (m) => {
                await setMode(m);
              }}
            />
          </View>
        </>
      )}

      <View style={styles.footerRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonGhost]}
          onPress={() => handleFinish("edge")}
        >
          <Text style={[styles.buttonText, styles.buttonGhostText]}>
            Connect to edge server
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleFinish("tabs")}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xxl,
    paddingTop: 80,
    paddingBottom: Spacing.xxl,
    gap: Spacing.base,
  },
  stepLabel: {
    ...Typography.micro,
    color: Colors.primary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    ...Typography.h1,
    fontSize: 32,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.bodySecondary,
    color: Colors.textPrimary,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.bodyPrimary,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
    ...Shadows.md,
    flex: 1,
  },
  buttonGhost: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    color: "#fff",
    ...Typography.bodyPrimary,
    fontWeight: "700",
  },
  buttonGhostText: {
    color: Colors.primary,
  },
  capCard: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    gap: Spacing.xs,
  },
  capTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  capDetail: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
  },
  capWarn: {
    ...Typography.bodySecondary,
    color: Colors.emergency,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  capInfo: {
    ...Typography.micro,
    color: Colors.warning,
    marginTop: Spacing.xs,
  },
  modeBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.base,
  },
  modeBlockTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
