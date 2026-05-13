/**
 * Aivaan — Tab Navigation Layout
 * Main app navigation with 4 core tabs:
 * 1. Home (Dashboard)
 * 2. Chat (AI Health Assistant)
 * 3. Scan (Document/Food Scanner)
 * 4. Symptoms (Symptom Checker)
 */
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

// Simple emoji-based tab icons (no external icon library needed)
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <View style={styles.emojiContainer}>
        <View>
          {/* Using Text from react-native directly */}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <View style={styles.emojiBox}>
                <EmojiText emoji="🏠" />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <View style={styles.emojiBox}>
                <EmojiText emoji="💬" />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <View style={styles.emojiBox}>
                <EmojiText emoji="📄" />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="symptoms"
        options={{
          title: 'Symptoms',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <View style={styles.emojiBox}>
                <EmojiText emoji="🩺" />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <View style={styles.emojiBox}>
                <EmojiText emoji="📋" />
              </View>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

// Helper component for emoji rendering
import { Text } from 'react-native';
function EmojiText({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxl : Spacing.sm,
    elevation: 0,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
  iconWrap: {
    padding: 4,
    borderRadius: BorderRadius.sm,
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryMuted,
  },
  emojiBox: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
