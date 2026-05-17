/**
 * SobaHealth — Tab Navigation Layout
 * Main app navigation with 5 core tabs:
 * 1. Home (Dashboard)
 * 2. Symptoms (Symptom Checker)
 * 3. Scan (Document/Food Scanner)
 * 4. Chat (AI Health Assistant)
 * 5. Records
 */
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import {
  Home,
  Stethoscope,
  Camera,
  MessageSquare,
  ClipboardList,
} from "lucide-react-native";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../../constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Home color={color} size={24} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          title: "Symptoms",
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Stethoscope color={color} size={24} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ focused, color }) => (
            <View
              style={[
                styles.iconWrapCenter,
                focused && styles.iconWrapCenterActive,
              ]}
            >
              <Camera
                color={focused ? Colors.surface : Colors.primary}
                size={28}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <MessageSquare color={color} size={24} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <ClipboardList color={color} size={24} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 88 : 68,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === "ios" ? Spacing.xl : Spacing.sm,
    elevation: 0,
  },
  tabLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
  iconWrap: {
    padding: 6,
    borderRadius: BorderRadius.md,
  },
  iconWrapActive: {
    backgroundColor: Colors.secondary,
  },
  iconWrapCenter: {
    padding: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondary,
    transform: [{ translateY: -10 }],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrapCenterActive: {
    backgroundColor: Colors.primary,
  },
});
