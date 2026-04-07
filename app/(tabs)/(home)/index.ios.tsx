
import { useChurch } from '@/hooks/useChurch';
import { useNotifications } from '@/contexts/NotificationContext';
import { colors } from '@/styles/commonStyles';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stack } from 'expo-router';
import { useServices } from '@/hooks/useServices';
import { checkAndSendServiceReminders, cleanupOldReminderKeys } from '@/utils/serviceReminders';
import { IconSymbol } from '@/components/IconSymbol';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



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
    paddingBottom: 100,
  },
  headerContainer: {
    backgroundColor: colors.primary,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    textAlign: 'center',
    marginTop: 4,
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
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  pickerButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  recurringServiceItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recurringServiceText: {
    fontSize: 16,
    color: colors.text,
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
  const insets = useSafeAreaInsets();
  const {
    currentChurch,
    members,
    recurringServices,
    churchRoles,
    fillInRequests,
    isAdmin,
    currentMember,
    notificationSettings,
    loading: churchLoading,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    refreshFillInRequests,
    refreshMembers,
    user,
  } = useChurch();

  // OneSignal notification context — replaces expo-notifications push token logic on iOS
  const { requestPermission, oneSignalPlayerId, hasPermission } = useNotifications();

  // Track if we've already registered the OneSignal player ID for this member
  const hasRegisteredThisSession = useRef(false);

  // Register OneSignal player ID with Supabase push_tokens table
  useEffect(() => {
    if (!currentMember) {
      console.log('[OneSignal] [iOS] No current member, skipping push token registration');
      return;
    }

    if (hasRegisteredThisSession.current) {
      console.log('[OneSignal] [iOS] Already registered push token this session, skipping');
      return;
    }

    const registerOneSignalToken = async () => {
      try {
        console.log('[OneSignal] [iOS] Starting push notification setup for member:', currentMember.id);

        // Request permission via OneSignal (shows iOS native permission dialog)
        let permissionGranted = hasPermission;
        if (!permissionGranted) {
          console.log('[OneSignal] [iOS] Requesting notification permission...');
          permissionGranted = await requestPermission();
          console.log('[OneSignal] [iOS] Permission result:', permissionGranted);
        }

        if (!permissionGranted) {
          console.log('[OneSignal] [iOS] Notification permission not granted, skipping token registration');
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in Settings > Music Ministry > Notifications to receive service reminders.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Wait for player ID to become available (may take a moment after permission grant)
        let playerId = oneSignalPlayerId;
        if (!playerId) {
          console.log('[OneSignal] [iOS] Player ID not yet available, waiting for subscription change event...');
          // The effect will re-run when oneSignalPlayerId updates in context
          return;
        }

        console.log('[OneSignal] [iOS] Registering player ID with Supabase:', playerId);
        const success = await registerPushToken(currentMember.id, playerId, 'ios');

        if (success) {
          console.log('[OneSignal] [iOS] Push token (player ID) registered successfully in database');
          hasRegisteredThisSession.current = true;
        } else {
          console.error('[OneSignal] [iOS] Failed to register push token in database');
        }
      } catch (error: any) {
        console.error('[OneSignal] [iOS] Error during push notification registration:', error?.message || error);
      }
    };

    registerOneSignalToken();
  }, [currentMember, oneSignalPlayerId, hasPermission, requestPermission, registerPushToken]);

  const { services, loading: servicesLoading, refreshServices, deleteService, updateAssignment, createServiceFromTemplate } = useServices(currentChurch?.id || null);

  // Refresh services when church changes
  useEffect(() => {
    if (currentChurch?.id) {
      console.log('Church changed, refreshing services');
      refreshServices();
    }
  }, [currentChurch?.id, refreshServices]);

  // Check and send service reminder notifications on app open
  useEffect(() => {
    if (
      !oneSignalPlayerId ||
      !currentChurch ||
      !currentMember ||
      !notificationSettings ||
      servicesLoading ||
      services.length === 0
    ) {
      return;
    }

    console.log('[ServiceReminders] [iOS] App opened — checking for due service reminders');

    // Collect past service IDs for cleanup
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pastServiceIds = services
      .filter(s => {
        const parts = s.date.split('-');
        if (parts.length !== 3) return false;
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d < now;
      })
      .map(s => s.id);

    cleanupOldReminderKeys(pastServiceIds).catch(() => {});

    checkAndSendServiceReminders({
      playerId: oneSignalPlayerId,
      churchName: currentChurch.name,
      services,
      currentMemberId: currentMember.id,
      notificationHours: notificationSettings.notification_hours ?? [24, 6],
      notificationsEnabled: notificationSettings.enabled ?? true,
    }).catch(err => {
      console.error('[ServiceReminders] [iOS] Error checking reminders:', err);
    });
  }, [oneSignalPlayerId, currentChurch, currentMember, notificationSettings, services, servicesLoading]);

  const [addServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [assignMemberModalVisible, setAssignMemberModalVisible] = useState(false);
  const [deleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [deleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [fillInRequestModalVisible, setFillInRequestModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCreatingFillInRequest, setIsCreatingFillInRequest] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<{ serviceId: string; assignmentId: string } | null>(null);

  const [newServiceDate, setNewServiceDate] = useState(new Date());
  const [newServiceType, setNewServiceType] = useState('');
  const [newServiceNotes, setNewServiceNotes] = useState('');

  const [fillInReason, setFillInReason] = useState('');
  const [fillInAssignmentId, setFillInAssignmentId] = useState('');
  const [fillInServiceId, setFillInServiceId] = useState('');
  const [fillInRoleName, setFillInRoleName] = useState('');

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

  const onRefresh = useCallback(async () => {
    console.log('User pulled to refresh schedules');
    setRefreshing(true);
    try {
      await Promise.all([
        refreshServices(),
        refreshMembers ? refreshMembers() : Promise.resolve(),
        refreshFillInRequests ? refreshFillInRequests() : Promise.resolve()
      ]);
      console.log('Refresh completed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshServices, refreshMembers, refreshFillInRequests]);

  const handleSaveService = async () => {
    console.log('User tapped save service button');
    if (!currentChurch || !newServiceType.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Format date as YYYY-MM-DD
    const year = newServiceDate.getFullYear();
    const month = String(newServiceDate.getMonth() + 1).padStart(2, '0');
    const day = String(newServiceDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Find the matching recurring service to get its role slots
    const matchingRecurring = recurringServices.find(rs => rs.name === newServiceType.trim());
    const roleSlots = matchingRecurring?.roles ?? [];

    console.log('Creating service:', { date: dateString, type: newServiceType, roles: roleSlots });

    const result = await createServiceFromTemplate(
      currentChurch.id,
      dateString,
      newServiceType.trim(),
      newServiceNotes.trim() || undefined,
      roleSlots,
    );

    if (result) {
      console.log('Service created successfully:', result.id);
      Alert.alert('Success', 'Service added successfully');
      setAddServiceModalVisible(false);
      setNewServiceType('');
      setNewServiceNotes('');
      setNewServiceDate(new Date());
    } else {
      console.error('Failed to create service');
      Alert.alert('Error', 'Failed to add service. Please try again.');
    }
  };

  const handleDeleteService = async () => {
    console.log('User confirmed delete service');
    if (!serviceToDelete) return;
    const success = await deleteService(serviceToDelete);
    if (success) {
      Alert.alert('Success', 'Service deleted successfully');
    } else {
      Alert.alert('Error', 'Failed to delete service');
    }
    setDeleteServiceModalVisible(false);
    setServiceToDelete(null);
  };

  const handleSelectRecurringService = (recurringService: any) => {
    console.log('User selected recurring service:', recurringService.name);
    setNewServiceType(recurringService.name);
  };

  const handleAssignMember = async () => {
    console.log('User tapped assign member button');
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
    const success = await updateAssignment(selectedAssignment, selectedMemberId, personName);
    if (success) {
      Alert.alert('Success', 'Member assigned successfully');
      setAssignMemberModalVisible(false);
      setSelectedAssignment(null);
      setSelectedMemberId('');
    } else {
      Alert.alert('Error', 'Failed to assign member');
    }
  };

  const handleDeleteAssignment = async () => {
    console.log('User confirmed delete assignment');
    if (!assignmentToDelete) return;
    const success = await updateAssignment(assignmentToDelete.assignmentId, '', '');
    if (success) {
      Alert.alert('Success', 'Assignment cleared successfully');
    } else {
      Alert.alert('Error', 'Failed to clear assignment');
    }
    setDeleteAssignmentModalVisible(false);
    setAssignmentToDelete(null);
  };

  const formatDate = useCallback((dateString: string) => {
    const date = createLocalDate(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
  }, []);

  const formatTime = useCallback((timeString: string | null) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  }, []);

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) setNewServiceDate(selectedDate);
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('User tapped delete service button');
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  };

  const openDeleteAssignmentModal = (serviceId: string, assignmentId: string) => {
    console.log('User tapped delete assignment button');
    setAssignmentToDelete({ serviceId, assignmentId });
    setDeleteAssignmentModalVisible(true);
  };

  const openAssignMemberModal = (assignmentId: string) => {
    console.log('User tapped assign member button');
    setSelectedAssignment(assignmentId);
    setSelectedMemberId('');
    setAssignMemberModalVisible(true);
  };

  const openFillInRequestModal = (assignmentId: string, serviceId: string, roleName: string) => {
    console.log('User tapped request fill-in button');
    setFillInAssignmentId(assignmentId);
    setFillInServiceId(serviceId);
    setFillInRoleName(roleName);
    setFillInRequestModalVisible(true);
  };

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
        if (refreshFillInRequests) await refreshFillInRequests();
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

  const handleAcceptFillInRequest = async (requestId: string, assignmentId: string) => {
    console.log('User accepted fill-in request');
    if (!currentChurch || !currentMember) return;
    const success = await acceptFillInRequest(requestId, currentMember.id, currentChurch.id);
    if (success) {
      Alert.alert('Success', 'You have accepted the fill-in request and been assigned to this role');
      refreshServices();
    } else {
      Alert.alert('Error', 'Failed to accept fill-in request');
    }
  };

  const handleCancelFillInRequest = async (requestId: string) => {
    console.log('User cancelled fill-in request');
    if (!currentChurch) return;
    const success = await cancelFillInRequest(requestId, currentChurch.id);
    if (success) {
      Alert.alert('Success', 'Fill-in request cancelled');
    } else {
      Alert.alert('Error', 'Failed to cancel fill-in request');
    }
  };

  const churchName = currentChurch?.name || 'Schedule';
  const upcomingCount = filteredServices.length;
  const upcomingText = `${upcomingCount} upcoming ${upcomingCount === 1 ? 'service' : 'services'}`;

  if (churchLoading || servicesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading services...</Text>
      </View>
    );
  }

  if (churchLoading || !currentChurch || !user) {
    console.log('[HomeScreen] [iOS] Loading or no church/user, rendering loading state');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{churchName}</Text>
        <Text style={styles.headerSubtitle}>{upcomingText}</Text>
      </View>

      <ScrollView 
        style={styles.container} 
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
        {filteredServices.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming services scheduled</Text>
        ) : (
          filteredServices.map((service) => {
            const serviceFillInRequests = (fillInRequests ?? []).filter(
              req => req.service_id === service.id && req.status === 'pending'
            );

            const dateDisplay = formatDate(service.date);
            const timeDisplay = formatTime(service.time);
            const dateTimeDisplay = timeDisplay ? `${dateDisplay} at ${timeDisplay}` : dateDisplay;

            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceTitle}>{service.service_type}</Text>
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => openDeleteServiceModal(service.id)}
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
                {service.notes && <Text style={styles.serviceNotes}>{service.notes}</Text>}

                {serviceFillInRequests.map(request => {
                  const requestingMemberDisplayName = request.requesting_member_name || request.requesting_member_email;
                  const isMyRequest = currentMember?.id === request.requesting_member_id;
                  const canAccept = currentMember?.memberRoles.some(r => r.role_name === request.role_name);

                  return (
                    <View key={request.id} style={styles.fillInRequestCard}>
                      <Text style={styles.fillInRequestText}>
                        {isMyRequest ? 'You' : requestingMemberDisplayName}
                      </Text>
                      <Text style={styles.fillInRequestText}>
                        requested a fill-in for {request.role_name}
                      </Text>
                      {request.reason && (
                        <Text style={styles.fillInRequestText}>Reason: {request.reason}</Text>
                      )}
                      <View style={styles.fillInRequestButtons}>
                        {!isMyRequest && canAccept && (
                          <TouchableOpacity
                            style={styles.fillInAcceptButton}
                            onPress={() => handleAcceptFillInRequest(request.id, request.assignment_id)}
                          >
                            <Text style={styles.fillInButtonTextSmall}>Accept</Text>
                          </TouchableOpacity>
                        )}
                        {isMyRequest && (
                          <TouchableOpacity
                            style={styles.fillInCancelButton}
                            onPress={() => handleCancelFillInRequest(request.id)}
                          >
                            <Text style={styles.fillInButtonTextSmall}>Cancel Request</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}

                {sortedRoles.map(role => {
                  const assignment = service.assignments.find(a => a.role === role.name);
                  if (!assignment) return null;

                  const isMyAssignment = currentMember?.id === assignment.member_id;
                  const hasFillInRequest = serviceFillInRequests.some(
                    req => req.assignment_id === assignment.id
                  );

                  return (
                    <View key={assignment.id} style={styles.assignmentRow}>
                      <Text style={styles.roleNameText}>{assignment.role}</Text>
                      <Text style={[styles.personText, !assignment.person_name && styles.emptySlot]}>
                        {assignment.person_name || 'Unassigned'}
                      </Text>
                      {isMyAssignment && !hasFillInRequest && (
                        <TouchableOpacity
                          style={styles.fillInButton}
                          onPress={() => openFillInRequestModal(assignment.id, service.id, assignment.role)}
                          disabled={isCreatingFillInRequest}
                        >
                          <Text style={styles.fillInButtonText}>Request Fill-In</Text>
                        </TouchableOpacity>
                      )}
                      {isAdmin && (
                        <>
                          <TouchableOpacity
                            onPress={() => openAssignMemberModal(assignment.id)}
                            style={styles.assignButton}
                          >
                            <IconSymbol
                              ios_icon_name="person.badge.plus"
                              android_material_icon_name="person-add"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          {assignment.member_id && (
                            <TouchableOpacity
                              onPress={() => openDeleteAssignmentModal(service.id, assignment.id)}
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
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={() => {
            console.log('User tapped Add Service button');
            setAddServiceModalVisible(true);
          }}>
            <Text style={styles.addButtonText}>Add Service</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
        onRequestClose={() => setAssignMemberModalVisible(false)}
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
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAssignMember}
              >
                <Text style={styles.buttonText}>Assign</Text>
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
