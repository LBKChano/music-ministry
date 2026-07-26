import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import type { FillInRequestWithMemberInfo } from '@/contexts/ChurchContext';
import type { ServiceWithAssignments } from '@/hooks/useServices';
import { colors } from '@/styles/commonStyles';

type ServiceComment = ServiceWithAssignments['service_comments'][number];

type ViewStyleName =
  | 'serviceCard'
  | 'serviceHeader'
  | 'commentsSection'
  | 'commentItem'
  | 'commentHeader'
  | 'songTypeBadge'
  | 'songNumberBadge'
  | 'songActions'
  | 'editSongButton'
  | 'addCommentButton'
  | 'fillInRequestCard'
  | 'fillInRequestButtons'
  | 'fillInAcceptButton'
  | 'fillInCancelButton'
  | 'assignmentRow'
  | 'fillInButton'
  | 'assignButton'
  | 'deleteButton';

type TextStyleName =
  | 'serviceTitle'
  | 'serviceDateTime'
  | 'serviceNotes'
  | 'commentsTitle'
  | 'songTypeText'
  | 'songNumberText'
  | 'commentText'
  | 'commentAuthor'
  | 'addCommentButtonText'
  | 'fillInRequestText'
  | 'fillInButtonTextSmall'
  | 'roleNameText'
  | 'personText'
  | 'emptySlot'
  | 'fillInButtonText';

export type ScheduleServiceCardStyles =
  Record<ViewStyleName, StyleProp<ViewStyle>>
  & Record<TextStyleName, StyleProp<TextStyle>>
  & {
    assignmentTopRow?: StyleProp<ViewStyle>;
    assignmentActions?: StyleProp<ViewStyle>;
  };

