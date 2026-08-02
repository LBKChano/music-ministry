import { usePreventRemove } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import { useAccountDeletionPreview } from '@/hooks/useAccountDeletionPreview';
import { colors } from '@/styles/commonStyles';

export function ProfileDeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, deleteAccount } = useChurch();
  const previewQuery = useAccountDeletionPreview({ accountId: user?.id });
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePreventRemove(deleting, () => {});

  const impact = previewQuery.data?.impact;
  const canDelete = Boolean(impact && confirmation.trim() === 'DELETE' && !deleting);

  const handleDelete = async () => {
    if (!canDelete) return;
    Keyboard.dismiss();
    setDeleting(true);
    setError(null);
    try {
      const refreshedPreview = await previewQuery.refetch();
      if (refreshedPreview.error || !refreshedPreview.data) {
        throw new Error(
          'The current deletion impact could not be confirmed. Please try again.',
        );
      }
      await deleteAccount();
      router.replace('/onboarding');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to finish deleting your account. Please try again.',
      );
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={deleting}
        onBack={() => router.back()}
        subtitle="Permanent account removal"
        title="Delete Account"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          <ProfileStatus message={error} tone="error" />

          <View style={styles.warningPanel}>
            <View style={styles.warningIcon}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={26}
                color={colors.error}
              />
            </View>
            <View style={styles.warningCopy}>
              <Text accessibilityRole="header" style={styles.warningTitle}>This cannot be undone</Text>
              <Text style={styles.warningText}>
                Your sign-in, church memberships, and account settings will be permanently removed. Every device signed in to this account will stop receiving its notifications.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Deletion Impact</Text>
            <Text style={styles.sectionDescription}>
              This preview is calculated from your current account before anything is deleted.
            </Text>

            {previewQuery.isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingText}>Checking your account...</Text>
              </View>
            ) : previewQuery.isError || !impact ? (
              <View style={styles.previewError}>
                <Text accessibilityRole="alert" style={styles.previewErrorText}>
                  The deletion impact could not be loaded. Account deletion remains disabled.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void previewQuery.refetch()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.impactList}>
                <ImpactRow label="Church memberships removed" value={impact.membershipsRemoved} />
                <ImpactRow label="Churches you own deleted" value={impact.ownedChurchesDeleted} />
                <ImpactRow label="Other church members affected" value={impact.otherChurchMembersRemoved} />
                <ImpactRow label="Scheduled services deleted" value={impact.ownedServicesDeleted} />
                <ImpactRow label="Weekly service templates deleted" value={impact.ownedWeeklyServicesDeleted} />
                <ImpactRow label="Assigned slots cleared" value={impact.assignmentsCleared} />
                {impact.ownedChurchNames.length > 0 ? (
                  <View style={styles.ownedChurches}>
                    <Text style={styles.ownedChurchLabel}>Owned churches that will be deleted</Text>
                    {impact.ownedChurchNames.map(name => (
                      <Text key={name} selectable style={styles.ownedChurchName}>- {name}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.confirmSection}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Confirm Permanent Deletion</Text>
            <Text style={styles.sectionDescription}>
              Type DELETE exactly to enable the final action.
            </Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm account deletion"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              onChangeText={setConfirmation}
              onSubmitEditing={() => void handleDelete()}
              placeholder="DELETE"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              style={styles.input}
              value={confirmation}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Permanently deletes this account and the data listed above."
              accessibilityState={{ busy: deleting, disabled: !canDelete }}
              disabled={!canDelete}
              onPress={() => void handleDelete()}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && canDelete && styles.pressed,
                !canDelete && styles.disabled,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.headerText} />
              ) : (
                <>
                  <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete-forever" size={20} color={colors.headerText} />
                  <Text style={styles.deleteButtonText}>Delete Account Permanently</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.impactRow}>
      <Text style={styles.impactLabel}>{label}</Text>
      <Text accessibilityLabel={`${value} ${label}`} style={styles.impactValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { alignSelf: 'center', gap: 18, maxWidth: 720, paddingHorizontal: 16, paddingTop: 16, width: '100%' },
  warningPanel: { alignItems: 'flex-start', backgroundColor: colors.errorBackground, borderColor: colors.errorBorder, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  warningIcon: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  warningCopy: { flex: 1, gap: 5, minWidth: 0 },
  warningTitle: { color: colors.error, fontSize: 18, fontWeight: '800', lineHeight: 23 },
  warningText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  section: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: 16 },
  confirmSection: { backgroundColor: colors.errorBackground, borderColor: colors.errorBorder, borderRadius: 8, borderWidth: 1, padding: 16 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  sectionDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 70, paddingVertical: 14 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  previewError: { alignItems: 'flex-start', gap: 12, paddingTop: 16 },
  previewErrorText: { color: colors.error, fontSize: 14, lineHeight: 20 },
  retryButton: { alignItems: 'center', backgroundColor: colors.backgroundAlt, borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 42, minWidth: 96, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  impactList: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  impactRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 13 },
  impactLabel: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 19 },
  impactValue: { color: colors.text, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '800' },
  ownedChurches: { backgroundColor: colors.errorBackground, gap: 4, padding: 13 },
  ownedChurchLabel: { color: colors.error, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  ownedChurchName: { color: colors.text, fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: colors.card, borderColor: colors.errorBorder, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 0, marginTop: 15, minHeight: 52, paddingHorizontal: 13, paddingVertical: 11 },
  deleteButton: { alignItems: 'center', backgroundColor: colors.error, borderRadius: 8, flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 14, minHeight: 50, paddingHorizontal: 16 },
  deleteButtonText: { color: colors.headerText, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.48 },
});
