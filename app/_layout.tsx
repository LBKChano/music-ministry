
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not prevented — safe to ignore
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  const router = useRouter();

  // Single effect: get initial session, then subscribe to changes.
  // onAuthStateChange fires INITIAL_SESSION synchronously on mount which
  // sets both session and initialized in one pass — no race condition.
  useEffect(() => {
    console.log("🔐 RootLayout: subscribing to auth state");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(
        "🔄 onAuthStateChange:",
        event,
        newSession ? `user=${newSession.user.id}` : "no session"
      );
      setSession(newSession ?? null);

      // Mark initialized after the first event (INITIAL_SESSION or SIGNED_IN etc.)
      setInitialized(true);
    });

    return () => {
      console.log("🧹 Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  // Hide splash once both fonts and auth are ready
  useEffect(() => {
    if (fontsLoaded && initialized) {
      console.log("✅ Fonts + auth ready — hiding splash");
      SplashScreen.hideAsync().catch((err) => {
        console.warn("⚠️ SplashScreen.hideAsync error (safe to ignore):", err);
      });
    }
  }, [fontsLoaded, initialized]);

  // Navigation guard — runs once initialized, drives all routing decisions
  useEffect(() => {
    if (!initialized || !fontsLoaded) return;

    if (session) {
      console.log("✅ Session present — navigating to tabs");
      router.replace("/(tabs)");
    } else {
      console.log("🚫 No session — navigating to onboarding");
      router.replace("/onboarding");
    }
  }, [initialized, session, fontsLoaded, router]);

  // Offline alert
  useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  // While loading, keep the splash screen visible
  if (!initialized || !fontsLoaded) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(0, 122, 255)",
      background: "rgb(242, 242, 247)",
      card: "rgb(255, 255, 255)",
      text: "rgb(0, 0, 0)",
      border: "rgb(216, 216, 220)",
      notification: "rgb(255, 59, 48)",
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(10, 132, 255)",
      background: "rgb(1, 1, 1)",
      card: "rgb(28, 28, 30)",
      text: "rgb(255, 255, 255)",
      border: "rgb(44, 44, 46)",
      notification: "rgb(255, 69, 58)",
    },
  };

  return (
    <NotificationProvider>
      <>
        <StatusBar style="auto" animated />
        <ThemeProvider
          value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
        >
          <WidgetProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <SystemBars style="auto" />
            </GestureHandlerRootView>
          </WidgetProvider>
        </ThemeProvider>
      </>
    </NotificationProvider>
  );
}
