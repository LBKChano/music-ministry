import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '@/contexts/AppThemeContext';
import { queryKeys } from '@/lib/query/keys';
import { shouldResetModalList } from '@/lib/ui/modal-presentation';
import {
  createManualAssignmentSections,
  getManualAssignmentCandidateReason,
  normalizeManualAssignmentError,
  type ManualAssignmentCandidate,
} from '@/lib/services/manual-assignment-model';

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
  const theme = useAppTheme();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const assignmentId = target?.assignmentId ?? 'none';
  const assignmentTargetKey = `${assignmentId}:${target?.roleName ?? 'role'}`;
  const listRef = useRef<SectionList<ManualAssignmentCandidate>>(null);
  const previousTargetKeyRef = useRef<string | null>(null);
  const pendingTopResetRef = useRef(false);
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

  useEffect(() => {
    if (!shouldResetModalList({
      visible,
      previousTargetKey: previousTargetKeyRef.current,
      nextTargetKey: assignmentTargetKey,
    })) return;
    previousTargetKeyRef.current = assignmentTargetKey;
    pendingTopResetRef.current = true;
  }, [assignmentTargetKey, visible]);

  useEffect(() => {
    if (
      !visible
      || !pendingTopResetRef.current
      || sections.length === 0
      || sections.every(section => section.data.length === 0)
    ) return;

    pendingTopResetRef.current = false;
    requestAnimationFrame(() => {
      listRef.current?.scrollToLocation({
        animated: false,
        itemIndex: 0,
        sectionIndex: 0,
        viewOffset: 0,
      });
    });
  }, [sections, visible]);
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
      headerIcon={(
        <IconSymbol
          android_material_icon_name="manage-accounts"
          color={theme.modalHeader.accent}
          ios_icon_name="person.crop.circle.badge.checkmark"
          size={22}
        />
      )}
      maxWidth={620}
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
          textStyle={[styles.role, { color: theme.modalHeader.mutedForeground }]}
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

          <View style={[
            styles.currentAssignment,
            { borderBottomColor: theme.divider.color },
          ]}>
            <View
              accessibilityLabel={`Current assignment: ${target?.assignedMemberName || 'Unassigned'}`}
              accessibilityRole="text"
              accessible
              style={styles.currentAssignmentCopy}
            >
              <Text
                accessible={false}
                style={[styles.currentAssignmentLabel, { color: theme.colors.textSecondary }]}
              >
                Current assignment
              </Text>
              <ResponsiveText
                accessible={false}
                text={target?.assignedMemberName || 'Unassigned'}
                textStyle={[
                  styles.currentAssignmentName,
                  { color: theme.colors.textPrimary },
                  !target?.hasAssignedMember && styles.unassignedName,
                  !target?.hasAssignedMember && { color: theme.colors.textTertiary },
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
                  { borderColor: theme.status.error.border },
                  pressed && styles.pressed,
                ]}
              >
                <IconSymbol
                  android_material_icon_name="person-remove"
                  color={theme.status.error.foreground}
                  ios_icon_name="person.crop.circle.badge.minus"
                  size={19}
                />
                <ResponsiveText
                  accessible={false}
                  style={styles.clearLabelLane}
                  text="Clear"
                  textStyle={[
                    styles.clearButtonText,
                    { color: theme.status.error.foreground },
                  ]}
                  variant="actionLabel"
                />
              </Pressable>
            ) : null}
          </View>

          {query.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.stateText, { color: theme.colors.textSecondary }]}>Checking role and availability...</Text>
            </View>
          ) : queryError && candidates.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={[styles.stateText, { color: theme.colors.textSecondary }]}>
                The member list could not be loaded.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry member list"
                onPress={() => {
                  void query.refetch();
                }}
                style={[styles.retryButton, { borderColor: theme.colors.accent }]}
              >
                <IconSymbol
                  ios_icon_name="arrow.clockwise"
                  android_material_icon_name="refresh"
                  size={20}
                  color={theme.colors.accent}
                />
                <ResponsiveText
                  accessible={false}
                  style={styles.retryLabelLane}
                  text="Try Again"
                  textStyle={[styles.retryText, { color: theme.colors.accent }]}
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
                color={theme.colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No members have this role</Text>
              <ResponsiveText
                text={`Assign the ${roleName} role to a member in Church Setup first.`}
                textStyle={[styles.stateText, { color: theme.colors.textSecondary }]}
                variant="supportingCopy"
              />
            </View>
          ) : (
            <SectionList
              ref={listRef}
              accessibilityLabel={`Members for ${roleName}`}
              bounces
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              keyExtractor={candidate => candidate.memberId}
              renderSectionHeader={({ section }) => (
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.sectionTitle,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textSecondary,
                    },
                  ]}
                >
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
                      { borderColor: theme.divider.color },
                      selected && [
                        styles.selectedRow,
                        {
                          backgroundColor: theme.inputHighlight.surface,
                          borderColor: theme.inputHighlight.border,
                        },
                      ],
                      !item.eligible && [
                        styles.unavailableRow,
                        { backgroundColor: theme.colors.surfaceMuted },
                      ],
                      pressed && item.eligible && styles.pressed,
                    ]}
                  >
                    <View style={styles.memberCopy}>
                      <ResponsiveText
                        accessible={false}
                        text={item.displayName}
                        textStyle={[
                          styles.memberName,
                          { color: theme.colors.textPrimary },
                          !item.eligible && styles.unavailableText,
                          !item.eligible && { color: theme.colors.textSecondary },
                        ]}
                        variant="memberName"
                      />
                      {reason ? (
                        <ResponsiveText
                          accessible={false}
                          text={reason}
                          textStyle={[
                            styles.reasonText,
                            { color: theme.status.error.foreground },
                          ]}
                          variant="supportingCopy"
                        />
                      ) : null}
                    </View>
                    <View style={styles.memberActionLane}>
                      <IconSymbol
                        ios_icon_name={selected ? 'checkmark.circle.fill' : 'circle'}
                        android_material_icon_name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={23}
                        color={selected ? theme.colors.accent : theme.colors.textTertiary}
                      />
                    </View>
                  </Pressable>
                );
              }}
              sections={sections}
              nestedScrollEnabled
              onScrollToIndexFailed={() => {
                pendingTopResetRef.current = true;
              }}
              stickySectionHeadersEnabled={false}
              style={styles.list}
            />
          )}

    </AppModal>
  );
}

const styles = StyleSheet.create({
  role: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'left',
  },
  statusWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  currentAssignment: {
    alignItems: 'center',
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
    fontSize: 12,
    fontWeight: '700',
  },
  currentAssignmentName: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  unassignedName: {
    fontStyle: 'italic',
  },
  clearButton: {
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  retryLabelLane: {
    minWidth: 82,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    paddingBottom: 7,
    paddingTop: 14,
  },
  memberRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedRow: {
    borderWidth: 1,
  },
  unavailableRow: {
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  unavailableText: {
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 2,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
