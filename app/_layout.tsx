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
import {
  DefaultTheme,
  Theme,
  ThemeProvider,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ChurchProvider, useChurchSession } from '@/contexts/ChurchContext';
import {
  AppThemeProvider,
  useAppAppearance,
  useAppTheme,
} from '@/contexts/AppThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CustomSplashScreen } from '@/components/CustomSplashScreen';
import { MemberNotificationRealtimeSync } from '@/components/notifications/member-notification-realtime-sync';
import { ScheduleWidgetLifecycleSync } from '@/components/widgets/schedule-widget-lifecycle-sync';
import { queryClient } from '@/lib/query/client';
import { supabase } from '@/lib/supabase/client';
import { resolveStartupDestination } from '@/lib/church/startup-coordinator';
import { registerCurrentNotificationDevice } from '@/lib/notifications/device-registration';
import { usePerformanceBaselineLifecycle } from '@/hooks/usePerformanceBaselineScreen';
import { createNavigationThemeColors } from '@/lib/ui/app-theme';
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

// Safely resolve SystemBars — react-native-edge-to-edge requires a native build.
type SystemBarStyle = 'auto' | 'inverted' | 'light' | 'dark';
type SystemBarsComponent = React.ComponentType<{
  style?: SystemBarStyle | {
    statusBar?: SystemBarStyle;
    navigationBar?: SystemBarStyle;
  };
}>;
let SystemBars: SystemBarsComponent | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const edgeToEdge = require('react-native-edge-to-edge') as { SystemBars: SystemBarsComponent };
  SystemBars = edgeToEdge.SystemBars ?? null;
} catch {
  console.warn('[_layout] react-native-edge-to-edge not available — skipping SystemBars');
}

function RootLayoutNav() {
  const appTheme = useAppTheme();
  const { ready: appearanceReady } = useAppAppearance();
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
  const nativeSplashHiddenRef = useRef(false);
  usePerformanceBaselineLifecycle();

  const handleSplashReady = React.useCallback(() => {
    if (nativeSplashHiddenRef.current) return;
    nativeSplashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(error => {
      console.warn('[Layout] Unable to hide native splash screen:', error);
    });
  }, []);

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
    const rootSegment = segments[0] as string | undefined;
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

  const activeTheme = React.useMemo<Theme>(() => ({
    ...DefaultTheme,
    dark: appTheme.mode === 'dark',
    colors: createNavigationThemeColors(appTheme),
  }), [appTheme]);
  const usesBrandedTabHeader = segments[0] === '(tabs)';
  const statusBarStyle = appTheme.mode === 'dark' || usesBrandedTabHeader
    ? 'light'
    : 'dark';
  const navigationBarStyle = appTheme.mode === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(appTheme.colors.canvas).catch(error => {
      console.warn('[Layout] Unable to update the native root background:', error);
    });
  }, [appTheme.colors.canvas]);

  const showStartupSplash = (
    !appearanceReady
    || !initialized
    || (
      startupDestination === 'wait'
      && !currentChurch
      && segments[0] !== 'onboarding'
      && segments[0] !== 'reset-password'
      && segments[0] !== 'verify-email'
    )
  );

  return (
    <ThemeProvider value={activeTheme}>
      <WidgetProvider>
        <GestureHandlerRootView
          style={{ flex: 1, backgroundColor: appTheme.colors.canvas }}
        >
          <StatusBar animated style={statusBarStyle} />
          <MemberNotificationRealtimeSync />
          <ScheduleWidgetLifecycleSync />
          {/*
           * Always render the Stack unconditionally so the navigator is mounted
           * and ready to receive router.replace() calls from app/index.tsx.
           * An opaque overlay is shown on top while auth initializes.
           */}
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: appTheme.colors.canvas },
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="verify-email" options={{ headerShown: false }} />
            <Stack.Screen name="no-membership" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile-identity" options={{ headerShown: false }} />
            <Stack.Screen name="profile-churches" options={{ headerShown: false }} />
            <Stack.Screen name="profile-availability" options={{ headerShown: false }} />
            <Stack.Screen name="profile-scheduling-preferences" options={{ headerShown: false }} />
            <Stack.Screen name="profile-account" options={{ headerShown: false }} />
            <Stack.Screen name="profile-appearance" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />
            <Stack.Screen name="schedule-notifications" options={{ headerShown: false }} />
            <Stack.Screen
              name="notification-preferences"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>

          {/*
           * Opaque loading overlay while auth initializes. Sits above the Stack
           * so the navigator is mounted (and can receive navigation calls) but
           * the user sees a clean loading screen instead of a flash of the wrong route.
           */}
          <CustomSplashScreen
            onReady={handleSplashReady}
            visible={showStartupSplash}
          />

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

          {SystemBars ? (
            <SystemBars
              style={{
                navigationBar: navigationBarStyle,
                statusBar: statusBarStyle,
              }}
            />
          ) : null}
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
        <AppThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <ChurchProvider>
                <RootLayoutNav />
              </ChurchProvider>
            </NotificationProvider>
          </AuthProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
