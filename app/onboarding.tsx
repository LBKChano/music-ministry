import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import { LabeledTextInput } from '@/components/auth/LabeledTextInput';
import { useAuth } from '@/contexts/AuthContext';
import { useChurch } from '@/hooks/useChurch';
import {
  clearPendingOnboardingIntent,
  loadPendingOnboardingIntent,
  savePendingOnboardingIntent,
} from '@/lib/auth/onboarding-intent-storage';
import { completeOnboardingIntent } from '@/lib/auth/onboarding-service';
import { saveLastSelectedChurchId } from '@/lib/church/session-storage';
import {
  classifySignUpOutcome,
  createChurchIntent,
  createJoinIntent,
  createOnboardingRequestId,
  normalizeAccountEmail,
  type PendingOnboardingIntent,
} from '@/lib/auth/onboarding-workflow';
import { supabase } from '@/lib/supabase/client';
import { PASSWORD_RESET_REDIRECT_URL } from '@/utils/passwordResetLinks';
import { SIGNUP_VERIFICATION_REDIRECT_URL } from '@/utils/signupVerificationLinks';

type OnboardingStep = 'welcome' | 'signIn' | 'join' | 'create' | 'forgotPassword';
type FieldErrors = Partial<Record<
  'churchName' | 'name' | 'email' | 'password' | 'invitationCode' | 'resetEmail',
  string
>>;

