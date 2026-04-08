import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
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
  const { initialized } = useAuth();

  // Fonts are loaded asynchronously but we don't block rendering on them.
  void fontsLoaded;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomDefaultTheme}>
      <WidgetProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/*
           * Always render the Stack unconditionally so the navigator is mounted
           * and ready to receive router.replace() calls from app/index.tsx.
           * An opaque overlay is shown on top while auth initializes.
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

          {/*
           * Opaque loading overlay while auth initializes. Sits above the Stack
           * so the navigator is mounted (and can receive navigation calls) but
           * the user sees a clean loading screen instead of a flash of the wrong route.
           */}
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
    backgroundColor: '#1a2332',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
