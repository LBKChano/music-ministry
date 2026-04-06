
import "react-native-reanimated";
import React, { useEffect, useCallback } from "react";
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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not prevented — safe to ignore
});

export const unstable_settings = {
  initialRouteName: "onboarding",
};

function useProtectedRoute(user: any, needsOnboarding: boolean, isCheckingAuth: boolean) {
  const segments = useSegments();
  const router = useRouter();
  // Use a ref so the navigation lock never causes re-render loops.
  // Reset it whenever the auth check restarts so a fresh redirect can fire.
  const isNavigating = React.useRef(false);
  const prevIsCheckingAuth = React.useRef(isCheckingAuth);

  useEffect(() => {
    // When isCheckingAuth transitions true → false, unlock navigation so the
    // guard below can fire a fresh redirect for the new auth state.
    if (prevIsCheckingAuth.current === true && isCheckingAuth === false) {
      console.log('🔄 isCheckingAuth flipped to false — unlocking navigation guard');
      isNavigating.current = false;
    }
    prevIsCheckingAuth.current = isCheckingAuth;
  }, [isCheckingAuth]);

  useEffect(() => {
    if (isCheckingAuth) {
      console.log('⏳ Still checking auth, waiting...');
      return;
    }

    const inOnboarding = segments[0] === 'onboarding';

    console.log('🛡️ Protected route check:', {
      user: !!user,
      needsOnboarding,
      inOnboarding,
      segments: segments.join('/'),
      isNavigating: isNavigating.current,
    });

    if (needsOnboarding && !inOnboarding) {
      if (isNavigating.current) return;
      isNavigating.current = true;
      console.log('🔀 No session / needs onboarding — redirecting to /onboarding');
      router.replace('/onboarding');
    } else if (!needsOnboarding && inOnboarding) {
      if (isNavigating.current) return;
      isNavigating.current = true;
      console.log('🔀 Authenticated with churches — redirecting to /(tabs)');
      router.replace('/(tabs)');
    } else {
      // Already on the correct screen — clear the lock so future auth changes
      // can trigger a redirect again.
      isNavigating.current = false;
      console.log('✅ Already on correct screen, no redirect needed');
    }
  }, [user, needsOnboarding, segments, isCheckingAuth, router]);
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

// Maximum ms to wait for startup auth check before forcing the splash to hide.
const SPLASH_TIMEOUT_MS = 7000;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const networkState = useNetworkState();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [user, setUser] = useState<any>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Track whether the initial checkAuth has already completed so the
  // auth-state-change listener doesn't re-block the splash on INITIAL_SESSION.
  const initialCheckDone = React.useRef(false);

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch((err) => {
      console.warn('⚠️ SplashScreen.hideAsync error (safe to ignore):', err);
    });
  }, []);

  // Hide splash once fonts are loaded AND auth check is done.
  // The absolute timeout below guarantees this always fires within SPLASH_TIMEOUT_MS.
  useEffect(() => {
    if (loaded && !isCheckingAuth) {
      console.log('✅ Fonts + auth ready — hiding splash screen');
      hideSplash();
    }
  }, [loaded, isCheckingAuth, hideSplash]);

  // Absolute safety-net: hide the splash after SPLASH_TIMEOUT_MS no matter what.
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn(`⏰ Splash timeout (${SPLASH_TIMEOUT_MS}ms) reached — forcing hide`);
      setIsCheckingAuth(false); // unblock any pending state
      hideSplash();
    }, SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  // Check authentication and onboarding status
  useEffect(() => {
    console.log('🔐 Initializing authentication check');

    // Wrap getSession in a race against a 5 s timeout so a hung network call
    // never blocks the splash indefinitely.
    const getSessionWithTimeout = (): Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>> => {
      return Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('getSession timed out after 5 s')), 5000)
        ),
      ]);
    };
    
    const checkAuth = async () => {
      try {
        console.log('🔍 Fetching current session from storage...');
        const sessionResult = await getSessionWithTimeout();
        
        if (sessionResult.error) {
          console.error('❌ Error fetching session:', sessionResult.error);
          // Clear any corrupted/expired session from storage so the next launch is clean
          try {
            await supabase.auth.signOut();
            console.log('🧹 Cleared bad session from storage');
          } catch (signOutErr) {
            console.warn('⚠️ Could not clear bad session (safe to ignore):', signOutErr);
          }
          setUser(null);
          setNeedsOnboarding(true);
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
        initialCheckDone.current = true;
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

      // INITIAL_SESSION fires concurrently with checkAuth — ignore it here so
      // we don't re-block the splash after checkAuth already finished.
      if (event === 'INITIAL_SESSION') {
        console.log('🔄 Initial session event - already handled by checkAuth, skipping');
        return;
      }

      setUser(currentUser);

      if (currentUser && event === 'SIGNED_IN') {
        // Full church check only on actual sign-in
        console.log('🔒 SIGNED_IN — blocking navigation guard for church check');
        setIsCheckingAuth(true);

        try {
          console.log('⏳ Waiting for database to settle after sign in...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          console.log('🏛️ Checking churches after auth change...');
          const hasChurches = await checkUserHasChurches(currentUser.id, currentUser.email);

          console.log('🏛️ Auth change - User has churches:', hasChurches);
          setNeedsOnboarding(!hasChurches);

          if (hasChurches) {
            console.log('✅ User has churches, will redirect to app');
          }
        } catch (error) {
          console.error('❌ Error checking churches after auth change:', error);
          setNeedsOnboarding(true);
        } finally {
          initialCheckDone.current = true;
          setIsCheckingAuth(false);
          console.log('🔓 Navigation guard unblocked after church check');
        }
      } else if (currentUser && event === 'TOKEN_REFRESHED') {
        // Just update user, don't re-check churches or block navigation
        // The session is still valid, user is still logged in
        console.log('🔄 Token refreshed, keeping current auth state');
        if (!initialCheckDone.current) {
          // Only unblock if initial check hasn't run yet
          setIsCheckingAuth(false);
          initialCheckDone.current = true;
        }
      } else if (!currentUser && (event === 'SIGNED_OUT' || event === 'USER_DELETED')) {
        console.log('🚪 User signed out or deleted');
        setNeedsOnboarding(true);
        setIsCheckingAuth(false);
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth subscription');
      try {
        authSubscription.data.subscription.unsubscribe();
      } catch (err) {
        console.warn('⚠️ Error unsubscribing auth listener (safe to ignore):', err);
      }
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

  // While fonts are loading OR auth check is still in progress, render nothing
  // visible (splash screen is still showing). This prevents the blank/white
  // screen flash on Android after a force-close where the JS bundle loads but
  // the navigation guard hasn't fired yet.
  if (!loaded || isCheckingAuth) {
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
