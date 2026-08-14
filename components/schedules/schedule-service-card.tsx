import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { RoleSymbol } from '@/components/roles/role-symbol';
import { AppIconTile, AppStatusBadge } from '@/components/ui/app-surface';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import type { FillInRequestWithMemberInfo } from '@/contexts/ChurchContext';
import type { ServiceWithAssignments } from '@/hooks/useServices';
import {
  buildScheduleServiceSummary,
  canManageScheduleSong,
  getVisibleScheduleSongs,
  SCHEDULE_SONG_PREVIEW_LIMIT,
  shouldStackScheduleTeamRows,
} from '@/lib/schedules/schedule-view';
import { moveItemById } from '@/lib/services/song-order';
import {
  SCHEDULE_DISCLOSURE_ANIMATION_MS,
  shouldAnimateScheduleDisclosure,
} from '@/lib/ui/schedule-interaction';
import { resolveSurfaceStatusTokens } from '@/lib/ui/surface-system';
import { resolveRoleSymbolForName } from '@/lib/roles/role-symbols';
import {
  createLegacyThemeColors,
  type LegacyThemeColors,
} from '@/lib/ui/legacy-theme-colors';

type ServiceComment = ServiceWithAssignments['service_comments'][number];

type ViewStyleName =
  | 'serviceCard';

type TextStyleName =
  | 'serviceNotes';

export type ScheduleServiceCardStyles =
  Record<ViewStyleName, StyleProp<ViewStyle>>
  & Record<TextStyleName, StyleProp<TextStyle>>;

export interface ScheduleServiceRole {
  id: string;
  name: string;
  icon_key?: string | null;
}

interface ScheduleServiceCardProps {
  service: ServiceWithAssignments;
  pendingFillInRequests: readonly FillInRequestWithMemberInfo[];
  sortedRoles: readonly ScheduleServiceRole[];
  memberDisplayNames: ReadonlyMap<string, string>;
  currentMemberId: string | null;
  currentMemberDisplayName: string;
  currentMemberRoleNames: ReadonlySet<string>;
  isAdmin: boolean;
  isCreatingFillInRequest: boolean;
  busyFillInRequestIds: ReadonlySet<string>;
  isReorderingSongs: boolean;
  styles: ScheduleServiceCardStyles;
  onOpenServiceActions: (service: ServiceWithAssignments) => void;
  onAddSong: (service: ServiceWithAssignments) => void;
  onEditSong: (
    service: ServiceWithAssignments,
    comment: ServiceComment
  ) => void;
  onOpenSongActions: (
    service: ServiceWithAssignments,
    comment: ServiceComment,
  ) => void;
  onReorderSongs: (
    serviceId: string,
    orderedCommentIds: string[]
  ) => Promise<boolean>;
  onAcceptFillIn: (requestId: string, assignmentId: string) => void;
  onCancelFillIn: (requestId: string) => void;
  onRequestFillIn: (
    assignmentId: string,
    serviceId: string,
    roleName: string
  ) => void;
  onAssignMember: (
    assignmentId: string,
    serviceId: string,
    roleName: string,
    assignedMemberId: string | null,
    assignedMemberName: string | null,
  ) => void;
}

function createLocalDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    return new Date(Number.NaN);
  }

  const datePart = dateString.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return new Date(Number.NaN);

  const [year, month, day] = parts.map(Number);
  if ([year, month, day].some(Number.isNaN)) {
    return new Date(Number.NaN);
  }

  return new Date(year, month - 1, day);
}

