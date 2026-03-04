
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
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
import { supabase } from "@/app/integrations/supabase/client";
// Note: Error logging is auto-initialized via index.ts import

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)", // Ensure any route can link back to `/`
};

function useProtectedRoute(user: any, needsOnboarding: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('Protected route check:', { user: !!user, needsOnboarding, segments });
    
    const inAuthGroup = segments[0] === 'onboarding';

    // If user needs onboarding and not on onboarding screen, redirect
    if (needsOnboarding && !inAuthGroup) {
      console.log('Redirecting to onboarding');
      router.replace('/onboarding');
    } 
    // If user doesn't need onboarding and is on onboarding screen, redirect to app
    else if (!needsOnboarding && inAuthGroup) {
      console.log('Redirecting to app');
      router.replace('/(tabs)');
    }
  }, [user, needsOnboarding, segments]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [user, setUser] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Check authentication and onboarding status
  useEffect(() => {
    console.log('Checking authentication status');
    
    const checkAuth = async () => {
      try {
        const sessionResult = await supabase.auth.getSession();
        const currentUser = sessionResult.data.session?.user || null;
        
        console.log('Current user:', currentUser?.id);
        setUser(currentUser);

        if (currentUser) {
          // Check if user has any churches
          console.log('Checking if user has churches');
          const churchesResult = await supabase
            .from('churches')
            .select('id')
            .eq('admin_id', currentUser.id)
            .limit(1);

          const hasChurches = churchesResult.data && churchesResult.data.length > 0;
          console.log('User has churches:', hasChurches);
          
          setNeedsOnboarding(!hasChurches);
        } else {
          console.log('No user logged in, needs onboarding');
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setNeedsOnboarding(true);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser && event === 'SIGNED_IN') {
        // Check if user has churches
        const churchesResult = await supabase
          .from('churches')
          .select('id')
          .eq('admin_id', currentUser.id)
          .limit(1);

        const hasChurches = churchesResult.data && churchesResult.data.length > 0;
        setNeedsOnboarding(!hasChurches);
      } else if (!currentUser) {
        setNeedsOnboarding(true);
      }
    });

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  useProtectedRoute(user, needsOnboarding);

  React.useEffect(() => {
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

  if (!loaded || isCheckingAuth) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: "rgb(0, 122, 255)", // System Blue
      background: "rgb(242, 242, 247)", // Light mode background
      card: "rgb(255, 255, 255)", // White cards/surfaces
      text: "rgb(0, 0, 0)", // Black text for light mode
      border: "rgb(216, 216, 220)", // Light gray for separators/borders
      notification: "rgb(255, 59, 48)", // System Red
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: "rgb(10, 132, 255)", // System Blue (Dark Mode)
      background: "rgb(1, 1, 1)", // True black background for OLED displays
      card: "rgb(28, 28, 30)", // Dark card/surface color
      text: "rgb(255, 255, 255)", // White text for dark mode
      border: "rgb(44, 44, 46)", // Dark gray for separators/borders
      notification: "rgb(255, 69, 58)", // System Red (Dark Mode)
    },
  };
  return (
    <>
      <StatusBar style="auto" animated />
        <ThemeProvider
          value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}
        >
          <WidgetProvider>
            <GestureHandlerRootView>
            <Stack>
              {/* Onboarding screen */}
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              {/* Main app with tabs */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <SystemBars style={"auto"} />
            </GestureHandlerRootView>
          </WidgetProvider>
        </ThemeProvider>
    </>
  );
}
