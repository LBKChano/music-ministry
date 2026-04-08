import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
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
  // Keep stable refs to avoid stale closures / infinite effect loops
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    // CRITICAL: Do NOT redirect while auth is still loading.
    // Redirecting before initialized=true causes a navigation storm and crashes.
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

  // While auth is initializing, show a blank view — never redirect during this phase
  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
      <WidgetProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
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
