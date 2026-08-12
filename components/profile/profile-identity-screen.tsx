import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useChurch } from '@/hooks/useChurch';
import {
  MAX_CHURCH_DISPLAY_NAME_LENGTH,
  validateChurchDisplayName,
} from '@/lib/profile/identity';
import { getMembershipAccessLabel } from '@/lib/profile/overview';
import {
  createLegacyThemeColors,
  type LegacyThemeColors,
} from '@/lib/ui/legacy-theme-colors';

type StatusTone = 'success' | 'error' | 'info';

export function ProfileIdentityScreen() {
  const theme = useAppTheme();
  const colors = useMemo(() => createLegacyThemeColors(theme), [theme]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentChurch,
    currentMember,
    isAdmin,
    sessionStatus,
    user,
    updateOwnChurchProfile,
  } = useChurch();
  const identityKey = currentChurch && currentMember
    ? `${currentChurch.id}:${currentMember.id}`
    : null;
  const initializedIdentityRef = useRef<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');

  useEffect(() => {
    if (!identityKey || initializedIdentityRef.current === identityKey) return;

    const initialName = currentMember?.name?.trim() ?? '';
    initializedIdentityRef.current = identityKey;
    setDraftName(initialName);
    setSavedName(initialName);
    setSaving(false);
    setStatus(null);
  }, [currentMember?.name, identityKey]);

  const accessLabel = getMembershipAccessLabel({
    isOwner: currentChurch?.admin_id === user?.id,
    isAdmin,
  });
  const roleNames = useMemo(
    () => currentMember?.memberRoles
      .map(role => role.role_name)
      .filter(Boolean) ?? [],
    [currentMember?.memberRoles],
  );
  const validation = validateChurchDisplayName(draftName);
  const hasChanges = !validation.error && validation.normalizedName !== savedName;
  const email = user?.email ?? currentMember?.email ?? '';

  const handleSave = async () => {
    if (!currentChurch || !currentMember || saving) return;

    if (validation.error) {
      setStatus(validation.error);
      setStatusTone('error');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    setStatus(null);

    try {
      const updatedMember = await updateOwnChurchProfile(
        currentChurch.id,
        validation.normalizedName,
      );
      const confirmedName = updatedMember.name ?? validation.normalizedName;
      setDraftName(confirmedName);
      setSavedName(confirmedName);
      setStatus('Your name was updated for this church.');
      setStatusTone('success');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Unable to update your church profile.',
      );
      setStatusTone('error');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !currentChurch || !currentMember) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        {sessionStatus === 'ready' ? (
          <>
            <IconSymbol
              ios_icon_name="person.crop.circle.badge.exclamationmark"
              android_material_icon_name="person-off"
              size={40}
              color={colors.primary}
            />
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Church profile unavailable
            </Text>
            <Text style={styles.stateCopy}>
              Return to Profile and select a church membership.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.stateButton}
            >
              <Text style={styles.stateButtonText}>Back to Profile</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateCopy}>Loading church profile...</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={saving}
        onBack={() => router.back()}
        subtitle={currentChurch.name}
        title="Church Profile"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 104 },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          <ProfileStatus message={status} tone={statusTone} />

          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={30}
                color={colors.headerText}
              />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.identityName}>
                {savedName || currentMember.email}
              </Text>
              <Text style={styles.identityChurch}>{currentChurch.name}</Text>
            </View>
            <View style={styles.accessBadge}>
              <Text style={styles.accessBadgeText}>{accessLabel}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Church Identity
            </Text>
            <Text style={styles.sectionDescription}>
              This name is visible only in the selected church. Other church memberships keep their own names.
            </Text>
            <Text style={styles.fieldLabel}>Display name</Text>
            <View
              style={[
                styles.inputFrame,
                validation.error && draftName.length > 0
                  ? styles.inputFrameError
                  : null,
              ]}
            >
              <IconSymbol
                ios_icon_name="person.text.rectangle"
                android_material_icon_name="badge"
                size={21}
                color={colors.primary}
              />
              <TextInput
                accessibilityLabel="Church display name"
                accessibilityHint="Changes the name shown to members of this church only."
                autoCapitalize="words"
                autoComplete="name"
                editable={!saving}
                maxLength={MAX_CHURCH_DISPLAY_NAME_LENGTH}
                onChangeText={value => {
                  setDraftName(value);
                  if (statusTone === 'error') setStatus(null);
                }}
                onSubmitEditing={Keyboard.dismiss}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                style={styles.input}
                textContentType="name"
                value={draftName}
              />
              <Text style={styles.characterCount}>
                {draftName.length}/{MAX_CHURCH_DISPLAY_NAME_LENGTH}
              </Text>
            </View>
            {validation.error && draftName.length > 0 ? (
              <Text accessibilityRole="alert" style={styles.validationText}>
                {validation.error}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Membership
            </Text>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <IconSymbol
                  ios_icon_name="building.2.fill"
                  android_material_icon_name="business"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Selected church</Text>
                <Text style={styles.detailValue}>{currentChurch.name}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <IconSymbol
                  ios_icon_name="person.badge.key.fill"
                  android_material_icon_name="verified-user"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Access</Text>
                <Text style={styles.detailValue}>{accessLabel}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <IconSymbol
                  ios_icon_name="envelope.fill"
                  android_material_icon_name="email"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailLabel}>Account email</Text>
                <Text selectable style={styles.detailValue}>{email}</Text>
                <Text style={styles.readOnlyLabel}>Shared by all church memberships</Text>
              </View>
              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyBadgeText}>Read only</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Ministry Roles
            </Text>
            {roleNames.length > 0 ? (
              <View style={styles.roleList}>
                {roleNames.map(roleName => (
                  <View key={roleName} style={styles.roleChip}>
                    <IconSymbol
                      ios_icon_name="music.note"
                      android_material_icon_name="music-note"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.roleChipText}>{roleName}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRoles}>
                <IconSymbol
                  ios_icon_name="music.note.list"
                  android_material_icon_name="queue-music"
                  size={22}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyRolesText}>
                  No ministry roles are assigned in this church.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save church profile"
            accessibilityHint="Saves your display name for the selected church."
            accessibilityState={{
              busy: saving,
              disabled: saving || !hasChanges,
            }}
            disabled={saving || !hasChanges}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.saveButton,
              (saving || !hasChanges) && styles.saveButtonDisabled,
              pressed && hasChanges && !saving && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.headerText} />
            ) : (
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="save"
                size={20}
                color={colors.headerText}
              />
            )}
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Church Profile'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: LegacyThemeColors) {
  return StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.headerBackground,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerButtonSpacer: {
    height: 44,
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: colors.headerText,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  headerSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 1,
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  identityCard: {
    alignItems: 'center',
    backgroundColor: colors.navyDark,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  identityName: {
    color: colors.headerText,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  identityChurch: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  accessBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  accessBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 7,
    marginTop: 16,
  },
  inputFrame: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 12,
  },
  inputFrameError: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  characterCount: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  validationText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  detailRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 62,
    paddingVertical: 12,
  },
  detailIcon: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 9,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  readOnlyLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  readOnlyBadge: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginLeft: 8,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  readOnlyBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  roleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  roleChip: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  roleChipText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyRoles: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  emptyRolesText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    maxWidth: 720,
    minHeight: 50,
    paddingHorizontal: 18,
    width: '100%',
  },
  saveButtonDisabled: {
    backgroundColor: colors.textTertiary,
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  stateCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 4,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stateButtonText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
  });
}