const SCHEDULES_ROUTE = '/(tabs)/(home)';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveRequestedStep(mode?: string): OnboardingStep {
  switch (mode) {
    case 'signIn':
    case 'adminLogin':
    case 'member':
      return 'signIn';
    case 'join':
    case 'memberSignup':
      return 'join';
    case 'create':
    case 'church':
    case 'admin':
      return 'create';
    default:
      return 'welcome';
  }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors: themeColors, dark } = useTheme();
  const { session } = useAuth();
  const { refreshChurches } = useChurch();
  const routeParams = useLocalSearchParams<{
    passwordReset?: 'complete' | 'request';
    mode?: string;
    email?: string;
  }>();

  const screenColors = {
    text: themeColors.text,
    textSecondary: dark ? '#A7B0BE' : '#64748B',
    border: themeColors.border,
    primary: themeColors.primary,
    background: themeColors.background,
    surface: themeColors.card,
  };

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [churchName, setChurchName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const passwordInputRef = useRef<TextInput>(null);
  const invitationCodeInputRef = useRef<TextInput>(null);
  const submissionInFlightRef = useRef(false);
  const createRequestRef = useRef<{ key: string; requestId: string } | null>(null);

  const signedInEmail = normalizeAccountEmail(session?.user.email ?? '');
  const signedInName = typeof session?.user.user_metadata?.name === 'string'
    ? session.user.user_metadata.name.trim()
    : '';

  useEffect(() => {
    if (routeParams.passwordReset === 'request') {
      setStep('forgotPassword');
      setResetEmail(
        typeof routeParams.email === 'string' ? routeParams.email : '',
      );
      setMessage(null);
      setError(null);
      return;
    }

    setStep(resolveRequestedStep(routeParams.mode));
    if (typeof routeParams.email === 'string') {
      setEmail(routeParams.email);
    }
    if (routeParams.passwordReset === 'complete') {
      setMessage('Password updated. Sign in with your new password.');
      setStep('signIn');
    }
  }, [
    routeParams.email,
    routeParams.mode,
    routeParams.passwordReset,
  ]);

  useEffect(() => {
    if (!session) return;
    if (!email) setEmail(signedInEmail);
    if (!name && signedInName) setName(signedInName);
  }, [email, name, session, signedInEmail, signedInName]);

  const resetFeedback = useCallback(() => {
    setFieldErrors({});
    setError(null);
    setMessage(null);
  }, []);

  const openStep = useCallback((nextStep: OnboardingStep) => {
    resetFeedback();
    setPassword('');
    setStep(nextStep);
  }, [resetFeedback]);

  const runSubmission = useCallback(async (work: () => Promise<void>) => {
    if (submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await work();
    } catch (submissionError) {
      console.error('[Onboarding] Submission failed:', submissionError);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      submissionInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const routeAfterChurchRefresh = useCallback(async (
    preferredChurchId?: string,
  ) => {
    const transition = await refreshChurches(preferredChurchId);
    if (transition.status === 'ready') {
      router.replace(SCHEDULES_ROUTE);
      return true;
    }
    if (transition.status === 'no-membership') {
      router.replace('/no-membership');
      return false;
    }
    if (transition.status === 'error') {
      setError(transition.error);
    }
    return false;
  }, [refreshChurches, router]);

  const routeAfterCompletedIntent = useCallback(async (completion: {
    accountId: string;
    churchId: string;
  }) => {
    await saveLastSelectedChurchId(
      completion.accountId,
      completion.churchId,
    );

    if (session?.user.id === completion.accountId) {
      await routeAfterChurchRefresh(completion.churchId);
      return;
    }

    router.replace('/');
  }, [routeAfterChurchRefresh, router, session?.user.id]);

  const completeIntent = useCallback(async (
    intent: PendingOnboardingIntent,
  ) => {
    const completion = await completeOnboardingIntent(intent, session);

    if (completion.status === 'ready') {
      await clearPendingOnboardingIntent();
      await routeAfterCompletedIntent(completion);
      return;
    }

    if (completion.status === 'authentication-required') {
      setEmail(intent.email);
      setPassword('');
      setStep('signIn');
      setMessage('Sign in to finish this church setup.');
      return;
    }

    if (completion.status === 'account-mismatch') {
      setError(
        `This setup belongs to ${completion.expectedEmail}. Sign in with that account to continue.`,
      );
      return;
    }

    setError(completion.message);
    if (intent.kind === 'join') {
      setInvitationCode(intent.invitationCode);
      setStep('join');
    }
  }, [routeAfterCompletedIntent, session]);

  const submitIntent = useCallback(async (
    intent: PendingOnboardingIntent,
  ) => {
    await savePendingOnboardingIntent(intent);

    if (session) {
      await completeIntent(intent);
      return;
    }

    const signUpResult = await supabase.auth.signUp({
      email: intent.email,
      password,
      options: {
        data: { name: intent.name },
        emailRedirectTo: SIGNUP_VERIFICATION_REDIRECT_URL,
      },
    });

    const outcome = classifySignUpOutcome({
      error: signUpResult.error,
      user: signUpResult.data.user,
      hasSession: Boolean(signUpResult.data.session),
    });

    if (outcome.status === 'error') {
      setError(outcome.message);
      return;
    }

    if (outcome.status === 'existing-account') {
      setEmail(intent.email);
      setPassword('');
      setStep('signIn');
      setMessage(
        'An account already uses this email. Sign in and the church action will continue automatically.',
      );
      return;
    }

    if (outcome.status === 'verification-required') {
      setPassword('');
      router.replace({
        pathname: '/verify-email',
        params: { email: intent.email },
      });
      return;
    }

    await completeIntent(intent);
  }, [completeIntent, password, router, session]);

  const validateAccountFields = useCallback(() => {
    const nextErrors: FieldErrors = {};
    const activeEmail = session ? signedInEmail : normalizeAccountEmail(email);

    if (!name.trim()) nextErrors.name = 'Enter your name.';
    if (!session && !activeEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!session && !EMAIL_PATTERN.test(activeEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!session && !password) {
      nextErrors.password = 'Enter a password.';
    } else if (!session && password.length < 6) {
      nextErrors.password = 'Use at least 6 characters.';
    }

    setFieldErrors(nextErrors);
    return {
      valid: Object.keys(nextErrors).length === 0,
      accountEmail: activeEmail,
    };
  }, [email, name, password, session, signedInEmail]);

  const handleCreateChurch = useCallback(() => {
    const accountValidation = validateAccountFields();
    const nextErrors: FieldErrors = {};
    if (!churchName.trim()) nextErrors.churchName = 'Enter the church name.';

    if (!accountValidation.valid || Object.keys(nextErrors).length > 0) {
      setFieldErrors(previous => ({ ...previous, ...nextErrors }));
      return;
    }

    void runSubmission(async () => {
      const requestKey = [
        accountValidation.accountEmail,
        name.trim(),
        churchName.trim(),
      ].join('|');
      if (createRequestRef.current?.key !== requestKey) {
        createRequestRef.current = {
          key: requestKey,
          requestId: createOnboardingRequestId(),
        };
      }

      const intent = createChurchIntent({
        email: accountValidation.accountEmail,
        name,
        churchName,
        requestId: createRequestRef.current.requestId,
      });
      await submitIntent(intent);
    });
  }, [
    churchName,
    name,
    runSubmission,
    submitIntent,
    validateAccountFields,
  ]);

  const handleJoinChurch = useCallback(() => {
    const accountValidation = validateAccountFields();
    const nextErrors: FieldErrors = {};
    if (!invitationCode.trim()) {
      nextErrors.invitationCode = 'Enter the invitation code.';
    }

    if (!accountValidation.valid || Object.keys(nextErrors).length > 0) {
      setFieldErrors(previous => ({ ...previous, ...nextErrors }));
      return;
    }

    void runSubmission(async () => {
      const intent = createJoinIntent({
        email: accountValidation.accountEmail,
        name,
        invitationCode,
      });
      await submitIntent(intent);
    });
  }, [
    invitationCode,
    name,
    runSubmission,
    submitIntent,
    validateAccountFields,
  ]);

  const handleSignIn = useCallback(() => {
    const normalizedEmail = normalizeAccountEmail(email);
    const nextErrors: FieldErrors = {};
    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) nextErrors.password = 'Enter your password.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void runSubmission(async () => {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError || !data.session) {
        setError(signInError?.message ?? 'Could not sign in.');
        return;
      }

      setPassword('');
      const pendingIntent = await loadPendingOnboardingIntent();
      if (pendingIntent?.email === normalizedEmail) {
        const completion = await completeOnboardingIntent(
          pendingIntent,
          data.session,
        );
        if (completion.status === 'ready') {
          await clearPendingOnboardingIntent();
          await saveLastSelectedChurchId(
            completion.accountId,
            completion.churchId,
          );
          router.replace('/');
          return;
        }
        if (completion.status === 'error') {
          setError(completion.message);
          setName(pendingIntent.name);
          if (pendingIntent.kind === 'join') {
            setInvitationCode(pendingIntent.invitationCode);
            setStep('join');
          } else {
            setChurchName(pendingIntent.churchName);
            setStep('create');
          }
          return;
        }
      } else if (pendingIntent) {
        await clearPendingOnboardingIntent();
      }

      router.replace('/');
    });
  }, [email, password, router, runSubmission]);

  const handleSendPasswordReset = useCallback(() => {
    const normalizedEmail = normalizeAccountEmail(resetEmail);
    const nextErrors: FieldErrors = {};
    if (!normalizedEmail) {
      nextErrors.resetEmail = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.resetEmail = 'Enter a valid email address.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void runSubmission(async () => {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: PASSWORD_RESET_REDIRECT_URL },
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setMessage(
        'Reset email sent. Open its link to choose a new password.',
      );
    });
  }, [resetEmail, runSubmission]);

  const renderAccountFields = () => (
    <>
      <LabeledTextInput
        label="Your name"
        colors={screenColors}
        error={fieldErrors.name}
        placeholder="Full name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setFieldErrors(previous => ({ ...previous, name: undefined }));
        }}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType={session ? 'done' : 'next'}
      />

      {session ? (
        <View
          style={[styles.signedInNotice, { borderColor: screenColors.border }]}
          accessibilityRole="text"
        >
          <IconSymbol
            ios_icon_name="person.crop.circle.badge.checkmark"
            android_material_icon_name="verified-user"
            size={22}
            color={screenColors.primary}
          />
          <View style={styles.signedInCopy}>
            <Text style={[styles.noticeLabel, { color: screenColors.textSecondary }]}>
              Signed in as
            </Text>
            <Text selectable style={[styles.noticeValue, { color: screenColors.text }]}>
              {signedInEmail}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <LabeledTextInput
            label="Email"
            colors={screenColors}
            error={fieldErrors.email}
            credentialType="new-username"
            placeholder="name@example.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors(previous => ({ ...previous, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <LabeledTextInput
            ref={passwordInputRef}
            label="Password"
            colors={screenColors}
            error={fieldErrors.password}
            credentialType="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors(previous => ({ ...previous, password: undefined }));
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            passwordRules="minlength: 6;"
            returnKeyType="next"
          />
        </>
      )}
    </>
  );

  const renderFeedback = () => (
    <>
      {message ? (
        <View
          style={styles.messageContainer}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}
      {error ? (
        <View
          style={styles.errorContainer}
          accessibilityLiveRegion="assertive"
        >
          <Text selectable style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  const renderBackButton = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      disabled={loading}
      onPress={() => openStep('welcome')}
      style={({ pressed }) => [
        styles.backButton,
        { borderColor: screenColors.border },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      <Text style={[styles.backButtonText, { color: screenColors.text }]}>
        Back
      </Text>
    </Pressable>
  );

  const renderSubmitButton = (
    label: string,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.submitButton,
        { backgroundColor: screenColors.primary },
        pressed && styles.pressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.submitButtonText}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {step === 'welcome' ? (
            <View style={styles.content}>
              <View
                style={[styles.brandIcon, { backgroundColor: screenColors.primary }]}
                accessibilityElementsHidden
              >
                <IconSymbol
                  ios_icon_name="music.note.house.fill"
                  android_material_icon_name="church"
                  size={42}
                  color="#FFFFFF"
                />
              </View>
              <Text style={[styles.title, { color: screenColors.text }]}>
                Music Ministry
              </Text>
              <Text style={[styles.subtitle, { color: screenColors.textSecondary }]}>
                Sign in to your account, join your church team, or create a church workspace.
              </Text>
              {renderFeedback()}

              <View style={styles.actionList}>
                {!session ? (
                  <WelcomeAction
                    title="Sign In"
                    subtitle="Use your existing Music Ministry account"
                    iconIos="person.crop.circle"
                    iconAndroid="login"
                    primary
                    colors={screenColors}
                    onPress={() => openStep('signIn')}
                  />
                ) : null}
                <WelcomeAction
                  title="Join a Church"
                  subtitle="Use an invitation code from your church admin"
                  iconIos="person.badge.plus"
                  iconAndroid="group-add"
                  primary={Boolean(session)}
                  colors={screenColors}
                  onPress={() => openStep('join')}
                />
                <WelcomeAction
                  title="Create a Church"
                  subtitle="Set up a new church and become its first admin"
                  iconIos="building.2.crop.circle"
                  iconAndroid="add-business"
                  colors={screenColors}
                  onPress={() => openStep('create')}
                />
              </View>
            </View>
          ) : null}

          {step === 'signIn' ? (
            <OnboardingFormHeader
              title="Sign In"
              subtitle="One account works for every church you belong to."
              colors={screenColors}
            >
              <LabeledTextInput
                label="Email"
                colors={screenColors}
                error={fieldErrors.email}
                credentialType="username"
                placeholder="name@example.com"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setFieldErrors(previous => ({ ...previous, email: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
              <LabeledTextInput
                ref={passwordInputRef}
                label="Password"
                colors={screenColors}
                error={fieldErrors.password}
                credentialType="current-password"
                placeholder="Your password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors(previous => ({ ...previous, password: undefined }));
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => {
                  setResetEmail(email);
                  openStep('forgotPassword');
                }}
                style={styles.forgotButton}
              >
                <Text style={[styles.linkText, { color: screenColors.primary }]}>
                  Forgot your password?
                </Text>
              </Pressable>
              {renderFeedback()}
              <View style={styles.navigationButtons}>
                {renderBackButton()}
                {renderSubmitButton('Sign In', handleSignIn)}
              </View>
            </OnboardingFormHeader>
          ) : null}

          {step === 'join' ? (
            <OnboardingFormHeader
              title="Join a Church"
              subtitle="Your invitation code connects this account to the right church."
              colors={screenColors}
            >
              {renderAccountFields()}
              <LabeledTextInput
                ref={invitationCodeInputRef}
                label="Invitation code"
                colors={screenColors}
                error={fieldErrors.invitationCode}
                placeholder="8-character code"
                value={invitationCode}
                onChangeText={(value) => {
                  setInvitationCode(value.toUpperCase());
                  setFieldErrors(previous => ({
                    ...previous,
                    invitationCode: undefined,
                  }));
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={handleJoinChurch}
                style={styles.codeInput}
              />
              {renderFeedback()}
              <View style={styles.navigationButtons}>
                {renderBackButton()}
                {renderSubmitButton('Join Church', handleJoinChurch)}
              </View>
            </OnboardingFormHeader>
          ) : null}

          {step === 'create' ? (
            <OnboardingFormHeader
              title="Create a Church"
              subtitle="Create the workspace first, then configure roles and weekly services."
              colors={screenColors}
            >
              <LabeledTextInput
                label="Church name"
                colors={screenColors}
                error={fieldErrors.churchName}
                placeholder="Church name"
                value={churchName}
                onChangeText={(value) => {
                  setChurchName(value);
                  setFieldErrors(previous => ({
                    ...previous,
                    churchName: undefined,
                  }));
                }}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {renderAccountFields()}
              {renderFeedback()}
              <View style={styles.navigationButtons}>
                {renderBackButton()}
                {renderSubmitButton('Create Church', handleCreateChurch)}
              </View>
            </OnboardingFormHeader>
          ) : null}

          {step === 'forgotPassword' ? (
            <OnboardingFormHeader
              title="Reset Password"
              subtitle="We will email you a secure link to choose a new password."
              colors={screenColors}
            >
              <LabeledTextInput
                label="Account email"
                colors={screenColors}
                error={fieldErrors.resetEmail}
                credentialType="email"
                placeholder="name@example.com"
                value={resetEmail}
                onChangeText={(value) => {
                  setResetEmail(value);
                  setFieldErrors(previous => ({
                    ...previous,
                    resetEmail: undefined,
                  }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendPasswordReset}
              />
              {renderFeedback()}
              <View style={styles.navigationButtons}>
                {renderBackButton()}
                {renderSubmitButton('Send Reset Email', handleSendPasswordReset)}
              </View>
            </OnboardingFormHeader>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WelcomeAction({
  title,
  subtitle,
  iconIos,
  iconAndroid,
  primary = false,
  colors,
  onPress,
}: {
  title: string;
  subtitle: string;
  iconIos: string;
  iconAndroid: React.ComponentProps<
    typeof IconSymbol
  >['android_material_icon_name'];
  primary?: boolean;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    surface: string;
  };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => [
        styles.welcomeAction,
        {
          backgroundColor: primary ? colors.primary : colors.surface,
          borderColor: primary ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <IconSymbol
        ios_icon_name={iconIos}
        android_material_icon_name={iconAndroid}
        size={25}
        color={primary ? '#FFFFFF' : colors.primary}
      />
      <View style={styles.welcomeActionCopy}>
        <Text
          style={[
            styles.welcomeActionTitle,
            { color: primary ? '#FFFFFF' : colors.text },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.welcomeActionSubtitle,
            {
              color: primary
                ? 'rgba(255,255,255,0.82)'
                : colors.textSecondary,
            },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <IconSymbol
        ios_icon_name="chevron.right"
        android_material_icon_name="chevron-right"
        size={20}
        color={primary ? '#FFFFFF' : colors.textSecondary}
      />
    </Pressable>
  );
}

function OnboardingFormHeader({
  title,
  subtitle,
  colors,
  children,
}: {
  title: string;
  subtitle: string;
  colors: { text: string; textSecondary: string };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[styles.formTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
      <View style={styles.form}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  brandIcon: {
    width: 72,
    height: 72,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 28,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  actionList: {
    gap: 12,
  },
  welcomeAction: {
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  welcomeActionCopy: {
    flex: 1,
    gap: 3,
  },
  welcomeActionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  welcomeActionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  formTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
  },
  formSubtitle: {
    marginTop: 8,
    marginBottom: 26,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  signedInNotice: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  signedInCopy: {
    flex: 1,
  },
  noticeLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  noticeValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
  },
  backButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 52,
    flex: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  forgotButton: {
    minHeight: 36,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    marginTop: -7,
  },
  linkText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#A51D1D',
    fontSize: 14,
    lineHeight: 20,
  },
  messageContainer: {
    backgroundColor: '#EAF7EF',
    borderRadius: 8,
    padding: 12,
  },
  messageText: {
    color: '#176B3A',
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
});
