
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
import { supabase } from "@/lib/supabase/client";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

async function checkUserHasChurches(userId: string, userEmail: string | undefined, retryCount = 0): Promise<boolean> {
  console.log(`Checking churches for user (attempt ${retryCount + 1}):`, userId, userEmail);
  
  try {
    // Check if user is admin of any church
    const adminChurchesResult = await supabase
      .from('churches')
      .select('id')
      .eq('admin_id', userId)
      .limit(1);

    console.log('Admin churches query result:', adminChurchesResult);

    // Check if user is a member of any church (by email)
    let hasMemberChurches = false;
    if (userEmail) {
      const memberChurchesResult = await supabase
        .from('church_members')
        .select('church_id')
        .eq('email', userEmail)
        .limit(1);

      console.log('Member churches query result:', memberChurchesResult);
      hasMemberChurches = memberChurchesResult.data ? memberChurchesResult.data.length > 0 : false;
    }

    const hasAdminChurches = adminChurchesResult.data ? adminChurchesResult.data.length > 0 : false;
    const hasChurches = hasAdminChurches || hasMemberChurches;
    
    console.log('User has admin churches:', hasAdminChurches);
    console.log('User has member churches:', hasMemberChurches);
    console.log('User has churches (total):', hasChurches);
    
    // If no churches found and we haven't retried too many times, retry after a delay
    if (!hasChurches && retryCount < 3) {
      console.log(`No churches found, retrying in ${(retryCount + 1) * 500}ms...`);
      await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 500));
      return checkUserHasChurches(userId, userEmail, retryCount + 1);
    }
    
    return hasChurches;
  } catch (error) {
    console.error('Error checking churches:', error);
    return false;
  }
}

function useProtectedRoute(user: any, needsOnboarding: boolean, isCheckingAuth: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't navigate while still checking auth
    if (isCheckingAuth) {
      console.log('Still checking auth, waiting...');
      return;
    }

    console.log('Protected route check:', { user: !!user, needsOnboarding, segments });
    
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';

    // If user needs onboarding and not on onboarding screen, redirect
    if (needsOnboarding && !inOnboarding) {
      console.log('Redirecting to onboarding');
      router.replace('/onboarding');
    } 
    // If user doesn't need onboarding and is on onboarding screen, redirect to app
    else if (!needsOnboarding && inOnboarding) {
      console.log('Redirecting to app');
      router.replace('/(tabs)');
    }
  }, [user, needsOnboarding, segments, isCheckingAuth, router]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [user, setUser] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Handle font loading errors
  useEffect(() => {
    if (error) {
      console.error('Font loading error:', error);
      throw error;
    }
  }, [error]);

  // Hide splash screen when ready
  useEffect(() => {
    if (loaded && !isCheckingAuth) {
      console.log('Fonts loaded and auth checked, hiding splash screen');
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
          const hasChurches = await checkUserHasChurches(currentUser.id, currentUser.email);
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
        // Set checking auth to true while we verify churches
        setIsCheckingAuth(true);
        
        // Add a longer initial delay to ensure database operations have completed
        console.log('Waiting for database to settle after sign in...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check for churches with retry logic
        const hasChurches = await checkUserHasChurches(currentUser.id, currentUser.email);
        
        console.log('Auth change - User has churches:', hasChurches);
        setNeedsOnboarding(!hasChurches);
        setIsCheckingAuth(false);
      } else if (!currentUser) {
        setNeedsOnboarding(true);
        setIsCheckingAuth(false);
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

  // Don't render anything until fonts are loaded
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
