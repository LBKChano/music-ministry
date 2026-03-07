
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

function useProtectedRoute(user: any, needsOnboarding: boolean, isCheckingAuth: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    // Don't navigate while still checking auth
    if (isCheckingAuth) {
      console.log('⏳ Still checking auth, waiting...');
      return;
    }

    console.log('🛡️ Protected route check:', { 
      user: !!user, 
      needsOnboarding, 
      segments: segments.join('/'),
      hasNavigated,
    });
    
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';

    // If user needs onboarding and not on onboarding screen, redirect
    if (needsOnboarding && !inOnboarding) {
      console.log('🔀 User needs onboarding, redirecting...');
      // Use setTimeout to ensure navigation happens after layout is mounted
      // Only navigate once to prevent loops
      if (!hasNavigated) {
        setHasNavigated(true);
        setTimeout(() => {
          try {
            router.replace('/onboarding');
            console.log('✅ Navigated to onboarding');
          } catch (error) {
            console.error('❌ Error navigating to onboarding:', error);
            setHasNavigated(false);
          }
        }, 100);
      }
    } 
    // If user doesn't need onboarding and is on onboarding screen, redirect to app
    else if (!needsOnboarding && inOnboarding) {
      console.log('🔀 User has churches, redirecting to app...');
      if (!hasNavigated) {
        setHasNavigated(true);
        setTimeout(() => {
          try {
            router.replace('/(tabs)');
            console.log('✅ Navigated to app');
          } catch (error) {
            console.error('❌ Error navigating to app:', error);
            setHasNavigated(false);
          }
        }, 100);
      }
    } else {
      // Reset navigation flag when we're on the correct screen
      if (hasNavigated) {
        console.log('✅ On correct screen, resetting navigation flag');
        setHasNavigated(false);
      }
    }
  }, [user, needsOnboarding, segments, isCheckingAuth, router, hasNavigated]);
}

async function checkUserHasChurches(userId: string, userEmail: string | undefined, retryCount = 0): Promise<boolean> {
  console.log(`🔍 Checking churches for user (attempt ${retryCount + 1}):`, userId);
  
  try {
    // Check if user is admin of any church
    const adminChurchesResult = await supabase
      .from('churches')
      .select('id')
      .eq('admin_id', userId)
      .limit(1);

    console.log('🏛️ Admin churches query result:', {
      hasData: !!adminChurchesResult.data,
      count: adminChurchesResult.data?.length || 0,
      hasError: !!adminChurchesResult.error,
    });

    // Handle RLS errors specifically
    if (adminChurchesResult.error) {
      if (adminChurchesResult.error.code === '42P17') {
        console.error('❌ RLS infinite recursion error detected - database policies need to be fixed');
        // Return false to send user to onboarding where they can see the error
        return false;
      }
      console.error('❌ Error checking admin churches:', adminChurchesResult.error.message);
    }

    // Check if user is a member of any church (by member_id, not email)
    const memberChurchesResult = await supabase
      .from('church_members')
      .select('church_id')
      .eq('member_id', userId)
      .limit(1);

    console.log('👥 Member churches query result:', {
      hasData: !!memberChurchesResult.data,
      count: memberChurchesResult.data?.length || 0,
      hasError: !!memberChurchesResult.error,
    });

    // Handle RLS errors specifically
    if (memberChurchesResult.error) {
      if (memberChurchesResult.error.code === '42P17') {
        console.error('❌ RLS infinite recursion error detected - database policies need to be fixed');
        // Return false to send user to onboarding where they can see the error
        return false;
      }
      console.error('❌ Error checking member churches:', memberChurchesResult.error.message);
    }

    const hasAdminChurches = adminChurchesResult.data ? adminChurchesResult.data.length > 0 : false;
    const hasMemberChurches = memberChurchesResult.data ? memberChurchesResult.data.length > 0 : false;
    const hasChurches = hasAdminChurches || hasMemberChurches;
    
    console.log('📊 Church check results:', {
      hasAdminChurches,
      hasMemberChurches,
      hasChurches,
    });
    
    // If no churches found and we haven't retried too many times, retry after a delay
    // Only retry if there were no errors (errors indicate a real problem, not just timing)
    if (!hasChurches && retryCount < 3 && !adminChurchesResult.error && !memberChurchesResult.error) {
      const delayMs = (retryCount + 1) * 500;
      console.log(`⏳ No churches found, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return checkUserHasChurches(userId, userEmail, retryCount + 1);
    }
    
    return hasChurches;
  } catch (error) {
    console.error('❌ Unexpected error in checkUserHasChurches:', error);
    // Return false instead of throwing to prevent app crashes
    return false;
  }
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
    console.log('🔐 Initializing authentication check');
    
    const checkAuth = async () => {
      try {
        console.log('🔍 Fetching current session from storage...');
        const sessionResult = await supabase.auth.getSession();
        
        if (sessionResult.error) {
          console.error('❌ Error fetching session:', sessionResult.error);
          setUser(null);
          setNeedsOnboarding(true);
          setIsCheckingAuth(false);
          return;
        }

        const currentUser = sessionResult.data.session?.user || null;
        
        if (currentUser) {
          console.log('✅ Session found for user:', currentUser.id);
          console.log('📧 User email:', currentUser.email);
          setUser(currentUser);

          console.log('🏛️ Checking if user has churches...');
          const hasChurches = await checkUserHasChurches(currentUser.id, currentUser.email);
          console.log('🏛️ User has churches:', hasChurches);
          setNeedsOnboarding(!hasChurches);
        } else {
          console.log('❌ No session found - user needs to log in');
          setUser(null);
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('❌ Unexpected error checking auth:', error);
        setUser(null);
        setNeedsOnboarding(true);
      } finally {
        console.log('✅ Auth check complete, setting isCheckingAuth to false');
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event);
      const currentUser = session?.user || null;
      
      if (currentUser) {
        console.log('👤 User from auth change:', currentUser.id);
      } else {
        console.log('👤 No user in auth change event');
      }

      setUser(currentUser);

      if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Set checking auth to true while we verify churches
        setIsCheckingAuth(true);
        
        // Add a delay to ensure database operations have completed
        console.log('⏳ Waiting for database to settle after sign in...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check for churches with retry logic
        console.log('🏛️ Checking churches after auth change...');
        const hasChurches = await checkUserHasChurches(currentUser.id, currentUser.email);
        
        console.log('🏛️ Auth change - User has churches:', hasChurches);
        setNeedsOnboarding(!hasChurches);
        setIsCheckingAuth(false);
        
        // If user has churches, redirect to app
        if (hasChurches) {
          console.log('✅ User has churches, will redirect to app');
        }
      } else if (!currentUser && (event === 'SIGNED_OUT' || event === 'USER_DELETED')) {
        console.log('🚪 User signed out or deleted');
        setNeedsOnboarding(true);
        setIsCheckingAuth(false);
      } else if (event === 'INITIAL_SESSION') {
        console.log('🔄 Initial session event - already handled by checkAuth');
        // Don't change state here, let the initial checkAuth handle it
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth subscription');
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
