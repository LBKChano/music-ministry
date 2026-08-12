
import { useChurch } from '@/hooks/useChurch';
import type { FillInRequestWithMemberInfo } from '@/contexts/ChurchContext';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useServices, type ServiceWithAssignments } from '@/hooks/useServices';
import { usePerformanceBaselineScreen } from '@/hooks/usePerformanceBaselineScreen';
import { moveItemById } from '@/lib/services/song-order';
import { IconSymbol } from '@/components/IconSymbol';
import { AppStatePanel } from '@/components/feedback/app-state-panel';
import { AppStateScreen } from '@/components/feedback/app-state-screen';
import { InlineStatus } from '@/components/feedback/inline-status';
import { AppModal } from '@/components/ui/app-modal';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { NotificationBell } from "@/components/NotificationBell";
import {
  NotificationPermissionOnboarding,
} from '@/components/notifications/NotificationPermissionOnboarding';
import {
  ResponsiveTabHeader,
  TabHeaderPill,
} from '@/components/navigation/responsive-tab-header';
import { ScheduleServiceCard } from '@/components/schedules/schedule-service-card';
import { ScheduleFilterModal } from '@/components/schedules/schedule-filter-modal';
import { ScheduleViewControls } from '@/components/schedules/schedule-view-controls';
import { useAppTheme } from '@/contexts/AppThemeContext';
import {
  ManualAssignmentModal,
  type ManualAssignmentTarget,
} from '@/components/schedules/manual-assignment-modal';
import { RefreshErrorNotice } from '@/components/RefreshErrorNotice';
import { useRefreshController } from '@/hooks/useRefreshController';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import {
  runRefreshBatch,
  shouldShowInitialLoader,
} from '@/lib/query/refresh-coordinator';
import { HEADER_ACTION_LANE_WIDTHS } from '@/lib/ui/header-typography';
import {
  buildScheduleView,
  buildScheduleSections,
  countActiveScheduleViewFilters,
  EMPTY_SCHEDULE_VIEW_FILTERS,
  type ScheduleViewFilters,
  type ScheduleViewMode,
} from '@/lib/schedules/schedule-view';
import {
  resolveScheduleListState,
  type ScheduleListState,
} from '@/lib/schedules/schedule-state';
import { formatScheduleTodayText } from '@/lib/schedules/schedule-range';
import type { ServicePaginationStatus } from '@/lib/schedules/service-pagination';
import { useNetworkState } from 'expo-network';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  Text,
  SectionList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';

// Helper to create a Date object representing the local date from a "YYYY-MM-DD" or full ISO string
// This avoids timezone shifts when displaying dates
const createLocalDate = (dateString: string): Date => {
  if (!dateString || typeof dateString !== 'string') {
    console.error('createLocalDate received invalid dateString:', dateString);
    return new Date(NaN);
  }

  const datePart = dateString.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length !== 3) {
    console.error('createLocalDate: Invalid date format:', dateString);
    return new Date(NaN);
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    console.error('createLocalDate: Failed to parse date parts:', { dateString, datePart, year, month, day });
    return new Date(NaN);
  }

  return new Date(year, month - 1, day);
};

const DEFAULT_SONG_TYPE_OPTIONS = ['Opening', 'Praise', 'Worship', 'Offering', 'Special', 'Closing'];
const OTHER_SONG_TYPE_OPTION = 'Other';
const EMPTY_FILL_IN_REQUESTS: readonly FillInRequestWithMemberInfo[] = [];

type PendingServiceSong = {
  id: string;
  commentText: string;
  songType: string;
  songNumber: string;
};

type SongActionsTarget = {
  service: ServiceWithAssignments;
  comment: ServiceWithAssignments['service_comments'][number];
};

const normalizeSongTypeOptions = (options?: string[] | null) => {
  const cleaned = (options ?? DEFAULT_SONG_TYPE_OPTIONS)
    .map(option => option.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned));
  const configuredOptions = unique.length > 0 ? unique : DEFAULT_SONG_TYPE_OPTIONS;
  return configuredOptions.includes(OTHER_SONG_TYPE_OPTION)
    ? configuredOptions
    : [...configuredOptions, OTHER_SONG_TYPE_OPTION];
};

function ScheduleEmptyState({
  kind,
  loadError,
  onClearFilters,
  onFinishSetup,
  onRetryRange,
  onShowAll,
}: {
  kind: ScheduleListState;
  loadError: string | null;
  onClearFilters: () => void;
  onFinishSetup: () => void;
  onRetryRange: () => void;
  onShowAll: () => void;
}) {
  if (kind === 'filtered-empty') {
    return (
      <AppStatePanel
        actions={[{ label: 'Clear Filters', onPress: onClearFilters }]}
        androidIcon="filter-list-off"
        iosIcon="line.3.horizontal.decrease.circle"
        message="The services already loaded on this device do not match every selected filter."
        title="No filter matches"
      />
    );
  }

  if (kind === 'personal-empty') {
    return (
      <AppStatePanel
        actions={[{ label: 'View All Services', onPress: onShowAll }]}
        androidIcon="person-off"
        iosIcon="person.crop.circle.badge.xmark"
        message="You are not assigned to any upcoming service in the loaded schedule."
        title="No personal assignments"
      />
    );
  }

  if (kind === 'offline-empty') {
    return (
      <AppStatePanel
        actions={[{ label: 'Try Again', onPress: onRetryRange }]}
        androidIcon="cloud-off"
        iosIcon="icloud.slash"
        message="No saved schedule is available on this device. Reconnect and try again."
        title="Schedule unavailable offline"
      />
    );
  }

  if (kind === 'range-error') {
    return (
      <AppStatePanel
        actions={[{ label: 'Try Again', onPress: onRetryRange }]}
        androidIcon="sync-problem"
        iosIcon="exclamationmark.arrow.triangle.2.circlepath"
        message={loadError || 'The service range could not be loaded. Check your connection and try again.'}
        title="Services could not load"
        tone="error"
      />
    );
  }

  if (kind === 'setup-incomplete') {
    return (
      <AppStatePanel
        actions={[{
          accessibilityHint: 'Opens the admin-only Church Setup workspace.',
          label: 'Finish Church Setup',
          onPress: onFinishSetup,
        }]}
        androidIcon="settings-suggest"
        iosIcon="wrench.and.screwdriver.fill"
        message="Add ministry roles and weekly services before preparing the schedule."
        title="Church setup is incomplete"
      />
    );
  }

  return (
    <AppStatePanel
      androidIcon="event-available"
      iosIcon="calendar"
      message="There are no upcoming scheduled services."
      title="No upcoming services"
    />
  );
}

