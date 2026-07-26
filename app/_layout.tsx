import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
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
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChurchProvider, useChurchSession } from '@/contexts/ChurchContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CustomSplashScreen } from '@/components/CustomSplashScreen';
import { supabase } from '@/lib/supabase/client';
import { queryClient } from '@/lib/query/client';
import { usePerformanceBaselineLifecycle } from '@/hooks/usePerformanceBaselineScreen';

// Force expo-router to always start at index, never restore cached navigation state
export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before auth is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});
if (Platform.OS === 'android') {
  SplashScreen.setOptions({
    duration: 350,
    fade: true,
  });
}

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const edgeToEdge = require('react-native-edge-to-edge') as { SystemBars: SystemBarsComponent };
  SystemBars = edgeToEdge.SystemBars ?? null;
} catch {
  console.warn('[_layout] react-native-edge-to-edge not available — skipping SystemBars');
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { initialized, session } = useAuth();
  const { currentMember } = useChurchSession();
  const { hasPermission, onesignalSubscriptionId } = useNotifications();
  usePerformanceBaselineLifecycle();

  useEffect(() => {
    if (!initialized || session) return;

    const rootSegment = segments[0];
    const isPublicRoute = rootSegment === 'onboarding' || rootSegment === 'reset-password';

    if (!isPublicRoute) {
      console.log('[Layout] no session on protected route - navigating to onboarding');
      router.replace('/onboarding');
    }
  }, [initialized, router, segments, session]);

  useEffect(() => {
    if (!initialized || session || currentMember?.id || Platform.OS === 'web') return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { OneSignal } = require('react-native-onesignal') as {
        OneSignal: {
          logout?: () => void;
          User: {
            removeTag?: (key: string) => void;
          };
        };
      };
      OneSignal.User.removeTag?.('member_id');
      OneSignal.User.removeTag?.('church_id');
      OneSignal.logout?.();
      console.log('[Layout] Cleared OneSignal user after sign out');
    } catch (err) {
      console.warn('[Layout] Failed to clear OneSignal user after sign out:', err);
    }
  }, [currentMember?.id, initialized, session]);

  // Keep OneSignal's user alias in sync with the app member. This runs again
  // after permission/subscription changes so a fresh install cannot miss linking.
  useEffect(() => {
    if (currentMember?.id && Platform.OS !== 'web') {
      console.log('[Layout] Linking OneSignal user ID for member:', currentMember.id);
      const timer = setTimeout(() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { OneSignal } = require('react-native-onesignal') as {
            OneSignal: {
              login: (id: string) => void;
              User: {
                addTags: (tags: Record<string, string>) => void;
                getExternalId: () => Promise<string | null>;
                pushSubscription: {
                  optIn: () => void;
                };
              };
            };
          };
          if (hasPermission) {
            OneSignal.User.pushSubscription.optIn();
          }
          OneSignal.login(currentMember.id);
          OneSignal.User.addTags({
            member_id: currentMember.id,
            church_id: currentMember.church_id,
          });
          OneSignal.User.getExternalId()
            .then((externalId) => {
              console.log('[Layout] OneSignal external ID after login:', externalId);
            })
            .catch((err) => {
              console.warn('[Layout] Failed to read OneSignal external ID:', err);
            });
        } catch (err) {
          console.warn('[Layout] OneSignal login failed:', err);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentMember?.church_id, currentMember?.id, hasPermission, onesignalSubscriptionId]);

  // Save OneSignal subscription ID to Supabase for backend targeting
  useEffect(() => {
    if (currentMember?.id && onesignalSubscriptionId && Platform.OS !== 'web') {
      console.log('[Layout] Saving OneSignal subscription ID to Supabase for member:', currentMember.id);
      supabase
        .rpc('claim_onesignal_subscription', {
          target_member_id: currentMember.id,
          target_subscription_id: onesignalSubscriptionId,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[Layout] Failed to save subscription ID:', error.message);
          } else {
            console.log('[Layout] Subscription ID saved for member:', currentMember.id);
          }
        });
    }
  }, [currentMember?.id, onesignalSubscriptionId]);

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
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
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
            <CustomSplashScreen />
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
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <ChurchProvider>
              <StatusBar style="auto" animated />
              <RootLayoutNav />
            </ChurchProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
