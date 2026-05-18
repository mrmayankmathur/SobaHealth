import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Brain, ChevronDown, ChevronUp } from "lucide-react-native";
import { Colors, Spacing, Typography, BorderRadius } from "../constants/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  reasoning_text: string;
}

export function ThinkingBlock({ reasoning_text }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const lines = reasoning_text.split("\n").filter((l) => l.trim() !== "");
  const firstLine = lines.length > 0 ? lines[0] : "";

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Brain size={18} color={Colors.primary} style={styles.brainIcon} />
          <View style={styles.textContainer}>
            <Text style={styles.title}>AI Reasoning Process</Text>
            {!expanded && firstLine ? (
              <Text style={styles.previewText} numberOfLines={1}>
                {firstLine}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          {expanded ? (
            <ChevronUp size={18} color={Colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={Colors.textSecondary} />
          )}
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.content}>
          <Text style={styles.reasoningText}>{reasoning_text.trim()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  brainIcon: {
    marginRight: Spacing.xs,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    ...Typography.micro,
    color: Colors.primary,
    fontWeight: "600",
  },
  previewText: {
    ...Typography.micro,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "400",
    marginTop: 2,
    fontStyle: "italic",
  },
  headerRight: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: Spacing.sm,
  },
  content: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: "#93C5FD",
  },
  reasoningText: {
    ...Typography.micro,
    fontSize: 13.5,
    color: "#374151",
    lineHeight: 20,
    fontWeight: "400",
    fontStyle: "italic",
  },
});
