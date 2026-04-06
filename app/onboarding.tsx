
import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
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

  const [step, setStep] = useState<'welcome' | 'church' | 'admin' | 'adminLogin' | 'member' | 'memberSignup'>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety timeout: if loading stays true for 8s (e.g. navigation fails), reset it
  useEffect(() => {
    if (loading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        Alert.alert('Something went wrong', 'Please try again.');
      }, 8000);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [loading]);

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

  // Member signup data
  const [memberSignupEmail, setMemberSignupEmail] = useState('');
  const [memberSignupPassword, setMemberSignupPassword] = useState('');
  const [memberSignupName, setMemberSignupName] = useState('');
  const [memberInvitationCode, setMemberInvitationCode] = useState('');

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
      const session = signUpResult.data.session;
      
      if (!user) {
        setError('Failed to create user account');
        setLoading(false);
        return;
      }

      console.log('Admin user created:', user.id);
      console.log('Session created:', session ? 'Yes' : 'No');

      // Step 2: Generate unique invitation code
      const invitationCode = generateInvitationCode();
      console.log('Generated invitation code:', invitationCode);

      // Step 3: Create the church with invitation code
      console.log('Creating church:', churchName);
      const churchResult = await supabase
        .from('churches')
        .insert({
          name: churchName.trim(),
          admin_id: user.id,
          invitation_code: invitationCode,
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

      // Step 4: Add admin as a member of the church with is_admin flag and member_id
      console.log('Adding admin as church member with email:', adminEmail.trim(), 'and member_id:', user.id);
      const memberResult = await supabase
        .from('church_members')
        .insert({
          church_id: churchResult.data.id,
          member_id: user.id,
          email: adminEmail.trim(),
          name: adminName.trim() || adminEmail.trim(),
          role: 'Admin',
          is_admin: true,
        })
        .select()
        .single();

      if (memberResult.error) {
        console.error('Error adding admin as member:', memberResult.error);
        setError('Church created but failed to add you as a member. Please contact support.');
        setLoading(false);
        return;
      }

      console.log('Admin added as member successfully:', memberResult.data);
      console.log('Church and admin account created successfully — auth state change will handle navigation');
      
      // Do NOT call router.replace here — the onAuthStateChange listener in _layout.tsx
      // will set isCheckingAuth=true, verify churches, then set needsOnboarding=false,
      // which triggers useProtectedRoute to navigate to /(tabs) safely.
      // Keep loading=true so the spinner stays visible until navigation fires.
      // (The 8s safety timeout in this component will reset loading if navigation stalls.)
    } catch (err) {
      console.error('Error in onboarding:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const generateInvitationCode = (): string => {
    // Generate an 8-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking characters
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleAdminLogin = async () => {
    console.log('Admin logging in with email:', adminLoginEmail);

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

      console.log('Admin logged in successfully! User ID:', signInResult.data.user?.id);
      console.log('Auth state change will handle navigation to app.');
      
      // Do NOT call router.replace here — the onAuthStateChange listener in _layout.tsx
      // will set isCheckingAuth=true, verify churches, then set needsOnboarding=false,
      // which triggers useProtectedRoute to navigate to /(tabs) safely.
      
      // Keep loading state true — navigation guard will redirect
    } catch (err) {
      console.error('Error in admin login:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
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

      console.log('Member logged in successfully! Auth state change will handle navigation.');
      
      // Do NOT call router.replace here — the onAuthStateChange listener in _layout.tsx
      // will set isCheckingAuth=true, verify churches, then set needsOnboarding=false,
      // which triggers useProtectedRoute to navigate to /(tabs) safely.
      
      // Keep loading state true — navigation guard will redirect
    } catch (err) {
      console.error('Error in member login:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleMemberSignup = async () => {
    console.log('User creating member account with invitation code');

    if (!memberSignupEmail.trim() || !memberSignupPassword.trim()) {
      setError('Please enter email and password');
      return;
    }

    if (!memberSignupName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!memberInvitationCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }

    if (memberSignupPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Validate invitation code and find church (this now works for unauthenticated users)
      console.log('Validating invitation code:', memberInvitationCode.trim().toUpperCase());
      const churchQuery = supabase
        .from('churches')
        .select('id, name')
        .eq('invitation_code', memberInvitationCode.trim().toUpperCase())
        .single();

      console.log('Executing church query...');
      const { data: churchData, error: churchError } = await churchQuery;

      if (churchError) {
        console.error('Church query error:', churchError);
        setError('Invalid invitation code. Please check with your church admin.');
        setLoading(false);
        return;
      }

      if (!churchData) {
        console.error('No church found with invitation code');
        setError('Invalid invitation code. Please check with your church admin.');
        setLoading(false);
        return;
      }

      console.log('Valid invitation code! Church found:', churchData.name, 'ID:', churchData.id);

      // Step 2: Sign up the member user
      console.log('Signing up member user:', memberSignupEmail);
      const signUpResult = await supabase.auth.signUp({
        email: memberSignupEmail.trim(),
        password: memberSignupPassword,
        options: {
          data: {
            name: memberSignupName.trim(),
          },
        },
      });

      if (signUpResult.error) {
        console.error('Error signing up member:', signUpResult.error);
        setError(signUpResult.error.message);
        setLoading(false);
        return;
      }

      const user = signUpResult.data.user;
      const session = signUpResult.data.session;
      
      if (!user) {
        console.error('No user returned from signup');
        setError('Failed to create user account');
        setLoading(false);
        return;
      }

      console.log('Member user created successfully! User ID:', user.id);
      console.log('Session created:', session ? 'Yes' : 'No');

      // Step 3: Add member to church with member_id linking to auth.users
      console.log('Adding member to church:', churchData.id, 'with member_id:', user.id);
      const memberInsert = supabase
        .from('church_members')
        .insert({
          church_id: churchData.id,
          member_id: user.id,
          email: memberSignupEmail.trim(),
          name: memberSignupName.trim(),
          is_admin: false,
        })
        .select()
        .single();

      console.log('Executing member insert...');
      const { data: memberData, error: memberError } = await memberInsert;

      if (memberError) {
        console.error('Error adding member to church:', memberError);
        setError('Account created but failed to join church. Please contact your admin.');
        setLoading(false);
        return;
      }

      console.log('Member successfully joined church:', churchData.name);
      console.log('Member data:', memberData);
      console.log('Member account created successfully — auth state change will handle navigation');

      // Do NOT call router.replace here — the onAuthStateChange listener in _layout.tsx
      // will set isCheckingAuth=true, verify churches, then set needsOnboarding=false,
      // which triggers useProtectedRoute to navigate to /(tabs) safely.
      // Keep loading=true so the spinner stays visible until navigation fires.
    } catch (err) {
      console.error('Unexpected error in member signup:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const welcomeTitle = 'Welcome to Music Ministry';
  const welcomeSubtitle = 'Streamline your worship team scheduling with smart assignments, role management, and automated reminders for every service';
  const createChurchButton = 'Create Church & Admin Account';
  const loginAsAdminButton = 'Login as Admin';
  const loginAsMemberButton = 'Login as Member';
  const createMemberAccountButton = 'Create Member Account';
  const churchStepTitle = 'Create Your Church';
  const churchStepSubtitle = 'Enter the name of your church';
  const adminStepTitle = 'Create Admin Account';
  const adminStepSubtitle = 'Set up your administrator account';
  const adminLoginTitle = 'Admin Login';
  const adminLoginSubtitle = 'Sign in with your admin credentials';
  const memberStepTitle = 'Member Login';
  const memberStepSubtitle = 'Sign in with your member credentials';
  const memberSignupTitle = 'Create Member Account';
  const memberSignupSubtitle = 'Register with your church invitation code';
  const backButton = 'Back';
  const continueButton = 'Continue';
  const createButton = 'Create & Start';
  const loginButton = 'Login';
  const signupButton = 'Create Account';

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
                    console.log('User selected: Create Member Account');
                    setStep('memberSignup');
                  }}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                    {createMemberAccountButton}
                  </Text>
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

          {/* Member Signup Step - UPDATED WITH INVITATION CODE */}
          {step === 'memberSignup' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                {memberSignupTitle}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {memberSignupSubtitle}
              </Text>

              <View style={styles.formContainer}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Your Name"
                  placeholderTextColor={colors.textSecondary}
                  value={memberSignupName}
                  onChangeText={setMemberSignupName}
                  autoCapitalize="words"
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={memberSignupEmail}
                  onChangeText={setMemberSignupEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={colors.textSecondary}
                  value={memberSignupPassword}
                  onChangeText={setMemberSignupPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  style={[styles.input, styles.invitationCodeInput, { color: colors.text, borderColor: colors.primary }]}
                  placeholder="Church Invitation Code"
                  placeholderTextColor={colors.textSecondary}
                  value={memberInvitationCode}
                  onChangeText={(text) => setMemberInvitationCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Enter the 8-character code provided by your church admin
                </Text>

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
                    onPress={handleMemberSignup}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.continueButtonText}>{signupButton}</Text>
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
    lineHeight: 24,
    paddingHorizontal: 8,
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
  invitationCodeInput: {
    borderWidth: 2,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
    fontSize: 18,
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
    fontStyle: 'italic',
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
