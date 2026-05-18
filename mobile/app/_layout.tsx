/**
 * SobaHealth — Root Layout
 * Handles app-level setup: fonts, splash screen, connection check.
 * Routes to onboarding (server setup) or main tabs based on connection state.
 */
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../constants/theme";
import { getServerUrl } from "../services/api";
import { initDatabase, getUserProfile } from "../services/database";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    checkInitialState();
  }, []);

  async function checkInitialState() {
    try {
      await initDatabase();
      const profile = await getUserProfile();
      setHasProfile(!!profile);
    } catch (e) {
      console.warn("Database init failed:", e);
    }
    // Server URL is no longer a gate to entering the app. The inference
    // router decides per-request whether to use edge or on-device, and
    // errors guide the user to /connect or /onboarding if something is
    // missing. Touching getServerUrl here just warms the cache.
    await getServerUrl();
    setIsReady(true);
  }

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: "fade",
        }}
        initialRouteName={hasProfile ? "(tabs)" : "onboarding"}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="connect"
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
