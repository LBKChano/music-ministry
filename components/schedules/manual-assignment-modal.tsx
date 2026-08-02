import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { IconSymbol } from '@/components/IconSymbol';
import { InlineStatus } from '@/components/feedback/inline-status';
import { AppModal } from '@/components/ui/app-modal';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { queryKeys } from '@/lib/query/keys';
import {
  createManualAssignmentSections,
  getManualAssignmentCandidateReason,
  normalizeManualAssignmentError,
  type ManualAssignmentCandidate,
} from '@/lib/services/manual-assignment-model';
import { colors } from '@/styles/commonStyles';

export interface ManualAssignmentTarget {
  assignmentId: string;
  serviceId: string;
  roleName: string;
  assignedMemberName: string | null;
  hasAssignedMember: boolean;
}

export function ManualAssignmentModal({
  accountId,
  churchId,
  target,
  visible,
  loadCandidates,
  onAssign,
  onClear,
  onClose,
}: {
  accountId: string | null;
  churchId: string | null;
  target: ManualAssignmentTarget | null;
  visible: boolean;
  loadCandidates: (
    assignmentId: string,
  ) => Promise<ManualAssignmentCandidate[]>;
  onAssign: (candidate: ManualAssignmentCandidate) => Promise<unknown>;
  onClear: (serviceId: string, assignmentId: string) => void;
  onClose: () => void;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const assignmentId = target?.assignmentId ?? 'none';
  const query = useQuery({
    queryKey: queryKeys.manualAssignmentCandidates(
      accountId ?? 'signed-out',
      churchId ?? 'none',
      assignmentId,
    ),
    queryFn: () => loadCandidates(assignmentId),
    enabled: visible
      && Boolean(accountId && churchId && target?.assignmentId),
    retry: 1,
    staleTime: 15_000,
  });

  useEffect(() => {
    setSelectedMemberId(null);
    setActionError(null);
    setAssigning(false);
  }, [assignmentId, visible]);

  const candidates = useMemo(() => query.data ?? [], [query.data]);
  const sections = useMemo(
    () => createManualAssignmentSections(candidates),
    [candidates],
  );
  const selectedCandidate = candidates.find(
    candidate => candidate.memberId === selectedMemberId && candidate.eligible,
  ) ?? null;
  const roleName = candidates[0]?.roleName || target?.roleName || 'Role';
  const queryError = query.error
    ? normalizeManualAssignmentError(query.error).message
    : null;

  const close = () => {
    if (!assigning) onClose();
  };

  const assign = async () => {
    if (!selectedCandidate || assigning) return;
    setAssigning(true);
    setActionError(null);
    try {
      await onAssign(selectedCandidate);
      onClose();
    } catch (error) {
      const normalized = normalizeManualAssignmentError(error);
      setActionError(normalized.message);
      if (normalized.shouldRefresh) {
        setSelectedMemberId(null);
        await query.refetch();
      }
    } finally {
      setAssigning(false);
    }
  };

  const clear = () => {
    if (!target?.hasAssignedMember || assigning) return;
    onClose();
    onClear(target.serviceId, target.assignmentId);
  };

  return (
    <AppModal
      bodyScroll={false}
      busy={assigning}
      onClose={close}
      primaryAction={{
        label: target?.hasAssignedMember ? 'Reassign' : 'Assign',
        loading: assigning,
        disabled: !selectedCandidate,
        onPress: () => void assign(),
        accessibilityHint: selectedCandidate
          ? `Assign ${selectedCandidate.displayName}`
          : undefined,
      }}
      secondaryAction={{ label: 'Cancel', onPress: close }}
      subtitle={(
        <ResponsiveText
          text={`Role: ${roleName}`}
          textStyle={styles.role}
          variant="roleName"
        />
      )}
      title="Manage Assignment"
      variant="long-content"
      visible={visible}
    >
          <View style={styles.statusWrap}>
            <InlineStatus
              message={actionError ?? queryError}
              tone="error"
            />
          </View>

          <View style={styles.currentAssignment}>
            <View
              accessibilityLabel={`Current assignment: ${target?.assignedMemberName || 'Unassigned'}`}
              accessibilityRole="text"
              accessible
              style={styles.currentAssignmentCopy}
            >
              <Text accessible={false} style={styles.currentAssignmentLabel}>Current assignment</Text>
              <ResponsiveText
                accessible={false}
                text={target?.assignedMemberName || 'Unassigned'}
                textStyle={[
                  styles.currentAssignmentName,
                  !target?.hasAssignedMember && styles.unassignedName,
                ]}
                variant="memberName"
              />
            </View>
            {target?.hasAssignedMember ? (
              <Pressable
                accessibilityLabel={`Clear ${target?.assignedMemberName || 'current member'} from this assignment`}
                accessibilityHint="Opens a confirmation before clearing this assignment"
                accessibilityRole="button"
                accessibilityState={{ disabled: assigning }}
                disabled={assigning}
                onPress={clear}
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}
              >
                <IconSymbol
                  android_material_icon_name="person-remove"
                  color={colors.error}
                  ios_icon_name="person.crop.circle.badge.minus"
                  size={19}
                />
                <ResponsiveText
                  accessible={false}
                  style={styles.clearLabelLane}
                  text="Clear"
                  textStyle={styles.clearButtonText}
                  variant="actionLabel"
                />
              </Pressable>
            ) : null}
          </View>

          {query.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>Checking role and availability...</Text>
            </View>
          ) : queryError && candidates.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>
                The member list could not be loaded.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry member list"
                onPress={() => {
                  void query.refetch();
                }}
                style={styles.retryButton}
              >
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color={colors.primary}
                />
                <ResponsiveText
                  accessible={false}
                  style={styles.retryLabelLane}
                  text="Try Again"
                  textStyle={styles.retryText}
                  variant="actionLabel"
                />
              </Pressable>
            </View>
          ) : candidates.length === 0 ? (
            <View style={styles.centerState}>
              <IconSymbol
                ios_icon_name="person.2.slash"
                android_material_icon_name="person-off"
                size={36}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>No members have this role</Text>
              <ResponsiveText
                text={`Assign the ${roleName} role to a member in Church Setup first.`}
                textStyle={styles.stateText}
                variant="supportingCopy"
              />
            </View>
          ) : (
            <SectionList
              accessibilityLabel={`Members for ${roleName}`}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyExtractor={candidate => candidate.memberId}
              renderSectionHeader={({ section }) => (
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {section.title}
                </Text>
              )}
              renderItem={({ item }) => {
                const selected = item.memberId === selectedMemberId;
                const reason = getManualAssignmentCandidateReason(item);
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={item.displayName}
                    accessibilityHint={reason ?? `Assign ${item.displayName} to ${roleName}`}
                    accessibilityState={{
                      checked: selected,
                      disabled: !item.eligible || assigning,
                    }}
                    accessibilityValue={{ text: reason ?? 'Available' }}
                    disabled={!item.eligible || assigning}
                    onPress={() => setSelectedMemberId(item.memberId)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      selected && styles.selectedRow,
                      !item.eligible && styles.unavailableRow,
                      pressed && item.eligible && styles.pressed,
                    ]}
                  >
                    <View style={styles.memberCopy}>
                      <ResponsiveText
                        accessible={false}
                        text={item.displayName}
                        textStyle={[
                          styles.memberName,
                          !item.eligible && styles.unavailableText,
                        ]}
                        variant="memberName"
                      />
                      {reason ? (
                        <ResponsiveText
                          accessible={false}
                          text={reason}
                          textStyle={styles.reasonText}
                          variant="supportingCopy"
                        />
                      ) : null}
                    </View>
                    <View style={styles.memberActionLane}>
                      <IconSymbol
                        ios_icon_name={selected ? 'checkmark.circle.fill' : 'circle'}
                        android_material_icon_name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={23}
                        color={selected ? colors.primary : colors.textTertiary}
                      />
                    </View>
                  </Pressable>
                );
              }}
              sections={sections}
              stickySectionHeadersEnabled={false}
              style={styles.list}
            />
          )}

    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modal: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '82%',
    maxWidth: 520,
    minHeight: 360,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  role: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  statusWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  currentAssignment: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 14,
    minHeight: 62,
    paddingVertical: 10,
  },
  currentAssignmentCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  currentAssignmentLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  currentAssignmentName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  unassignedName: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  clearButton: {
    alignItems: 'center',
    borderColor: colors.error + '55',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    width: 96,
  },
  clearLabelLane: {
    flex: 1,
  },
  clearButtonText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    minHeight: 210,
    padding: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  retryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  retryLabelLane: {
    minWidth: 82,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  sectionTitle: {
    backgroundColor: colors.card,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    paddingBottom: 7,
    paddingTop: 14,
  },
  memberRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedRow: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  unavailableRow: {
    backgroundColor: colors.inputBackground,
    opacity: 0.76,
  },
  memberCopy: {
    flex: 1,
    minWidth: 0,
  },
  memberActionLane: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
  },
  memberName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  unavailableText: {
    color: colors.textSecondary,
  },
  reasonText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 2,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  action: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  cancelAction: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  assignAction: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  assignText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
