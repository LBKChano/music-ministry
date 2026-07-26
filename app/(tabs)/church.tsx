
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch } from '@/hooks/useChurch';
import { useServices } from '@/hooks/useServices';
import { usePerformanceBaselineScreen } from '@/hooks/usePerformanceBaselineScreen';
import { supabase } from '@/lib/supabase/client';
import { createAutoAssignPreviewKey } from '@/lib/admin/operations';
import type { Json } from '@/lib/supabase/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

type AutoAssignMode = 'fill_empty' | 'reassign_all';
type AutoAssignRangeMode = 'next_30_days' | 'next_quarter' | 'selected_range' | 'visible_services';
type AutoAssignPreviewAssignment = {
  assignment_id: string;
  service_id: string;
  service_date: string;
  service_time: string | null;
  service_type: string;
  role: string;
  member_id: string;
  person_name: string;
  current_member_id: string | null;
  current_person_name: string | null;
};
type AutoAssignUnavailableMember = {
  member_id: string;
  name: string;
  email: string;
};
type AutoAssignSkippedSlot = {
  assignment_id: string;
  service_id: string;
  service_date: string;
  service_time: string | null;
  service_type: string;
  role: string;
  reason: string;
  unavailable_members: AutoAssignUnavailableMember[];
};
type AutoAssignResult = {
  assigned_count: number;
  open_slot_count: number;
  skipped_count: number;
  no_role_match_count: number;
  unavailable_slot_count: number;
  unavailable_candidate_count: number;
  same_service_conflict_count: number;
  cleared_count: number;
  preview: AutoAssignPreviewAssignment[];
  skipped_report: AutoAssignSkippedSlot[];
};
type AutoAssignListItem =
  | {
    kind: 'assignment';
    assignment: AutoAssignPreviewAssignment;
  }
  | {
    kind: 'skipped';
    skipped: AutoAssignSkippedSlot;
  };
type AutoAssignListSection = {
  key: 'preview' | 'skipped';
  title: string;
  data: AutoAssignListItem[];
};

type AutoAssignRangeConfig = {
  target_start_date: string | null;
  target_end_date: string | null;
  target_service_ids: string[] | null;
  label: string;
};

const AUTO_ASSIGN_RANGE_OPTIONS: { mode: AutoAssignRangeMode; label: string }[] = [
  { mode: 'next_30_days', label: 'Next 30 Days' },
  { mode: 'next_quarter', label: 'Next Quarter' },
  { mode: 'selected_range', label: 'Date Range' },
  { mode: 'visible_services', label: 'Visible Services' },
];

const DEFAULT_SONG_TYPE_OPTIONS = ['Opening', 'Praise', 'Worship', 'Offering', 'Special', 'Closing'];
const OTHER_SONG_TYPE_OPTION = 'Other';

const normalizeSongTypeLabel = (option: string) => option.trim().replace(/\s+/g, ' ');

const normalizeEditableSongTypeOptions = (options?: string[] | null, fallbackToDefaults = true) => {
  const configuredOptions = options && options.length > 0 ? options : DEFAULT_SONG_TYPE_OPTIONS;
  const seen = new Set<string>();
  const cleaned: string[] = [];

  configuredOptions.forEach(option => {
    const normalized = normalizeSongTypeLabel(option);
    const key = normalized.toLowerCase();
    if (!normalized || key === OTHER_SONG_TYPE_OPTION.toLowerCase() || seen.has(key)) {
      return;
    }
    seen.add(key);
    cleaned.push(normalized);
  });

  return cleaned.length > 0 || !fallbackToDefaults ? cleaned : DEFAULT_SONG_TYPE_OPTIONS;
};

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateForDatabase(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function formatDateForDisplay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPreviewTime(time?: string | null): string {
  if (!time) return '';
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function normalizeAutoAssignPreview(preview: Json | undefined): AutoAssignPreviewAssignment[] {
  if (!Array.isArray(preview)) return [];

  return preview
    .filter((item): item is Record<string, Json | undefined> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      assignment_id: String(item.assignment_id ?? ''),
      service_id: String(item.service_id ?? ''),
      service_date: String(item.service_date ?? ''),
      service_time: typeof item.service_time === 'string' ? item.service_time : null,
      service_type: String(item.service_type ?? ''),
      role: String(item.role ?? ''),
      member_id: String(item.member_id ?? ''),
      person_name: String(item.person_name ?? ''),
      current_member_id: typeof item.current_member_id === 'string' ? item.current_member_id : null,
      current_person_name: typeof item.current_person_name === 'string' ? item.current_person_name : null,
    }))
    .filter(item => item.assignment_id && item.service_id && item.service_date && item.member_id);
}

function normalizeUnavailableMembers(members: Json | undefined): AutoAssignUnavailableMember[] {
  if (!Array.isArray(members)) return [];

  return members
    .filter((item): item is Record<string, Json | undefined> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      member_id: String(item.member_id ?? ''),
      name: String(item.name ?? ''),
      email: String(item.email ?? ''),
    }))
    .filter(item => item.member_id);
}

function normalizeAutoAssignSkippedReport(report: Json | undefined): AutoAssignSkippedSlot[] {
  if (!Array.isArray(report)) return [];

  return report
    .filter((item): item is Record<string, Json | undefined> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      assignment_id: String(item.assignment_id ?? ''),
      service_id: String(item.service_id ?? ''),
      service_date: String(item.service_date ?? ''),
      service_time: typeof item.service_time === 'string' ? item.service_time : null,
      service_type: String(item.service_type ?? ''),
      role: String(item.role ?? ''),
      reason: String(item.reason ?? 'No available member matched this slot'),
      unavailable_members: normalizeUnavailableMembers(item.unavailable_members),
    }))
    .filter(item => item.assignment_id && item.service_id && item.service_date && item.role);
}

