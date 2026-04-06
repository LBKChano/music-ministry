
import "react-native-reanimated";
import React, { useEffect, useState, useCallback } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
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

export const unstable_settings = {
  initialRouteName: "onboarding",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch((err) => {
      console.warn("⚠️ SplashScreen.hideAsync error (safe to ignore):", err);
    });
  }, []);

  // Step 1: Get the initial session once on mount
  useEffect(() => {
    console.log("🔐 RootLayout: fetching initial session");

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn(
            "⚠️ getSession error (treating as no session):",
            error.message
          );
          setSession(null);
        } else {
          const s = data.session ?? null;
          console.log(
            "✅ Initial session:",
            s ? `user=${s.user.id}` : "none"
          );
          setSession(s);
        }
      })
      .catch((err) => {
        console.error("❌ getSession threw unexpectedly:", err);
        setSession(null);
      })
      .finally(() => {
        console.log("✅ Auth check complete — isLoading → false");
        setIsLoading(false);
      });

    // Step 2: Keep session in sync with auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("🔄 onAuthStateChange:", event, newSession ? `user=${newSession.user.id}` : "no session");
      // INITIAL_SESSION fires before getSession resolves on some platforms —
      // we still update state so the guard always has the latest value.
      setSession(newSession ?? null);
    });

    return () => {
      console.log("🧹 Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, []);

  // Step 3: Hide splash once both fonts and auth are ready
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      console.log("✅ Fonts + auth ready — hiding splash");
      hideSplash();
    }
  }, [fontsLoaded, isLoading, hideSplash]);

  // Step 4: Navigation guard — only runs after loading is complete
  useEffect(() => {
    if (isLoading) return;
    if (segments[0] === undefined) return; // router not yet resolved

    const inTabsGroup = segments[0] === "(tabs)";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && inTabsGroup) {
      router.replace("/onboarding");
    } else if (session && inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments, router]);

  // Offline alert
  useEffect(() => {
    if (
      !networkState.isConnected &&
      networkState.isInternetReachable === false
    ) {
      Alert.alert(
        "🔌 You are offline",
        "You can keep using the app! Your changes will be saved locally and synced when you are back online."
      );
    }
  }, [networkState.isConnected, networkState.isInternetReachable]);

  // While loading, keep the splash screen visible (return null)
  if (isLoading || !fontsLoaded) {
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
