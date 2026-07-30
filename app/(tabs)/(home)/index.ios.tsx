
import { useChurch } from '@/hooks/useChurch';
import type { FillInRequestWithMemberInfo } from '@/contexts/ChurchContext';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Stack } from 'expo-router';
import { useServices, type ServiceWithAssignments } from '@/hooks/useServices';
import { usePerformanceBaselineScreen } from '@/hooks/usePerformanceBaselineScreen';
import { moveItemById } from '@/lib/services/song-order';
import { IconSymbol } from '@/components/IconSymbol';
import { NotificationBell } from "@/components/NotificationBell";
import {
  NotificationPermissionOnboarding,
} from '@/components/notifications/NotificationPermissionOnboarding';
import {
  ResponsiveTabHeader,
  TabHeaderMetaText,
  TabHeaderPill,
} from '@/components/navigation/responsive-tab-header';
import { ScheduleServiceCard } from '@/components/schedules/schedule-service-card';
import { RefreshErrorNotice } from '@/components/RefreshErrorNotice';
import { useRefreshController } from '@/hooks/useRefreshController';
import {
  runRefreshBatch,
  shouldShowInitialLoader,
} from '@/lib/query/refresh-coordinator';
import { HEADER_ACTION_LANE_WIDTHS } from '@/lib/ui/header-typography';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  serviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '30',
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    letterSpacing: 0.5,
  },
  serviceDateTime: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  serviceNotes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 16,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
    paddingTop: 12,
    marginBottom: 12,
  },
  commentsHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  reorderSongsButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '45',
    backgroundColor: colors.primary + '10',
  },
  reorderSongsButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  commentItem: {
    backgroundColor: colors.background + '40',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  songDragHandle: {
    width: 24,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songReorderControls: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  songMoveButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
  },
  songTypeBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  songTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  songNumberBadge: {
    backgroundColor: colors.accent + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  songNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  editSongButton: {
    padding: 4,
  },
  songActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  commentDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  commentText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
    fontWeight: '600',
  },
  addCommentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.primary + '12',
    marginBottom: 12,
  },
  addCommentButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
    backgroundColor: colors.background + '30',
    borderRadius: 8,
    marginBottom: 8,
  },
  roleNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    minWidth: 80,
    maxWidth: 140,
  },
  personText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
    marginRight: 8,
    fontWeight: '500',
  },
  emptySlot: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  deleteButton: {
    padding: 4,
  },
  loadMoreButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
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
    width: 34,
    height: 34,
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
    marginTop: 2,
  },
  pendingSongRemoveButton: {
    padding: 6,
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
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  assignButton: {
    padding: 4,
    marginLeft: 8,
  },
  fillInButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  fillInButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fillInRequestCard: {
    backgroundColor: colors.accent + '15',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  fillInRequestText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 6,
    fontWeight: '500',
  },
  fillInRequestButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  fillInAcceptButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  fillInCancelButton: {
    backgroundColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fillInButtonTextSmall: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  memberItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberItemText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default function HomeScreen() {
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
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    refreshFillInRequests,
    refreshMembers,
    user,
  } = useChurch();

  const {
    services,
    loading: servicesLoading,
    refreshServices,
    deleteService,
    updateAssignment,
    addServiceComment,
    addServiceComments,
    updateServiceComment,
    deleteServiceComment,
    reorderServiceComments,
    reorderingServiceIds,
    notifyServiceComments,
    loadMoreServices,
    loadingMoreServices,
    serviceRangeError,
    loadedThrough,
    serviceWindowDays,
  } = useServices(currentChurch?.id ?? null, { windowed: true });

  usePerformanceBaselineScreen(
    'Schedules',
    !churchInitializing && !servicesLoading && !!currentChurch && !!user,
    {
      implementation: 'ios',
      services: services.length,
      members: members.length,
      roles: churchRoles.length,
      recurringServices: recurringServices.length,
      fillInRequests: fillInRequests.length,
    }
  );

  const [assignMemberModalVisible, setAssignMemberModalVisible] = useState(false);
  const [deleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [deleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [fillInRequestModalVisible, setFillInRequestModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const {
    refreshing,
    refreshError,
    runRefresh,
  } = useRefreshController(currentChurch?.id ?? null);
  const [isCreatingFillInRequest, setIsCreatingFillInRequest] = useState(false);
  const [isSavingServiceComment, setIsSavingServiceComment] = useState(false);
  const [isAssigningMember, setIsAssigningMember] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
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

  const handleAssignMember = async () => {
    console.log('User tapped assign member button');
    if (isAssigningMember) return;
    if (!selectedAssignment || !selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }
    const member = members.find(m => m.id === selectedMemberId);
    if (!member) {
      Alert.alert('Error', 'Member not found');
      return;
    }
    const personName = member.name || member.email;
    setIsAssigningMember(true);
    try {
      const success = await updateAssignment(selectedAssignment, selectedMemberId, personName);
      if (success) {
        Alert.alert('Success', 'Member assigned successfully');
        setAssignMemberModalVisible(false);
        setSelectedAssignment(null);
        setSelectedMemberId('');
      } else {
        Alert.alert('Error', 'Failed to assign member');
      }
    } catch (err) {
      console.error('[HomeScreen.ios] handleAssignMember error:', err);
      Alert.alert('Error', 'Failed to assign member');
    } finally {
      setIsAssigningMember(false);
    }
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

  const openDeleteAssignmentModal = useCallback((serviceId: string, assignmentId: string) => {
    console.log('User tapped delete assignment button');
    setAssignmentToDelete({ serviceId, assignmentId });
    setDeleteAssignmentModalVisible(true);
  }, []);

  const openAssignMemberModal = useCallback((assignmentId: string) => {
    console.log('User tapped assign member button');
    setSelectedAssignment(assignmentId);
    setSelectedMemberId('');
    setAssignMemberModalVisible(true);
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
  };

  const handleRemovePendingServiceSong = (songId: string) => {
    setPendingServiceSongs(prev => prev.filter(song => song.id !== songId));
  };

  const handleMovePendingServiceSong = (songId: string, direction: -1 | 1) => {
    setPendingServiceSongs(previous => (
      moveItemById(previous, songId, direction)
    ));
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
    if (!currentChurch || !currentMember) return;
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
    }
  }, [acceptFillInRequest, currentChurch, currentMember]);

  const handleCancelFillInRequest = useCallback(async (requestId: string) => {
    console.log('User cancelled fill-in request');
    if (!currentChurch) return;
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
    }
  }, [cancelFillInRequest, currentChurch]);

  const churchName = currentChurch?.name ?? 'Schedule';
  const upcomingCount = filteredServices.length;
  const upcomingText = `${upcomingCount} scheduled`;
  const schedulePeriod = useMemo(() => {
    if (!loadedThrough) {
      return new Date().toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }
    return `Through ${createLocalDate(loadedThrough).toLocaleDateString(
      undefined,
      { month: 'short', day: 'numeric', year: 'numeric' }
    )}`;
  }, [loadedThrough]);

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
        isReorderingSongs={reorderingServiceIds.has(service.id)}
        assignmentLayout="inline"
        styles={styles}
        onDeleteService={openDeleteServiceModal}
        onAddSong={openCommentModal}
        onEditSong={openEditCommentModal}
        onDeleteSong={handleDeleteServiceComment}
        onReorderSongs={handleReorderServiceSongs}
        onAcceptFillIn={handleAcceptFillInRequest}
        onCancelFillIn={handleCancelFillInRequest}
        onRequestFillIn={openFillInRequestModal}
        onAssignMember={openAssignMemberModal}
        onDeleteAssignment={openDeleteAssignmentModal}
      />
    ),
    [
      currentMember?.id,
      currentMemberDisplayName,
      currentMemberRoleNames,
      handleAcceptFillInRequest,
      handleCancelFillInRequest,
      handleDeleteServiceComment,
      handleReorderServiceSongs,
      isAdmin,
      isCreatingFillInRequest,
      memberDisplayNames,
      openAssignMemberModal,
      openCommentModal,
      openDeleteAssignmentModal,
      openDeleteServiceModal,
      openEditCommentModal,
      openFillInRequestModal,
      pendingFillInRequestsByService,
      reorderingServiceIds,
      sortedRoles,
    ]
  );

  if (
    servicesLoading
    || shouldShowInitialLoader(churchInitializing, Boolean(currentChurch))
  ) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading services...</Text>
      </View>
    );
  }

  if (!currentChurch || !user) {
    console.log('[HomeScreen] [iOS] No church or user, rendering loading state');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ResponsiveTabHeader
        eyebrow="Schedule"
        title={churchName}
        titleVariant="primaryTitle"
        trailingWidth={HEADER_ACTION_LANE_WIDTHS.bell}
        accessibilityTitle={`Schedule for ${churchName}`}
        trailing={<NotificationBell />}
      >
        <TabHeaderPill
          icon={<IconSymbol ios_icon_name="calendar.badge.clock" android_material_icon_name="event" size={16} color="#FFFFFF" />}
          label={upcomingText}
        />
        <TabHeaderMetaText>{schedulePeriod}</TabHeaderMetaText>
      </ResponsiveTabHeader>

      <RefreshErrorNotice message={refreshError} />

      <NotificationPermissionOnboarding scheduleReady />

      <FlatList
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        data={filteredServices}
        keyExtractor={service => service.id}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={(
          <Text style={styles.emptyText}>
            {serviceRangeError
              ? 'Could not load services. Please try again.'
              : 'No upcoming services scheduled'}
          </Text>
        )}
        renderItem={renderScheduleService}
        ListFooterComponent={(
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={loadMoreServices}
            disabled={loadingMoreServices}
          >
            {loadingMoreServices ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol
                ios_icon_name="calendar.badge.plus"
                android_material_icon_name="event"
                size={19}
                color={colors.primary}
              />
            )}
            <Text style={styles.loadMoreButtonText}>
              {loadingMoreServices
                ? 'Loading services...'
                : serviceRangeError
                  ? 'Retry Service Range'
                  : `Load Next ${serviceWindowDays ?? 90} Days`}
            </Text>
          </TouchableOpacity>
        )}
      />

        {/* Add Song Modal */}
        <Modal
          visible={commentModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCommentModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.keyboardDismissArea} onPress={Keyboard.dismiss}>
              <View style={[styles.modalContent, styles.addSongModalContent]}>
                <ScrollView
                  style={styles.addSongScroll}
                  contentContainerStyle={styles.addSongScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>{editingServiceCommentId ? 'Edit Song' : 'Add Song'}</Text>
                  <View style={styles.songTypeLabelRow}>
                    <Text style={styles.notifyTitle}>Song type</Text>
                  </View>
                  <View style={styles.songTypeGrid}>
                    {enabledSongTypeOptions.map(option => {
                      const selected = serviceSongType === option;
                      return (
                        <TouchableOpacity
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
                    style={styles.input}
                    placeholder="Song number (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={serviceSongNumber}
                    onChangeText={setServiceSongNumber}
                    keyboardType="default"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <TextInput
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
                              <Text style={styles.pendingSongTitle}>{song.commentText}</Text>
                              <Text style={styles.pendingSongMeta}>
                                {[song.songType, song.songNumber ? `#${song.songNumber}` : null].filter(Boolean).join(' ')}
                              </Text>
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
                              >
                                <IconSymbol ios_icon_name="arrow.down" android_material_icon_name="keyboard-arrow-down" size={19} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                              style={styles.pendingSongRemoveButton}
                              onPress={() => handleRemovePendingServiceSong(song.id)}
                              accessibilityLabel="Remove queued song"
                            >
                              <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.pendingSongsEmpty}>Add songs here before posting them together.</Text>
                      )}
                      <TouchableOpacity
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
                          <Text style={styles.notifyMemberName}>{option.name}</Text>
                          <Text style={styles.notifyMemberRole}>{option.role}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                    </View>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={closeCommentModal}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleAddServiceComment}
                      disabled={isSavingServiceComment}
                    >
                      {isSavingServiceComment ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>
                          {editingServiceCommentId
                            ? 'Update'
                            : pendingServiceSongs.length + (hasSongDraftInForm() ? 1 : 0) > 1
                              ? `Post ${pendingServiceSongs.length + (hasSongDraftInForm() ? 1 : 0)} Songs`
                              : 'Post Song'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Fill-In Request Modal */}
      <Modal
        visible={fillInRequestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFillInRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Fill-In</Text>
            <Text style={{ color: colors.text, marginBottom: 12 }}>
              Role: {fillInRoleName}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textSecondary}
              value={fillInReason}
              onChangeText={setFillInReason}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setFillInRequestModalVisible(false);
                  setFillInReason('');
                }}
                disabled={isCreatingFillInRequest}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleCreateFillInRequest}
                disabled={isCreatingFillInRequest}
              >
                {isCreatingFillInRequest ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Member Modal */}
      <Modal
        visible={assignMemberModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isAssigningMember) setAssignMemberModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Member</Text>
            <Text style={{ color: colors.text, marginBottom: 12 }}>
              Select a member to assign:
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {members.map(member => {
                const displayName = member.name || member.email;
                const isSelected = selectedMemberId === member.id;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberItem,
                      isSelected && { backgroundColor: colors.primary + '30', borderColor: colors.primary }
                    ]}
                    onPress={() => setSelectedMemberId(member.id)}
                    disabled={isAssigningMember}
                  >
                    <Text style={[styles.memberItemText, isSelected && { fontWeight: 'bold' }]}>
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAssignMemberModalVisible(false);
                  setSelectedAssignment(null);
                  setSelectedMemberId('');
                }}
                disabled={isAssigningMember}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  isAssigningMember && { opacity: 0.6 },
                ]}
                onPress={handleAssignMember}
                disabled={isAssigningMember || !selectedMemberId}
              >
                {isAssigningMember ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Service Modal */}
      <Modal
        visible={deleteServiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Service</Text>
            <Text style={{ color: colors.text, marginBottom: 16 }}>
              Are you sure you want to delete this service?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteServiceModalVisible(false);
                  setServiceToDelete(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteService}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Assignment Modal */}
      <Modal
        visible={deleteAssignmentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteAssignmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clear Assignment</Text>
            <Text style={{ color: colors.text, marginBottom: 16 }}>
              Are you sure you want to clear this assignment?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setDeleteAssignmentModalVisible(false);
                  setAssignmentToDelete(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteAssignment}
              >
                <Text style={styles.buttonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