// Helper function to format time from Date object as HH:MM
function formatTimeForDatabase(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const AutoAssignVirtualRow = React.memo(function AutoAssignVirtualRow({
  row,
}: {
  row: AutoAssignListItem;
}) {
  if (row.kind === 'assignment') {
    const item = row.assignment;
    const time = formatPreviewTime(item.service_time);
    return (
      <View
        style={[
          styles.autoAssignPreviewItem,
          styles.autoAssignVirtualRow,
          {
            borderColor: colors.border,
            backgroundColor: colors.inputBackground,
          },
        ]}
      >
        <Text style={[styles.autoAssignPreviewService, { color: colors.text }]}>
          {formatDateForDisplay(item.service_date)}
          {time ? ` • ${time}` : ''}
          {' • '}
          {item.service_type}
        </Text>
        <Text style={[styles.autoAssignPreviewMember, { color: colors.text }]}>
          {item.person_name} will be assigned to {item.role}
        </Text>
        {item.current_person_name
          && item.current_person_name !== item.person_name ? (
            <Text
              style={[
                styles.autoAssignPreviewReplacement,
                { color: colors.textSecondary },
              ]}
            >
              Replaces {item.current_person_name}
            </Text>
          ) : null}
      </View>
    );
  }

  const item = row.skipped;
  const time = formatPreviewTime(item.service_time);
  const unavailableNames = item.unavailable_members
    .map(member => member.name || member.email)
    .filter(Boolean);

  return (
    <View
      style={[
        styles.autoAssignSkippedItem,
        styles.autoAssignVirtualRow,
        { borderColor: colors.border, backgroundColor: '#FFF7ED' },
      ]}
    >
      <Text style={[styles.autoAssignPreviewService, { color: colors.text }]}>
        {formatDateForDisplay(item.service_date)}
        {time ? ` • ${time}` : ''}
        {' • '}
        {item.service_type}
      </Text>
      <Text style={[styles.autoAssignSkippedRole, { color: colors.text }]}>
        {item.role}
      </Text>
      <Text style={[styles.autoAssignSkipText, { color: colors.textSecondary }]}>
        {item.reason}
      </Text>
      {unavailableNames.length > 0 ? (
        <Text
          style={[
            styles.autoAssignUnavailableText,
            { color: colors.textSecondary },
          ]}
        >
          Unavailable: {unavailableNames.join(', ')}
        </Text>
      ) : null}
    </View>
  );
});

export default function ChurchScreen() {
  const insets = useSafeAreaInsets();

  const {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    notificationSettings,
    loading,
    error,
    user,
    isAdmin,
    createChurch,
    deleteMember,
    updateMember,
    addRecurringService,
    updateRecurringService,
    deleteRecurringService,
    addChurchRole,
    deleteChurchRole,
    updateRoleOrder,
    addMemberRole,
    removeMemberRole,
    updateNotificationSettings,
    updateChurchName,
    updateChurchSongTypes,
    updateChurchAutoAssignSettings,
    signOut,
    refreshChurches,
    refreshMembers,
    refreshRecurringServices,
    refreshChurchRoles,
    refreshNotificationSettings,
  } = useChurch();

  const {
    services,
    loading: servicesLoading,
    createServiceFromTemplate,
    createServicesBatch,
    refreshServices: refreshServicesHook,
  } = useServices(currentChurch?.id || null, { windowed: true });

  usePerformanceBaselineScreen(
    'Church',
    !loading && !servicesLoading && !!user,
    {
      services: services.length,
      members: members.length,
      roles: churchRoles.length,
      recurringServices: recurringServices.length,
      churches: churches.length,
    }
  );

  const [activeTab, setActiveTab] = useState<'members' | 'services' | 'roles' | 'notifications'>('members');
  const [isCreateChurchModalVisible, setCreateChurchModalVisible] = useState(false);
  const [isEditMemberModalVisible, setEditMemberModalVisible] = useState(false);
  const [isAddServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [isAddRoleModalVisible, setAddRoleModalVisible] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [isDeleteRoleModalVisible, setDeleteRoleModalVisible] = useState(false);
  const [isSignOutModalVisible, setSignOutModalVisible] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [serviceToEdit, setServiceToEdit] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const [newChurchName, setNewChurchName] = useState('');
  const [isCreatingChurch, setIsCreatingChurch] = useState(false);
  const [editChurchName, setEditChurchName] = useState('');
  const [isEditChurchNameModalVisible, setEditChurchNameModalVisible] = useState(false);
  const [isSavingChurchName, setIsSavingChurchName] = useState(false);
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRoles, setEditMemberRoles] = useState<string[]>([]);
  const [editMemberIsAdmin, setEditMemberIsAdmin] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDay, setNewServiceDay] = useState(0);
  const [newServiceTime, setNewServiceTime] = useState('09:00');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [selectedServiceRoles, setSelectedServiceRoles] = useState<string[]>([]);
  const [showServiceRolePicker, setShowServiceRolePicker] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // Notification settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationSettings?.enabled ?? true);
  const [selectedNotificationHours, setSelectedNotificationHours] = useState<number[]>(
    notificationSettings?.notification_hours ?? [24, 6]
  );
  const [customHourInput, setCustomHourInput] = useState('');
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [songTypeDraftOptions, setSongTypeDraftOptions] = useState<string[]>(() => (
    normalizeEditableSongTypeOptions(currentChurch?.song_type_options)
  ));
  const [newSongTypeName, setNewSongTypeName] = useState('');
  const [isSavingSongTypes, setIsSavingSongTypes] = useState(false);

  // Quarterly assignment states
  const [showPrepareQuarterModal, setShowPrepareQuarterModal] = useState(false);
  const [prepareQuarterStep, setPrepareQuarterStep] = useState<'block' | 'special'>('block');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [blockedServices, setBlockedServices] = useState<Set<string>>(new Set());
  const [specialServices, setSpecialServices] = useState<SpecialService[]>([]);
  const [showAddSpecialService, setShowAddSpecialService] = useState(false);
  const [specialServiceDate, setSpecialServiceDate] = useState(new Date());
  const [draftSpecialServiceDate, setDraftSpecialServiceDate] = useState(new Date());
  const [specialServiceName, setSpecialServiceName] = useState('');
  const [specialServiceTime, setSpecialServiceTime] = useState(new Date());
  const [draftSpecialServiceTime, setDraftSpecialServiceTime] = useState(new Date());
  const [specialServiceNotes, setSpecialServiceNotes] = useState('');
  const [specialServiceRoles, setSpecialServiceRoles] = useState<string[]>([]);
  const [showSpecialServiceTimePicker, setShowSpecialServiceTimePicker] = useState(false);
  const [showSpecialServiceDatePicker, setShowSpecialServiceDatePicker] = useState(false);
  const [autoAssignMode, setAutoAssignMode] = useState<AutoAssignMode | null>(null);
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false);
  const [pendingAutoAssignMode, setPendingAutoAssignMode] = useState<AutoAssignMode>('fill_empty');
  const [autoAssignRangeMode, setAutoAssignRangeMode] = useState<AutoAssignRangeMode>('next_30_days');
  const [autoAssignStartDate, setAutoAssignStartDate] = useState(() => getStartOfLocalDay(new Date()));
  const [autoAssignEndDate, setAutoAssignEndDate] = useState(() => addDays(getStartOfLocalDay(new Date()), 30));
  const [draftAutoAssignStartDate, setDraftAutoAssignStartDate] = useState(() => getStartOfLocalDay(new Date()));
  const [draftAutoAssignEndDate, setDraftAutoAssignEndDate] = useState(() => addDays(getStartOfLocalDay(new Date()), 30));
  const [showAutoAssignStartPicker, setShowAutoAssignStartPicker] = useState(false);
  const [showAutoAssignEndPicker, setShowAutoAssignEndPicker] = useState(false);
  const [autoAssignPreview, setAutoAssignPreview] = useState<AutoAssignResult | null>(null);
  const [autoAssignPreviewKey, setAutoAssignPreviewKey] = useState<string | null>(null);
  const [autoAssignOperationStatus, setAutoAssignOperationStatus] = useState<string | null>(null);
  const [isGeneratingAutoAssignPreview, setIsGeneratingAutoAssignPreview] = useState(false);
  const [isApplyingAutoAssign, setIsApplyingAutoAssign] = useState(false);
  const isAutoAssigning = autoAssignMode !== null || isGeneratingAutoAssignPreview || isApplyingAutoAssign;
  const [allowMultipleRolesSameService, setAllowMultipleRolesSameService] = useState(
    currentChurch?.allow_member_multiple_roles_same_service ?? false
  );
  const [isSavingAutoAssignSettings, setIsSavingAutoAssignSettings] = useState(false);

  // Ad-hoc service modal states
  const [showAdHocServiceModal, setShowAdHocServiceModal] = useState(false);
  const [adHocServiceName, setAdHocServiceName] = useState('');
  const [adHocServiceDate, setAdHocServiceDate] = useState(new Date());
  const [draftAdHocServiceDate, setDraftAdHocServiceDate] = useState(new Date());
  const [adHocServiceTime, setAdHocServiceTime] = useState(new Date());
  const [draftAdHocServiceTime, setDraftAdHocServiceTime] = useState(new Date());
  const [adHocServiceNotes, setAdHocServiceNotes] = useState('');
  const [adHocServiceRoles, setAdHocServiceRoles] = useState<string[]>([]);
  const [showAdHocDatePicker, setShowAdHocDatePicker] = useState(false);
  const [showAdHocTimePicker, setShowAdHocTimePicker] = useState(false);
  const [isCreatingAdHocService, setIsCreatingAdHocService] = useState(false);

  // Quarter preparation loading state
  const [isPreparing, setIsPreparing] = useState(false);
  const [quarterOperationStatus, setQuarterOperationStatus] = useState<string | null>(null);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Update notification states when settings change
  React.useEffect(() => {
    if (notificationSettings) {
      setNotificationsEnabled(notificationSettings.enabled ?? true);
      setSelectedNotificationHours(notificationSettings.notification_hours ?? [24, 6]);
    }
  }, [notificationSettings]);

  React.useEffect(() => {
    setSongTypeDraftOptions(normalizeEditableSongTypeOptions(currentChurch?.song_type_options));
    setNewSongTypeName('');
  }, [currentChurch?.id, currentChurch?.song_type_options]);

  React.useEffect(() => {
    setAllowMultipleRolesSameService(currentChurch?.allow_member_multiple_roles_same_service ?? false);
  }, [currentChurch?.id, currentChurch?.allow_member_multiple_roles_same_service]);

  // Pull-to-refresh handler
  const onRefresh = React.useCallback(async () => {
    console.log('User pulled to refresh Church Management data');
    setRefreshing(true);
    try {
      // Refresh all church-related data
      await Promise.all([
        refreshChurches(),
        currentChurch ? refreshMembers() : Promise.resolve(),
        currentChurch ? refreshRecurringServices() : Promise.resolve(),
        currentChurch ? refreshChurchRoles() : Promise.resolve(),
        currentChurch ? refreshNotificationSettings() : Promise.resolve(),
        currentChurch ? refreshServicesHook() : Promise.resolve(),
      ]);
      console.log('Church Management data refreshed successfully');
    } catch (err) {
      console.error('Error refreshing Church Management data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshChurches, refreshMembers, refreshRecurringServices, refreshChurchRoles, refreshNotificationSettings, refreshServicesHook, currentChurch]);

  const handleAddSongType = () => {
    const normalizedName = normalizeSongTypeLabel(newSongTypeName);
    const normalizedKey = normalizedName.toLowerCase();

    if (!normalizedName) {
      Alert.alert('Error', 'Enter a song type name first.');
      return;
    }

    if (normalizedKey === OTHER_SONG_TYPE_OPTION.toLowerCase()) {
      Alert.alert('Already Available', 'Other is always available in the Schedules tab.');
      setNewSongTypeName('');
      return;
    }

    if (normalizedName.length > 40) {
      Alert.alert('Error', 'Song type names must be 40 characters or fewer.');
      return;
    }

    if (songTypeDraftOptions.some(option => option.toLowerCase() === normalizedKey)) {
      Alert.alert('Already Added', 'That song type is already in the list.');
      setNewSongTypeName('');
      return;
    }

    setSongTypeDraftOptions(prev => [...prev, normalizedName]);
    setNewSongTypeName('');
  };

  const handleRemoveSongType = (option: string) => {
    setSongTypeDraftOptions(prev => prev.filter(item => item !== option));
  };

  const handleSaveSongTypes = async () => {
    if (!currentChurch || isSavingSongTypes) return;

    const nextOptions = normalizeEditableSongTypeOptions(songTypeDraftOptions, false);
    if (nextOptions.length === 0) {
      Alert.alert('Error', 'Keep at least one song type.');
      return;
    }

    setIsSavingSongTypes(true);
    try {
      const updatedChurch = await updateChurchSongTypes(currentChurch.id, nextOptions);
      if (!updatedChurch) {
        Alert.alert('Error', 'Could not save song types. Please try again.');
        return;
      }
      Alert.alert('Success', 'Song types updated.');
    } catch (err) {
      console.error('Error saving song types:', err);
      Alert.alert('Error', 'Could not save song types. Please try again.');
    } finally {
      setIsSavingSongTypes(false);
    }
  };

  const handleToggleAllowMultipleRolesSameService = async (value: boolean) => {
    if (!currentChurch || isSavingAutoAssignSettings) return;

    setIsSavingAutoAssignSettings(true);
    try {
      const updatedChurch = await updateChurchAutoAssignSettings(currentChurch.id, value);
      if (!updatedChurch) {
        Alert.alert('Error', 'Could not save auto-assign settings. Please try again.');
        return;
      }
      setAllowMultipleRolesSameService(updatedChurch.allow_member_multiple_roles_same_service);
    } catch (err) {
      console.error('Error saving auto-assign settings:', err);
      Alert.alert('Error', 'Could not save auto-assign settings. Please try again.');
    } finally {
      setIsSavingAutoAssignSettings(false);
    }
  };

  const autoAssignSections = React.useMemo<AutoAssignListSection[]>(() => {
    if (!autoAssignPreview) return [];

    const sections: AutoAssignListSection[] = [];

    if (autoAssignPreview.preview.length > 0) {
      sections.push({
        key: 'preview',
        title: 'Schedule Preview',
        data: autoAssignPreview.preview.map(assignment => ({
          kind: 'assignment',
          assignment,
        })),
      });
    }

    if (autoAssignPreview.skipped_report.length > 0) {
      sections.push({
        key: 'skipped',
        title: 'Skipped Slots',
        data: autoAssignPreview.skipped_report.map(skipped => ({
          kind: 'skipped',
          skipped,
        })),
      });
    }

    return sections;
  }, [autoAssignPreview]);

  if (!isAdmin) {
    console.log('[ChurchScreen] Non-admin user attempted to access church screen, redirecting');
    return <Redirect href="/(tabs)/(home)" />;
  }

  const handleCreateChurch = async () => {
    console.log('User tapped Create Church button');
    if (isCreatingChurch) return;

    const trimmedName = newChurchName.trim();
    if (!trimmedName) {
      Alert.alert('Church Name Required', 'Please enter a church name.');
      return;
    }

    setIsCreatingChurch(true);
    try {
      const result = await createChurch(trimmedName);
      if (!result) {
        Alert.alert('Error', 'Could not create the church. Please try again.');
        return;
      }

      setCurrentChurch(result);
      setNewChurchName('');
      setCreateChurchModalVisible(false);
    } catch (err) {
      console.error('Error creating church:', err);
      Alert.alert('Error', 'Could not create the church. Please try again.');
    } finally {
      setIsCreatingChurch(false);
    }
  };

  const openEditChurchNameModal = () => {
    if (!currentChurch) return;
    console.log('User tapped Edit Church Name');
    setEditChurchName(currentChurch.name || '');
    setEditChurchNameModalVisible(true);
  };

  const closeEditChurchNameModal = () => {
    if (isSavingChurchName) return;
    setEditChurchNameModalVisible(false);
    setEditChurchName('');
  };

  const handleUpdateChurchName = async () => {
    if (!currentChurch || isSavingChurchName) return;

    const trimmedName = editChurchName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a church name.');
      return;
    }

    if (trimmedName === currentChurch.name) {
      closeEditChurchNameModal();
      return;
    }

    setIsSavingChurchName(true);
    try {
      const updatedChurch = await updateChurchName(currentChurch.id, trimmedName);
      if (!updatedChurch) {
        Alert.alert('Error', 'Could not update the church name. Please try again.');
        return;
      }

      setEditChurchNameModalVisible(false);
      setEditChurchName('');
    } catch (err) {
      console.error('Error updating church name:', err);
      Alert.alert('Error', 'Could not update the church name. Please try again.');
    } finally {
      setIsSavingChurchName(false);
    }
  };

  const copyInvitationCode = async () => {
    if (currentChurch?.invitation_code) {
      console.log('User copied invitation code:', currentChurch.invitation_code);
      await Clipboard.setStringAsync(currentChurch.invitation_code);
      Alert.alert('Copied!', 'Invitation code copied to clipboard');
    }
  };

  const openEditMemberModal = (memberId: string) => {
    console.log('User tapped edit member:', memberId);
    const member = (members ?? []).find(m => m.id === memberId);
    if (!member) {
      return;
    }

    setMemberToEdit(memberId);
    setEditMemberEmail(member.email);
    setEditMemberName(member.name || '');
    setEditMemberRoles(member.memberRoles?.map(r => r.role_name) || []);
    setEditMemberIsAdmin(member.is_admin || member.member_id === currentChurch?.admin_id);
    setEditMemberModalVisible(true);
  };

  const handleEditMember = async () => {
    console.log('User tapped Save Edit Member button');
    if (!memberToEdit || !currentChurch) {
      return;
    }

    const member = (members ?? []).find(m => m.id === memberToEdit);
    const isChurchOwner = member?.member_id === currentChurch.admin_id;
    const updates: { name?: string; email?: string; is_admin?: boolean } = {};
    
    if (editMemberEmail.trim()) {
      updates.email = editMemberEmail.trim();
    }
    if (editMemberName.trim()) {
      updates.name = editMemberName.trim();
    }
    const nextIsAdmin = isChurchOwner ? true : editMemberIsAdmin;
    if (member && member.is_admin !== nextIsAdmin) {
      updates.is_admin = nextIsAdmin;
    }

    const success = await updateMember(memberToEdit, currentChurch.id, updates);
    
    if (success) {
      const currentRoleNames = member?.memberRoles?.map(r => r.role_name) || [];
      
      console.log('Current roles:', currentRoleNames);
      console.log('New roles:', editMemberRoles);
      
      const safeEditRoles = editMemberRoles ?? [];
      const rolesToRemove = currentRoleNames.filter(roleName => !safeEditRoles.includes(roleName));
      const rolesToAdd = safeEditRoles.filter(roleName => !currentRoleNames.includes(roleName));
      
      console.log('Roles to remove:', rolesToRemove);
      console.log('Roles to add:', rolesToAdd);
      
      for (const roleNameToRemove of rolesToRemove) {
        const role = (churchRoles ?? []).find(r => r.name === roleNameToRemove);
        if (role) {
          console.log('Removing role:', roleNameToRemove);
          await removeMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      for (const roleNameToAdd of rolesToAdd) {
        const role = (churchRoles ?? []).find(r => r.name === roleNameToAdd);
        if (role) {
          console.log('Adding role:', roleNameToAdd);
          await addMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      setMemberToEdit(null);
      setEditMemberEmail('');
      setEditMemberName('');
      setEditMemberRoles([]);
      setEditMemberIsAdmin(false);
      setEditMemberModalVisible(false);
    }
  };

  const handleDeleteMember = async () => {
    console.log('User confirmed delete member');
    if (!memberToDelete || !currentChurch) {
      return;
    }

    const success = await deleteMember(memberToDelete, currentChurch.id);
    if (success) {
      setMemberToDelete(null);
      setDeleteModalVisible(false);
    }
  };

  const handleSignOut = async () => {
    console.log('User confirmed sign out');
    try {
      setSignOutModalVisible(false);
      await signOut();
      console.log('User signed out successfully — auth state listener will handle navigation');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const openDeleteModal = (memberId: string) => {
    console.log('User tapped delete member:', memberId);
    setMemberToDelete(memberId);
    setDeleteModalVisible(true);
  };

  const resetServiceForm = () => {
    setServiceToEdit(null);
    setNewServiceName('');
    setNewServiceDay(0);
    setNewServiceTime('09:00');
    setNewServiceNotes('');
    setSelectedServiceRoles([]);
  };

  const handleSaveService = async () => {
    console.log('User tapped Save Service button');
    if (!currentChurch || !newServiceName.trim()) {
      return;
    }

    const result = serviceToEdit
      ? await updateRecurringService(
        serviceToEdit,
        currentChurch.id,
        {
          name: newServiceName.trim(),
          day_of_week: newServiceDay,
          time: newServiceTime,
          notes: newServiceNotes.trim() || null,
        },
        selectedServiceRoles,
      )
      : await addRecurringService(
        currentChurch.id,
        newServiceName.trim(),
        newServiceDay,
        newServiceTime,
        newServiceNotes.trim() || undefined,
        selectedServiceRoles,
      );

    if (result) {
      resetServiceForm();
      setAddServiceModalVisible(false);
    }
  };

  const openAddServiceModal = () => {
    resetServiceForm();
    setAddServiceModalVisible(true);
  };

  const openEditServiceModal = (serviceId: string) => {
    console.log('User tapped edit recurring service:', serviceId);
    const service = (recurringServices ?? []).find(item => item.id === serviceId);
    if (!service) return;

    setServiceToEdit(service.id);
    setNewServiceName(service.name);
    setNewServiceDay(service.day_of_week);
    setNewServiceTime(service.time);
    setNewServiceNotes(service.notes ?? '');
    setSelectedServiceRoles(service.roles ?? []);
    setAddServiceModalVisible(true);
  };

  const handleDeleteService = async () => {
    console.log('User confirmed delete service');
    if (!serviceToDelete || !currentChurch) {
      return;
    }

    const success = await deleteRecurringService(serviceToDelete, currentChurch.id);
    if (success) {
      setServiceToDelete(null);
      setDeleteServiceModalVisible(false);
    }
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('User tapped delete service:', serviceId);
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  };

  const handleAddRole = async () => {
    console.log('User tapped Add Role button');
    if (!currentChurch || !newRoleName.trim()) {
      return;
    }

    const result = await addChurchRole(
      currentChurch.id,
      newRoleName.trim(),
      newRoleDescription.trim() || undefined
    );

    if (result) {
      setNewRoleName('');
      setNewRoleDescription('');
      setAddRoleModalVisible(false);
    }
  };

  const handleDeleteRole = async () => {
    console.log('User confirmed delete role');
    if (!roleToDelete || !currentChurch) {
      return;
    }

    const success = await deleteChurchRole(roleToDelete, currentChurch.id);
    if (success) {
      setRoleToDelete(null);
      setDeleteRoleModalVisible(false);
    }
  };

  const openDeleteRoleModal = (roleId: string) => {
    console.log('User tapped delete role:', roleId);
    setRoleToDelete(roleId);
    setDeleteRoleModalVisible(true);
  };

  const moveRoleUp = async (index: number) => {
    if (index === 0 || !currentChurch) return;
    const safeRoles = churchRoles ?? [];
    console.log('User moved role up:', safeRoles[index]?.name);
    const newRoles = [...safeRoles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index - 1];
    newRoles[index - 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const moveRoleDown = async (index: number) => {
    const safeRolesDown = churchRoles ?? [];
    if (index === safeRolesDown.length - 1 || !currentChurch) return;
    
    console.log('User moved role down:', safeRolesDown[index]?.name);
    const newRoles = [...safeRolesDown];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index + 1];
    newRoles[index + 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const toggleServiceRole = (roleName: string) => {
    console.log('User toggled service role:', roleName);
    const safeServiceRoles = selectedServiceRoles ?? [];
    if (safeServiceRoles.includes(roleName)) {
      setSelectedServiceRoles(safeServiceRoles.filter(r => r !== roleName));
    } else {
      setSelectedServiceRoles([...safeServiceRoles, roleName]);
    }
  };

  const toggleNotificationHour = (hour: number) => {
    console.log('User toggled notification hour:', hour);
    const safeHours = selectedNotificationHours ?? [];
    if (safeHours.includes(hour)) {
      setSelectedNotificationHours(safeHours.filter(h => h !== hour));
    } else {
      setSelectedNotificationHours([...safeHours, hour].sort((a, b) => b - a));
    }
  };

  const addCustomNotificationHour = () => {
    const hour = parseInt(customHourInput);
    if (isNaN(hour) || hour < 1 || hour > 168) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 168 hours');
      return;
    }
    const safeHoursCustom = selectedNotificationHours ?? [];
    if (safeHoursCustom.includes(hour)) {
      Alert.alert('Already Added', 'This notification time is already in the list');
      return;
    }

    console.log('User added custom notification hour:', hour);
    setSelectedNotificationHours([...safeHoursCustom, hour].sort((a, b) => b - a));
    setCustomHourInput('');
  };

  const removeNotificationHour = (hour: number) => {
    console.log('User removed notification hour:', hour);
    setSelectedNotificationHours((selectedNotificationHours ?? []).filter(h => h !== hour));
  };

  const handleSaveNotificationSettings = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if ((selectedNotificationHours ?? []).length === 0) {
      Alert.alert('Error', 'Please select at least one notification time');
      return;
    }

    console.log('User tapped Save Notification Settings button');
    setIsSavingNotifications(true);

    try {
      const success = await updateNotificationSettings(
        currentChurch.id,
        selectedNotificationHours,
        notificationsEnabled
      );

      if (success) {
        Alert.alert('Success', 'Notification settings saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save notification settings');
      }
    } catch (err) {
      console.error('Error saving notification settings:', err);
      Alert.alert('Error', 'An error occurred while saving settings');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const getDayName = (day: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || '';
  };

  const formatTime = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const formatDate = (dateString: string) => {
    // Append time to avoid UTC offset shifting the date for users in UTC-N timezones
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getQuarterDates = (quarter: number, year: number) => {
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    return { startDate, endDate };
  };

  const generateQuarterServices = () => {
    const { startDate, endDate } = getQuarterDates(selectedQuarter, selectedYear);
    const generatedServices: { date: Date; template: any }[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      (recurringServices ?? []).forEach(template => {
        if (template.day_of_week === dayOfWeek) {
          const serviceKey = `${template.id}-${currentDate.toISOString().split('T')[0]}`;
          if (!blockedServices.has(serviceKey)) {
            generatedServices.push({
              date: new Date(currentDate),
              template,
            });
          }
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return generatedServices;
  };

  const handleSaveBlockedDates = () => {
    console.log('User saved blocked dates, moving to special services step');
    setPrepareQuarterStep('special');
  };

  const handlePrepareQuarter = async () => {
    if (!currentChurch?.id) {
      Alert.alert('Error', 'No church selected. Please ensure your account is linked to a church.');
      return;
    }

    const generatedServices = generateQuarterServices();
    const recurringDrafts = generatedServices.map(({ date, template }) => ({
      date: formatDateForDatabase(date),
      serviceType: template.name,
      notes: template.notes,
      roleSlots: template.roles ?? [],
      time: template.time,
    }));
    const specialDrafts = specialServices.map(special => {
      const roleNames = (special.selectedRoleIds ?? [])
        .map(roleId => (churchRoles ?? []).find(r => r.id === roleId)?.name)
        .filter((name): name is string => name !== undefined);
      return {
        date: formatDateForDatabase(special.date),
        serviceType: special.name,
        notes: special.notes,
        roleSlots: roleNames,
        time: special.time,
      };
    });
    const drafts = [...recurringDrafts, ...specialDrafts];

    console.log('User tapped Generate Services button for church:', currentChurch.id);
    setIsPreparing(true);
    setQuarterOperationStatus(`Creating ${drafts.length} service${drafts.length !== 1 ? 's' : ''}...`);

    try {
      const result = await createServicesBatch(
        currentChurch.id,
        drafts,
        (completed, total) => {
          if (completed > 0 && completed < total) {
            setQuarterOperationStatus(`Created ${completed} of ${total} services...`);
          }
        }
      );
      if (!result) {
        Alert.alert('Error', 'No services were created. Please check your connection and try again.');
        return;
      }

      setShowPrepareQuarterModal(false);
      setPrepareQuarterStep('block');
      setBlockedServices(new Set());
      setSpecialServices([]);

      if (result.failedCount > 0) {
        Alert.alert(
          'Partial Success',
          `${result.createdCount} service${result.createdCount !== 1 ? 's' : ''} created successfully, ${result.failedCount} failed. Please check your connection and try again for any missing services.`
        );
      } else {
        Alert.alert(
          'Success',
          `${result.createdCount} quarter service${result.createdCount !== 1 ? 's' : ''} generated successfully!`
        );
      }
    } catch (err) {
      console.error('Error preparing quarter:', err);
      Alert.alert('Error', 'No services were created. Please try again.');
    } finally {
      setIsPreparing(false);
      setQuarterOperationStatus(null);
    }
  };

  const formatAutoAssignMessage = (result: AutoAssignResult, mode: AutoAssignMode) => {
    const intro = mode === 'reassign_all'
      ? `${result.cleared_count} existing assignment${result.cleared_count !== 1 ? 's' : ''} cleared and rebuilt.`
      : 'Existing assignments were kept.';

    return [
      'Auto-assignment completed!',
      intro,
      `${result.assigned_count} of ${result.open_slot_count} open slot${result.open_slot_count !== 1 ? 's' : ''} assigned`,
      `${result.skipped_count} slot${result.skipped_count !== 1 ? 's' : ''} remain open`,
      '',
      'Skipped details:',
      `${result.no_role_match_count} no matching role`,
      `${result.unavailable_slot_count} blocked by unavailable dates`,
      `${result.same_service_conflict_count} same-service conflicts`,
    ].join('\n');
  };

  const normalizeAutoAssignResult = (row: {
    assigned_count: number;
    open_slot_count: number;
    skipped_count: number;
    no_role_match_count: number;
    unavailable_slot_count: number;
    unavailable_candidate_count: number;
    same_service_conflict_count: number;
    cleared_count: number;
    preview?: Json;
    skipped_report?: Json;
  }): AutoAssignResult => ({
    assigned_count: row.assigned_count ?? 0,
    open_slot_count: row.open_slot_count ?? 0,
    skipped_count: row.skipped_count ?? 0,
    no_role_match_count: row.no_role_match_count ?? 0,
    unavailable_slot_count: row.unavailable_slot_count ?? 0,
    unavailable_candidate_count: row.unavailable_candidate_count ?? 0,
    same_service_conflict_count: row.same_service_conflict_count ?? 0,
    cleared_count: row.cleared_count ?? 0,
    preview: normalizeAutoAssignPreview(row.preview),
    skipped_report: normalizeAutoAssignSkippedReport(row.skipped_report),
  });

  const getAutoAssignRangeConfig = (): AutoAssignRangeConfig | null => {
    const today = getStartOfLocalDay(new Date());
    const todayString = formatDateForDatabase(today);

    if (autoAssignRangeMode === 'next_30_days') {
      return {
        target_start_date: todayString,
        target_end_date: formatDateForDatabase(addDays(today, 30)),
        target_service_ids: null,
        label: 'next 30 days',
      };
    }

    if (autoAssignRangeMode === 'next_quarter') {
      return {
        target_start_date: todayString,
        target_end_date: formatDateForDatabase(addMonths(today, 3)),
        target_service_ids: null,
        label: 'next quarter',
      };
    }

    if (autoAssignRangeMode === 'selected_range') {
      const startDate = getStartOfLocalDay(autoAssignStartDate);
      const endDate = getStartOfLocalDay(autoAssignEndDate);

      if (endDate < startDate) {
        Alert.alert('Invalid Range', 'The end date must be on or after the start date.');
        return null;
      }

      return {
        target_start_date: formatDateForDatabase(startDate),
        target_end_date: formatDateForDatabase(endDate),
        target_service_ids: null,
        label: `${formatDateForDisplay(formatDateForDatabase(startDate))} to ${formatDateForDisplay(formatDateForDatabase(endDate))}`,
      };
    }

    const visibleServiceIds = services
      .filter(service => service.date >= todayString)
      .map(service => service.id);

    if (visibleServiceIds.length === 0) {
      Alert.alert('No Visible Services', 'There are no visible upcoming services to auto-assign.');
      return null;
    }

    return {
      target_start_date: null,
      target_end_date: null,
      target_service_ids: visibleServiceIds,
      label: `${visibleServiceIds.length} visible upcoming service${visibleServiceIds.length !== 1 ? 's' : ''}`,
    };
  };

  const getAutoAssignPreviewKey = (range: AutoAssignRangeConfig) => (
    createAutoAssignPreviewKey({
      churchId: currentChurch?.id ?? '',
      mode: pendingAutoAssignMode,
      range,
      allowMultipleRolesSameService,
      services,
      members,
    })
  );

  const clearAutoAssignPreview = () => {
    setAutoAssignPreview(null);
    setAutoAssignPreviewKey(null);
    setAutoAssignOperationStatus(null);
  };

  const openAutoAssignModal = (mode: AutoAssignMode) => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    const today = getStartOfLocalDay(new Date());
    setPendingAutoAssignMode(mode);
    setAutoAssignRangeMode('next_30_days');
    setAutoAssignStartDate(today);
    setAutoAssignEndDate(addDays(today, 30));
    setDraftAutoAssignStartDate(today);
    setDraftAutoAssignEndDate(addDays(today, 30));
    setShowAutoAssignStartPicker(false);
    setShowAutoAssignEndPicker(false);
    clearAutoAssignPreview();
    setShowAutoAssignModal(true);
  };

  const requestAutoAssignPreview = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    const range = getAutoAssignRangeConfig();
    if (!range) return;
    const requestKey = getAutoAssignPreviewKey(range);
    if (autoAssignPreview && autoAssignPreviewKey === requestKey) {
      setAutoAssignOperationStatus('Preview is already current.');
      return;
    }

    console.log('Generating auto-assign preview:', {
      mode: pendingAutoAssignMode,
      rangeMode: autoAssignRangeMode,
      range,
    });

    setIsGeneratingAutoAssignPreview(true);
    setAutoAssignPreview(null);
    setAutoAssignPreviewKey(null);
    setAutoAssignOperationStatus('Calculating the schedule preview...');

    try {
      const { data, error: rpcError } = await supabase.rpc('auto_assign_service_slots', {
        target_church_id: currentChurch.id,
        assignment_mode: pendingAutoAssignMode,
        dry_run: true,
        target_start_date: range.target_start_date,
        target_end_date: range.target_end_date,
        target_service_ids: range.target_service_ids,
      });

      if (rpcError) {
        console.error('Error generating auto-assign preview:', rpcError);
        setAutoAssignOperationStatus(null);
        Alert.alert('Error', rpcError.message || 'Could not generate the assignment preview.');
        return;
      }

      const result = data?.[0] ? normalizeAutoAssignResult(data[0]) : null;
      if (result) {
        setAutoAssignPreview(result);
        setAutoAssignPreviewKey(requestKey);
        setAutoAssignOperationStatus('Preview ready.');
      } else {
        setAutoAssignOperationStatus(null);
        Alert.alert('Info', 'No assignment preview was returned.');
      }
    } catch (err) {
      console.error('Error generating auto-assign preview:', err);
      setAutoAssignOperationStatus(null);
      Alert.alert('Error', 'Could not generate the assignment preview.');
    } finally {
      setIsGeneratingAutoAssignPreview(false);
    }
  };

  const applyAutoAssignPreview = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if (!autoAssignPreview) {
      Alert.alert('Preview Required', 'Generate a preview before saving assignments.');
      return;
    }

    const range = getAutoAssignRangeConfig();
    if (!range) return;
    if (autoAssignPreviewKey !== getAutoAssignPreviewKey(range)) {
      clearAutoAssignPreview();
      Alert.alert(
        'Preview Out of Date',
        'The schedule or assignment options changed. Generate a new preview before saving.'
      );
      return;
    }

    console.log('Applying auto-assign preview:', {
      mode: pendingAutoAssignMode,
      rangeMode: autoAssignRangeMode,
      range,
    });

    setAutoAssignMode(pendingAutoAssignMode);
    setIsApplyingAutoAssign(true);
    setAutoAssignOperationStatus('Saving assignments atomically...');

    try {
      const { data, error: rpcError } = await supabase.rpc('auto_assign_service_slots', {
        target_church_id: currentChurch.id,
        assignment_mode: pendingAutoAssignMode,
        dry_run: false,
        target_start_date: range.target_start_date,
        target_end_date: range.target_end_date,
        target_service_ids: range.target_service_ids,
      });

      if (rpcError) {
        console.error('Error applying auto-assign RPC:', rpcError);
        setAutoAssignOperationStatus('Save failed. The preview is still available.');
        Alert.alert('Error', rpcError.message || 'Auto-assignment failed');
        return;
      }

      const result = data?.[0] ? normalizeAutoAssignResult(data[0]) : autoAssignPreview;
      await refreshServicesHook();
      setShowAutoAssignModal(false);
      clearAutoAssignPreview();
      Alert.alert('Success', formatAutoAssignMessage(result, pendingAutoAssignMode));
    } catch (err) {
      console.error('Error applying auto-assign:', err);
      setAutoAssignOperationStatus('Save failed. The preview is still available.');
      Alert.alert('Error', 'Auto-assignment failed');
    } finally {
      setAutoAssignMode(null);
      setIsApplyingAutoAssign(false);
    }
  };

  const toggleBlockService = (serviceKey: string) => {
    const newBlocked = new Set(blockedServices);
    if (newBlocked.has(serviceKey)) {
      newBlocked.delete(serviceKey);
    } else {
      newBlocked.add(serviceKey);
    }
    setBlockedServices(newBlocked);
  };

  const toggleSpecialServiceRole = (roleId: string) => {
    const newRoles = [...specialServiceRoles];
    const index = newRoles.indexOf(roleId);
    if (index > -1) {
      newRoles.splice(index, 1);
    } else {
      newRoles.push(roleId);
    }
    setSpecialServiceRoles(newRoles);
  };

  const handleAddSpecialService = () => {
    if (!specialServiceName.trim()) {
      Alert.alert('Error', 'Please enter a service name');
      return;
    }

    if (specialServiceRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one role for this service');
      return;
    }

    const timeString = formatTimeForDatabase(specialServiceTime);
    console.log('User added special service with roles:', specialServiceRoles, 'time:', timeString);
    const newSpecialService: SpecialService = {
      id: `special-${Date.now()}`,
      name: specialServiceName,
      date: specialServiceDate,
      time: timeString,
      notes: specialServiceNotes,
      selectedRoleIds: specialServiceRoles,
    };

    setSpecialServices([...specialServices, newSpecialService]);
    setShowAddSpecialService(false);
    setSpecialServiceName('');
    setSpecialServiceTime(new Date());
    setSpecialServiceNotes('');
    setSpecialServiceRoles([]);
    setSpecialServiceDate(new Date());
  };

  const toggleAdHocServiceRole = (roleId: string) => {
    const newRoles = [...adHocServiceRoles];
    const index = newRoles.indexOf(roleId);
    if (index > -1) {
      newRoles.splice(index, 1);
    } else {
      newRoles.push(roleId);
    }
    setAdHocServiceRoles(newRoles);
  };

  const handleCreateAdHocService = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if (!adHocServiceName.trim()) {
      Alert.alert('Error', 'Please enter a service name');
      return;
    }

    if (adHocServiceRoles.length === 0) {
      Alert.alert('Error', 'Please select at least one role for this service');
      return;
    }

    console.log('User tapped Create Ad-Hoc Service button');
    console.log('Selected date:', adHocServiceDate);
    console.log('Selected time:', adHocServiceTime);
    setIsCreatingAdHocService(true);

    try {
      // Use the helper function to format date correctly in local timezone
      const dateString = formatDateForDatabase(adHocServiceDate);
      const timeString = formatTimeForDatabase(adHocServiceTime);
      
      console.log('Formatted date string for database:', dateString);
      console.log('Formatted time string for database:', timeString);
      
      const roleNames = (adHocServiceRoles ?? [])
        .map(roleId => (churchRoles ?? []).find(r => r.id === roleId)?.name)
        .filter((name): name is string => name !== undefined);
      
      console.log('Creating ad-hoc service:', { 
        name: adHocServiceName, 
        date: dateString, 
        time: timeString, 
        roleNames 
      });

      const result = await createServiceFromTemplate(
        currentChurch.id,
        dateString,
        adHocServiceName,
        adHocServiceNotes.trim() || undefined,
        roleNames,
        timeString
      );

      if (result) {
        console.log('Ad-hoc service created successfully:', result);
        Alert.alert('Success', 'Service created successfully! It will now appear in the Schedules tab and members will receive reminder notifications.');
        
        // Reset form and close modal
        setAdHocServiceName('');
        setAdHocServiceDate(new Date());
        setAdHocServiceTime(new Date());
        setAdHocServiceNotes('');
        setAdHocServiceRoles([]);
        setShowAdHocServiceModal(false);
      } else {
        Alert.alert('Error', 'Failed to create service');
      }
    } catch (err) {
      console.error('Error creating ad-hoc service:', err);
      Alert.alert('Error', 'An error occurred while creating the service');
    } finally {
      setIsCreatingAdHocService(false);
    }
  };

  // Show spinner while auth is initializing OR while the first church fetch is in flight.
  // loading starts true and only becomes false once fetchChurches (or the no-session branch)
  // completes, so this guard reliably prevents a blank/empty flash on Android.
  if (loading || !user) {
    console.log('[ChurchScreen] Showing loading state — loading:', loading, 'user:', !!user);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Church Management',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && (churches ?? []).length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Church Management',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.centerContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={48}
            color={colors.error}
          />
          <Text style={[styles.errorHeading, { color: colors.text }]}>Unable to load</Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              console.log('User tapped Retry on Church error screen');
              if (user) refreshChurches();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const noChurchesText = 'No churches yet';
  const createFirstChurchText = 'Create your first church to get started';
  const noMembersText = 'No members yet';
  const inviteMembersText = 'Share your invitation code with members to join';
  const signOutText = 'Sign Out';
  const churchHeaderTitle = currentChurch?.name || 'Church Management';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.churchHeaderContainer, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.headerAccentPanel} />
        <View style={styles.headerAccentLine} />
        <View style={styles.churchHeaderTopRow}>
          <View style={styles.churchHeaderTextWrap}>
            <Text style={styles.headerEyebrow}>Church</Text>
            <Text
              style={styles.churchHeaderTitle}
              numberOfLines={2}
            >
              {churchHeaderTitle}
            </Text>
          </View>
          <View style={styles.churchHeaderActions}>
            {currentChurch ? (
              <TouchableOpacity
                style={styles.churchHeaderIconButton}
                onPress={openEditChurchNameModal}
                accessibilityLabel="Edit church name"
              >
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.churchHeaderIconButton}
              onPress={() => {
                console.log('User tapped Create Church from header');
                setCreateChurchModalVisible(true);
              }}
              accessibilityLabel="Add church"
            >
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.churchHeaderIconButton}
              onPress={() => {
                console.log('User tapped Sign Out');
                setSignOutModalVisible(true);
              }}
              accessibilityLabel="Sign out"
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={23}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>
        {currentChurch ? (
          <TouchableOpacity
            style={styles.churchHeaderInvitationPill}
            onPress={copyInvitationCode}
            accessibilityLabel="Copy invitation code"
          >
            <IconSymbol
              ios_icon_name="ticket"
              android_material_icon_name="local-offer"
              size={19}
              color="#FFFFFF"
            />
            <View style={styles.churchHeaderInvitationText}>
              <Text style={styles.churchHeaderInvitationLabel}>Invitation Code</Text>
              <Text style={styles.churchHeaderInvitationCode} numberOfLines={1}>
                {currentChurch.invitation_code}
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="doc.on.doc"
              android_material_icon_name="file-copy"
              size={17}
              color="#DBEAFE"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.churchHeaderEmptyPill}>
            <IconSymbol ios_icon_name="building.2" android_material_icon_name="home" size={17} color="#FFFFFF" />
            <Text style={styles.churchHeaderEmptyText} numberOfLines={1}>Create a church to get started</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Church Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Churches</Text>
          </View>

          {(churches ?? []).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {noChurchesText}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {createFirstChurchText}
              </Text>
            </View>
          ) : (
            <View style={styles.churchList}>
              {(churches ?? []).map((church) => {
                const isSelected = currentChurch?.id === church.id;
                return (
                  <TouchableOpacity
                    key={church.id}
                    style={[
                      styles.churchCard,
                      { backgroundColor: colors.cardBackground },
                      isSelected && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      console.log('User selected church:', church.name);
                      setCurrentChurch(church);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="building.2"
                      android_material_icon_name="home"
                      size={24}
                      color={isSelected ? colors.primary : colors.text}
                    />
                    <Text
                      style={[
                        styles.churchName,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                    >
                      {church.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Quarterly Assignment Buttons */}
        {currentChurch && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Management</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                console.log('User tapped Prepare Next Quarter button');
                setShowPrepareQuarterModal(true);
                setPrepareQuarterStep('block');
              }}
            >
              <IconSymbol
                ios_icon_name="calendar.badge.plus"
                android_material_icon_name="event"
                size={24}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Prepare Next Quarter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={() => openAutoAssignModal('fill_empty')}
              disabled={isAutoAssigning}
            >
              {autoAssignMode === 'fill_empty' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="person.2.fill"
                    android_material_icon_name="group"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>Fill Empty Slots</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.reassignButton,
                { marginTop: 12, opacity: isAutoAssigning ? 0.6 : 1 },
              ]}
              onPress={() => openAutoAssignModal('reassign_all')}
              disabled={isAutoAssigning}
            >
              {autoAssignMode === 'reassign_all' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="arrow.triangle.2.circlepath"
                    android_material_icon_name="sync"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>Reassign All Upcoming Slots</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50', marginTop: 12 }]}
              onPress={() => {
                console.log('User tapped Add Single Service button');
                setShowAdHocServiceModal(true);
              }}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={24}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Add Single Service</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.autoAssignSettingsCard,
                {
                  backgroundColor: allowMultipleRolesSameService ? '#EEF6FF' : colors.cardBackground,
                  borderColor: allowMultipleRolesSameService ? colors.primary : '#C7D2FE',
                },
              ]}
              activeOpacity={0.85}
              onPress={() => {
                if (!isSavingAutoAssignSettings) {
                  handleToggleAllowMultipleRolesSameService(!allowMultipleRolesSameService);
                }
              }}
              disabled={isSavingAutoAssignSettings}
            >
              <View
                style={[
                  styles.autoAssignSettingsIcon,
                  { backgroundColor: allowMultipleRolesSameService ? colors.primary : '#E0E7FF' },
                ]}
              >
                <IconSymbol
                  ios_icon_name="person.2.fill"
                  android_material_icon_name="manage-accounts"
                  size={22}
                  color={allowMultipleRolesSameService ? '#fff' : colors.primary}
                />
              </View>
              <View style={styles.autoAssignSettingsText}>
                <Text style={[styles.autoAssignSettingsTitle, { color: colors.text }]}>
                  Allow one member in multiple roles
                </Text>
                <Text style={[styles.autoAssignSettingsDescription, { color: colors.textSecondary }]}>
                  When enabled, auto-assign can schedule the same person for more than one role in the same service.
                </Text>
              </View>
              {isSavingAutoAssignSettings ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View
                  style={styles.autoAssignSwitchWrap}
                  onStartShouldSetResponder={() => true}
                >
                  <Switch
                    value={allowMultipleRolesSameService}
                    onValueChange={handleToggleAllowMultipleRolesSameService}
                    trackColor={{ false: '#CBD5E1', true: colors.primary }}
                    thumbColor="#fff"
                    ios_backgroundColor="#CBD5E1"
                    disabled={isSavingAutoAssignSettings}
                  />
                </View>
              )}
            </TouchableOpacity>

            <View style={[styles.songTypesCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.songTypesHeader}>
                <IconSymbol
                  ios_icon_name="music.note.list"
                  android_material_icon_name="queue-music"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.songTypesHeaderText}>
                  <Text style={[styles.songTypesTitle, { color: colors.text }]}>Song Types</Text>
                  <Text style={[styles.songTypesDescription, { color: colors.textSecondary }]}>
                    Choose the default song type buttons shown in schedules. Other is always available.
                  </Text>
                </View>
              </View>
              <View style={styles.songTypeGrid}>
                {songTypeDraftOptions.map(option => (
                  <View
                    key={option}
                    style={[
                      styles.songTypeOption,
                      styles.songTypeOptionRow,
                      { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                    ]}
                  >
                    <Text style={[styles.songTypeOptionText, { color: colors.primary }]}>
                      {option}
                    </Text>
                    <TouchableOpacity
                      style={styles.removeSongTypeButton}
                      onPress={() => handleRemoveSongType(option)}
                      accessibilityLabel={`Remove ${option}`}
                    >
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={18}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addSongTypeRow}>
                <TextInput
                  style={[styles.addSongTypeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
                  placeholder="Add song type"
                  placeholderTextColor={colors.textSecondary}
                  value={newSongTypeName}
                  onChangeText={setNewSongTypeName}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleAddSongType}
                />
                <TouchableOpacity
                  style={[styles.addSongTypeButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddSongType}
                >
                  <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={18} color="#fff" />
                  <Text style={styles.addSongTypeButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.saveSongTypesButton,
                  { backgroundColor: colors.primary },
                  isSavingSongTypes && styles.disabledButton,
                ]}
                onPress={handleSaveSongTypes}
                disabled={isSavingSongTypes}
              >
                {isSavingSongTypes ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveSongTypesButtonText}>Save Song Types</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tabs and Content */}
        {currentChurch && (
          <>
            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'members' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Members tab');
                  setActiveTab('members');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'members' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Members
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'services' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Services tab');
                  setActiveTab('services');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'services' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Services
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'roles' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Roles tab');
                  setActiveTab('roles');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'roles' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Roles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'notifications' && [styles.activeTab, { borderBottomColor: colors.primary }],
                ]}
                onPress={() => {
                  console.log('User switched to Notifications tab');
                  setActiveTab('notifications');
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'notifications' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Notifications
                </Text>
              </TouchableOpacity>
            </View>

            {/* Members Tab */}
            {activeTab === 'members' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
                </View>

                {(members ?? []).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      {noMembersText}
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      {inviteMembersText}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.membersList}>
                      {(members ?? []).map((member) => {
                        const displayName = member.name || member.email;
                        const displayRoles = member.memberRoles && member.memberRoles.length > 0
                          ? member.memberRoles.map(r => r.role_name).join(', ')
                          : 'No roles assigned';
                        const isMemberAdmin = member.is_admin || member.member_id === currentChurch?.admin_id;
                        return (
                        <View
                          key={member.id}
                          style={[styles.memberCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.memberInfo}>
                            <IconSymbol
                              ios_icon_name="person.circle"
                              android_material_icon_name="person"
                              size={40}
                              color={colors.primary}
                            />

                            <View style={styles.memberDetails}>
                              <Text style={[styles.memberName, { color: colors.text }]}>
                                {displayName}
                              </Text>
                              <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                                {member.email}
                              </Text>
                                <Text style={[styles.memberRole, { color: colors.primary }]}>
                                  {displayRoles}
                                </Text>
                                {isMemberAdmin && (
                                  <View style={styles.memberAdminBadge}>
                                    <Text style={styles.memberAdminBadgeText}>
                                      {member.member_id === currentChurch?.admin_id ? 'Owner Admin' : 'Scheduling Admin'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                          </View>
                          <View style={styles.memberActions}>
                            <TouchableOpacity
                              onPress={() => openEditMemberModal(member.id)}
                              style={styles.editIconButton}
                            >
                              <IconSymbol
                                ios_icon_name="pencil"
                                android_material_icon_name="edit"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openDeleteModal(member.id)}
                              style={styles.deleteButton}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={20}
                                color="#ff3b30"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Services Tab */}
            {activeTab === 'services' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Services</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Add Service');
                      openAddServiceModal();
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="plus"
                      android_material_icon_name="add"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {(recurringServices ?? []).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      No recurring services
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      Add weekly services that repeat
                    </Text>
                  </View>
                ) : (
                  <View style={styles.servicesList}>
                    {(recurringServices ?? []).map((service) => {
                      const dayName = getDayName(service.day_of_week);
                      const timeDisplay = formatTime(service.time);
                      const rolesDisplay = service.roles && service.roles.length > 0 
                        ? service.roles.join(', ') 
                        : '';
                      return (
                        <View
                          key={service.id}
                          style={[styles.serviceCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.serviceInfo}>
                            <IconSymbol
                              ios_icon_name="calendar"
                              android_material_icon_name="event"
                              size={40}
                              color={colors.primary}
                            />
                            <View style={styles.serviceDetails}>
                              <Text style={[styles.serviceName, { color: colors.text }]}>
                                {service.name}
                              </Text>
                              <Text style={[styles.serviceTime, { color: colors.textSecondary }]}>
                                {dayName}
                              </Text>
                              <Text style={[styles.serviceTime, { color: colors.textSecondary }]}>
                                {timeDisplay}
                              </Text>
                              {rolesDisplay && (
                                <Text style={[styles.serviceRoles, { color: colors.primary }]}>
                                  Roles: {rolesDisplay}
                                </Text>
                              )}
                              {service.notes && (
                                <Text style={[styles.serviceNotes, { color: colors.textSecondary }]}>
                                  {service.notes}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.serviceActions}>
                            <TouchableOpacity
                              onPress={() => openEditServiceModal(service.id)}
                              style={styles.editIconButton}
                            >
                              <IconSymbol
                                ios_icon_name="pencil"
                                android_material_icon_name="edit"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => openDeleteServiceModal(service.id)}
                              style={styles.deleteIconButton}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={20}
                                color="#ff3b30"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Church Roles</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Add Role');
                      setAddRoleModalVisible(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="plus"
                      android_material_icon_name="add"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Drag roles to reorder how they appear in services
                </Text>

                {(churchRoles ?? []).length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      No roles defined
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      Add roles for your church team
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rolesList}>
                    {(churchRoles ?? []).map((role, index) => {
                      return (
                        <View
                          key={role.id}
                          style={[styles.roleCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.roleInfo}>
                            <View style={styles.roleOrderControls}>
                              <TouchableOpacity
                                onPress={() => moveRoleUp(index)}
                                disabled={index === 0}
                                style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                              >
                                <IconSymbol
                                  ios_icon_name="chevron.up"
                                  android_material_icon_name="expand-less"
                                  size={20}
                                  color={index === 0 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => moveRoleDown(index)}
                                disabled={index === (churchRoles ?? []).length - 1}
                                style={[styles.orderButton, index === (churchRoles ?? []).length - 1 && styles.orderButtonDisabled]}
                              >
                                <IconSymbol
                                  ios_icon_name="chevron.down"
                                  android_material_icon_name="expand-more"
                                  size={20}
                                  color={index === (churchRoles ?? []).length - 1 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                            </View>
                            <IconSymbol
                              ios_icon_name="person.badge.shield.checkmark"
                              android_material_icon_name="person"
                              size={40}
                              color={colors.primary}
                            />
                            <View style={styles.roleDetails}>
                              <Text style={[styles.roleName, { color: colors.text }]}>
                                {role.name}
                              </Text>
                              {role.description && (
                                <Text style={[styles.roleDescription, { color: colors.textSecondary }]}>
                                  {role.description}
                                </Text>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => openDeleteRoleModal(role.id)}
                            style={styles.deleteIconButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color="#ff3b30"
                            />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Settings</Text>
                </View>

                {/* Automation Status Banner */}
                <View style={[styles.automationBanner, { backgroundColor: '#4CAF50' + '20', borderColor: '#4CAF50', borderWidth: 2 }]}>
                  <View style={styles.automationBannerContent}>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="notifications"
                      size={32}
                      color="#4CAF50"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.automationBannerTitle, { color: '#4CAF50' }]}>
                        ✅ Automated Notifications Active
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text }]}>
                        The system automatically checks every hour and sends reminders to members at the times you've configured below. Members will receive notifications even when the app is closed.
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text, marginTop: 8, fontWeight: '600' }]}>
                        How it works:
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text }]}>
                        • Every hour, the system checks for upcoming services
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text }]}>
                        • If a service is 6 hours away (or 24 hours, etc.), notifications are sent
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text }]}>
                        • Members receive push notifications on their devices
                      </Text>
                      <Text style={[styles.automationBannerText, { color: colors.text }]}>
                        • Works for both recurring and single services
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 16, marginTop: 16 }]}>
                  Configure when members receive reminders about their upcoming service assignments (including single services)
                </Text>

                {/* Enable/Disable Notifications */}
                <View style={[styles.notificationCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.notificationRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.notificationLabel, { color: colors.text }]}>
                        Enable Notifications
                      </Text>
                      <Text style={[styles.notificationSubtext, { color: colors.textSecondary }]}>
                        Send reminders to members before their services
                      </Text>
                    </View>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={(value) => {
                        console.log('User toggled notifications:', value);
                        setNotificationsEnabled(value);
                      }}
                      trackColor={{ false: '#767577', true: colors.primary }}
                      thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* Notification Times */}
                <View style={[styles.notificationCard, { backgroundColor: colors.cardBackground, marginTop: 16 }]}>
                  <Text style={[styles.notificationLabel, { color: colors.text, marginBottom: 12 }]}>
                    Reminder Times
                  </Text>
                  <Text style={[styles.notificationSubtext, { color: colors.textSecondary, marginBottom: 16 }]}>
                    Select when to send reminders before each service
                  </Text>

                  {/* Quick Select Options */}
                  <View style={styles.quickSelectContainer}>
                    {[1, 2, 6, 12, 24, 48, 72, 168].map((hour) => {
                      const isSelected = (selectedNotificationHours ?? []).includes(hour);
                      const hourLabel = hour === 1 ? '1 hour' : hour < 24 ? `${hour} hours` : hour === 24 ? '1 day' : hour === 48 ? '2 days' : hour === 72 ? '3 days' : '1 week';
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.quickSelectButton,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          onPress={() => toggleNotificationHour(hour)}
                        >
                          <Text
                            style={[
                              styles.quickSelectText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {hourLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Custom Hour Input */}
                  <View style={styles.customHourContainer}>
                    <TextInput
                      style={[styles.customHourInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Custom hours (1-168)"
                      placeholderTextColor={colors.textSecondary}
                      value={customHourInput}
                      onChangeText={setCustomHourInput}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.addCustomButton, { backgroundColor: colors.primary }]}
                      onPress={addCustomNotificationHour}
                    >
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Selected Times List */}
                  {(selectedNotificationHours ?? []).length > 0 && (
                    <View style={styles.selectedTimesContainer}>
                      <Text style={[styles.selectedTimesLabel, { color: colors.text }]}>
                        Selected reminder times:
                      </Text>
                      {(selectedNotificationHours ?? []).map((hour) => {
                        const hourLabel = hour === 1 ? '1 hour before' : hour < 24 ? `${hour} hours before` : hour === 24 ? '1 day before' : hour === 48 ? '2 days before' : hour === 72 ? '3 days before' : hour === 168 ? '1 week before' : `${hour} hours before`;
                        return (
                          <View key={hour} style={[styles.selectedTimeChip, { backgroundColor: colors.inputBackground }]}>
                            <Text style={[styles.selectedTimeText, { color: colors.text }]}>
                              {hourLabel}
                            </Text>
                            <TouchableOpacity onPress={() => removeNotificationHour(hour)}>
                              <IconSymbol
                                ios_icon_name="xmark.circle.fill"
                                android_material_icon_name="close"
                                size={20}
                                color={colors.textSecondary}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveNotificationsButton, { backgroundColor: colors.primary, marginTop: 24 }]}
                  onPress={handleSaveNotificationSettings}
                  disabled={isSavingNotifications}
                >
                  {isSavingNotifications ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <IconSymbol
                        ios_icon_name="checkmark.circle"
                        android_material_icon_name="notifications"
                        size={24}
                        color="#fff"
                      />
                      <Text style={styles.saveNotificationsButtonText}>Save Notification Settings</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 16, fontStyle: 'italic' }]}>
                  Note: Members will receive notifications at the selected times before each service they are assigned to (including single services added via "Add Single Service")
                </Text>

                {/* Troubleshooting Info */}
                <View style={[styles.troubleshootingCard, { backgroundColor: colors.inputBackground, marginTop: 16 }]}>
                  <Text style={[styles.troubleshootingTitle, { color: colors.text }]}>
                    💡 Not receiving notifications?
                  </Text>
                  <Text style={[styles.troubleshootingText, { color: colors.textSecondary }]}>
                    The system checks every hour for services that match your reminder times. For example, if you have a 6-hour reminder enabled:
                  </Text>
                  <Text style={[styles.troubleshootingText, { color: colors.textSecondary, marginTop: 8 }]}>
                    • A service at 3:00 PM will trigger a notification around 9:00 AM
                  </Text>
                  <Text style={[styles.troubleshootingText, { color: colors.textSecondary }]}>
                    • A service at 7:30 PM will trigger a notification around 1:30 PM
                  </Text>
                  <Text style={[styles.troubleshootingText, { color: colors.textSecondary, marginTop: 8 }]}>
                    The system checks within a 30-minute window, so notifications may arrive slightly before or after the exact time.
                  </Text>
                  <Text style={[styles.troubleshootingText, { color: colors.textSecondary, marginTop: 8, fontWeight: '600' }]}>
                    To test: Create a service 6 hours from now and wait for the next hourly check!
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* All modals remain the same - keeping them for completeness */}
      {/* Create Church Modal */}
      <Modal
        visible={isCreateChurchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!isCreatingChurch) setCreateChurchModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Church</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Church Name"
              placeholderTextColor={colors.textSecondary}
              value={newChurchName}
              onChangeText={setNewChurchName}
              editable={!isCreatingChurch}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreateChurch}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: '#e0e0e0' },
                  isCreatingChurch && styles.disabledButton,
                ]}
                onPress={() => {
                  if (isCreatingChurch) return;
                  console.log('User cancelled create church');
                  setCreateChurchModalVisible(false);
                  setNewChurchName('');
                }}
                disabled={isCreatingChurch}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                  isCreatingChurch && styles.disabledButton,
                ]}
                onPress={handleCreateChurch}
                disabled={isCreatingChurch}
              >
                {isCreatingChurch ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Church Name Modal */}
      <Modal
        visible={isEditChurchNameModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditChurchNameModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Church Name</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Church Name"
              placeholderTextColor={colors.textSecondary}
              value={editChurchName}
              onChangeText={setEditChurchName}
              autoCapitalize="words"
              returnKeyType="done"
              editable={!isSavingChurchName}
              onSubmitEditing={handleUpdateChurchName}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: '#e0e0e0' },
                  isSavingChurchName && styles.disabledButton,
                ]}
                onPress={closeEditChurchNameModal}
                disabled={isSavingChurchName}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                  isSavingChurchName && styles.disabledButton,
                ]}
                onPress={handleUpdateChurchName}
                disabled={isSavingChurchName}
              >
                {isSavingChurchName ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        visible={isEditMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Member</Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={editMemberEmail}
                onChangeText={setEditMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={editMemberName}
                onChangeText={setEditMemberName}
              />

                <View style={styles.pickerContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>Roles (select multiple)</Text>
                  {(churchRoles ?? []).length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {(churchRoles ?? []).map((role) => {
                      const isSelected = (editMemberRoles ?? []).includes(role.name);
                      return (
                        <TouchableOpacity
                          key={role.id}
                          style={[
                            styles.roleCheckbox,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => {
                            console.log('User toggled role:', role.name);
                            if (isSelected) {
                              setEditMemberRoles(editMemberRoles.filter(r => r !== role.name));
                            } else {
                              setEditMemberRoles([...editMemberRoles, role.name]);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.roleCheckboxText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    Add roles in the Roles tab first
                  </Text>
                  )}
                </View>

                <View style={[styles.adminToggleRow, { borderColor: colors.border }]}>
                  <View style={styles.adminToggleTextWrap}>
                    <Text style={[styles.adminToggleTitle, { color: colors.text }]}>Scheduling Admin</Text>
                    <Text style={[styles.adminToggleDescription, { color: colors.textSecondary }]}>
                      Can manage schedules, roles, members, notifications, and auto-assignments.
                    </Text>
                  </View>
                  <Switch
                    value={editMemberIsAdmin}
                    onValueChange={setEditMemberIsAdmin}
                    disabled={(members ?? []).find(m => m.id === memberToEdit)?.member_id === currentChurch?.admin_id}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={editMemberIsAdmin ? colors.primary : '#f4f3f4'}
                  />
                </View>

                <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                  onPress={() => {
                    console.log('User cancelled edit member');
                    setEditMemberModalVisible(false);
                    setMemberToEdit(null);
                    setEditMemberEmail('');
                      setEditMemberName('');
                      setEditMemberRoles([]);
                      setEditMemberIsAdmin(false);
                    }}
                >
                  <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleEditMember}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Member</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove this member?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled delete');
                  setDeleteModalVisible(false);
                  setMemberToDelete(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteMember}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Service Modal */}
      <Modal
        visible={isAddServiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setAddServiceModalVisible(false);
          resetServiceForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {serviceToEdit ? 'Edit Weekly Service' : 'Add Weekly Service'}
              </Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Sunday Morning)"
                placeholderTextColor={colors.textSecondary}
                value={newServiceName}
                onChangeText={setNewServiceName}
              />

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Day of Week</Text>
                <View style={styles.dayButtons}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayButton,
                        { borderColor: colors.border },
                        newServiceDay === index && { backgroundColor: colors.primary },
                      ]}
                      onPress={() => setNewServiceDay(index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          { color: newServiceDay === index ? '#fff' : colors.text },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="HH:MM (e.g., 09:00)"
                  placeholderTextColor={colors.textSecondary}
                  value={newServiceTime}
                  onChangeText={setNewServiceTime}
                />
              </View>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Roles for this service</Text>
                {(churchRoles ?? []).length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {(churchRoles ?? []).map((role) => {
                      const isSelected = (selectedServiceRoles ?? []).includes(role.name);
                      return (
                        <TouchableOpacity
                          key={role.id}
                          style={[
                            styles.roleCheckbox,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => toggleServiceRole(role.name)}
                        >
                          <Text
                            style={[
                              styles.roleCheckboxText,
                              { color: isSelected ? '#fff' : colors.text },
                            ]}
                          >
                            {role.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                    Add roles in the Roles tab first
                  </Text>
                )}
              </View>

              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="Additional notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newServiceNotes}
                onChangeText={setNewServiceNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                  onPress={() => {
                    console.log('User cancelled weekly service modal');
                    setAddServiceModalVisible(false);
                    resetServiceForm();
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveService}
                >
                  <Text style={styles.saveButtonText}>{serviceToEdit ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Role Modal */}
      <Modal
        visible={isAddRoleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Church Role</Text>

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Role Name (e.g., Worship Leader)"
              placeholderTextColor={colors.textSecondary}
              value={newRoleName}
              onChangeText={setNewRoleName}
            />

            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newRoleDescription}
              onChangeText={setNewRoleDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled add role');
                  setAddRoleModalVisible(false);
                  setNewRoleName('');
                  setNewRoleDescription('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleAddRole}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Service Confirmation Modal */}
      <Modal
        visible={isDeleteServiceModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Service</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this recurring service?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled delete service');
                  setDeleteServiceModalVisible(false);
                  setServiceToDelete(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteService}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Role Confirmation Modal */}
      <Modal
        visible={isDeleteRoleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Role</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this role?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled delete role');
                  setDeleteRoleModalVisible(false);
                  setRoleToDelete(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteRole}
              >
                <Text style={styles.saveButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={isSignOutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setSignOutModalVisible(false);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSignOut}
              >
                <Text style={styles.saveButtonText}>{signOutText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Auto Assign Preview Modal */}
      <Modal
        visible={showAutoAssignModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!isApplyingAutoAssign) {
            setShowAutoAssignModal(false);
            clearAutoAssignPreview();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.autoAssignModalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <View style={[styles.autoAssignModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {pendingAutoAssignMode === 'reassign_all' ? 'Preview Reassign All' : 'Preview Fill Empty Slots'}
              </Text>
              <Text style={[styles.autoAssignDescription, { color: colors.textSecondary }]}>
                {pendingAutoAssignMode === 'reassign_all'
                  ? 'This preview clears assignments in the selected range and rebuilds them before anything is saved.'
                  : 'This preview keeps current assignments and fills only open slots before anything is saved.'}
              </Text>
            </View>

            <SectionList<AutoAssignListItem, AutoAssignListSection>
              style={styles.autoAssignModalBody}
              contentContainerStyle={styles.autoAssignModalBodyContent}
              contentInsetAdjustmentBehavior="automatic"
              sections={autoAssignSections}
              keyExtractor={item => (
                item.kind === 'assignment'
                  ? `assignment-${item.assignment.assignment_id}`
                  : `skipped-${item.skipped.assignment_id}`
              )}
              renderItem={({ item }) => <AutoAssignVirtualRow row={item} />}
              renderSectionHeader={({ section }) => (
                <Text
                  style={[
                    styles.autoAssignPreviewTitle,
                    styles.autoAssignSectionHeader,
                    { color: colors.text, backgroundColor: colors.cardBackground },
                  ]}
                >
                  {section.title}
                </Text>
              )}
              ListHeaderComponent={(
                <>
                  <Text style={[styles.label, { color: colors.text }]}>Assignment Range</Text>
                  <View style={styles.autoAssignRangeGrid}>
                    {AUTO_ASSIGN_RANGE_OPTIONS.map(option => {
                      const isSelected = autoAssignRangeMode === option.mode;
                      return (
                        <TouchableOpacity
                          key={option.mode}
                          style={[
                            styles.autoAssignRangeChip,
                            {
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? colors.primary : colors.inputBackground,
                            },
                          ]}
                          onPress={() => {
                            setAutoAssignRangeMode(option.mode);
                            clearAutoAssignPreview();
                          }}
                          disabled={isGeneratingAutoAssignPreview || isApplyingAutoAssign}
                        >
                          <Text style={[styles.autoAssignRangeChipText, { color: isSelected ? '#fff' : colors.text }]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {autoAssignRangeMode === 'selected_range' && (
                    <View style={styles.autoAssignDateRange}>
                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                        onPress={() => {
                          setDraftAutoAssignStartDate(autoAssignStartDate);
                          setShowAutoAssignStartPicker(true);
                          setShowAutoAssignEndPicker(false);
                        }}
                      >
                        <Text style={[styles.dateButtonText, { color: colors.text }]}>
                          Start: {autoAssignStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                      {showAutoAssignStartPicker && (
                        <View style={styles.datePickerWrapper}>
                          <DateTimePicker
                            value={draftAutoAssignStartDate}
                            mode="date"
                            display="spinner"
                            themeVariant="light"
                            textColor="#000000"
                            onChange={(event, date) => {
                              if (date) setDraftAutoAssignStartDate(getStartOfLocalDay(date));
                            }}
                          />
                          <View style={styles.pickerActionRow}>
                            <TouchableOpacity
                              style={[styles.pickerActionButton, styles.pickerCancelButton]}
                              onPress={() => {
                                setDraftAutoAssignStartDate(autoAssignStartDate);
                                setShowAutoAssignStartPicker(false);
                              }}
                            >
                              <Text style={styles.pickerCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                              onPress={() => {
                                setAutoAssignStartDate(draftAutoAssignStartDate);
                                setShowAutoAssignStartPicker(false);
                                clearAutoAssignPreview();
                              }}
                            >
                              <Text style={styles.pickerConfirmText}>Confirm</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                        onPress={() => {
                          setDraftAutoAssignEndDate(autoAssignEndDate);
                          setShowAutoAssignEndPicker(true);
                          setShowAutoAssignStartPicker(false);
                        }}
                      >
                        <Text style={[styles.dateButtonText, { color: colors.text }]}>
                          End: {autoAssignEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                      {showAutoAssignEndPicker && (
                        <View style={styles.datePickerWrapper}>
                          <DateTimePicker
                            value={draftAutoAssignEndDate}
                            mode="date"
                            display="spinner"
                            themeVariant="light"
                            textColor="#000000"
                            onChange={(event, date) => {
                              if (date) setDraftAutoAssignEndDate(getStartOfLocalDay(date));
                            }}
                          />
                          <View style={styles.pickerActionRow}>
                            <TouchableOpacity
                              style={[styles.pickerActionButton, styles.pickerCancelButton]}
                              onPress={() => {
                                setDraftAutoAssignEndDate(autoAssignEndDate);
                                setShowAutoAssignEndPicker(false);
                              }}
                            >
                              <Text style={styles.pickerCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                              onPress={() => {
                                setAutoAssignEndDate(draftAutoAssignEndDate);
                                setShowAutoAssignEndPicker(false);
                                clearAutoAssignPreview();
                              }}
                            >
                              <Text style={styles.pickerConfirmText}>Confirm</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      styles.autoAssignPreviewButton,
                      { backgroundColor: colors.primary },
                      isGeneratingAutoAssignPreview && styles.disabledButton,
                    ]}
                    onPress={requestAutoAssignPreview}
                    disabled={isGeneratingAutoAssignPreview || isApplyingAutoAssign}
                  >
                    {isGeneratingAutoAssignPreview ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {autoAssignPreview ? 'Regenerate Preview' : 'Generate Preview'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {autoAssignOperationStatus ? (
                    <Text
                      style={[
                        styles.adminOperationStatus,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {autoAssignOperationStatus}
                    </Text>
                  ) : null}

                  {autoAssignPreview && (
                    <View style={styles.autoAssignPreviewPanel}>
                      <View style={styles.autoAssignStatsGrid}>
                        <View style={[styles.autoAssignStat, { backgroundColor: colors.inputBackground }]}>
                          <Text style={[styles.autoAssignStatValue, { color: colors.primary }]}>{autoAssignPreview.assigned_count}</Text>
                          <Text style={[styles.autoAssignStatLabel, { color: colors.textSecondary }]}>Will assign</Text>
                        </View>
                        <View style={[styles.autoAssignStat, { backgroundColor: colors.inputBackground }]}>
                          <Text style={[styles.autoAssignStatValue, { color: colors.text }]}>{autoAssignPreview.open_slot_count}</Text>
                          <Text style={[styles.autoAssignStatLabel, { color: colors.textSecondary }]}>Slots checked</Text>
                        </View>
                        <View style={[styles.autoAssignStat, { backgroundColor: colors.inputBackground }]}>
                          <Text style={[styles.autoAssignStatValue, { color: '#B45309' }]}>{autoAssignPreview.skipped_count}</Text>
                          <Text style={[styles.autoAssignStatLabel, { color: colors.textSecondary }]}>Left open</Text>
                        </View>
                        {pendingAutoAssignMode === 'reassign_all' && (
                          <View style={[styles.autoAssignStat, { backgroundColor: colors.inputBackground }]}>
                            <Text style={[styles.autoAssignStatValue, { color: '#C2410C' }]}>{autoAssignPreview.cleared_count}</Text>
                            <Text style={[styles.autoAssignStatLabel, { color: colors.textSecondary }]}>Will clear</Text>
                          </View>
                        )}
                      </View>

                      {autoAssignPreview.preview.length === 0 && (
                        <View style={styles.autoAssignEmptyPreview}>
                          <Text style={[styles.autoAssignPreviewTitle, { color: colors.text }]}>
                            Schedule Preview
                          </Text>
                          <Text style={[styles.autoAssignEmptyText, { color: colors.textSecondary }]}>
                            No assignment changes found for this range.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
              stickySectionHeadersEnabled={false}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              ListFooterComponent={<View style={styles.autoAssignListFooter} />}
            />

            <View style={[styles.modalButtons, styles.autoAssignModalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  setShowAutoAssignModal(false);
                  clearAutoAssignPreview();
                }}
                disabled={isApplyingAutoAssign}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: pendingAutoAssignMode === 'reassign_all' ? '#C2410C' : colors.primary },
                  (!autoAssignPreview || isApplyingAutoAssign) && styles.disabledButton,
                ]}
                onPress={applyAutoAssignPreview}
                disabled={!autoAssignPreview || isApplyingAutoAssign}
              >
                {isApplyingAutoAssign ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {pendingAutoAssignMode === 'reassign_all' ? 'Confirm Reassign' : 'Confirm Fill'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prepare Quarter Modal - TWO-STEP WORKFLOW */}
      <Modal visible={showPrepareQuarterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff', maxWidth: 500 }]}>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: 22, marginBottom: 8 }]}>
                {prepareQuarterStep === 'block' ? 'Step 1: Block Recurring Dates' : 'Step 2: Add Special Services'}
              </Text>
              
              {prepareQuarterStep === 'block' && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Select Quarter</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    {[1, 2, 3, 4].map(q => {
                      const isSelected = selectedQuarter === q;
                      const quarterText = `Q${q}`;
                      return (
                        <TouchableOpacity
                          key={q}
                          style={[
                            styles.quarterButton,
                            { flex: 1, marginHorizontal: 4, backgroundColor: colors.inputBackground, paddingVertical: 12, borderRadius: 8 },
                            isSelected && { backgroundColor: colors.primary },
                          ]}
                          onPress={() => setSelectedQuarter(q)}
                        >
                          <Text style={[
                            styles.quarterButtonText,
                            { color: isSelected ? '#fff' : colors.text, fontWeight: '600' },
                          ]}>
                            {quarterText}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Year</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Year"
                    placeholderTextColor={colors.textSecondary}
                    value={selectedYear.toString()}
                    onChangeText={(text) => setSelectedYear(parseInt(text) || new Date().getFullYear())}
                    keyboardType="number-pad"
                  />

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Block Recurring Services</Text>
                  <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 8 }]}>
                    Select dates to skip for recurring services
                  </Text>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {(recurringServices ?? []).map(template => {
                      const { startDate, endDate } = getQuarterDates(selectedQuarter, selectedYear);
                      const currentDate = new Date(startDate);
                      const serviceDates: Date[] = [];

                      while (currentDate <= endDate) {
                        if (currentDate.getDay() === template.day_of_week) {
                          serviceDates.push(new Date(currentDate));
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                      }

                      return serviceDates.map(date => {
                        const serviceKey = `${template.id}-${date.toISOString().split('T')[0]}`;
                        const isBlocked = blockedServices.has(serviceKey);
                        const dateText = formatDate(date.toISOString());
                        return (
                          <TouchableOpacity
                            key={serviceKey}
                            style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}
                            onPress={() => toggleBlockService(serviceKey)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.blockServiceText, { color: colors.text, fontWeight: '600' }]}>
                                {template.name}
                              </Text>
                              <Text style={[styles.blockServiceText, { color: colors.textSecondary, fontSize: 13 }]}>
                                {dateText}
                              </Text>
                            </View>
                            <View style={[
                              styles.checkbox,
                              { borderColor: colors.primary },
                              isBlocked && { backgroundColor: colors.primary },
                            ]}>
                              {isBlocked && (
                                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="done" size={16} color="#fff" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })}
                  </ScrollView>

                  <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]} 
                    onPress={handleSaveBlockedDates}
                  >
                    <Text style={styles.primaryButtonText}>Continue to Special Services</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.secondaryButton, { backgroundColor: '#e0e0e0', marginTop: 12 }]} 
                    onPress={() => {
                      console.log('User cancelled prepare quarter');
                      setShowPrepareQuarterModal(false);
                      setPrepareQuarterStep('block');
                      setBlockedServices(new Set());
                      setSpecialServices([]);
                    }}
                  >
                    <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {prepareQuarterStep === 'special' && showAddSpecialService && (
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text, fontSize: 20, marginBottom: 16 }]}>Add Special Service</Text>
                  <Text style={[styles.label, { color: colors.text }]}>Service Name</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                    placeholder="e.g. Christmas Service"
                    placeholderTextColor={colors.textSecondary}
                    value={specialServiceName}
                    onChangeText={setSpecialServiceName}
                  />
                    <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={() => {
                        setDraftSpecialServiceDate(specialServiceDate);
                        setShowSpecialServiceDatePicker(true);
                      }}
                    >
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {specialServiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                    {showSpecialServiceDatePicker && (
                      <View style={styles.datePickerWrapper}>
                        <DateTimePicker
                          value={draftSpecialServiceDate}
                          mode="date"
                          display="spinner"
                          themeVariant="light"
                          textColor="#000000"
                          onChange={(event, date) => {
                            if (date) setDraftSpecialServiceDate(date);
                          }}
                        />
                        <View style={styles.pickerActionRow}>
                          <TouchableOpacity
                            style={[styles.pickerActionButton, styles.pickerCancelButton]}
                            onPress={() => {
                              setDraftSpecialServiceDate(specialServiceDate);
                              setShowSpecialServiceDatePicker(false);
                            }}
                          >
                            <Text style={styles.pickerCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                            onPress={() => {
                              setSpecialServiceDate(draftSpecialServiceDate);
                              setShowSpecialServiceDatePicker(false);
                            }}
                          >
                            <Text style={styles.pickerConfirmText}>Confirm</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                    <TouchableOpacity
                      style={[styles.dateButton, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
                      onPress={() => {
                        setDraftSpecialServiceTime(specialServiceTime);
                        setShowSpecialServiceTimePicker(true);
                      }}
                    >
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {specialServiceTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                    {showSpecialServiceTimePicker && (
                      <View style={styles.datePickerWrapper}>
                        <DateTimePicker
                          value={draftSpecialServiceTime}
                          mode="time"
                          display="spinner"
                          themeVariant="light"
                          textColor="#000000"
                          onChange={(event, time) => {
                            if (time) setDraftSpecialServiceTime(time);
                          }}
                        />
                        <View style={styles.pickerActionRow}>
                          <TouchableOpacity
                            style={[styles.pickerActionButton, styles.pickerCancelButton]}
                            onPress={() => {
                              setDraftSpecialServiceTime(specialServiceTime);
                              setShowSpecialServiceTimePicker(false);
                            }}
                          >
                            <Text style={styles.pickerCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                            onPress={() => {
                              setSpecialServiceTime(draftSpecialServiceTime);
                              setShowSpecialServiceTimePicker(false);
                            }}
                          >
                            <Text style={styles.pickerConfirmText}>Confirm</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  <Text style={[styles.label, { color: colors.text }]}>Notes (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                    placeholder="Any special notes..."
                    placeholderTextColor={colors.textSecondary}
                    value={specialServiceNotes}
                    onChangeText={setSpecialServiceNotes}
                    multiline
                  />
                  <Text style={[styles.label, { color: colors.text }]}>Roles</Text>
                  <View style={styles.roleCheckboxContainer}>
                    {(churchRoles ?? []).map(role => {
                      const isSelected = (specialServiceRoles ?? []).includes(role.id);
                      return (
                        <TouchableOpacity
                          key={role.id}
                          style={[styles.roleCheckbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.cardBackground }]}
                          onPress={() => toggleSpecialServiceRole(role.id)}
                        >
                          <Text style={[styles.roleCheckboxText, { color: isSelected ? '#fff' : colors.text }]}>{role.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleAddSpecialService}>
                    <Text style={[styles.primaryButtonText]}>Add Service</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#e0e0e0', marginTop: 12 }]} onPress={() => {
                    console.log('User cancelled Add Special Service form');
                    setShowAddSpecialService(false);
                    setSpecialServiceName('');
                    setSpecialServiceTime(new Date());
                    setSpecialServiceNotes('');
                    setSpecialServiceRoles([]);
                    setSpecialServiceDate(new Date());
                  }}>
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
              {prepareQuarterStep === 'special' && !showAddSpecialService && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Special Services</Text>
                  <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
                    Add one-time services like Christmas Eve, Easter, etc.
                  </Text>
                  {specialServices.map((special) => {
                    const dateText = formatDate(special.date.toISOString());
                    const roleNames = (special.selectedRoleIds ?? [])
                      .map(roleId => (churchRoles ?? []).find(r => r.id === roleId)?.name)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <View key={special.id} style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.blockServiceText, { color: colors.text, fontWeight: '600' }]}>
                            {special.name}
                          </Text>
                          <Text style={[styles.blockServiceText, { color: colors.textSecondary, fontSize: 13 }]}>
                            {dateText} at {special.time}
                          </Text>
                          {roleNames && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                              Roles: {roleNames}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => {
                          const newSpecial = specialServices.filter(s => s.id !== special.id);
                          setSpecialServices(newSpecial);
                        }}>
                          <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="close" size={24} color="#ff3b30" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={{ marginTop: 12, marginBottom: 20 }}
                    onPress={() => {
                      console.log('User tapped Add Special Service button');
                      setShowAddSpecialService(true);
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>+ Add Special Service</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]} 
                    onPress={handlePrepareQuarter}
                    disabled={isPreparing}
                  >
                    {isPreparing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Generate All Services</Text>
                    )}
                  </TouchableOpacity>
                  {quarterOperationStatus ? (
                    <Text
                      style={[
                        styles.adminOperationStatus,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {quarterOperationStatus}
                    </Text>
                  ) : null}
                  <TouchableOpacity 
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: '#e0e0e0',
                        marginTop: 12,
                        opacity: isPreparing ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => {
                      console.log('User went back to block dates step');
                      setPrepareQuarterStep('block');
                    }}
                    disabled={isPreparing}
                  >
                    <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Back to Block Dates</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: '#e0e0e0',
                        marginTop: 12,
                        opacity: isPreparing ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => {
                      console.log('User cancelled prepare quarter');
                      setShowPrepareQuarterModal(false);
                      setPrepareQuarterStep('block');
                      setBlockedServices(new Set());
                      setSpecialServices([]);
                    }}
                    disabled={isPreparing}
                  >
                    <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Special Service - rendered inline inside Prepare Quarter modal to avoid nested Modal issues */}
      <Modal visible={false} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff', maxWidth: 500 }]}>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: 22 }]}>Add Special Service</Text>
              
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, marginTop: 16 }]}
                placeholder="Service Name (e.g., Christmas Eve)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceName}
                onChangeText={setSpecialServiceName}
              />

              <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => {
                    console.log('User tapped date picker button');
                    setDraftSpecialServiceDate(specialServiceDate);
                    setShowSpecialServiceDatePicker(true);
                  }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {formatDate(specialServiceDate.toISOString())}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceDatePicker && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={draftSpecialServiceDate}
                    mode="date"
                    display="spinner"
                    themeVariant="light"
                    onChange={(event, date) => {
                      console.log('User selected date:', date);
                      if (date) setDraftSpecialServiceDate(date);
                    }}
                  />
                  <View style={styles.pickerActionRow}>
                    <TouchableOpacity
                      style={[styles.pickerActionButton, styles.pickerCancelButton]}
                      onPress={() => {
                        setDraftSpecialServiceDate(specialServiceDate);
                        setShowSpecialServiceDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                      onPress={() => {
                        setSpecialServiceDate(draftSpecialServiceDate);
                        setShowSpecialServiceDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerConfirmText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                  </View>
                )}

              <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => {
                    console.log('User tapped time picker button');
                    setDraftSpecialServiceTime(specialServiceTime);
                    setShowSpecialServiceTimePicker(true);
                  }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {formatTimeForDatabase(specialServiceTime)}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceTimePicker && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={draftSpecialServiceTime}
                    mode="time"
                    display="spinner"
                    themeVariant="light"
                    onChange={(event, date) => {
                      console.log('User selected time:', date);
                      if (date) setDraftSpecialServiceTime(date);
                    }}
                  />
                  <View style={styles.pickerActionRow}>
                    <TouchableOpacity
                      style={[styles.pickerActionButton, styles.pickerCancelButton]}
                      onPress={() => {
                        setDraftSpecialServiceTime(specialServiceTime);
                        setShowSpecialServiceTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                      onPress={() => {
                        setSpecialServiceTime(draftSpecialServiceTime);
                        setShowSpecialServiceTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerConfirmText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                  </View>
                )}

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Select Roles</Text>
              <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
                {(churchRoles ?? []).map(role => {
                  const isSelected = (specialServiceRoles ?? []).includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleItem, { backgroundColor: colors.inputBackground }]}
                      onPress={() => toggleSpecialServiceRole(role.id)}
                    >
                      <Text style={[styles.roleItemText, { color: colors.text }]}>{role.name}</Text>
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        isSelected && { backgroundColor: colors.primary },
                      ]}>
                        {isSelected && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="done" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceNotes}
                onChangeText={setSpecialServiceNotes}
                multiline
              />

              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleAddSpecialService}>
                <Text style={styles.primaryButtonText}>Add Service</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: '#e0e0e0', marginTop: 12 }]} onPress={() => setShowAddSpecialService(false)}>
                <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Ad-Hoc Service Modal */}
      <Modal visible={showAdHocServiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, styles.singleServiceModalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, styles.singleServiceModalTitle, { color: colors.text }]}>Add Single Service</Text>
              
              <TextInput
                style={[styles.input, styles.singleServiceInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Special Prayer Meeting)"
                placeholderTextColor={colors.textSecondary}
                value={adHocServiceName}
                onChangeText={setAdHocServiceName}
              />

              <TouchableOpacity
                  style={[styles.dateButton, styles.singleServiceDateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => {
                    console.log('User tapped ad-hoc date picker button');
                    setDraftAdHocServiceDate(adHocServiceDate);
                    setShowAdHocDatePicker(true);
                  }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {adHocServiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
                {showAdHocDatePicker && (
                  <View style={styles.datePickerWrapper}>
                    <DateTimePicker
                      value={draftAdHocServiceDate}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      textColor="#000000"
                      onChange={(event, date) => {
                        console.log('User selected ad-hoc date:', date);
                        if (date) setDraftAdHocServiceDate(date);
                      }}
                    />
                    <View style={styles.pickerActionRow}>
                      <TouchableOpacity
                        style={[styles.pickerActionButton, styles.pickerCancelButton]}
                        onPress={() => {
                          setDraftAdHocServiceDate(adHocServiceDate);
                          setShowAdHocDatePicker(false);
                        }}
                      >
                        <Text style={styles.pickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                        onPress={() => {
                          setAdHocServiceDate(draftAdHocServiceDate);
                          setShowAdHocDatePicker(false);
                        }}
                      >
                        <Text style={styles.pickerConfirmText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

              <TouchableOpacity
                  style={[styles.dateButton, styles.singleServiceDateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => {
                    console.log('User tapped ad-hoc time picker button');
                    setDraftAdHocServiceTime(adHocServiceTime);
                    setShowAdHocTimePicker(true);
                  }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {adHocServiceTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
                {showAdHocTimePicker && (
                  <View style={styles.datePickerWrapper}>
                    <DateTimePicker
                      value={draftAdHocServiceTime}
                      mode="time"
                      display="spinner"
                      themeVariant="light"
                      textColor="#000000"
                      onChange={(event, date) => {
                        console.log('User selected ad-hoc time:', date);
                        if (date) setDraftAdHocServiceTime(date);
                      }}
                    />
                    <View style={styles.pickerActionRow}>
                      <TouchableOpacity
                        style={[styles.pickerActionButton, styles.pickerCancelButton]}
                        onPress={() => {
                          setDraftAdHocServiceTime(adHocServiceTime);
                          setShowAdHocTimePicker(false);
                        }}
                      >
                        <Text style={styles.pickerCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pickerActionButton, styles.pickerConfirmButton]}
                        onPress={() => {
                          setAdHocServiceTime(draftAdHocServiceTime);
                          setShowAdHocTimePicker(false);
                        }}
                      >
                        <Text style={styles.pickerConfirmText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

              <Text style={[styles.sectionTitle, styles.singleServiceSectionTitle, { color: colors.text }]}>Select Roles</Text>
              <ScrollView style={styles.singleServiceRolesList}>
                {(churchRoles ?? []).map(role => {
                  const isSelected = (adHocServiceRoles ?? []).includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleItem, styles.singleServiceRoleItem, { backgroundColor: colors.inputBackground }]}
                      onPress={() => toggleAdHocServiceRole(role.id)}
                    >
                      <Text style={[styles.roleItemText, { color: colors.text }]}>{role.name}</Text>
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        isSelected && { backgroundColor: colors.primary },
                      ]}>
                        {isSelected && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="done" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={[styles.input, styles.singleServiceInput, styles.singleServiceNotesInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={adHocServiceNotes}
                onChangeText={setAdHocServiceNotes}
                multiline
              />

              <TouchableOpacity 
                style={[styles.primaryButton, styles.singleServicePrimaryButton, { backgroundColor: colors.primary }]} 
                onPress={handleCreateAdHocService}
                disabled={isCreatingAdHocService}
              >
                {isCreatingAdHocService ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Service</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.secondaryButton, styles.singleServiceSecondaryButton, { backgroundColor: '#e0e0e0' }]} 
                onPress={() => {
                  console.log('User cancelled ad-hoc service creation');
                  setShowAdHocServiceModal(false);
                  setAdHocServiceName('');
                  setAdHocServiceDate(new Date());
                  setAdHocServiceTime(new Date());
                  setAdHocServiceNotes('');
                  setAdHocServiceRoles([]);
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  datePickerWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  pickerActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  pickerActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerCancelButton: {
    backgroundColor: '#e0e0e0',
  },
  pickerConfirmButton: {
    backgroundColor: '#007AFF',
  },
  pickerCancelText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  churchHeaderContainer: {
    paddingBottom: 22,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  headerAccentPanel: {
    position: 'absolute',
    right: -24,
    top: 18,
    width: 132,
    height: 74,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    transform: [{ rotate: '-12deg' }],
  },
  headerAccentLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  churchHeaderTopRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  churchHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  churchHeaderTitle: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  churchHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  churchHeaderIconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  churchHeaderInvitationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  churchHeaderInvitationText: {
    flexShrink: 1,
    minWidth: 0,
  },
  churchHeaderInvitationLabel: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  churchHeaderInvitationCode: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  churchHeaderEmptyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  churchHeaderEmptyText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  churchList: {
    gap: 12,
  },
  churchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  churchName: {
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  reassignButton: {
    backgroundColor: '#7C2D12',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  songTypesCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  songTypesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  songTypesHeaderText: {
    flex: 1,
  },
  songTypesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  songTypesDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  songTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  songTypeOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  songTypeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  songTypeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeSongTypeButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSongTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  addSongTypeInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  addSongTypeButton: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addSongTypeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  saveSongTypesButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveSongTypesButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '500',
  },
  memberAdminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  memberAdminBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editIconButton: {
    padding: 8,
  },
  adminToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  adminToggleTextWrap: {
    flex: 1,
  },
  adminToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  adminToggleDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  servicesList: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceDetails: {
    flex: 1,
  },
  serviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  serviceTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  serviceRoles: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  serviceNotes: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  rolesList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleOrderControls: {
    flexDirection: 'column',
    gap: 4,
  },
  orderButton: {
    padding: 4,
  },
  orderButtonDisabled: {
    opacity: 0.3,
  },
  roleDetails: {
    flex: 1,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIconButton: {
    padding: 8,
  },
  notificationCard: {
    padding: 16,
    borderRadius: 12,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationSubtext: {
    fontSize: 14,
  },
  quickSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickSelectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customHourContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customHourInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addCustomButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedTimesContainer: {
    marginTop: 16,
  },
  selectedTimesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedTimeText: {
    fontSize: 14,
    flex: 1,
  },
  saveNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  saveNotificationsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  autoAssignSettingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    gap: 14,
  },
  autoAssignSettingsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoAssignSettingsText: {
    flex: 1,
  },
  autoAssignSettingsTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  autoAssignSettingsDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  autoAssignSwitchWrap: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  singleServiceModalContent: {
    maxWidth: 500,
    maxHeight: '78%',
    padding: 16,
  },
  singleServiceModalTitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  singleServiceInput: {
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  singleServiceDateButton: {
    padding: 11,
    borderRadius: 8,
    marginBottom: 10,
  },
  singleServiceSectionTitle: {
    marginTop: 4,
    marginBottom: 8,
  },
  singleServiceRolesList: {
    maxHeight: 96,
    marginBottom: 10,
  },
  singleServiceRoleItem: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  singleServiceNotesInput: {
    minHeight: 44,
    textAlignVertical: 'top',
  },
  singleServicePrimaryButton: {
    padding: 13,
    marginTop: 4,
  },
  singleServiceSecondaryButton: {
    padding: 13,
    marginTop: 10,
  },
  autoAssignModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '78%',
    padding: 0,
    overflow: 'hidden',
  },
  autoAssignModalHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  autoAssignModalBody: {
    width: '100%',
    flexShrink: 1,
  },
  autoAssignModalBodyContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  autoAssignModalFooter: {
    marginTop: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  autoAssignDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 0,
  },
  autoAssignRangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  autoAssignRangeChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  autoAssignRangeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  autoAssignDateRange: {
    gap: 10,
    marginBottom: 12,
  },
  autoAssignPreviewButton: {
    marginTop: 4,
    marginBottom: 14,
  },
  adminOperationStatus: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  autoAssignPreviewPanel: {
    gap: 12,
  },
  autoAssignSectionHeader: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  autoAssignVirtualRow: {
    marginBottom: 8,
  },
  autoAssignListFooter: {
    height: 8,
  },
  autoAssignEmptyPreview: {
    gap: 8,
  },
  autoAssignStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  autoAssignStat: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 8,
    padding: 10,
  },
  autoAssignStatValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  autoAssignStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  autoAssignPreviewTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  autoAssignPreviewItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  autoAssignPreviewService: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  autoAssignPreviewMember: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  autoAssignPreviewReplacement: {
    fontSize: 12,
    marginTop: 4,
  },
  autoAssignSkippedItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  autoAssignSkippedRole: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  autoAssignEmptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  autoAssignSkipText: {
    fontSize: 12,
    lineHeight: 17,
  },
  autoAssignUnavailableText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  dayButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleCheckboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCheckbox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleCheckboxText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quarterButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quarterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  blockServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  blockServiceText: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateButton: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  roleItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  automationBanner: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  automationBannerContent: {
    flexDirection: 'row',
    gap: 12,
  },
  automationBannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  automationBannerText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  troubleshootingCard: {
    borderRadius: 12,
    padding: 16,
  },
  troubleshootingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  troubleshootingText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
