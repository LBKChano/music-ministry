import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChurchProvider } from '@/contexts/ChurchContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Force expo-router to always start at index, never restore cached navigation state
export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before auth is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Absolute last-resort fallback: if nothing hides the splash within 8 seconds,
// force-hide it so the app never gets permanently stuck on the splash screen.
const splashFallbackTimer = setTimeout(() => {
  console.warn('[_layout] Splash fallback timeout fired — force-hiding splash screen');
  SplashScreen.hideAsync().catch(() => {});
}, 8000);

const CustomDefaultTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    primary: 'rgb(0, 122, 255)',
    background: 'rgb(242, 242, 247)',
    card: 'rgb(255, 255, 255)',
    text: 'rgb(0, 0, 0)',
    border: 'rgb(216, 216, 220)',
    notification: 'rgb(255, 59, 48)',
  },
};

const CustomDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    primary: 'rgb(10, 132, 255)',
    background: 'rgb(1, 1, 1)',
    card: 'rgb(28, 28, 30)',
    text: 'rgb(255, 255, 255)',
    border: 'rgb(44, 44, 46)',
    notification: 'rgb(255, 69, 58)',
  },
};

// Safely resolve SystemBars — react-native-edge-to-edge requires a native build.
// If the native module isn't linked yet (Expo Go / missing prebuild), skip it
// gracefully rather than crashing the entire app at startup.
type SystemBarsComponent = React.ComponentType<{ style?: string }>;
let SystemBars: SystemBarsComponent | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const edgeToEdge = require('react-native-edge-to-edge') as { SystemBars: SystemBarsComponent };
  SystemBars = edgeToEdge.SystemBars ?? null;
} catch {
  console.warn('[_layout] react-native-edge-to-edge not available — skipping SystemBars');
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { session, initialized } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  // Track whether the navigator has mounted and is ready to accept navigation calls.
  // In expo-router v4, useRootNavigationState was removed. Instead we use a ref
  // that flips to true on the first render tick after the Stack mounts.
  const navigatorReady = useRef(false);

  // Clear the module-level splash fallback once auth is initialized
  useEffect(() => {
    if (initialized) {
      clearTimeout(splashFallbackTimer);
    }
  }, [initialized]);

  useEffect(() => {
    // Mark the navigator as ready after the first render cycle.
    // setTimeout(0) defers until after the current JS frame, by which point
    // the Stack navigator is fully mounted and router.replace() is safe to call.
    const t = setTimeout(() => {
      navigatorReady.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Wait for auth to initialize. The navigator-ready check is handled by
    // deferring this effect's action with setTimeout(0) as well.
    if (!initialized) return;

    const t = setTimeout(() => {
      const inTabs = segments[0] === '(tabs)';
      const inOnboarding = segments[0] === 'onboarding';

      if (session) {
        if (!inTabs) {
          console.log('[RootLayout] session detected — navigating to /(tabs)');
          router.replace('/(tabs)');
        }
      } else {
        if (!inOnboarding) {
          console.log('[RootLayout] no session — navigating to /onboarding');
          router.replace('/onboarding');
        }
      }
    }, 0);

    return () => clearTimeout(t);
  }, [session, initialized, segments, router]);

  // Fonts are loaded asynchronously but we don't block rendering on them —
  // the splash screen is controlled solely by AuthContext (INITIAL_SESSION).
  void fontsLoaded;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
      <WidgetProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/*
           * IMPORTANT: Always render the Stack unconditionally.
           *
           * Previously, this component returned an early <View> while !initialized,
           * which prevented the Stack from ever mounting. That meant
           * useRootNavigationState() never produced a key, so the navigation
           * useEffect's guard `!navigationState?.key` never cleared, and the
           * redirect to /onboarding or /(tabs) never fired — a permanent deadlock.
           *
           * Fix: always render the Stack. Show an opaque overlay on top while
           * auth is initializing so the user sees a loading screen, but the
           * navigator is mounted and ready to receive router.replace() calls.
           */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="notification-preferences"
              options={{ headerShown: true, title: 'Notification Preferences' }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>

          {/* Opaque loading overlay while auth initializes. Sits above the Stack
              so the navigator is mounted (and can receive navigation calls) but
              the user sees a clean loading screen instead of a flash of the wrong route. */}
          {!initialized && (
            <View style={styles.loadingOverlay} pointerEvents="box-none">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}

          {SystemBars ? <SystemBars style="auto" /> : null}
        </GestureHandlerRootView>
      </WidgetProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <ChurchProvider>
            <StatusBar style="auto" animated />
            <RootLayoutNav />
          </ChurchProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
