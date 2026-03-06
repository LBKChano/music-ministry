
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useChurch } from '@/hooks/useChurch';
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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { colors } from '@/styles/commonStyles';
import { Stack } from 'expo-router';
import { useServices } from '@/hooks/useServices';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

// Helper to create a Date object representing the local date from a "YYYY-MM-DD" or full ISO string
// This avoids timezone shifts when displaying dates
const createLocalDate = (dateString: string): Date => {
  if (!dateString || typeof dateString !== 'string') {
    console.error('createLocalDate received invalid dateString:', dateString);
    return new Date(NaN);
  }

  // Extract "YYYY-MM-DD" part, handling potential full ISO strings from timestamp with time zone
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

  // Month is 0-indexed in Date constructor
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
    paddingTop: 60,
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
    flex: 1,
  },
  personText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 2,
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
  const {
    currentChurch,
    members,
    recurringServices,
    churchRoles,
    fillInRequests,
    isAdmin,
    currentMember,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    refreshFillInRequests,
  } = useChurch();

  // Register for push notifications when component mounts
  useEffect(() => {
    if (!currentMember) return;

    const registerForPushNotifications = async () => {
      try {
        console.log('Registering for push notifications...');
        
        // Only register on physical devices
        if (!Device.isDevice) {
          console.log('Push notifications only work on physical devices');
          return;
        }

        // Set up notification channel for Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }
        
        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Push notification permissions not granted');
          return;
        }

        // Get the project ID from app.json via Constants
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
          console.error('No EAS project ID found in app.json');
          return;
        }

        console.log('Expo project ID:', projectId);

        // Get the Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        
        const token = tokenData.data;
        console.log('Got Expo push token:', token);

        // Register the token with the backend
        const success = await registerPushToken(currentMember.id, token, Platform.OS);
        
        if (success) {
          console.log('Push token registered successfully');
        } else {
          console.error('Failed to register push token');
        }
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    };

    registerForPushNotifications();
  }, [currentMember, registerPushToken]);

  // Listen for incoming notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      
      if (data.type === 'fill_in_request') {
        // Handle fill-in request notification tap
        console.log('User tapped fill-in request notification:', data.fillInRequestId);
      } else if (data.type === 'service_reminder') {
        // Handle service reminder notification tap
        console.log('User tapped service reminder notification:', data.serviceId);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const { services, loading: servicesLoading, refreshServices, deleteService, updateAssignment } = useServices(currentChurch?.id || null);

  // Refresh services when church changes
  useEffect(() => {
    if (currentChurch?.id) {
      console.log('Church changed, refreshing services');
      refreshServices();
    }
  }, [currentChurch?.id, refreshServices]);

  const [addServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [editServiceModalVisible, setEditServiceModalVisible] = useState(false);
  const [assignMemberModalVisible, setAssignMemberModalVisible] = useState(false);
  const [deleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [deleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [fillInRequestModalVisible, setFillInRequestModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<{ serviceId: string; assignmentId: string } | null>(null);

  const [newServiceDate, setNewServiceDate] = useState(new Date());
  const [newServiceType, setNewServiceType] = useState('');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRecurringServicePicker, setShowRecurringServicePicker] = useState(false);

  const [fillInReason, setFillInReason] = useState('');
  const [fillInAssignmentId, setFillInAssignmentId] = useState('');
  const [fillInServiceId, setFillInServiceId] = useState('');
  const [fillInRoleName, setFillInRoleName] = useState('');

  const { colors: themeColors } = useTheme();

  // OPTIMIZATION: Memoize filtered services to avoid recalculating on every render
  const filteredServices = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    return services.filter(service => {
      const serviceDate = createLocalDate(service.date);
      
      // Check if date is valid
      if (isNaN(serviceDate.getTime())) {
        console.warn('Skipping service with invalid date:', service.date);
        return false;
      }
      
      // CRITICAL: Only show services that are today or in the future
      return serviceDate >= today;
    });
  }, [services]);

  // OPTIMIZATION: Memoize sorted roles to avoid recalculating on every render
  const sortedRoles = useMemo(() => {
    return [...churchRoles].sort((a, b) => a.display_order - b.display_order);
  }, [churchRoles]);

  const onRefresh = useCallback(async () => {
    console.log('User pulled to refresh schedules');
    setRefreshing(true);
    try {
      // Refresh both services and fill-in requests to ensure UI is up to date
      await Promise.all([
        refreshServices(),
        refreshFillInRequests ? refreshFillInRequests() : Promise.resolve()
      ]);
      console.log('Refresh completed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshServices, refreshFillInRequests]);

  const handleSaveService = async () => {
    console.log('User tapped save service button');
    if (!currentChurch || !newServiceType) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Implementation handled by useServices hook
    setAddServiceModalVisible(false);
    setNewServiceType('');
    setNewServiceNotes('');
    setNewServiceDate(new Date());
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

  const handleSaveAssignment = async () => {
    console.log('User tapped save assignment button');
    // Implementation handled by useServices hook
    setEditServiceModalVisible(false);
    setSelectedService(null);
  };

  const handleSelectRecurringService = (recurringService: any) => {
    console.log('User selected recurring service:', recurringService.name);
    setNewServiceType(recurringService.name);
    setShowRecurringServicePicker(false);
  };

  const handleAssignMember = async () => {
    console.log('User tapped assign member button');
    if (!selectedAssignment || !selectedMemberId) {
      Alert.alert('Error', 'Please select a member');
      return;
    }

    // Find the selected member
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

    // Clear the assignment by setting member_id to null and person_name to empty
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
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    return formattedDate;
  }, []);

  const formatTime = useCallback((timeString: string | null) => {
    if (!timeString) return '';
    
    try {
      // timeString is in format "HH:MM:SS" or "HH:MM"
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  }, []);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewServiceDate(selectedDate);
    }
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
    if (!currentChurch || !currentMember || !fillInAssignmentId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    console.log('Creating fill-in request:', {
      assignmentId: fillInAssignmentId,
      serviceId: fillInServiceId,
      roleName: fillInRoleName,
    });

    const result = await createFillInRequest(
      fillInAssignmentId,
      fillInServiceId,
      currentChurch.id,
      currentMember.id,
      fillInRoleName,
      fillInReason || undefined
    );

    if (result) {
      Alert.alert('Success', 'Fill-in request created successfully. Members with the same role will be notified.');
      setFillInRequestModalVisible(false);
      setFillInReason('');
      setFillInAssignmentId('');
      setFillInServiceId('');
      setFillInRoleName('');
    } else {
      Alert.alert('Error', 'Failed to create fill-in request');
    }
  };

  const handleAcceptFillInRequest = async (requestId: string, assignmentId: string) => {
    console.log('User accepted fill-in request');
    if (!currentChurch || !currentMember) return;

    const success = await acceptFillInRequest(requestId, currentMember.id, currentChurch.id);
    
    if (success) {
      Alert.alert('Success', 'You have accepted the fill-in request and been assigned to this role');
      // Refresh services to show updated assignment
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

  if (servicesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>Loading services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.headerContainer}>
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
            const serviceFillInRequests = fillInRequests.filter(
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

                {/* Display fill-in requests for this service */}
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

                {/* Display assignments sorted by role display_order */}
                {sortedRoles.map(role => {
                  const assignment = service.assignments.find(a => a.role === role.name);
                  if (!assignment) return null;

                  const isMyAssignment = currentMember?.id === assignment.member_id;
                  const hasFillInRequest = serviceFillInRequests.some(
                    req => req.assignment_id === assignment.id
                  );

                  return (
                    <View key={assignment.id} style={styles.assignmentRow}>
                      <Text style={styles.roleNameText} numberOfLines={1} ellipsizeMode="tail">
                        {assignment.role}
                      </Text>
                      <Text style={[styles.personText, !assignment.person_name && styles.emptySlot]}>
                        {assignment.person_name || 'Unassigned'}
                      </Text>
                      {isMyAssignment && !hasFillInRequest && (
                        <TouchableOpacity
                          style={styles.fillInButton}
                          onPress={() => openFillInRequestModal(assignment.id, service.id, assignment.role)}
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
          <TouchableOpacity style={styles.addButton} onPress={() => setAddServiceModalVisible(true)}>
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
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleCreateFillInRequest}
              >
                <Text style={styles.buttonText}>Request</Text>
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
