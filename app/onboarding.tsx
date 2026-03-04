
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase/client';

export default function OnboardingScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<'welcome' | 'church' | 'admin' | 'adminLogin' | 'member'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Church data
  const [churchName, setChurchName] = useState('');

  // Admin account data
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');

  // Admin login data
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');

  // Member login data
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');

  const handleCreateChurchAndAdmin = async () => {
    console.log('User creating church and admin account');
    
    if (!churchName.trim()) {
      setError('Please enter a church name');
      return;
    }

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError('Please enter email and password');
      return;
    }

    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Sign up the admin user
      console.log('Signing up admin user:', adminEmail);
      const signUpResult = await supabase.auth.signUp({
        email: adminEmail.trim(),
        password: adminPassword,
        options: {
          data: {
            name: adminName.trim() || undefined,
          },
        },
      });

      if (signUpResult.error) {
        console.error('Error signing up:', signUpResult.error);
        setError(signUpResult.error.message);
        setLoading(false);
        return;
      }

      const user = signUpResult.data.user;
      if (!user) {
        setError('Failed to create user account');
        setLoading(false);
        return;
      }

      console.log('Admin user created:', user.id);

      // Step 2: Create the church
      console.log('Creating church:', churchName);
      const churchResult = await supabase
        .from('churches')
        .insert({
          name: churchName.trim(),
          admin_id: user.id,
        })
        .select()
        .single();

      if (churchResult.error) {
        console.error('Error creating church:', churchResult.error);
        setError(churchResult.error.message);
        setLoading(false);
        return;
      }

      console.log('Church created successfully:', churchResult.data);

      // Success! Redirect to main app
      console.log('Onboarding complete, redirecting to app');
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Error in onboarding:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    console.log('Admin logging in');

    if (!adminLoginEmail.trim() || !adminLoginPassword.trim()) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: adminLoginEmail.trim(),
        password: adminLoginPassword,
      });

      if (signInResult.error) {
        console.error('Error signing in as admin:', signInResult.error);
        setError(signInResult.error.message);
        setLoading(false);
        return;
      }

      console.log('Admin logged in successfully');
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Error in admin login:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberLogin = async () => {
    console.log('User logging in as member');

    if (!memberEmail.trim() || !memberPassword.trim()) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signInResult = await supabase.auth.signInWithPassword({
        email: memberEmail.trim(),
        password: memberPassword,
      });

      if (signInResult.error) {
        console.error('Error signing in:', signInResult.error);
        setError(signInResult.error.message);
        setLoading(false);
        return;
      }

      console.log('Member logged in successfully');
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Error in member login:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const welcomeTitle = 'Welcome to Church Scheduler';
  const welcomeSubtitle = 'Organize your church services and team assignments';
  const createChurchButton = 'Create Church & Admin Account';
  const loginAsAdminButton = 'Login as Admin';
  const loginAsMemberButton = 'Login as Member';
  const churchStepTitle = 'Create Your Church';
  const churchStepSubtitle = 'Enter the name of your church';
  const adminStepTitle = 'Create Admin Account';
  const adminStepSubtitle = 'Set up your administrator account';
  const adminLoginTitle = 'Admin Login';
  const adminLoginSubtitle = 'Sign in with your admin credentials';
  const memberStepTitle = 'Member Login';
  const memberStepSubtitle = 'Sign in with your member credentials';
  const backButton = 'Back';
  const continueButton = 'Continue';
  const createButton = 'Create & Start';
  const loginButton = 'Login';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome Step */}
          {step === 'welcome' && (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="building.2"
                  android_material_icon_name="home"
                  size={80}
                  color={colors.primary}
                />
              </View>

              <Text style={[styles.title, { color: colors.text }]}>
                {welcomeTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {welcomeSubtitle}
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    console.log('User selected: Create Church');
                    setStep('church');
                  }}
                >
                  <Text style={styles.primaryButtonText}>{createChurchButton}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.primary }]}
                  onPress={() => {
                    console.log('User selected: Login as Admin');
                    setStep('adminLogin');
                  }}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    {loginAsAdminButton}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.primary }]}
                  onPress={() => {
                    console.log('User selected: Login as Member');
                    setStep('member');
                  }}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    {loginAsMemberButton}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Church Creation Step */}
          {step === 'church' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {churchStepTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {churchStepSubtitle}
              </Text>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Church Name"
                  placeholderTextColor={colors.textSecondary}
                  value={churchName}
                  onChangeText={setChurchName}
                  autoCapitalize="words"
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[styles.backButton, { borderColor: colors.border }]}
                    onPress={() => {
                      console.log('User tapped Back');
                      setStep('welcome');
                      setError(null);
                    }}
                  >
                    <Text style={[styles.backButtonText, { color: colors.text }]}>
                      {backButton}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Continue from church step');
                      if (!churchName.trim()) {
                        setError('Please enter a church name');
                        return;
                      }
                      setError(null);
                      setStep('admin');
                    }}
                  >
                    <Text style={styles.continueButtonText}>{continueButton}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Admin Account Creation Step */}
          {step === 'admin' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {adminStepTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {adminStepSubtitle}
              </Text>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Your Name (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={adminName}
                  onChangeText={setAdminName}
                  autoCapitalize="words"
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={colors.textSecondary}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[styles.backButton, { borderColor: colors.border }]}
                    onPress={() => {
                      console.log('User tapped Back');
                      setStep('church');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.backButtonText, { color: colors.text }]}>
                      {backButton}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateChurchAndAdmin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.continueButtonText}>{createButton}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Admin Login Step */}
          {step === 'adminLogin' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {adminLoginTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {adminLoginSubtitle}
              </Text>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={adminLoginEmail}
                  onChangeText={setAdminLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={adminLoginPassword}
                  onChangeText={setAdminLoginPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[styles.backButton, { borderColor: colors.border }]}
                    onPress={() => {
                      console.log('User tapped Back');
                      setStep('welcome');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.backButtonText, { color: colors.text }]}>
                      {backButton}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: colors.primary }]}
                    onPress={handleAdminLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.continueButtonText}>{loginButton}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Member Login Step */}
          {step === 'member' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {memberStepTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {memberStepSubtitle}
              </Text>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={memberEmail}
                  onChangeText={setMemberEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={memberPassword}
                  onChangeText={setMemberPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[styles.backButton, { borderColor: colors.border }]}
                    onPress={() => {
                      console.log('User tapped Back');
                      setStep('welcome');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.backButtonText, { color: colors.text }]}>
                      {backButton}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: colors.primary }]}
                    onPress={handleMemberLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.continueButtonText}>{loginButton}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    padding: 24,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
});
