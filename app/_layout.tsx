import 'react-native-reanimated';
import React, { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SystemBars } from 'react-native-edge-to-edge';
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
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Force expo-router to always start at index, never restore cached navigation state
export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before auth is ready.
// AuthContext.tsx calls SplashScreen.hideAsync() once initialized.
SplashScreen.preventAutoHideAsync().catch(() => {});

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

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { session, initialized } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  // Track last auth state to avoid firing navigation on every render
  const lastAuthState = useRef<boolean | null>(null);
  // Keep a stable ref to segments so the effect can read current value
  // without segments being in the dependency array (useSegments() returns a
  // new array reference every render, which would re-trigger the effect on
  // every render and cause a navigation storm on Android).
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  // Keep a stable ref to router — useRouter() may return a new object
  // reference on every render in some expo-router versions, which would
  // cause the effect to re-run on every render if router is in the deps.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!initialized) return;

    const currentSegments = segmentsRef.current;
    const inTabs = currentSegments[0] === '(tabs)';
    const inOnboarding = currentSegments[0] === 'onboarding';
    const isLoggedIn = !!session;

    // Only act when auth state actually changes to avoid re-entrancy crashes
    if (lastAuthState.current === isLoggedIn) return;
    lastAuthState.current = isLoggedIn;

    if (isLoggedIn && !inTabs) {
      console.log('[RootLayout] session detected — navigating to /(tabs)');
      routerRef.current.replace('/(tabs)');
    } else if (!isLoggedIn && !inOnboarding) {
      console.log('[RootLayout] no session — navigating to /onboarding');
      routerRef.current.replace('/onboarding');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, initialized]);

  // Fonts are loaded asynchronously but we don't block rendering on them —
  // the splash screen is controlled solely by AuthContext (INITIAL_SESSION).
  void fontsLoaded;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
      <WidgetProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="notification-preferences" options={{ headerShown: true, title: 'Notification Preferences' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <SystemBars style="auto" />
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
          <>
            <StatusBar style="auto" animated />
            <RootLayoutNav />
          </>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
