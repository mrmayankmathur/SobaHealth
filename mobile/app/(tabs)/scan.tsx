import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Camera, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { X, Zap, ZapOff, Circle } from "lucide-react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
} from "../../constants/theme";
import { extractDocument, analyzeFood } from "../../services/api";
import { saveHealthRecord } from "../../services/database";
import { awardXP } from "../../services/gamification";
import { showInferenceError } from "@/services/errorMessages";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<boolean>(false);
  const [mode, setMode] = useState<"document" | "food">("document");
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    // Camera permissions are still loading.
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo?.uri) {
        const lang = "en"; // default for now
        let summaryText = "";
        let extractedJSON = null;

        if (mode === "document") {
          const data = await extractDocument(photo.uri, lang);
          summaryText = data.summary;
          extractedJSON = data.extracted_data;
        } else {
          const data = await analyzeFood(photo.uri);
          summaryText =
            data.nutrition?.summary || "Food analyzed successfully.";
          extractedJSON = data.nutrition;
        }

        await saveHealthRecord({
          id: Date.now().toString(),
          type: mode === "document" ? "lab" : "nutrition",
          extractedData: extractedJSON,
          summary: summaryText,
        });

        awardXP(50, "scan");

        // Navigate to records or show a success modal here
        router.push("/(tabs)/records");
      }
    } catch (error) {
      console.warn("Capture failed", error);
      showInferenceError(error, router);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)")}
          style={styles.iconButton}
        >
          <X size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFlash(!flash)}
          style={styles.iconButton}
        >
          {flash ? (
            <Zap size={24} color={Colors.primary} fill={Colors.primary} />
          ) : (
            <ZapOff size={24} color={Colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Camera Viewfinder */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          enableTorch={flash}
        >
          <View style={styles.viewfinderOverlay}>
            <View style={styles.viewfinderBox} />
            <Text style={styles.viewfinderText}>
              Align {mode === "document" ? "document" : "food"} here
            </Text>
          </View>
        </CameraView>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Toggle Mode */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "document" && styles.toggleButtonActive,
            ]}
            onPress={() => setMode("document")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "document" && styles.toggleTextActive,
              ]}
            >
              Document
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              mode === "food" && styles.toggleButtonActive,
            ]}
            onPress={() => setMode("food")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "food" && styles.toggleTextActive,
              ]}
            >
              Food
            </Text>
          </TouchableOpacity>
        </View>

        {/* Capture Button */}
        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              isProcessing && styles.captureButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color={Colors.surface} />
            ) : (
              <Circle
                size={64}
                color={Colors.emergency}
                fill={Colors.emergency}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyTextPrimary}>
            AI will extract data locally.
          </Text>
          <Text style={styles.privacyTextSecondary}>
            Photos never leave your network.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  permissionText: {
    ...Typography.bodyPrimary,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  permissionButtonText: {
    ...Typography.bodyPrimary,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  iconButton: {
    padding: Spacing.sm,
  },
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  camera: {
    flex: 1,
  },
  viewfinderOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinderBox: {
    width: "80%",
    height: "60%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: BorderRadius.lg,
    backgroundColor: "transparent",
  },
  viewfinderText: {
    ...Typography.bodyPrimary,
    color: "#FFFFFF",
    marginTop: Spacing.md,
    fontWeight: "500",
  },
  controlsContainer: {
    padding: Spacing.xl,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  toggleButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    ...Typography.bodyPrimary,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  captureContainer: {
    marginBottom: Spacing.xl,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  captureButtonDisabled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  privacyNote: {
    alignItems: "center",
  },
  privacyTextPrimary: {
    ...Typography.micro,
    color: Colors.textPrimary,
    fontWeight: "bold",
    marginBottom: 2,
  },
  privacyTextSecondary: {
    ...Typography.micro,
    color: Colors.textSecondary,
  },
});
