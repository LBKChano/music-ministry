import 'react-native-reanimated';
import React, { useEffect } from 'react';
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
  const { session, initialized } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (!initialized || !fontsLoaded) return;

    console.log('[RootLayout] auth ready — session:', session ? 'yes' : 'no', 'segments:', segments[0]);
    SplashScreen.hideAsync().catch(() => {});

    if (session) {
      // Logged in — go to tabs (unless already there)
      if (segments[0] !== '(tabs)') {
        console.log('[RootLayout] session found outside tabs — redirecting to tabs');
        router.replace('/(tabs)');
      }
    } else {
      // Not logged in — go to onboarding (unless already there)
      if (segments[0] !== 'onboarding') {
        console.log('[RootLayout] no session — redirecting to onboarding');
        router.replace('/onboarding');
      }
    }
  }, [session, initialized, fontsLoaded, segments]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <AuthProvider>
      <NotificationProvider>
        <>
          <StatusBar style="auto" animated />
          <RootLayoutNav />
        </>
      </NotificationProvider>
    </AuthProvider>
  );
}
