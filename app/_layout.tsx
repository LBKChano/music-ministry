import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
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
  // useRootNavigationState tells us when the expo-router navigator is fully mounted
  // and ready to accept router.replace/push calls. Without this guard, calling
  // router.replace before the navigator is ready causes a crash/blank screen.
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for auth to initialize AND for the navigator to be mounted.
    if (!initialized || !navigationState?.key) return;

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
  }, [session, initialized, segments, navigationState?.key, router]);

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
