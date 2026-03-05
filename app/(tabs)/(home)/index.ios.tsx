
import * as Notifications from 'expo-notifications';
import { useChurch } from '@/hooks/useChurch';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { colors } from '@/styles/commonStyles';
import { Stack } from 'expo-router';
import { useServices } from '@/hooks/useServices';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  serviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  serviceDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  serviceNotes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roleText: {
    fontSize: 14,
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
  },
  emptySlot: {
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 4,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
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
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
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
    backgroundColor: colors.accent + '20',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fillInRequestText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
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
  } = useChurch();

  // Register for push notifications when component mounts
  useEffect(() => {
    if (!currentMember) return;

    const registerForPushNotifications = async () => {
      try {
        console.log('[InternalBytecode.js:1] Registering for push notifications...');
        
        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('[InternalBytecode.js:1] Push notification permissions not granted');
          return;
        }

        // Get the Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // Replace with your actual project ID from app.json
        });
        
        const token = tokenData.data;
        console.log('[InternalBytecode.js:1] Got Expo push token:', token);

        // Register the token with the backend
        const success = await registerPushToken(currentMember.id, token, Platform.OS);
        
        if (success) {
          console.log('[InternalBytecode.js:1] Push token registered successfully');
        } else {
          console.error('[InternalBytecode.js:1] Failed to register push token');
        }
      } catch (error) {
        console.error('[InternalBytecode.js:1] Error registering for push notifications:', error);
      }
    };

    registerForPushNotifications();
  }, [currentMember, registerPushToken]);

  // Listen for incoming notifications
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('[InternalBytecode.js:1] Notification received:', notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[InternalBytecode.js:1] Notification response:', response);
      const data = response.notification.request.content.data;
      
      if (data.type === 'fill_in_request') {
        // Handle fill-in request notification tap
        console.log('[InternalBytecode.js:1] User tapped fill-in request notification:', data.fillInRequestId);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const { services, loading: servicesLoading, refreshServices } = useServices(currentChurch?.id || null);

  // Refresh services when church changes
  useEffect(() => {
    if (currentChurch?.id) {
      console.log('[InternalBytecode.js:1] Church changed, refreshing services');
      refreshServices();
    }
  }, [currentChurch?.id, refreshServices]);

  const [addServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [editServiceModalVisible, setEditServiceModalVisible] = useState(false);
  const [assignMemberModalVisible, setAssignMemberModalVisible] = useState(false);
  const [deleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [deleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [fillInRequestModalVisible, setFillInRequestModalVisible] = useState(false);

  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
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

  // Filter services to only show future/current services
  const filteredServices = services.filter(service => {
    const serviceDate = new Date(service.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return serviceDate >= today;
  });

  // Sort roles by display_order
  const sortedRoles = [...churchRoles].sort((a, b) => a.display_order - b.display_order);

  const handleSaveService = async () => {
    console.log('[InternalBytecode.js:1] User tapped save service button');
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
    console.log('[InternalBytecode.js:1] User confirmed delete service');
    if (!serviceToDelete) return;

    // Implementation handled by useServices hook
    setDeleteServiceModalVisible(false);
    setServiceToDelete(null);
  };

  const handleSaveAssignment = async () => {
    console.log('[InternalBytecode.js:1] User tapped save assignment button');
    // Implementation handled by useServices hook
    setEditServiceModalVisible(false);
    setSelectedService(null);
  };

  const handleSelectRecurringService = (recurringService: any) => {
    console.log('[InternalBytecode.js:1] User selected recurring service:', recurringService.name);
    setNewServiceType(recurringService.name);
    setShowRecurringServicePicker(false);
  };

  const handleAssignMember = async () => {
    console.log('[InternalBytecode.js:1] User tapped assign member button');
    // Implementation handled by useServices hook
    setAssignMemberModalVisible(false);
    setSelectedAssignment(null);
  };

  const handleDeleteAssignment = async () => {
    console.log('[InternalBytecode.js:1] User confirmed delete assignment');
    if (!assignmentToDelete) return;

    // Implementation handled by useServices hook
    setDeleteAssignmentModalVisible(false);
    setAssignmentToDelete(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    return formattedDate;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewServiceDate(selectedDate);
    }
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('[InternalBytecode.js:1] User tapped delete service button');
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  };

  const openDeleteAssignmentModal = (serviceId: string, assignmentId: string) => {
    console.log('[InternalBytecode.js:1] User tapped delete assignment button');
    setAssignmentToDelete({ serviceId, assignmentId });
    setDeleteAssignmentModalVisible(true);
  };

  const openAssignMemberModal = (assignmentId: string) => {
    console.log('[InternalBytecode.js:1] User tapped assign member button');
    setSelectedAssignment(assignmentId);
    setAssignMemberModalVisible(true);
  };

  const openFillInRequestModal = (assignmentId: string, serviceId: string, roleName: string) => {
    console.log('[InternalBytecode.js:1] User tapped request fill-in button');
    setFillInAssignmentId(assignmentId);
    setFillInServiceId(serviceId);
    setFillInRoleName(roleName);
    setFillInRequestModalVisible(true);
  };

  const handleCreateFillInRequest = async () => {
    console.log('[InternalBytecode.js:1] User submitted fill-in request');
    if (!currentChurch || !currentMember || !fillInAssignmentId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    console.log('[InternalBytecode.js:1] Creating fill-in request:', {
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
      Alert.alert('Success', 'Fill-in request created successfully');
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
    console.log('[InternalBytecode.js:1] User accepted fill-in request');
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
    console.log('[InternalBytecode.js:1] User cancelled fill-in request');
    if (!currentChurch) return;

    const success = await cancelFillInRequest(requestId, currentChurch.id);
    
    if (success) {
      Alert.alert('Success', 'Fill-in request cancelled');
    } else {
      Alert.alert('Error', 'Failed to cancel fill-in request');
    }
  };

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
          title: currentChurch?.name || 'Schedule',
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.headerText,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {filteredServices.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming services scheduled</Text>
        ) : (
          filteredServices.map((service) => {
            const serviceFillInRequests = fillInRequests.filter(
              req => req.service_id === service.id && req.status === 'pending'
            );

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
                <Text style={styles.serviceDate}>{formatDate(service.date)}</Text>
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
                      <Text style={styles.roleText}>{assignment.role}</Text>
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
              placeholderTextColor={colors.textTertiary}
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

      {/* Other modals remain the same... */}
    </View>
  );
}
