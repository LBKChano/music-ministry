
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
import { supabase } from "@/lib/supabase/client";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function useProtectedRoute(user: any, needsOnboarding: boolean, isCheckingAuth: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't navigate while still checking auth
    if (isCheckingAuth) {
      return;
    }

    console.log('Protected route check:', { user: !!user, needsOnboarding, segments });
    
    const inOnboarding = segments[0] === 'onboarding';

    // If user needs onboarding and not on onboarding screen, redirect
    if (needsOnboarding && !inOnboarding) {
      console.log('Redirecting to onboarding');
      // Use setTimeout to ensure navigation happens after layout is mounted
      setTimeout(() => {
        router.replace('/onboarding');
      }, 100);
    } 
    // If user doesn't need onboarding and is on onboarding screen, redirect to app
    else if (!needsOnboarding && inOnboarding) {
      console.log('Redirecting to app');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  }, [user, needsOnboarding, segments, isCheckingAuth]);
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
    if (loaded && !isCheckingAuth) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isCheckingAuth]);

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

  useProtectedRoute(user, needsOnboarding, isCheckingAuth);

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

  if (!loaded) {
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
  );
}