function SchedulePaginationFooter({
  status,
  onPress,
}: {
  status: ServicePaginationStatus;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const complete = status === 'complete';
  const loading = status === 'loading';
  const error = status === 'error';
  const label = complete
    ? 'All scheduled services loaded'
    : loading
      ? 'Loading services...'
      : error
        ? 'Retry Service Range'
        : 'Load More Services';

  return (
    <TouchableOpacity
      accessibilityHint={complete
        ? undefined
        : 'Loads the next date range without removing the visible schedule'}
      accessibilityLabel={label}
      accessibilityRole={complete ? 'text' : 'button'}
      accessibilityState={complete ? undefined : {
        busy: loading,
        disabled: loading,
      }}
      activeOpacity={complete ? 1 : 0.78}
      disabled={complete || loading}
      onPress={onPress}
      style={[
        styles.loadMoreButton,
        {
          backgroundColor: complete
            ? theme.colors.surfaceMuted
            : theme.colors.surface,
          borderColor: complete
            ? theme.colors.borderSubtle
            : error
              ? theme.status.error.border
              : theme.colors.accent,
        },
      ]}
    >
      <View style={styles.loadMoreIconLane}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <IconSymbol
            ios_icon_name={complete
              ? 'checkmark.circle.fill'
              : error
                ? 'arrow.clockwise.circle.fill'
                : 'calendar.badge.plus'}
            android_material_icon_name={complete
              ? 'check-circle'
              : error
                ? 'refresh'
                : 'event'}
            size={19}
            color={complete
              ? theme.status.success.foreground
              : error
                ? theme.status.error.foreground
                : theme.colors.accent}
          />
        )}
      </View>
      <ResponsiveText
        accessible={false}
        style={styles.loadMoreLabelLane}
        text={label}
        textStyle={[
          styles.loadMoreButtonText,
          {
            color: complete
              ? theme.colors.textSecondary
              : error
                ? theme.status.error.foreground
                : theme.colors.accent,
          },
        ]}
        variant="actionLabel"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    alignSelf: 'center',
    maxWidth: 760,
    padding: 16,
    paddingBottom: 140,
    width: '100%',
  },
  serviceCard: {
    backgroundColor: colors.cardBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    padding: 16,
  },
  serviceNotes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 12,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  loadMoreButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadMoreIconLane: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
  },
  loadMoreLabelLane: {
    flexShrink: 1,
    minWidth: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardDismissArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  addSongModalContent: {
    padding: 0,
    overflow: 'hidden',
  },
  addSongScroll: {
    width: '100%',
  },
  addSongScrollContent: {
    padding: 24,
    paddingBottom: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  songNumberInput: {
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    fontWeight: '700',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  commentInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  songTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  songTypeOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    minHeight: 44,
  },
  songTypeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  songTypeOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  songTypeOptionTextSelected: {
    color: colors.primary,
    fontWeight: '900',
  },
  songTypeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingSongsSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.background + '60',
  },
  pendingSongsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pendingSongsCount: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    textAlign: 'center',
    overflow: 'hidden',
    backgroundColor: colors.primary + '18',
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  pendingSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border + '60',
  },
  pendingSongTextWrap: {
    flex: 1,
  },
  pendingSongDragHandle: {
    width: 24,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingSongMoveControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pendingSongMoveButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
  },
  pendingSongTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pendingSongMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pendingSongMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    minWidth: 0,
  },
  pendingSongMetaLane: {
    flex: 1,
    minWidth: 0,
  },
  pendingSongNumberChip: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pendingSongNumberText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
  },
  pendingSongRemoveButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pendingSongsEmpty: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  queueSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary + '12',
    minHeight: 44,
  },
  queueSongButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  notifySection: {
    marginBottom: 12,
  },
  notifyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  notifyMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    minHeight: 48,
  },
  notifyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyCheckboxSelected: {
    backgroundColor: colors.primary,
  },
  notifyMemberTextWrap: {
    flex: 1,
  },
  notifyMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  notifyMemberRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleStatusNotice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingBottom: 10,
    paddingTop: 8,
  },
  attentionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  attentionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  attentionTitleLane: {
    flex: 1,
    minWidth: 0,
  },
  attentionSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  monthHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  monthTitleLane: {
    flex: 1,
    minWidth: 0,
  },
  monthCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  serviceActionRow: {
    alignItems: 'center',
    borderColor: colors.error + '55',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  serviceActionText: {
    color: colors.error,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  songActionList: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  songActionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  songActionText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveSongActionText: {
    color: colors.error,
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const currentLocalDate = useCurrentLocalDate();
  // ── ALL hooks must be called unconditionally at the top ──────────────────
  const {
    currentChurch,
    members,
    recurringServices,
    churchRoles,
    fillInRequests,
    isAdmin,
    currentMember,
    notificationSettings,
    initializing: churchInitializing,
    sessionStatus,
    sessionError,
    retryChurchSession,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    refreshFillInRequests,
    refreshMembers,
    user,
  } = useChurch();
  const networkState = useNetworkState();

  const {
    services,
    loading: servicesLoading,
    refreshServices,
    deleteService,
    updateAssignment,
    loadManualAssignmentCandidates,
    assignMemberValidated,
    addServiceComment,
    addServiceComments,
    updateServiceComment,
    deleteServiceComment,
    reorderServiceComments,
    reorderingServiceIds,
    notifyServiceComments,
    loadMoreServices,
    serviceRangeError,
    servicePaginationStatus,
    error: servicesError,
  } = useServices(currentChurch?.id ?? null, {
    windowed: true,
    startDate: currentLocalDate.dateKey,
  });

  usePerformanceBaselineScreen(
    'Schedules',
    !churchInitializing && !servicesLoading && !!currentChurch && !!user,
    {
      implementation: 'shared',
      services: services.length,
      members: members.length,
      roles: churchRoles.length,
      recurringServices: recurringServices.length,
      fillInRequests: fillInRequests.length,
    }
  );

  const [manualAssignmentTarget, setManualAssignmentTarget] = useState<ManualAssignmentTarget | null>(null);
  const [deleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [deleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [fillInRequestModalVisible, setFillInRequestModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [serviceActionsTarget, setServiceActionsTarget] = useState<ServiceWithAssignments | null>(null);
  const [songActionsTarget, setSongActionsTarget] = useState<SongActionsTarget | null>(null);
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('all');
  const [scheduleFilters, setScheduleFilters] = useState<ScheduleViewFilters>({
    ...EMPTY_SCHEDULE_VIEW_FILTERS,
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const {
    refreshing,
    refreshError,
    runRefresh,
  } = useRefreshController(currentChurch?.id ?? null);
  const [isCreatingFillInRequest, setIsCreatingFillInRequest] = useState(false);
  const [busyFillInRequestIds, setBusyFillInRequestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const busyFillInRequestIdsRef = useRef(new Set<string>());
  const [isSavingServiceComment, setIsSavingServiceComment] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<{ serviceId: string; assignmentId: string } | null>(null);
  const [selectedCommentService, setSelectedCommentService] = useState<ServiceWithAssignments | null>(null);

  const [fillInReason, setFillInReason] = useState('');
  const [fillInAssignmentId, setFillInAssignmentId] = useState('');
  const [fillInServiceId, setFillInServiceId] = useState('');
  const [fillInRoleName, setFillInRoleName] = useState('');
  const [serviceCommentText, setServiceCommentText] = useState('');
  const [serviceSongType, setServiceSongType] = useState('Opening');
  const [serviceSongOtherType, setServiceSongOtherType] = useState('');
  const [serviceSongNumber, setServiceSongNumber] = useState('');
  const [songNumberFocused, setSongNumberFocused] = useState(false);
  const [editingServiceCommentId, setEditingServiceCommentId] = useState<string | null>(null);
  const [notifyCommentMemberIds, setNotifyCommentMemberIds] = useState<string[]>([]);
  const [pendingServiceSongs, setPendingServiceSongs] = useState<PendingServiceSong[]>([]);

  const enabledSongTypeOptions = useMemo(
    () => normalizeSongTypeOptions(currentChurch?.song_type_options),
    [currentChurch?.song_type_options]
  );

  // ── useEffect hooks (after all useState/useRef/other hooks) ──────────────

  useEffect(() => {
    if (!commentModalVisible || serviceSongType === OTHER_SONG_TYPE_OPTION) return;
    if (!enabledSongTypeOptions.includes(serviceSongType)) {
      setServiceSongType(enabledSongTypeOptions[0] ?? OTHER_SONG_TYPE_OPTION);
    }
  }, [commentModalVisible, enabledSongTypeOptions, serviceSongType]);

  useEffect(() => {
    if (sessionStatus !== 'ready' || !currentChurch?.id) return;
    setViewMode(isAdmin ? 'all' : 'mine');
    setScheduleFilters({ ...EMPTY_SCHEDULE_VIEW_FILTERS });
    setFilterModalVisible(false);
  }, [currentChurch?.id, isAdmin, sessionStatus]);

  const filteredServices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return services.filter(service => {
      const serviceDate = createLocalDate(service.date);
      if (isNaN(serviceDate.getTime())) {
        console.warn('Skipping service with invalid date:', service.date);
        return false;
      }
      return serviceDate >= today;
    });
  }, [services]);

  const sortedRoles = useMemo(() => {
    return [...(churchRoles ?? [])].sort((a, b) => a.display_order - b.display_order);
  }, [churchRoles]);

  const scheduleServiceTypes = useMemo(() => (
    Array.from(new Set(
      filteredServices
        .map(service => service.service_type?.trim())
        .filter((serviceType): serviceType is string => Boolean(serviceType))
    )).sort((left, right) => left.localeCompare(right))
  ), [filteredServices]);

  const pendingFillInRequestsByService = useMemo(() => {
    const grouped = new Map<string, FillInRequestWithMemberInfo[]>();
    fillInRequests.forEach(request => {
      if (request.status !== 'pending') return;
      const requests = grouped.get(request.service_id);
      if (requests) {
        requests.push(request);
      } else {
        grouped.set(request.service_id, [request]);
      }
    });
    return grouped;
  }, [fillInRequests]);

  const memberDisplayNames = useMemo(() => (
    new Map(
      members.map(member => [
        member.id,
        member.name || member.email || 'Member',
      ])
    )
  ), [members]);

  const currentMemberDisplayName = useMemo(
    () => currentMember?.name || currentMember?.email || 'Member',
    [currentMember?.email, currentMember?.name]
  );

  const currentMemberRoleNames = useMemo(
    () => new Set(
      currentMember?.memberRoles.map(role => role.role_name) ?? []
    ),
    [currentMember?.memberRoles]
  );

  const scheduleView = useMemo(() => buildScheduleView({
    services: filteredServices,
    fillInRequests,
    currentMemberId: currentMember?.id ?? null,
    currentMemberRoleNames,
    isAdmin,
    mode: viewMode,
    filters: scheduleFilters,
  }), [
    currentMember?.id,
    currentMemberRoleNames,
    fillInRequests,
    filteredServices,
    isAdmin,
    scheduleFilters,
    viewMode,
  ]);

  const scheduleSections = useMemo(() => buildScheduleSections({
    attentionServices: scheduleView.attentionServices,
    regularServices: scheduleView.regularServices,
  }), [scheduleView.attentionServices, scheduleView.regularServices]);

  const onRefresh = useCallback(() => {
    console.log('User pulled to refresh schedules');
    void runRefresh(async () => {
      await runRefreshBatch([
        refreshServices,
        refreshMembers ?? (async () => {}),
        refreshFillInRequests ?? (async () => {}),
      ]);
      console.log('Refresh completed successfully');
    });
  }, [
    refreshFillInRequests,
    refreshMembers,
    refreshServices,
    runRefresh,
  ]);

  const handleDeleteService = async () => {
    console.log('User confirmed delete service');
    if (!serviceToDelete) return;
    try {
      const success = await deleteService(serviceToDelete);
      if (success) {
        Alert.alert('Success', 'Service deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete service');
      }
    } catch (err) {
      console.error('[HomeScreen.ios] handleDeleteService error:', err);
      Alert.alert('Error', 'Failed to delete service');
    }
    setDeleteServiceModalVisible(false);
    setServiceToDelete(null);
  };

  const handleDeleteAssignment = async () => {
    console.log('User confirmed delete assignment');
    if (!assignmentToDelete) return;
    try {
      const success = await updateAssignment(assignmentToDelete.assignmentId, '', '');
      if (success) {
        Alert.alert('Success', 'Assignment cleared successfully');
      } else {
        Alert.alert('Error', 'Failed to clear assignment');
      }
    } catch (err) {
      console.error('[HomeScreen.ios] handleDeleteAssignment error:', err);
      Alert.alert('Error', 'Failed to clear assignment');
    }
    setDeleteAssignmentModalVisible(false);
    setAssignmentToDelete(null);
  };

  const openDeleteServiceModal = useCallback((serviceId: string) => {
    console.log('User tapped delete service button');
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  }, []);

  const openServiceActions = useCallback((service: ServiceWithAssignments) => {
    setServiceActionsTarget(service);
  }, []);

  const openSongActions = useCallback((
    service: ServiceWithAssignments,
    comment: ServiceWithAssignments['service_comments'][number],
  ) => {
    setSongActionsTarget({ service, comment });
  }, []);

  const openDeleteAssignmentModal = useCallback((serviceId: string, assignmentId: string) => {
    console.log('User tapped delete assignment button');
    setAssignmentToDelete({ serviceId, assignmentId });
    setDeleteAssignmentModalVisible(true);
  }, []);

  const openAssignMemberModal = useCallback((
    assignmentId: string,
    serviceId: string,
    roleName: string,
    assignedMemberId: string | null,
    assignedMemberName: string | null,
  ) => {
    console.log('User tapped assign member button');
    setManualAssignmentTarget({
      assignmentId,
      serviceId,
      roleName,
      assignedMemberName,
      hasAssignedMember: Boolean(assignedMemberId),
    });
  }, []);

  const openFillInRequestModal = useCallback((assignmentId: string, serviceId: string, roleName: string) => {
    console.log('User tapped request fill-in button');
    setFillInAssignmentId(assignmentId);
    setFillInServiceId(serviceId);
    setFillInRoleName(roleName);
    setFillInRequestModalVisible(true);
  }, []);

  const getCommentNotifyOptions = useCallback((service: ServiceWithAssignments | null) => {
    if (!service) return [];

    const seen = new Set<string>();
    return service.assignments
      .filter(assignment => {
        if (!assignment.member_id || assignment.member_id === currentMember?.id || seen.has(assignment.member_id)) {
          return false;
        }
        seen.add(assignment.member_id);
        return true;
      })
      .map(assignment => {
        const member = members.find(m => m.id === assignment.member_id);
        return {
          id: assignment.member_id as string,
          name: assignment.person_name || member?.name || member?.email || 'Assigned member',
          role: assignment.role,
        };
      });
  }, [currentMember?.id, members]);

  const getSongTypeEditState = useCallback((songType?: string | null) => {
    const normalizedType = songType?.trim();
    if (!normalizedType) {
      return { selectedType: enabledSongTypeOptions[0] ?? OTHER_SONG_TYPE_OPTION, customType: '' };
    }
    if (normalizedType === OTHER_SONG_TYPE_OPTION) {
      return { selectedType: OTHER_SONG_TYPE_OPTION, customType: '' };
    }
    if (enabledSongTypeOptions.includes(normalizedType)) {
      return { selectedType: normalizedType, customType: '' };
    }
    return { selectedType: OTHER_SONG_TYPE_OPTION, customType: normalizedType };
  }, [enabledSongTypeOptions]);

  const openCommentModal = useCallback((service: ServiceWithAssignments) => {
    console.log('User tapped add service song button');
    setSelectedCommentService(service);
    setServiceCommentText('');
    setServiceSongType(enabledSongTypeOptions[0] ?? OTHER_SONG_TYPE_OPTION);
    setServiceSongOtherType('');
    setServiceSongNumber('');
    setEditingServiceCommentId(null);
    setNotifyCommentMemberIds([]);
    setPendingServiceSongs([]);
    setCommentModalVisible(true);
  }, [enabledSongTypeOptions]);

  const openEditCommentModal = useCallback((
    service: ServiceWithAssignments,
    comment: ServiceWithAssignments['service_comments'][number]
  ) => {
    console.log('User tapped edit service song button');
    setSelectedCommentService(service);
    setServiceCommentText(comment.comment_text);
    const editSongType = getSongTypeEditState(comment.song_type);
    setServiceSongType(editSongType.selectedType);
    setServiceSongOtherType(editSongType.customType);
    setServiceSongNumber(comment.song_number || '');
    setEditingServiceCommentId(comment.id);
    setNotifyCommentMemberIds([]);
    setPendingServiceSongs([]);
    setCommentModalVisible(true);
  }, [getSongTypeEditState]);

  const closeCommentModal = () => {
    Keyboard.dismiss();
    setCommentModalVisible(false);
    setSelectedCommentService(null);
    setServiceCommentText('');
    setServiceSongType(enabledSongTypeOptions[0] ?? OTHER_SONG_TYPE_OPTION);
    setServiceSongOtherType('');
    setServiceSongNumber('');
    setEditingServiceCommentId(null);
    setNotifyCommentMemberIds([]);
    setPendingServiceSongs([]);
  };

  const toggleNotifyCommentMember = (memberId: string) => {
    setNotifyCommentMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const buildSongDraftFromForm = (): Omit<PendingServiceSong, 'id'> | null => {
    const commentText = serviceCommentText.trim();
    if (!commentText) {
      Alert.alert('Error', 'Please enter a song title or detail.');
      return null;
    }

    const songType = serviceSongType === OTHER_SONG_TYPE_OPTION
      ? serviceSongOtherType.trim()
      : serviceSongType.trim();

    if (!songType) {
      Alert.alert('Error', 'Please describe the song type.');
      return null;
    }

    return {
      commentText,
      songType,
      songNumber: serviceSongNumber.trim(),
    };
  };

  const hasSongDraftInForm = () => (
    serviceCommentText.trim().length > 0
    || serviceSongNumber.trim().length > 0
    || (serviceSongType === OTHER_SONG_TYPE_OPTION && serviceSongOtherType.trim().length > 0)
  );

  const resetSongFormFields = () => {
    setServiceCommentText('');
    setServiceSongNumber('');
    if (serviceSongType === OTHER_SONG_TYPE_OPTION) {
      setServiceSongOtherType('');
    }
  };

  const handleQueueServiceSong = () => {
    if (editingServiceCommentId) return;

    const draft = buildSongDraftFromForm();
    if (!draft) return;

    setPendingServiceSongs(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...draft,
      },
    ]);
    resetSongFormFields();
    AccessibilityInfo.announceForAccessibility(
      `${draft.commentText} added to the song list`,
    );
  };

  const handleRemovePendingServiceSong = (songId: string) => {
    const removedSong = pendingServiceSongs.find(song => song.id === songId);
    setPendingServiceSongs(prev => prev.filter(song => song.id !== songId));
    if (removedSong) {
      AccessibilityInfo.announceForAccessibility(
        `${removedSong.commentText} removed from the song list`,
      );
    }
  };

  const handleMovePendingServiceSong = (songId: string, direction: -1 | 1) => {
    const currentIndex = pendingServiceSongs.findIndex(song => song.id === songId);
    const nextIndex = Math.max(
      0,
      Math.min(pendingServiceSongs.length - 1, currentIndex + direction),
    );
    setPendingServiceSongs(previous => (
      moveItemById(previous, songId, direction)
    ));
    const movedSong = pendingServiceSongs[currentIndex];
    if (movedSong && currentIndex !== nextIndex) {
      AccessibilityInfo.announceForAccessibility(
        `${movedSong.commentText} moved to position ${nextIndex + 1}`,
      );
    }
  };

  const handleReorderServiceSongs = useCallback(async (
    serviceId: string,
    orderedCommentIds: string[]
  ) => {
    const success = await reorderServiceComments(serviceId, orderedCommentIds);
    if (!success) {
      Alert.alert(
        'Could Not Reorder Songs',
        'The song list may have changed on another device. Refresh and try again.'
      );
    }
    return success;
  }, [reorderServiceComments]);

  const handleAddServiceComment = async () => {
    if (isSavingServiceComment) return;

    if (!currentChurch || !currentMember || !selectedCommentService) {
      Alert.alert('Error', 'Missing service information. Please try again.');
      return;
    }

    const currentDraft = hasSongDraftInForm() || editingServiceCommentId
      ? buildSongDraftFromForm()
      : null;
    if ((hasSongDraftInForm() || editingServiceCommentId) && !currentDraft) return;

    const songsToSave = editingServiceCommentId
      ? currentDraft
        ? [{ id: editingServiceCommentId, ...currentDraft }]
        : []
      : [
        ...pendingServiceSongs,
        ...(currentDraft ? [{ id: 'current', ...currentDraft }] : []),
      ];

    if (songsToSave.length === 0) {
      Alert.alert('Error', 'Please add at least one song before posting.');
      return;
    }

    Keyboard.dismiss();
    setIsSavingServiceComment(true);
    try {
      if (editingServiceCommentId) {
        const song = songsToSave[0];
        const result = await updateServiceComment(
          editingServiceCommentId,
          selectedCommentService.id,
          song.commentText,
          song.songType,
          song.songNumber,
        );
        if (!result) {
          Alert.alert('Error', 'Failed to save song. Please try again.');
          return;
        }
      } else {
        let notificationsSent = true;
        const savedComments = await addServiceComments(
          currentChurch.id,
          selectedCommentService.id,
          currentMember.id,
          songsToSave.map(song => ({
            commentText: song.commentText,
            songType: song.songType,
            songNumber: song.songNumber,
          }))
        );
        if (!savedComments || savedComments.length !== songsToSave.length) {
          Alert.alert('Error', 'Failed to save every song. Please try again.');
          return;
        }

        if (notifyCommentMemberIds.length > 0) {
          notificationsSent = await notifyServiceComments(
            savedComments.map(comment => comment.id),
            notifyCommentMemberIds
          );
        }

        if (!notificationsSent) {
          Alert.alert('Partial Success', 'Songs were added, but notifications could not be sent.');
          closeCommentModal();
          return;
        }
      }

      Alert.alert(
        'Success',
        editingServiceCommentId
          ? 'Song updated.'
          : notifyCommentMemberIds.length > 0
            ? `${songsToSave.length === 1 ? 'Song' : 'Songs'} added and selected members were notified.`
            : `${songsToSave.length === 1 ? 'Song' : 'Songs'} added.`
      );
      closeCommentModal();
    } catch (error) {
      console.error('Error saving service song:', error);
      Alert.alert('Error', 'Failed to save song. Please try again.');
    } finally {
      setIsSavingServiceComment(false);
    }
  };

  const handleDeleteServiceComment = useCallback((
    serviceId: string,
    commentId: string,
  ) => {
    Alert.alert(
      'Delete Song',
      'Remove this song from the service?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteServiceComment(commentId, serviceId);
            if (success) {
              Alert.alert('Success', 'Song deleted.');
            } else {
              Alert.alert('Error', 'Failed to delete song. Please try again.');
            }
          },
        },
      ],
    );
  }, [deleteServiceComment]);

  const handleCreateFillInRequest = async () => {
    console.log('User submitted fill-in request');
    if (isCreatingFillInRequest) {
      console.log('Fill-in request already in progress, ignoring duplicate tap');
      return;
    }
    if (!currentChurch || !currentMember || !fillInAssignmentId) {
      console.error('Missing required information for fill-in request:', {
        hasChurch: !!currentChurch,
        hasMember: !!currentMember,
        hasAssignmentId: !!fillInAssignmentId,
      });
      Alert.alert('Error', 'Missing required information. Please try again.');
      return;
    }

    setIsCreatingFillInRequest(true);
    console.log('Creating fill-in request with data:', {
      assignmentId: fillInAssignmentId,
      serviceId: fillInServiceId,
      churchId: currentChurch.id,
      memberId: currentMember.id,
      roleName: fillInRoleName,
      reason: fillInReason || '(no reason provided)',
    });

    try {
      const result = await createFillInRequest(
        fillInAssignmentId,
        fillInServiceId,
        currentChurch.id,
        currentMember.id,
        fillInRoleName,
        fillInReason || undefined
      );

      if (result) {
        console.log('Fill-in request created successfully');
        Alert.alert(
          'Success',
          'Fill-in request created successfully. Members with the same role will be notified.',
          [{ text: 'OK' }]
        );
        setFillInRequestModalVisible(false);
        setFillInReason('');
        setFillInAssignmentId('');
        setFillInServiceId('');
        setFillInRoleName('');
      } else {
        console.error('Fill-in request creation returned false');
        Alert.alert('Error', 'Failed to create fill-in request. Please check your connection and try again.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Exception during fill-in request creation:', error);
      if (error instanceof Error) console.error('Error message:', error.message);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsCreatingFillInRequest(false);
    }
  };

  const handleAcceptFillInRequest = useCallback(async (requestId: string, assignmentId: string) => {
    console.log('User accepted fill-in request');
    if (
      !currentChurch
      || !currentMember
      || busyFillInRequestIdsRef.current.has(requestId)
    ) return;
    busyFillInRequestIdsRef.current.add(requestId);
    setBusyFillInRequestIds(new Set(busyFillInRequestIdsRef.current));
    try {
      const success = await acceptFillInRequest(requestId, currentMember.id, currentChurch.id);
      if (success) {
        Alert.alert('Success', 'You have accepted the fill-in request and been assigned to this role');
      } else {
        Alert.alert('Error', 'Failed to accept fill-in request');
      }
    } catch (err) {
      console.error('[HomeScreen.ios] handleAcceptFillInRequest error:', err);
      Alert.alert('Error', 'Failed to accept fill-in request');
    } finally {
      busyFillInRequestIdsRef.current.delete(requestId);
      setBusyFillInRequestIds(new Set(busyFillInRequestIdsRef.current));
    }
  }, [acceptFillInRequest, currentChurch, currentMember]);

  const handleCancelFillInRequest = useCallback(async (requestId: string) => {
    console.log('User cancelled fill-in request');
    if (!currentChurch || busyFillInRequestIdsRef.current.has(requestId)) return;
    busyFillInRequestIdsRef.current.add(requestId);
    setBusyFillInRequestIds(new Set(busyFillInRequestIdsRef.current));
    try {
      const success = await cancelFillInRequest(requestId, currentChurch.id);
      if (success) {
        Alert.alert('Success', 'Fill-in request cancelled');
      } else {
        Alert.alert('Error', 'Failed to cancel fill-in request');
      }
    } catch (err) {
      console.error('[HomeScreen.ios] handleCancelFillInRequest error:', err);
      Alert.alert('Error', 'Failed to cancel fill-in request');
    } finally {
      busyFillInRequestIdsRef.current.delete(requestId);
      setBusyFillInRequestIds(new Set(busyFillInRequestIdsRef.current));
    }
  }, [cancelFillInRequest, currentChurch]);

  const churchName = currentChurch?.name ?? 'Schedule';
  const upcomingCount = filteredServices.length;
  const activeFilterCount = countActiveScheduleViewFilters(scheduleFilters);
  const isOffline = networkState.isConnected === false
    || networkState.isInternetReachable === false;
  const setupIncomplete = churchRoles.length === 0 || recurringServices.length === 0;
  const visibleServiceCount = scheduleView.attentionServices.length
    + scheduleView.regularServices.length;
  const listState = resolveScheduleListState({
    activeFilterCount,
    hasCachedServices: filteredServices.length > 0,
    isAdmin,
    isOffline,
    setupIncomplete,
    serviceRangeError,
    viewMode,
    visibleServiceCount,
  });
  const upcomingText = viewMode === 'mine'
    ? `${scheduleView.personalServiceCount} assigned`
    : `${upcomingCount} services`;
  const scheduleSummaryLabel = viewMode === 'mine' ? 'My services' : 'Upcoming';
  const todayHeaderText = formatScheduleTodayText(currentLocalDate);
  const themedScheduleCardStyles = useMemo(() => ({
    serviceCard: [
      styles.serviceCard,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.borderSubtle,
        boxShadow: theme.elevation.low,
      },
    ],
    serviceNotes: [
      styles.serviceNotes,
      {
        borderLeftColor: theme.colors.accent,
        color: theme.colors.textSecondary,
      },
    ],
  }), [theme]);

  const renderScheduleService = useCallback(
    ({ item: service }: { item: ServiceWithAssignments }) => (
      <ScheduleServiceCard
        service={service}
        pendingFillInRequests={
          pendingFillInRequestsByService.get(service.id)
          ?? EMPTY_FILL_IN_REQUESTS
        }
        sortedRoles={sortedRoles}
        memberDisplayNames={memberDisplayNames}
        currentMemberId={currentMember?.id ?? null}
        currentMemberDisplayName={currentMemberDisplayName}
        currentMemberRoleNames={currentMemberRoleNames}
        isAdmin={isAdmin}
        isCreatingFillInRequest={isCreatingFillInRequest}
        busyFillInRequestIds={busyFillInRequestIds}
        isReorderingSongs={reorderingServiceIds.has(service.id)}
        styles={themedScheduleCardStyles}
        onOpenServiceActions={openServiceActions}
        onAddSong={openCommentModal}
        onEditSong={openEditCommentModal}
        onOpenSongActions={openSongActions}
        onReorderSongs={handleReorderServiceSongs}
        onAcceptFillIn={handleAcceptFillInRequest}
        onCancelFillIn={handleCancelFillInRequest}
        onRequestFillIn={openFillInRequestModal}
        onAssignMember={openAssignMemberModal}
      />
    ),
    [
      currentMember?.id,
      currentMemberDisplayName,
      currentMemberRoleNames,
      busyFillInRequestIds,
      handleAcceptFillInRequest,
      handleCancelFillInRequest,
      handleReorderServiceSongs,
      isAdmin,
      isCreatingFillInRequest,
      memberDisplayNames,
      openAssignMemberModal,
      openCommentModal,
      openServiceActions,
      openEditCommentModal,
      openFillInRequestModal,
      openSongActions,
      pendingFillInRequestsByService,
      reorderingServiceIds,
      sortedRoles,
      themedScheduleCardStyles,
    ]
  );

  if (user && sessionStatus === 'no-membership') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          actions={[{
            accessibilityHint: 'Opens options to join or create a church.',
            label: 'Review Church Access',
            onPress: () => router.replace('/no-membership'),
          }]}
          androidIcon="domain-disabled"
          iosIcon="building.2.crop.circle"
          message="This account is no longer connected to an active church membership."
          title="Church access changed"
        />
      </>
    );
  }

  if (user && sessionStatus === 'error' && !currentMember) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          actions={[{
            accessibilityHint: 'Retries loading the current church membership and schedule.',
            label: 'Try Again',
            onPress: () => {
              void retryChurchSession();
            },
          }]}
          androidIcon="sync-problem"
          iconTone="error"
          iosIcon="exclamationmark.arrow.triangle.2.circlepath"
          message={sessionError || 'Your church membership could not be loaded.'}
          title="Schedule unavailable"
        />
      </>
    );
  }

  if (
    !user
    || servicesLoading
    || shouldShowInitialLoader(
      churchInitializing,
      Boolean(currentChurch && currentMember),
    )
  ) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          loading
          message="Getting your church services and assignments ready."
          title="Loading Schedule"
        />
      </>
    );
  }

  if (!currentChurch || !currentMember) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          actions={[{
            label: 'Try Again',
            onPress: () => {
              void retryChurchSession();
            },
          }]}
          androidIcon="sync-problem"
          iconTone="error"
          iosIcon="exclamationmark.arrow.triangle.2.circlepath"
          message="The selected church membership is incomplete. Reload it before opening the schedule."
          title="Schedule needs to reload"
        />
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ResponsiveTabHeader
        density="compact"
        eyebrow={todayHeaderText}
        title={churchName}
        titleVariant="primaryTitle"
        trailingWidth={HEADER_ACTION_LANE_WIDTHS.bell}
        accessibilityTitle={`Schedule for ${churchName}`}
        trailing={<NotificationBell />}
      >
        <TabHeaderPill
          icon={<IconSymbol ios_icon_name="calendar.badge.clock" android_material_icon_name="event" size={16} color="#FFFFFF" />}
          accessibilityLabel={`${scheduleSummaryLabel}, ${upcomingText}`}
          label={scheduleSummaryLabel}
          detail={upcomingText}
        />
      </ResponsiveTabHeader>

      <ScheduleViewControls
        activeFilterCount={activeFilterCount}
        mode={viewMode}
        onChange={setViewMode}
        onOpenFilters={() => setFilterModalVisible(true)}
      />

      <RefreshErrorNotice message={refreshError} />

      {isOffline && services.length > 0 ? (
        <View style={styles.scheduleStatusNotice}>
          <InlineStatus
            message="You're offline. Showing the schedule saved on this device."
          />
        </View>
      ) : serviceRangeError && services.length > 0 ? (
        <RefreshErrorNotice message="The next service range could not load. Your saved schedule is still available." />
      ) : null}

      <NotificationPermissionOnboarding scheduleReady />

      <SectionList
        accessibilityLabel={`${viewMode === 'mine' ? 'My upcoming services' : 'All upcoming services'}, ${visibleServiceCount}`}
        style={[styles.container, { backgroundColor: theme.colors.canvas }]}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        sections={scheduleSections}
        keyExtractor={service => service.id}
        stickySectionHeadersEnabled
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        renderSectionHeader={({ section }) => (
          <View
            accessibilityLabel={section.kind === 'attention'
              ? `${section.title}. Fill-in requests you can act on or need to track. ${section.data.length} ${section.data.length === 1 ? 'service' : 'services'}`
              : `${section.title}. ${section.data.length} ${section.data.length === 1 ? 'service' : 'services'}`}
            accessibilityRole="header"
            accessible
            style={[styles.sectionHeader, { backgroundColor: theme.colors.canvas }]}
          >
            {section.kind === 'attention' ? (
              <>
                <View style={styles.attentionHeader}>
                  <IconSymbol
                    ios_icon_name="exclamationmark.bubble.fill"
                    android_material_icon_name="notification-important"
                    size={20}
                    color={theme.status.warning.foreground}
                  />
                  <ResponsiveText
                    accessible={false}
                    style={styles.attentionTitleLane}
                    text={section.title}
                    textStyle={[styles.attentionTitle, { color: theme.colors.textPrimary }]}
                    variant="monthLabel"
                  />
                </View>
                <Text accessible={false} style={[styles.attentionSummary, { color: theme.colors.textSecondary }]}>
                  Fill-in requests you can act on or need to track.
                </Text>
              </>
            ) : (
              <View style={styles.monthHeader}>
                <ResponsiveText
                  accessible={false}
                  style={styles.monthTitleLane}
                  text={section.title}
                  textStyle={[styles.monthTitle, { color: theme.colors.textPrimary }]}
                  variant="monthLabel"
                />
                <Text accessible={false} style={[styles.monthCount, { color: theme.colors.textSecondary }]}>
                  {section.data.length} {section.data.length === 1 ? 'service' : 'services'}
                </Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={(
          <ScheduleEmptyState
            kind={listState}
            loadError={servicesError}
            onClearFilters={() => setScheduleFilters({ ...EMPTY_SCHEDULE_VIEW_FILTERS })}
            onFinishSetup={() => router.push('/(tabs)/church')}
            onRetryRange={loadMoreServices}
            onShowAll={() => setViewMode('all')}
          />
        )}
        renderItem={renderScheduleService}
        ListFooterComponent={listState === 'content' || listState === 'no-services' ? (
          <SchedulePaginationFooter
            onPress={loadMoreServices}
            status={servicePaginationStatus}
          />
        ) : null}
      />

      <ScheduleFilterModal
        filters={scheduleFilters}
        onApply={nextFilters => {
          setScheduleFilters(nextFilters);
          setFilterModalVisible(false);
        }}
        onClose={() => setFilterModalVisible(false)}
        roleNames={sortedRoles.map(role => role.name)}
        serviceTypes={scheduleServiceTypes}
        visible={filterModalVisible}
      />

        <AppModal
          visible={commentModalVisible}
          title={editingServiceCommentId ? 'Edit Song' : 'Add Song'}
          onClose={closeCommentModal}
          variant="tall-form"
          maxWidth={520}
          headerIcon={<IconSymbol ios_icon_name="music.note.list" android_material_icon_name="queue-music" size={22} color={theme.modalHeader.accent} />}
          busy={isSavingServiceComment}
          secondaryAction={{
            label: 'Cancel',
            onPress: closeCommentModal,
            disabled: isSavingServiceComment,
          }}
          primaryAction={{
            label: editingServiceCommentId
              ? 'Update'
              : pendingServiceSongs.length + (hasSongDraftInForm() ? 1 : 0) > 1
                ? `Post ${pendingServiceSongs.length + (hasSongDraftInForm() ? 1 : 0)} Songs`
                : 'Post Song',
            onPress: handleAddServiceComment,
            disabled: isSavingServiceComment,
            loading: isSavingServiceComment,
          }}
          testID="service-song-modal"
        >
                  <View style={styles.songTypeLabelRow}>
                    <Text style={styles.notifyTitle}>Song type</Text>
                  </View>
                  <View style={styles.songTypeGrid}>
                    {enabledSongTypeOptions.map(option => {
                      const selected = serviceSongType === option;
                      return (
                        <TouchableOpacity
                          accessibilityHint={`Sets the song type to ${option}`}
                          accessibilityLabel={option}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={option}
                          style={[styles.songTypeOption, selected && styles.songTypeOptionSelected]}
                          onPress={() => setServiceSongType(option)}
                        >
                          <Text style={[styles.songTypeOptionText, selected && styles.songTypeOptionTextSelected]}>
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {serviceSongType === OTHER_SONG_TYPE_OPTION ? (
                    <TextInput
                      accessibilityLabel="Describe other song type"
                      style={styles.input}
                      placeholder="Describe song type"
                      placeholderTextColor={colors.textSecondary}
                      value={serviceSongOtherType}
                      onChangeText={setServiceSongOtherType}
                      maxLength={40}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  ) : null}
                  <TextInput
                    accessibilityLabel="Song number, optional"
                    style={[
                      styles.input,
                      styles.songNumberInput,
                      songNumberFocused && {
                        backgroundColor: theme.inputHighlight.surface,
                        borderColor: theme.inputHighlight.border,
                        color: theme.inputHighlight.foreground,
                      },
                    ]}
                    placeholder="Song number (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={serviceSongNumber}
                    onChangeText={setServiceSongNumber}
                    onBlur={() => setSongNumberFocused(false)}
                    onFocus={() => setSongNumberFocused(true)}
                    keyboardType="default"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <TextInput
                    accessibilityLabel="Song title or details"
                    style={[styles.input, styles.commentInput]}
                    placeholder="Song title or details"
                    placeholderTextColor={colors.textSecondary}
                    value={serviceCommentText}
                    onChangeText={setServiceCommentText}
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  {!editingServiceCommentId && (
                    <View style={styles.pendingSongsSection}>
                      <View style={styles.pendingSongsHeader}>
                        <Text style={styles.notifyTitle}>Songs to post</Text>
                        <Text style={styles.pendingSongsCount}>{pendingServiceSongs.length}</Text>
                      </View>
                      {pendingServiceSongs.length > 0 ? (
                        pendingServiceSongs.map((song, songIndex) => (
                          <View key={song.id} style={styles.pendingSongItem}>
                            <View
                              style={styles.pendingSongDragHandle}
                              accessible={false}
                            >
                              <IconSymbol ios_icon_name="line.3.horizontal" android_material_icon_name="drag-handle" size={19} color={colors.textSecondary} />
                            </View>
                            <View style={styles.pendingSongTextWrap}>
                              <ResponsiveText
                                text={song.commentText}
                                textStyle={styles.pendingSongTitle}
                                variant="songTitle"
                              />
                              <View style={styles.pendingSongMetaRow}>
                                {song.songNumber ? (
                                  <View
                                    style={[
                                      styles.pendingSongNumberChip,
                                      {
                                        backgroundColor: theme.status.info.surface,
                                        borderColor: theme.status.info.border,
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.pendingSongNumberText, { color: theme.status.info.foreground }]}>
                                      #{song.songNumber}
                                    </Text>
                                  </View>
                                ) : null}
                                <ResponsiveText
                                  style={styles.pendingSongMetaLane}
                                  text={song.songType}
                                  textStyle={styles.pendingSongMeta}
                                  variant="supportingCopy"
                                />
                              </View>
                            </View>
                            <View style={styles.pendingSongMoveControls}>
                              <TouchableOpacity
                                style={[
                                  styles.pendingSongMoveButton,
                                  songIndex === 0 ? { opacity: 0.35 } : null,
                                ]}
                                onPress={() => handleMovePendingServiceSong(song.id, -1)}
                                disabled={songIndex === 0}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${song.commentText} up`}
                                accessibilityState={{ disabled: songIndex === 0 }}
                              >
                                <IconSymbol ios_icon_name="arrow.up" android_material_icon_name="keyboard-arrow-up" size={19} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.pendingSongMoveButton,
                                  songIndex === pendingServiceSongs.length - 1
                                    ? { opacity: 0.35 }
                                    : null,
                                ]}
                                onPress={() => handleMovePendingServiceSong(song.id, 1)}
                                disabled={songIndex === pendingServiceSongs.length - 1}
                                accessibilityRole="button"
                                accessibilityLabel={`Move ${song.commentText} down`}
                                accessibilityState={{
                                  disabled: songIndex === pendingServiceSongs.length - 1,
                                }}
                              >
                                <IconSymbol ios_icon_name="arrow.down" android_material_icon_name="keyboard-arrow-down" size={19} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                              accessibilityHint="Removes this song from the list before posting"
                              accessibilityRole="button"
                              style={styles.pendingSongRemoveButton}
                              onPress={() => handleRemovePendingServiceSong(song.id)}
                              accessibilityLabel={`Remove ${song.commentText}`}
                            >
                              <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.pendingSongsEmpty}>Add songs here before posting them together.</Text>
                      )}
                      <TouchableOpacity
                        accessibilityHint="Adds the current song fields to the pending song list"
                        accessibilityLabel="Add song to list"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isSavingServiceComment }}
                        style={styles.queueSongButton}
                        onPress={handleQueueServiceSong}
                        disabled={isSavingServiceComment}
                      >
                        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={16} color={colors.primary} />
                        <Text style={styles.queueSongButtonText}>Add Song to List</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!editingServiceCommentId && getCommentNotifyOptions(selectedCommentService).length > 0 && (
                    <View style={styles.notifySection}>
                      <Text style={styles.notifyTitle}>Notify assigned members</Text>
                      {getCommentNotifyOptions(selectedCommentService).map(option => {
                    const selected = notifyCommentMemberIds.includes(option.id);
                    return (
                      <TouchableOpacity
                        accessibilityHint={selected
                          ? `Stops notifying ${option.name}`
                          : `Notifies ${option.name} when these songs are posted`}
                        accessibilityLabel={`${option.name}, ${option.role}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        key={option.id}
                        style={styles.notifyMemberRow}
                        onPress={() => toggleNotifyCommentMember(option.id)}
                      >
                        <View style={[
                          styles.notifyCheckbox,
                          selected && styles.notifyCheckboxSelected,
                        ]}>
                          {selected && (
                            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="done" size={14} color="#fff" />
                          )}
                        </View>
                        <View style={styles.notifyMemberTextWrap}>
                          <ResponsiveText
                            text={option.name}
                            textStyle={styles.notifyMemberName}
                            variant="memberName"
                          />
                          <ResponsiveText
                            text={option.role}
                            textStyle={styles.notifyMemberRole}
                            variant="roleName"
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                    </View>
                  )}

        </AppModal>

      <AppModal
        visible={fillInRequestModalVisible}
        title="Request Fill-In"
        subtitle={(
          <ResponsiveText
            text={`Role: ${fillInRoleName}`}
            textStyle={{ color: theme.modalHeader.mutedForeground, textAlign: 'left' }}
            variant="roleName"
          />
        )}
        onClose={() => setFillInRequestModalVisible(false)}
        variant="form"
        maxWidth={460}
        headerIcon={<IconSymbol ios_icon_name="person.crop.circle.badge.questionmark" android_material_icon_name="person-search" size={22} color={theme.modalHeader.accent} />}
        busy={isCreatingFillInRequest}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => {
            setFillInRequestModalVisible(false);
            setFillInReason('');
          },
          disabled: isCreatingFillInRequest,
        }}
        primaryAction={{
          label: 'Request',
          onPress: handleCreateFillInRequest,
          disabled: isCreatingFillInRequest,
          loading: isCreatingFillInRequest,
        }}
        testID="fill-in-request-modal"
      >
        <TextInput
          accessibilityLabel="Fill-in request reason, optional"
          style={[styles.input, styles.textArea]}
          placeholder="Reason (optional)"
          placeholderTextColor={colors.textSecondary}
          value={fillInReason}
          onChangeText={setFillInReason}
          multiline
        />
      </AppModal>

      <ManualAssignmentModal
        accountId={user?.id ?? null}
        churchId={currentChurch?.id ?? null}
        target={manualAssignmentTarget}
        visible={manualAssignmentTarget !== null}
        loadCandidates={loadManualAssignmentCandidates}
        onAssign={assignMemberValidated}
        onClear={openDeleteAssignmentModal}
        onClose={() => setManualAssignmentTarget(null)}
      />

      <AppModal
        onClose={() => setServiceActionsTarget(null)}
        secondaryAction={{
          label: 'Close',
          onPress: () => setServiceActionsTarget(null),
        }}
        subtitle={serviceActionsTarget
          ? `${serviceActionsTarget.service_type} - ${createLocalDate(serviceActionsTarget.date).toLocaleDateString()}`
          : undefined}
        title="Service Actions"
        variant="confirmation"
        visible={serviceActionsTarget !== null}
      >
        <TouchableOpacity
          accessibilityLabel="Delete service"
          accessibilityHint="Opens a confirmation before deleting this service"
          accessibilityRole="button"
          onPress={() => {
            const serviceId = serviceActionsTarget?.id;
            setServiceActionsTarget(null);
            if (serviceId) openDeleteServiceModal(serviceId);
          }}
          style={styles.serviceActionRow}
        >
          <IconSymbol
            android_material_icon_name="delete-outline"
            color={colors.error}
            ios_icon_name="trash"
            size={21}
          />
          <Text style={styles.serviceActionText}>Delete Service</Text>
          <IconSymbol
            android_material_icon_name="chevron-right"
            color={colors.textSecondary}
            ios_icon_name="chevron.right"
            size={20}
          />
        </TouchableOpacity>
      </AppModal>

      <AppModal
        onClose={() => setSongActionsTarget(null)}
        secondaryAction={{
          label: 'Close',
          onPress: () => setSongActionsTarget(null),
        }}
        subtitle={songActionsTarget
          ? [
            songActionsTarget.comment.song_type || 'Song',
            songActionsTarget.comment.song_number
              ? `#${songActionsTarget.comment.song_number}`
              : null,
          ].filter(Boolean).join(' - ')
          : undefined}
        title="Song Actions"
        variant="confirmation"
        visible={songActionsTarget !== null}
      >
        <View style={styles.songActionList}>
          <TouchableOpacity
            accessibilityHint="Opens this song in the edit form"
            accessibilityLabel="Edit song"
            accessibilityRole="button"
            onPress={() => {
              const target = songActionsTarget;
              setSongActionsTarget(null);
              if (target) openEditCommentModal(target.service, target.comment);
            }}
            style={styles.songActionRow}
          >
            <IconSymbol
              android_material_icon_name="edit"
              color={colors.primary}
              ios_icon_name="pencil"
              size={20}
            />
            <Text style={styles.songActionText}>Edit Song</Text>
            <IconSymbol
              android_material_icon_name="chevron-right"
              color={colors.textSecondary}
              ios_icon_name="chevron.right"
              size={20}
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Delete song"
            accessibilityHint="Opens a confirmation before deleting this song"
            accessibilityRole="button"
            onPress={() => {
              const target = songActionsTarget;
              setSongActionsTarget(null);
              if (target) {
                handleDeleteServiceComment(target.service.id, target.comment.id);
              }
            }}
            style={styles.songActionRow}
          >
            <IconSymbol
              android_material_icon_name="delete-outline"
              color={colors.error}
              ios_icon_name="trash"
              size={20}
            />
            <Text style={[styles.songActionText, styles.destructiveSongActionText]}>
              Delete Song
            </Text>
            <IconSymbol
              android_material_icon_name="chevron-right"
              color={colors.textSecondary}
              ios_icon_name="chevron.right"
              size={20}
            />
          </TouchableOpacity>
        </View>
      </AppModal>

      <AppModal
        visible={deleteServiceModalVisible}
        title="Delete Service"
        onClose={() => setDeleteServiceModalVisible(false)}
        variant="confirmation"
        maxWidth={440}
        headerIcon={<IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={22} color={theme.status.error.foreground} />}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => {
            setDeleteServiceModalVisible(false);
            setServiceToDelete(null);
          },
        }}
        primaryAction={{
          label: 'Delete',
          onPress: handleDeleteService,
          destructive: true,
        }}
      >
        <Text style={{ color: colors.textSecondary }}>
          Are you sure you want to delete this service?
        </Text>
      </AppModal>

      <AppModal
        visible={deleteAssignmentModalVisible}
        title="Clear Assignment"
        onClose={() => setDeleteAssignmentModalVisible(false)}
        variant="confirmation"
        maxWidth={440}
        headerIcon={<IconSymbol ios_icon_name="person.crop.circle.badge.minus" android_material_icon_name="person-remove" size={22} color={theme.status.error.foreground} />}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => {
            setDeleteAssignmentModalVisible(false);
            setAssignmentToDelete(null);
          },
        }}
        primaryAction={{
          label: 'Clear',
          onPress: handleDeleteAssignment,
          destructive: true,
        }}
      >
        <Text style={{ color: colors.textSecondary }}>
          Are you sure you want to clear this assignment?
        </Text>
      </AppModal>
    </View>
  );
}