export interface ScheduleServiceRole {
  id: string;
  name: string;
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
  assignmentLayout: 'stacked' | 'inline';
  styles: ScheduleServiceCardStyles;
  onDeleteService: (serviceId: string) => void;
  onAddSong: (service: ServiceWithAssignments) => void;
  onEditSong: (
    service: ServiceWithAssignments,
    comment: ServiceComment
  ) => void;
  onDeleteSong: (serviceId: string, commentId: string) => void;
  onAcceptFillIn: (requestId: string, assignmentId: string) => void;
  onCancelFillIn: (requestId: string) => void;
  onRequestFillIn: (
    assignmentId: string,
    serviceId: string,
    roleName: string
  ) => void;
  onAssignMember: (assignmentId: string) => void;
  onDeleteAssignment: (serviceId: string, assignmentId: string) => void;
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

function formatDate(dateString: string): string {
  const date = createLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  assignmentLayout,
  styles,
  onDeleteService,
  onAddSong,
  onEditSong,
  onDeleteSong,
  onAcceptFillIn,
  onCancelFillIn,
  onRequestFillIn,
  onAssignMember,
  onDeleteAssignment,
}: ScheduleServiceCardProps) {
  const timeDisplay = formatTime(service.time);
  const dateDisplay = formatDate(service.date);
  const dateTimeDisplay = timeDisplay
    ? `${dateDisplay} at ${timeDisplay}`
    : dateDisplay;

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
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{service.service_type}</Text>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => onDeleteService(service.id)}
            style={styles.deleteButton}
          >
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.serviceDateTime}>{dateTimeDisplay}</Text>
      {service.notes ? (
        <Text style={styles.serviceNotes}>{service.notes}</Text>
      ) : null}

      {service.service_comments.length > 0 && (
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Songs</Text>
          {service.service_comments.map(comment => {
            const authorName = getMemberDisplayName(
              comment.member_id,
              comment.church_members?.name || comment.church_members?.email
            );
            const canEditSong = isAdmin || currentMemberId === comment.member_id;
            const createdAt = new Date(comment.created_at);
            const createdAtText = Number.isNaN(createdAt.getTime())
              ? ''
              : createdAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

            return (
              <View key={comment.id} style={styles.commentItem}>
                <View style={styles.commentHeader}>
                  <View style={styles.songTypeBadge}>
                    <Text style={styles.songTypeText}>
                      {comment.song_type || 'Song'}
                    </Text>
                  </View>
                  {comment.song_number ? (
                    <View style={styles.songNumberBadge}>
                      <Text style={styles.songNumberText}>
                        #{comment.song_number}
                      </Text>
                    </View>
                  ) : null}
                  {canEditSong ? (
                    <View style={styles.songActions}>
                      <TouchableOpacity
                        style={styles.editSongButton}
                        onPress={() => onEditSong(service, comment)}
                      >
                        <IconSymbol
                          ios_icon_name="pencil"
                          android_material_icon_name="edit"
                          size={16}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editSongButton}
                        onPress={() => onDeleteSong(service.id, comment.id)}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={16}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.commentText}>{comment.comment_text}</Text>
                <Text style={styles.commentAuthor}>
                  Added by {authorName}
                  {createdAtText ? ` - ${createdAtText}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={styles.addCommentButton}
        onPress={() => onAddSong(service)}
      >
        <IconSymbol
          ios_icon_name="music.note.list"
          android_material_icon_name="queue-music"
          size={16}
          color={colors.primary}
        />
        <Text style={styles.addCommentButtonText}>Add Song</Text>
      </TouchableOpacity>

      {pendingFillInRequests.map(request => {
        const requestingMemberDisplayName = getMemberDisplayName(
          request.requesting_member_id,
          request.requesting_member_name || request.requesting_member_email
        );
        const isMyRequest = currentMemberId === request.requesting_member_id;
        const canAccept = currentMemberRoleNames.has(request.role_name);

        return (
          <View key={request.id} style={styles.fillInRequestCard}>
            <Text style={styles.fillInRequestText}>
              {isMyRequest ? 'You' : requestingMemberDisplayName}
            </Text>
            <Text style={styles.fillInRequestText}>
              requested a fill-in for {request.role_name}
            </Text>
            {request.reason ? (
              <Text style={styles.fillInRequestText}>
                Reason: {request.reason}
              </Text>
            ) : null}
            <View style={styles.fillInRequestButtons}>
              {!isMyRequest && canAccept && (
                <TouchableOpacity
                  style={styles.fillInAcceptButton}
                  onPress={() => onAcceptFillIn(request.id, request.assignment_id)}
                >
                  <Text style={styles.fillInButtonTextSmall}>Accept</Text>
                </TouchableOpacity>
              )}
              {isMyRequest && (
                <TouchableOpacity
                  style={styles.fillInCancelButton}
                  onPress={() => onCancelFillIn(request.id)}
                >
                  <Text style={styles.fillInButtonTextSmall}>
                    Cancel Request
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {sortedRoles.map(role => {
        const assignment = service.assignments.find(
          item => item.role === role.name
        );
        if (!assignment) return null;

        const isMyAssignment = currentMemberId === assignment.member_id;
        const hasFillInRequest = pendingFillInRequests.some(
          request => request.assignment_id === assignment.id
        );
        const showActions = (isMyAssignment && !hasFillInRequest) || isAdmin;

        if (assignmentLayout === 'inline') {
          return (
            <View key={assignment.id} style={styles.assignmentRow}>
              <Text style={styles.roleNameText}>{assignment.role}</Text>
              <Text
                style={[
                  styles.personText,
                  !assignment.person_name && styles.emptySlot,
                ]}
              >
                {assignment.person_name || 'Unassigned'}
              </Text>
              {isMyAssignment && !hasFillInRequest && (
                <TouchableOpacity
                  style={styles.fillInButton}
                  onPress={() => onRequestFillIn(
                    assignment.id,
                    service.id,
                    assignment.role
                  )}
                  disabled={isCreatingFillInRequest}
                >
                  <Text style={styles.fillInButtonText}>Request Fill-In</Text>
                </TouchableOpacity>
              )}
              {isAdmin && (
                <>
                  <TouchableOpacity
                    onPress={() => onAssignMember(assignment.id)}
                    style={styles.assignButton}
                  >
                    <IconSymbol
                      ios_icon_name="person.badge.plus"
                      android_material_icon_name="person-add-alt"
                      size={20}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  {assignment.member_id ? (
                    <TouchableOpacity
                      onPress={() => onDeleteAssignment(
                        service.id,
                        assignment.id
                      )}
                      style={styles.deleteButton}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          );
        }

        return (
          <View key={assignment.id} style={styles.assignmentRow}>
            <View style={styles.assignmentTopRow}>
              <Text
                style={styles.roleNameText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {assignment.role}
              </Text>
              <Text
                style={[
                  styles.personText,
                  !assignment.person_name && styles.emptySlot,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {assignment.person_name || 'Unassigned'}
              </Text>
            </View>
            {showActions && (
              <View style={styles.assignmentActions}>
                {isMyAssignment && !hasFillInRequest && (
                  <TouchableOpacity
                    style={styles.fillInButton}
                    onPress={() => onRequestFillIn(
                      assignment.id,
                      service.id,
                      assignment.role
                    )}
                    disabled={isCreatingFillInRequest}
                  >
                    <Text style={styles.fillInButtonText}>Request Fill-In</Text>
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <>
                    <TouchableOpacity
                      onPress={() => onAssignMember(assignment.id)}
                      style={styles.assignButton}
                    >
                      <IconSymbol
                        ios_icon_name="person.badge.plus"
                        android_material_icon_name="person-add-alt"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    {assignment.member_id ? (
                      <TouchableOpacity
                        onPress={() => onDeleteAssignment(
                          service.id,
                          assignment.id
                        )}
                        style={styles.deleteButton}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

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
    && previous.assignmentLayout === next.assignmentLayout
    && previous.styles === next.styles
    && previous.onDeleteService === next.onDeleteService
    && previous.onAddSong === next.onAddSong
    && previous.onEditSong === next.onEditSong
    && previous.onDeleteSong === next.onDeleteSong
    && previous.onAcceptFillIn === next.onAcceptFillIn
    && previous.onCancelFillIn === next.onCancelFillIn
    && previous.onRequestFillIn === next.onRequestFillIn
    && previous.onAssignMember === next.onAssignMember
    && previous.onDeleteAssignment === next.onDeleteAssignment
  );
}

export const ScheduleServiceCard = React.memo(
  ScheduleServiceCardComponent,
  areScheduleServiceCardPropsEqual
);
