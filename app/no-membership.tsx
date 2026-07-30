import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { Button } from '@/components/button';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch, useChurchSession } from '@/hooks/useChurch';
import { useAuth } from '@/contexts/AuthContext';

export default function NoMembershipScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { initializationError } = useAuth();
  const {
    sessionStatus,
    sessionError,
    retryChurchSession,
  } = useChurchSession();
  const { signOut } = useChurch();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'ready') {
      router.replace('/(tabs)/(home)');
    }
  }, [router, sessionStatus]);

  const isError = sessionStatus === 'error' || Boolean(initializationError);
  const message = isError
    ? sessionError || initializationError || 'We could not load your church access.'
    : 'This account is not connected to a church yet. Ask a church administrator to add you, then try again.';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryChurchSession();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: `${colors.primary}18` }]}
          accessibilityElementsHidden
        >
          <IconSymbol
            ios_icon_name={isError ? 'exclamationmark.arrow.triangle.2.circlepath' : 'building.2'}
            android_material_icon_name={isError ? 'sync-problem' : 'domain-disabled'}
            size={34}
            color={colors.primary}
          />
        </View>

        <Text selectable style={[styles.title, { color: colors.text }]}>
          {isError ? 'Church access could not load' : 'No church access yet'}
        </Text>
        <Text selectable style={[styles.message, { color: colors.text }]}>
          {message}
        </Text>

        {retrying ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}

        <View style={styles.actions}>
          {!isError ? (
            <>
              <Button
                onPress={() => router.push({
                  pathname: '/onboarding',
                  params: { mode: 'join' },
                })}
                disabled={retrying || signingOut}
                style={styles.button}
              >
                Join a Church
              </Button>
              <Button
                onPress={() => router.push({
                  pathname: '/onboarding',
                  params: { mode: 'create' },
                })}
                variant="outline"
                disabled={retrying || signingOut}
                style={styles.button}
              >
                Create a Church
              </Button>
            </>
          ) : null}
          <Button
            onPress={handleRetry}
            loading={retrying}
            disabled={signingOut}
            variant={isError ? 'filled' : 'ghost'}
            style={styles.button}
          >
            Try Again
          </Button>
          <Button
            onPress={handleSignOut}
            variant="outline"
            loading={signingOut}
            disabled={retrying}
            style={styles.button}
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  iconContainer: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  title: {
    maxWidth: 440,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    maxWidth: 480,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.72,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: 10,
    paddingTop: 8,
  },
  button: {
    width: '100%',
    borderRadius: 8,
  },
});