function getDateParts(dateString: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = createLocalDate(dateString);
  if (Number.isNaN(date.getTime())) {
    return { weekday: 'Date', day: '--', month: '' };
  }

  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function formatTime(timeString: string | null): string {
  if (!timeString) return '';

  try {
    const [hours, minutes] = timeString.split(':');
    const hour = Number.parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
}

function haveSameRequests(
  previous: readonly FillInRequestWithMemberInfo[],
  next: readonly FillInRequestWithMemberInfo[]
): boolean {
  return (
    previous === next
    || (
      previous.length === next.length
      && previous.every((request, index) => request === next[index])
    )
  );
}

function ScheduleServiceCardComponent({
  service,
  pendingFillInRequests,
  sortedRoles,
  memberDisplayNames,
  currentMemberId,
  currentMemberDisplayName,
  currentMemberRoleNames,
  isAdmin,
  isCreatingFillInRequest,
  busyFillInRequestIds,
  isReorderingSongs,
  styles,
  onOpenServiceActions,
  onAddSong,
  onEditSong,
  onOpenSongActions,
  onReorderSongs,
  onAcceptFillIn,
  onCancelFillIn,
  onRequestFillIn,
  onAssignMember,
}: ScheduleServiceCardProps) {
  const theme = useAppTheme();
  const colors = useMemo(() => createLegacyThemeColors(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(colors), [colors]);
  const { fontScale, width } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotionPreference();
  const [cardWidth, setCardWidth] = useState(0);
  const [isSongReorderMode, setIsSongReorderMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const availableCardWidth = cardWidth || width;
  const stackTeamRows = shouldStackScheduleTeamRows({
    width: availableCardWidth,
    fontScale,
  });
  const stackAttentionActions = availableCardWidth < 430 || fontScale > 1.15;
  const timeDisplay = formatTime(service.time);
  const dateParts = getDateParts(service.date);
  const canReorderSongs = isAdmin || Boolean(
    currentMemberId
    && service.assignments.some(
      assignment => assignment.member_id === currentMemberId
    )
  );
  const summary = buildScheduleServiceSummary({
    assignments: service.assignments,
    orderedRoleNames: sortedRoles.map(role => role.name),
    currentMemberId,
    songCount: service.service_comments.length,
    pendingFillInCount: pendingFillInRequests.length,
  });
  const statusLabel = summary.pendingFillInCount > 0
    ? `${summary.pendingFillInCount} fill-in${summary.pendingFillInCount === 1 ? '' : 's'}`
    : summary.personalRoleNames.length > 0
      ? "You're serving"
      : null;
  const summaryStatusTokens = resolveSurfaceStatusTokens(
    theme,
    summary.pendingFillInCount > 0 ? 'attention' : 'personal',
  );
  const visibleSongs = getVisibleScheduleSongs({
    songs: service.service_comments,
    showAll: showAllSongs,
    reordering: isSongReorderMode,
  });
  const personalRoles = summary.personalRoleNames.map(roleName => ({
    name: roleName,
    symbol: resolveRoleSymbolForName(sortedRoles, roleName),
  }));
  const serviceSummaryAccessibilityLabel = [
    service.service_type,
    `${dateParts.weekday}, ${dateParts.month} ${dateParts.day}`,
    timeDisplay || 'Time not set',
    `${summary.assignedCount} of ${summary.totalAssignmentCount} team roles assigned`,
    `${summary.songCount} ${summary.songCount === 1 ? 'song' : 'songs'}`,
    statusLabel,
  ].filter(Boolean).join('. ');
  const handleCardLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setCardWidth(current => current === nextWidth ? current : nextWidth);
  }, []);
  const animateDisclosure = useCallback(() => {
    if (!shouldAnimateScheduleDisclosure(reduceMotionEnabled)) return;
    LayoutAnimation.configureNext({
      duration: SCHEDULE_DISCLOSURE_ANIMATION_MS,
      create: {
        property: LayoutAnimation.Properties.opacity,
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        property: LayoutAnimation.Properties.opacity,
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
  }, [reduceMotionEnabled]);

  useEffect(() => {
    if (service.service_comments.length < 2 || !canReorderSongs) {
      setIsSongReorderMode(false);
    }
  }, [canReorderSongs, service.service_comments.length]);

  useEffect(() => {
    if (service.service_comments.length <= SCHEDULE_SONG_PREVIEW_LIMIT) {
      setShowAllSongs(false);
    }
  }, [service.service_comments.length]);

  useEffect(() => {
    if (isSongReorderMode || isReorderingSongs) setIsExpanded(true);
  }, [isReorderingSongs, isSongReorderMode]);

  const moveSavedSong = (commentId: string, direction: -1 | 1) => {
    if (isReorderingSongs) return;
    const nextComments = moveItemById(
      service.service_comments,
      commentId,
      direction
    );
    const movedSong = nextComments.find(comment => comment.id === commentId);
    const movedPosition = nextComments.findIndex(comment => comment.id === commentId) + 1;
    void onReorderSongs(
      service.id,
      nextComments.map(comment => comment.id)
    ).then(success => {
      if (success && movedSong) {
        AccessibilityInfo.announceForAccessibility(
          `${movedSong.comment_text} moved to position ${movedPosition}`,
        );
      }
    });
  };

  const getMemberDisplayName = (
    memberId?: string | null,
    preferredName?: string | null
  ) => {
    if (preferredName?.trim()) return preferredName.trim();
    if (memberId && memberId === currentMemberId) {
      return currentMemberDisplayName;
    }
    return (memberId && memberDisplayNames.get(memberId)) || 'Member';
  };

  return (
    <View
      onLayout={handleCardLayout}
      style={[
        styles.serviceCard,
        personalRoles.length > 0 && {
          borderLeftColor: theme.colors.accent,
          borderLeftWidth: 3,
        },
      ]}
    >
      <View style={cardStyles.summaryRow}>
        <View
          accessibilityLabel={serviceSummaryAccessibilityLabel}
          accessibilityRole="summary"
          accessible
          style={cardStyles.summaryPrimary}
        >
          <View
            accessible={false}
            style={[
              cardStyles.dateLane,
              {
                backgroundColor: theme.serviceMetadata.surface,
                borderColor: theme.serviceMetadata.border,
              },
            ]}
          >
            <Text accessible={false} style={[cardStyles.weekday, { color: theme.serviceMetadata.mutedForeground }]}>{dateParts.weekday}</Text>
            <Text accessible={false} style={[cardStyles.day, { color: theme.serviceMetadata.foreground }]}>{dateParts.day}</Text>
            <Text accessible={false} style={[cardStyles.month, { color: theme.serviceMetadata.mutedForeground }]}>{dateParts.month}</Text>
          </View>
          <View style={cardStyles.summaryCenter}>
            <ResponsiveText
              accessible={false}
              text={service.service_type}
              textStyle={[cardStyles.serviceType, { color: theme.colors.accent }]}
              variant="serviceType"
            />
            <View accessible={false} style={cardStyles.timeRow}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="schedule"
                color={theme.colors.accent}
                size={15}
              />
              <Text accessible={false} style={[cardStyles.timeText, { color: theme.colors.accent }]}>{timeDisplay || 'Time not set'}</Text>
            </View>
          </View>
        </View>
        <View style={cardStyles.summaryActions}>
          {statusLabel ? (
            <View style={[
              cardStyles.statusPill,
              summary.pendingFillInCount > 0 && cardStyles.attentionPill,
              {
                backgroundColor: summaryStatusTokens.surface,
                borderColor: summaryStatusTokens.border,
              },
            ]}>
              <ResponsiveText
                accessible={false}
                style={cardStyles.statusTextLane}
                text={statusLabel}
                textStyle={[
                  cardStyles.statusText,
                  summary.pendingFillInCount > 0 && cardStyles.attentionText,
                  { color: summaryStatusTokens.foreground },
                ]}
                variant="compactLabel"
              />
            </View>
          ) : null}
          {isAdmin ? (
            <Pressable
              accessibilityHint="Opens service actions"
              accessibilityLabel={`More actions for ${service.service_type}`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onOpenServiceActions(service)}
              style={({ pressed }) => [
                cardStyles.overflowButton,
                pressed && cardStyles.pressed,
              ]}
            >
              <IconSymbol
                ios_icon_name="ellipsis"
                android_material_icon_name="more-vert"
                color={colors.text}
                size={22}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {pendingFillInRequests.map(request => {
        const requestingMemberDisplayName = getMemberDisplayName(
          request.requesting_member_id,
          request.requesting_member_name || request.requesting_member_email,
        );
        const isMyRequest = currentMemberId === request.requesting_member_id;
        const canAccept = currentMemberRoleNames.has(request.role_name);
        const isBusy = busyFillInRequestIds.has(request.id);
        const reason = request.reason?.trim();
        const actionDescription = isMyRequest
          ? 'You can cancel this request.'
          : canAccept
            ? 'You can accept this request.'
            : `Waiting for an eligible ${request.role_name} member.`;
        const sentence = `${isMyRequest ? 'You' : requestingMemberDisplayName} requested a fill-in for ${request.role_name}${reason ? ` because ${reason}` : ''}. ${actionDescription}`;

        return (
          <View
            key={request.id}
            style={[
              cardStyles.fillInAttentionRow,
              stackAttentionActions && cardStyles.fillInAttentionRowStacked,
              {
                backgroundColor: theme.status.warning.surface,
                borderColor: theme.status.warning.border,
              },
            ]}
          >
            <IconSymbol
              android_material_icon_name="notification-important"
              color={theme.status.warning.foreground}
              ios_icon_name="exclamationmark.bubble.fill"
              size={20}
            />
            <ResponsiveText
              accessibilityLabel={sentence}
              accessibilityRole="alert"
              style={cardStyles.fillInAttentionTextLane}
              text={sentence}
              textStyle={cardStyles.fillInAttentionText}
              variant="requestCopy"
            />
            {!isMyRequest && canAccept ? (
              <Pressable
                accessibilityHint={`Assigns you to ${request.role_name} for this service`}
                accessibilityLabel={`Accept ${request.role_name} fill-in request from ${requestingMemberDisplayName}`}
                accessibilityRole="button"
                accessibilityState={{ busy: isBusy, disabled: isBusy }}
                disabled={isBusy}
                onPress={() => onAcceptFillIn(request.id, request.assignment_id)}
                style={({ pressed }) => [
                  cardStyles.fillInPrimaryAction,
                  pressed && cardStyles.pressed,
                  isBusy && cardStyles.disabled,
                ]}
              >
                <ResponsiveText
                  accessible={false}
                  style={cardStyles.actionLabelLane}
                  text={isBusy ? 'Accepting...' : 'Accept'}
                  textStyle={cardStyles.fillInPrimaryActionText}
                  variant="compactLabel"
                />
              </Pressable>
            ) : isMyRequest ? (
              <Pressable
                accessibilityHint="Cancels your pending fill-in request"
                accessibilityLabel={`Cancel ${request.role_name} fill-in request`}
                accessibilityRole="button"
                accessibilityState={{ busy: isBusy, disabled: isBusy }}
                disabled={isBusy}
                onPress={() => onCancelFillIn(request.id)}
                style={({ pressed }) => [
                  cardStyles.fillInSecondaryAction,
                  pressed && cardStyles.pressed,
                  isBusy && cardStyles.disabled,
                ]}
              >
                <ResponsiveText
                  accessible={false}
                  style={cardStyles.actionLabelLane}
                  text={isBusy ? 'Cancelling...' : 'Cancel'}
                  textStyle={cardStyles.fillInSecondaryActionText}
                  variant="compactLabel"
                />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {personalRoles.length > 0 ? (
        <View
          accessibilityLabel={`Your Assignment: ${summary.personalRoleNames.join(', ')}`}
          accessibilityRole="text"
          accessible
          style={[
            cardStyles.personalAssignment,
            {
              backgroundColor: theme.status.info.surface,
              borderColor: theme.status.info.border,
            },
          ]}
        >
          <View style={cardStyles.personalAssignmentText}>
            <Text accessible={false} style={[cardStyles.personalAssignmentLabel, { color: theme.status.info.foreground }]}>You&apos;re serving</Text>
            <View style={cardStyles.personalRoleList}>
              {personalRoles.map(role => (
                <View
                  key={role.name}
                  style={[
                    cardStyles.personalRoleChip,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.status.info.border,
                    },
                  ]}
                >
                  <RoleSymbol
                    color={theme.status.info.foreground}
                    iconKey={role.symbol.key}
                    size={18}
                  />
                  <ResponsiveText
                    accessible={false}
                    style={cardStyles.personalRoleTextLane}
                    text={role.name}
                    textStyle={[cardStyles.personalAssignmentRoles, { color: theme.status.info.foreground }]}
                    variant="roleName"
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View
          accessibilityLabel="Not assigned to this service"
          accessibilityRole="text"
          accessible
          style={cardStyles.notAssignedRow}
        >
          <IconSymbol
            android_material_icon_name="person-outline"
            color={theme.colors.textTertiary}
            ios_icon_name="person"
            size={17}
          />
          <Text accessible={false} style={[cardStyles.notAssignedText, { color: theme.colors.textTertiary }]}>Not assigned</Text>
        </View>
      )}

      {service.notes ? (
        <ResponsiveText
          selectable
          text={service.notes}
          textStyle={styles.serviceNotes}
          variant="supportingCopy"
        />
      ) : null}

      <View
        accessibilityLabel={`Team ${summary.assignedCount} of ${summary.totalAssignmentCount} assigned. ${summary.songCount} ${summary.songCount === 1 ? 'song' : 'songs'}${summary.pendingFillInCount > 0 ? '. Fill-in open' : ''}`}
        accessibilityRole="text"
        accessible
        style={cardStyles.metricsRow}
      >
        <Text accessible={false} style={cardStyles.metricText}>
          Team {summary.assignedCount}/{summary.totalAssignmentCount}
        </Text>
        <View style={cardStyles.metricDivider} />
        <Text accessible={false} style={cardStyles.metricText}>
          {summary.songCount} {summary.songCount === 1 ? 'song' : 'songs'}
        </Text>
        {summary.pendingFillInCount > 0 ? (
          <>
            <View style={cardStyles.metricDivider} />
            <Text accessible={false} style={cardStyles.attentionMetric}>Fill-in open</Text>
          </>
        ) : null}
      </View>

      <Pressable
        accessibilityHint={isExpanded
          ? 'Collapses the team and song details'
          : 'Show Details for the full team and song list'}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Hide service details' : 'Show service details'}
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => {
          animateDisclosure();
          setIsExpanded(current => !current);
          if (isExpanded) setIsSongReorderMode(false);
        }}
        style={({ pressed }) => [
          cardStyles.detailsToggle,
          pressed && cardStyles.pressed,
        ]}
      >
        <ResponsiveText
          accessible={false}
          style={cardStyles.disclosureLabelLane}
          text={isExpanded ? 'Hide team and songs' : 'View team and songs'}
          textStyle={cardStyles.detailsToggleText}
          variant="compactLabel"
        />
        <IconSymbol
          ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
          android_material_icon_name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          color={colors.primary}
          size={22}
        />
      </Pressable>

      {isExpanded ? (
        <View
          style={[
            cardStyles.expandedDetailsSurface,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <View style={cardStyles.teamSection}>
          <Text
            accessibilityLabel={`Team for ${service.service_type}, ${summary.totalAssignmentCount} roles`}
            accessibilityRole="header"
            style={cardStyles.sectionTitle}
          >
            Team
          </Text>
          {sortedRoles.map(role => {
            const assignment = service.assignments.find(item => item.role === role.name);
            if (!assignment) return null;

            const assignedMemberName = assignment.member_id
              ? getMemberDisplayName(assignment.member_id, assignment.person_name)
              : null;
            const isMyAssignment = currentMemberId === assignment.member_id;
            const hasFillInRequest = pendingFillInRequests.some(
              request => request.assignment_id === assignment.id
            );
            const roleSymbol = resolveRoleSymbolForName(sortedRoles, assignment.role);
            const assignmentState = isMyAssignment
              ? 'You'
              : hasFillInRequest
                ? 'Fill-in requested'
                : assignedMemberName
                  ? 'Assigned'
                  : 'Open';
            const showAssignmentState = isMyAssignment
              || hasFillInRequest
              || !assignedMemberName;
            const rowContent = (
              <>
                <AppIconTile compact>
                  <RoleSymbol
                    color={theme.iconTile.foreground}
                    iconKey={roleSymbol.key}
                    size={21}
                  />
                </AppIconTile>
                <View style={cardStyles.teamRoleCopy}>
                  <ResponsiveText
                    accessible={false}
                    text={assignment.role}
                    textStyle={cardStyles.teamRole}
                    variant="roleName"
                  />
                  {stackTeamRows ? (
                    <ResponsiveText
                      accessible={false}
                      text={assignedMemberName || 'Unassigned'}
                      textStyle={[
                        cardStyles.teamMember,
                        !assignedMemberName && cardStyles.unassigned,
                      ]}
                      variant="memberName"
                    />
                  ) : null}
                </View>
                {!stackTeamRows ? (
                  <ResponsiveText
                    accessible={false}
                    style={cardStyles.teamMemberLane}
                    text={assignedMemberName || 'Unassigned'}
                    textStyle={[
                      cardStyles.teamMember,
                      !assignedMemberName && cardStyles.unassigned,
                    ]}
                    variant="memberName"
                  />
                ) : null}
                {showAssignmentState ? (
                  <AppStatusBadge
                    label={assignmentState}
                    tone={isMyAssignment
                      ? 'personal'
                      : hasFillInRequest
                        ? 'attention'
                        : 'unassigned'}
                  />
                ) : null}
                {isAdmin ? (
                  <IconSymbol
                    android_material_icon_name="chevron-right"
                    color={colors.textSecondary}
                    ios_icon_name="chevron.right"
                    size={20}
                  />
                ) : null}
              </>
            );

            return (
              <View
                key={assignment.id}
                style={[
                  cardStyles.teamRowGroup,
                  isMyAssignment && cardStyles.personalTeamRowGroup,
                  isMyAssignment && {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderColor: theme.colors.accent,
                  },
                ]}
              >
                {isAdmin ? (
                  <Pressable
                    accessibilityHint="Opens availability-checked assignment options"
                    accessibilityLabel={`${assignment.role}, ${assignedMemberName || 'Unassigned'}`}
                    accessibilityRole="button"
                    onPress={() => onAssignMember(
                      assignment.id,
                      service.id,
                      assignment.role,
                      assignment.member_id,
                      assignedMemberName,
                    )}
                    style={({ pressed }) => [
                      cardStyles.teamRow,
                      stackTeamRows && cardStyles.teamRowStacked,
                      isMyAssignment && cardStyles.personalTeamRow,
                      pressed && cardStyles.pressed,
                    ]}
                  >
                    {rowContent}
                  </Pressable>
                ) : (
                  <View
                    accessibilityLabel={`${assignment.role}, ${assignedMemberName || 'Unassigned'}`}
                    accessibilityRole="text"
                    accessible
                    style={[
                      cardStyles.teamRow,
                      stackTeamRows && cardStyles.teamRowStacked,
                      isMyAssignment && cardStyles.personalTeamRow,
                    ]}
                  >
                    {rowContent}
                  </View>
                )}

                {isMyAssignment ? (
                  hasFillInRequest ? (
                    <View
                      accessibilityLabel={`Fill-in requested for ${assignment.role}`}
                      accessibilityRole="text"
                      accessible
                      style={cardStyles.fillInPending}
                    >
                      <IconSymbol
                        android_material_icon_name="schedule-send"
                        color={colors.secondary}
                        ios_icon_name="clock.badge.checkmark"
                        size={17}
                      />
                      <ResponsiveText
                        accessible={false}
                        style={cardStyles.actionLabelLane}
                        text="Fill-in requested"
                        textStyle={cardStyles.fillInPendingText}
                        variant="compactLabel"
                      />
                    </View>
                  ) : (
                    <Pressable
                      accessibilityHint={`Opens a fill-in request for your ${assignment.role} assignment`}
                      accessibilityLabel={`Request fill-in for ${assignment.role}`}
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: isCreatingFillInRequest,
                        disabled: isCreatingFillInRequest,
                      }}
                      disabled={isCreatingFillInRequest}
                      onPress={() => onRequestFillIn(
                        assignment.id,
                        service.id,
                        assignment.role,
                      )}
                      style={({ pressed }) => [
                        cardStyles.fillInAction,
                        {
                          backgroundColor: theme.button.primarySurface,
                          borderColor: theme.button.primarySurface,
                        },
                        pressed && cardStyles.pressed,
                        isCreatingFillInRequest && cardStyles.disabled,
                      ]}
                    >
                      <IconSymbol
                        android_material_icon_name="person-search"
                        color={theme.button.primaryForeground}
                        ios_icon_name="person.2.badge.gearshape"
                        size={18}
                      />
                      <ResponsiveText
                        accessible={false}
                        style={cardStyles.fillInActionLabelLane}
                        text="Request Fill-In"
                        textStyle={[
                          cardStyles.fillInActionText,
                          { color: theme.button.primaryForeground },
                        ]}
                        variant="compactLabel"
                      />
                    </Pressable>
                  )
                ) : null}
              </View>
            );
          })}
          </View>
          <View style={cardStyles.songsSection}>
          <View style={cardStyles.sectionHeaderRow}>
            <Text
              accessibilityLabel={`Songs for ${service.service_type}, ${summary.songCount}`}
              accessibilityRole="header"
              style={cardStyles.sectionTitle}
            >
              Songs
            </Text>
            <View style={cardStyles.sectionActions}>
              {canReorderSongs && service.service_comments.length > 1 ? (
                <Pressable
                  accessibilityHint={isSongReorderMode
                    ? 'Returns to the regular song list'
                    : 'Shows controls for changing song order'}
                  accessibilityLabel={isSongReorderMode
                    ? 'Finish reordering songs'
                    : 'Reorder songs'}
                  accessibilityRole="button"
                  accessibilityState={{
                    busy: isReorderingSongs,
                    disabled: isReorderingSongs,
                    expanded: isSongReorderMode,
                  }}
                  disabled={isReorderingSongs}
                  onPress={() => {
                    animateDisclosure();
                    setIsSongReorderMode(current => !current);
                  }}
                  style={({ pressed }) => [
                    cardStyles.reorderButton,
                    pressed && cardStyles.pressed,
                    isReorderingSongs && cardStyles.disabled,
                  ]}
                >
                  <IconSymbol
                    android_material_icon_name={isSongReorderMode ? 'done' : 'swap-vert'}
                    color={colors.primary}
                    ios_icon_name={isSongReorderMode ? 'checkmark' : 'arrow.up.arrow.down'}
                    size={18}
                  />
                  <ResponsiveText
                    accessible={false}
                    style={cardStyles.actionLabelLane}
                    text={isSongReorderMode ? 'Done' : 'Reorder'}
                    textStyle={cardStyles.reorderButtonText}
                    variant="compactLabel"
                  />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityHint="Opens the add song form"
                accessibilityLabel="Add song"
                accessibilityRole="button"
                onPress={() => onAddSong(service)}
                style={({ pressed }) => [
                  cardStyles.addSongButton,
                  pressed && cardStyles.pressed,
                ]}
              >
                <IconSymbol
                  android_material_icon_name="add"
                  color={colors.primary}
                  ios_icon_name="plus"
                  size={21}
                />
              </Pressable>
            </View>
          </View>

          {visibleSongs.length === 0 ? (
            <Text accessibilityRole="text" style={cardStyles.emptySongs}>
              No songs added yet.
            </Text>
          ) : visibleSongs.map((comment, commentIndex) => {
            const authorName = getMemberDisplayName(
              comment.member_id,
              comment.church_members?.name || comment.church_members?.email,
            );
            const canEditSong = canManageScheduleSong({
              isAdmin,
              currentMemberId,
              authorMemberId: comment.member_id,
            });
            const createdAt = new Date(comment.created_at);
            const createdAtText = Number.isNaN(createdAt.getTime())
              ? ''
              : createdAt.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
            const meta = [
              comment.song_type || 'Song',
              `Added by ${authorName}`,
              createdAtText || null,
            ].filter(Boolean).join(' - ');
            const songNumberLabel = comment.song_number ? `#${comment.song_number}` : null;
            const songCopy = (
              <View style={cardStyles.songCopy}>
                <View style={cardStyles.songTitleRow}>
                  {songNumberLabel ? (
                    <View
                      accessibilityLabel={`Song number ${comment.song_number}`}
                      style={[
                        cardStyles.songNumberChip,
                        {
                          backgroundColor: theme.status.info.surface,
                          borderColor: theme.status.info.border,
                        },
                      ]}
                    >
                      <Text style={[cardStyles.songNumberChipText, { color: theme.status.info.foreground }]}>
                        {songNumberLabel}
                      </Text>
                    </View>
                  ) : null}
                  <ResponsiveText
                    accessible={false}
                    style={cardStyles.songTitleLane}
                    text={comment.comment_text}
                    textStyle={cardStyles.songTitle}
                    variant="songTitle"
                  />
                </View>
                <ResponsiveText
                  accessible={false}
                  text={meta}
                  textStyle={cardStyles.songMeta}
                  variant="supportingCopy"
                />
              </View>
            );

            return (
              <View key={comment.id} style={cardStyles.songRow}>
                <Text style={cardStyles.songPosition}>{commentIndex + 1}</Text>
                {canEditSong && !isSongReorderMode ? (
                  <Pressable
                    accessibilityLabel={`Song ${commentIndex + 1}, ${songNumberLabel ? `${songNumberLabel}, ` : ''}${comment.comment_text}. ${meta}`}
                    accessibilityHint="Opens this song for editing"
                    accessibilityRole="button"
                    onPress={() => onEditSong(service, comment)}
                    style={({ pressed }) => [
                      cardStyles.songPressable,
                      pressed && cardStyles.pressed,
                    ]}
                  >
                    {songCopy}
                  </Pressable>
                ) : (
                  <View
                    accessibilityLabel={`Song ${commentIndex + 1}, ${songNumberLabel ? `${songNumberLabel}, ` : ''}${comment.comment_text}. ${meta}`}
                    accessibilityRole="text"
                    accessible
                    style={cardStyles.songPressable}
                  >
                    {songCopy}
                  </View>
                )}

                {isSongReorderMode ? (
                  <View style={cardStyles.songMoveActions}>
                    <Pressable
                      accessibilityLabel={`Move ${comment.comment_text} up`}
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: isReorderingSongs,
                        disabled: commentIndex === 0 || isReorderingSongs,
                      }}
                      disabled={commentIndex === 0 || isReorderingSongs}
                      onPress={() => moveSavedSong(comment.id, -1)}
                      style={({ pressed }) => [
                        cardStyles.songMoveButton,
                        pressed && cardStyles.pressed,
                        (commentIndex === 0 || isReorderingSongs) && cardStyles.disabled,
                      ]}
                    >
                      <IconSymbol
                        android_material_icon_name="keyboard-arrow-up"
                        color={colors.primary}
                        ios_icon_name="arrow.up"
                        size={21}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Move ${comment.comment_text} down`}
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: isReorderingSongs,
                        disabled: commentIndex === service.service_comments.length - 1
                          || isReorderingSongs,
                      }}
                      disabled={commentIndex === service.service_comments.length - 1 || isReorderingSongs}
                      onPress={() => moveSavedSong(comment.id, 1)}
                      style={({ pressed }) => [
                        cardStyles.songMoveButton,
                        pressed && cardStyles.pressed,
                        (
                          commentIndex === service.service_comments.length - 1
                          || isReorderingSongs
                        ) && cardStyles.disabled,
                      ]}
                    >
                      <IconSymbol
                        android_material_icon_name="keyboard-arrow-down"
                        color={colors.primary}
                        ios_icon_name="arrow.down"
                        size={21}
                      />
                    </Pressable>
                  </View>
                ) : canEditSong ? (
                  <Pressable
                    accessibilityHint="Opens edit and delete actions for this song"
                    accessibilityLabel={`More actions for ${comment.comment_text}`}
                    accessibilityRole="button"
                    onPress={() => onOpenSongActions(service, comment)}
                    style={({ pressed }) => [
                      cardStyles.songOverflow,
                      pressed && cardStyles.pressed,
                    ]}
                  >
                    <IconSymbol
                      android_material_icon_name="more-vert"
                      color={colors.textSecondary}
                      ios_icon_name="ellipsis"
                      size={21}
                    />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {service.service_comments.length > SCHEDULE_SONG_PREVIEW_LIMIT && !isSongReorderMode ? (
            <Pressable
              accessibilityHint={showAllSongs
                ? 'Collapses the song list to its preview'
                : 'Shows every song for this service'}
              accessibilityLabel={showAllSongs
                ? 'Show fewer songs'
                : `Show all ${service.service_comments.length} songs`}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAllSongs }}
              onPress={() => {
                animateDisclosure();
                setShowAllSongs(current => !current);
              }}
              style={({ pressed }) => [
                cardStyles.showAllSongs,
                pressed && cardStyles.pressed,
              ]}
            >
              <ResponsiveText
                accessible={false}
                style={cardStyles.disclosureLabelLane}
                text={showAllSongs
                  ? 'Show Fewer Songs'
                  : `Show All ${service.service_comments.length} Songs`}
                textStyle={cardStyles.showAllSongsText}
                variant="compactLabel"
              />
              <IconSymbol
                android_material_icon_name={showAllSongs ? 'expand-less' : 'expand-more'}
                color={colors.primary}
                ios_icon_name={showAllSongs ? 'chevron.up' : 'chevron.down'}
                size={20}
              />
            </Pressable>
          ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createCardStyles = (colors: LegacyThemeColors) => StyleSheet.create({
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  summaryPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  dateLane: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 7,
    width: 58,
  },
  weekday: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  day: {
    color: colors.text,
    fontSize: 25,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    lineHeight: 29,
  },
  month: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryCenter: {
    flex: 1,
    gap: 7,
    minWidth: 0,
    paddingTop: 3,
  },
  serviceType: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  timeText: {
    color: colors.textSecondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryActions: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 6,
    width: 96,
  },
  statusPill: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary + '35',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    width: 96,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statusTextLane: {
    width: '100%',
  },
  attentionPill: {
    backgroundColor: colors.secondary + '12',
    borderColor: colors.secondary + '70',
  },
  statusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    textAlign: 'right',
  },
  attentionText: {
    color: colors.secondary,
  },
  overflowButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  personalAssignment: {
    alignItems: 'center',
    backgroundColor: colors.primary + '0C',
    borderRadius: 8,
    borderWidth: 1,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 66,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fillInAttentionRow: {
    alignItems: 'center',
    borderBottomColor: colors.secondary + '70',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.secondary + '70',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  fillInAttentionRowStacked: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  fillInAttentionTextLane: {
    flex: 1,
    minWidth: 180,
  },
  fillInAttentionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  fillInPrimaryAction: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    width: 112,
  },
  fillInPrimaryActionText: {
    color: colors.headerText,
    fontSize: 13,
    fontWeight: '800',
  },
  fillInSecondaryAction: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    width: 112,
  },
  fillInSecondaryActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  personalAssignmentText: {
    flex: 1,
    gap: 5,
    justifyContent: 'center',
  },
  personalAssignmentLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  personalAssignmentRoles: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  personalRoleList: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  personalRoleChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  personalRoleTextLane: {
    alignSelf: 'center',
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  notAssignedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingTop: 10,
  },
  notAssignedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
  },
  metricText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  attentionMetric: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  metricDivider: {
    backgroundColor: colors.border,
    height: 12,
    width: StyleSheet.hairlineWidth,
  },
  detailsToggle: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 44,
    paddingTop: 8,
  },
  detailsToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  expandedDetailsSurface: {
    borderRadius: 6,
    marginTop: 2,
    overflow: 'hidden',
    paddingHorizontal: 10,
  },
  songsSection: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sectionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 9,
  },
  reorderButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  addSongButton: {
    alignItems: 'center',
    borderColor: colors.primary + '55',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptySongs: {
    color: colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingBottom: 10,
    paddingTop: 4,
  },
  songRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 64,
    paddingVertical: 8,
  },
  songPosition: {
    color: colors.textSecondary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    textAlign: 'center',
    width: 22,
  },
  songPressable: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 5,
  },
  songCopy: {
    gap: 3,
  },
  songTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  songTitleLane: {
    flex: 1,
    minWidth: 0,
  },
  songNumberChip: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 26,
    minWidth: 36,
    paddingHorizontal: 7,
  },
  songNumberChipText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  songTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  songMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  songOverflow: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  songMoveActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  songMoveButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  showAllSongs: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  showAllSongsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  teamSection: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
    paddingTop: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    paddingBottom: 8,
  },
  teamRowGroup: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  personalTeamRowGroup: {
    borderRadius: 8,
    borderTopWidth: 1,
    borderWidth: 1,
    marginBottom: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  teamRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
  },
  personalTeamRow: {
    paddingHorizontal: 10,
  },
  teamRowStacked: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  teamRoleCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  teamRole: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  teamMember: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  teamMemberLane: {
    flex: 1,
    minWidth: 100,
  },
  unassigned: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  fillInAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 10,
    marginHorizontal: 10,
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  fillInActionText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  fillInActionLabelLane: {
    alignSelf: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  fillInPending: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginHorizontal: 10,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  fillInPendingText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionLabelLane: {
    flexShrink: 1,
    minWidth: 0,
  },
  disclosureLabelLane: {
    flex: 1,
    minWidth: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.68,
  },
});

function areScheduleServiceCardPropsEqual(
  previous: ScheduleServiceCardProps,
  next: ScheduleServiceCardProps
): boolean {
  return (
    previous.service === next.service
    && haveSameRequests(
      previous.pendingFillInRequests,
      next.pendingFillInRequests
    )
    && previous.sortedRoles === next.sortedRoles
    && previous.memberDisplayNames === next.memberDisplayNames
    && previous.currentMemberId === next.currentMemberId
    && previous.currentMemberDisplayName === next.currentMemberDisplayName
    && previous.currentMemberRoleNames === next.currentMemberRoleNames
    && previous.isAdmin === next.isAdmin
    && previous.isCreatingFillInRequest === next.isCreatingFillInRequest
    && previous.busyFillInRequestIds === next.busyFillInRequestIds
    && previous.isReorderingSongs === next.isReorderingSongs
    && previous.styles === next.styles
    && previous.onOpenServiceActions === next.onOpenServiceActions
    && previous.onAddSong === next.onAddSong
    && previous.onEditSong === next.onEditSong
    && previous.onOpenSongActions === next.onOpenSongActions
    && previous.onReorderSongs === next.onReorderSongs
    && previous.onAcceptFillIn === next.onAcceptFillIn
    && previous.onCancelFillIn === next.onCancelFillIn
    && previous.onRequestFillIn === next.onRequestFillIn
    && previous.onAssignMember === next.onAssignMember
  );
}

export const ScheduleServiceCard = React.memo(
  ScheduleServiceCardComponent,
  areScheduleServiceCardPropsEqual
);
