import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
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
import { queryClient } from '@/lib/query/client';
import { supabase } from '@/lib/supabase/client';
import { resolveStartupDestination } from '@/lib/church/startup-coordinator';
import { registerCurrentNotificationDevice } from '@/lib/notifications/device-registration';
import { usePerformanceBaselineLifecycle } from '@/hooks/usePerformanceBaselineScreen';
import { isPasswordRecoveryUrl } from '@/utils/passwordResetLinks';
import { isSignupVerificationUrl } from '@/utils/signupVerificationLinks';

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
  const { initialized, session, initializationError } = useAuth();
  const { currentChurch, currentMember, sessionStatus } = useChurchSession();
  const {
    clearIdentity,
    linkIdentity,
    linkedIdentity,
    loading: notificationLoading,
    onesignalSubscriptionId,
  } = useNotifications();
  const registeredDeviceKeyRef = useRef<string | null>(null);
  usePerformanceBaselineLifecycle();

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isPasswordRecoveryUrl(url)) {
        console.log('[Layout] password recovery link received');
        router.replace({
          pathname: '/reset-password',
          params: { recoveryUrl: encodeURIComponent(url) },
        });
        return;
      }

      if (isSignupVerificationUrl(url)) {
        console.log('[Layout] signup verification link received');
        router.replace({
          pathname: '/verify-email',
          params: { verificationUrl: encodeURIComponent(url) },
        });
      }
    });

    return () => subscription.remove();
  }, [router]);

  const startupDestination = resolveStartupDestination({
    authInitialized: initialized,
    hasSession: Boolean(session),
    authError: initializationError,
    churchStatus: sessionStatus,
  });

  useEffect(() => {
    const rootSegment = segments[0];
    const isPasswordRecovery = rootSegment === 'reset-password';
    const isOnboarding = rootSegment === 'onboarding';
    const isEmailVerification = rootSegment === 'verify-email';

    if (
      isPasswordRecovery
      || isEmailVerification
      || startupDestination === 'wait'
    ) return;

    if (startupDestination === 'onboarding' && !isOnboarding) {
      console.log('[Layout] Signed-out session; navigating to onboarding');
      router.replace('/onboarding');
      return;
    }

    if (
      startupDestination === 'no-membership'
      && rootSegment !== 'no-membership'
      && !isOnboarding
    ) {
      console.log('[Layout] Church session needs recovery');
      router.replace('/no-membership');
      return;
    }

    if (
      startupDestination === 'tabs'
      && (rootSegment === 'index' || rootSegment === 'no-membership')
    ) {
      router.replace('/(tabs)/(home)');
    }
  }, [router, segments, startupDestination]);

  useEffect(() => {
    if (!initialized || session || currentMember?.id || Platform.OS === 'web') return;
    registeredDeviceKeyRef.current = null;
    clearIdentity();
  }, [clearIdentity, currentMember?.id, initialized, session]);

  // Link OneSignal only after Auth and the selected church membership are ready.
  useEffect(() => {
    const accountId = session?.user.id;
    const churchId = currentChurch?.id;
    const memberId = currentMember?.id;
    if (
      sessionStatus !== 'ready'
      || notificationLoading
      || !accountId
      || !churchId
      || !memberId
      || currentMember.member_id !== accountId
      || currentMember.church_id !== churchId
      || Platform.OS === 'web'
    ) return;

    void linkIdentity({ memberId, churchId });
  }, [
    currentChurch?.id,
    currentMember?.church_id,
    currentMember?.id,
    currentMember?.member_id,
    linkIdentity,
    notificationLoading,
    session?.user.id,
    sessionStatus,
  ]);

  // Register this physical subscription to the account and retain the released
  // member-scoped claim as a compatibility bridge.
  useEffect(() => {
    const accountId = session?.user.id;
    const memberId = currentMember?.id;
    if (
      sessionStatus !== 'ready'
      || !accountId
      || !memberId
      || currentMember.member_id !== accountId
      || linkedIdentity?.memberId !== memberId
      || linkedIdentity.churchId !== currentMember.church_id
      || !onesignalSubscriptionId
      || Platform.OS === 'web'
    ) return;

    const registrationKey = [
      accountId,
      memberId,
      onesignalSubscriptionId,
    ].join(':');
    if (registeredDeviceKeyRef.current === registrationKey) return;
    registeredDeviceKeyRef.current = registrationKey;

    void registerCurrentNotificationDevice({
      accountId,
      memberId,
      subscriptionId: onesignalSubscriptionId,
      platform: Platform.OS,
    }, supabase).then(() => {
      console.log('[Layout] Notification device registered:', {
        accountId,
        memberId,
      });
    }).catch(error => {
      if (registeredDeviceKeyRef.current === registrationKey) {
        registeredDeviceKeyRef.current = null;
      }
      console.warn('[Layout] Failed to register notification device:', error);
    });
  }, [
    currentMember?.id,
    currentMember?.church_id,
    currentMember?.member_id,
    linkedIdentity?.churchId,
    linkedIdentity?.memberId,
    onesignalSubscriptionId,
    session?.user.id,
    sessionStatus,
  ]);

  // Fonts are loaded asynchronously but we don't block rendering on them.
  void fontsLoaded;

  const activeTheme = colorScheme === 'dark'
    ? CustomDarkTheme
    : CustomDefaultTheme;

  return (
    <ThemeProvider value={activeTheme}>
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
            <Stack.Screen name="verify-email" options={{ headerShown: false }} />
            <Stack.Screen name="no-membership" options={{ headerShown: false }} />
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
          {(
            !initialized
            || (
              startupDestination === 'wait'
              && !currentChurch
              && segments[0] !== 'onboarding'
              && segments[0] !== 'reset-password'
              && segments[0] !== 'verify-email'
            )
          ) && (
            <CustomSplashScreen />
          )}

          {sessionStatus === 'selecting-church' ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Switching church"
              style={[
                styles.churchSwitchOverlay,
                { backgroundColor: activeTheme.colors.background },
              ]}
            >
              <ActivityIndicator size="large" color={activeTheme.colors.primary} />
              <Text style={[styles.churchSwitchText, { color: activeTheme.colors.text }]}>
                Switching church...
              </Text>
            </View>
          ) : null}

          {SystemBars ? <SystemBars style="auto" /> : null}
        </GestureHandlerRootView>
      </WidgetProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  churchSwitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  churchSwitchText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
});

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
