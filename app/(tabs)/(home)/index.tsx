
import { colors } from '@/styles/commonStyles';
import { useChurch } from '@/hooks/useChurch';
import { useServices } from '@/hooks/useServices';
import { Stack } from 'expo-router';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import * as Notifications from 'expo-notifications';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  serviceType: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  serviceDate: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.backgroundAlt,
    padding: 8,
    borderRadius: 8,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  personText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  openSlotText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: colors.text,
    fontSize: 16,
  },
  dateButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  templateItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  templateDetails: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  memberItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  memberRole: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cantAssistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  cantAssistText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
    marginLeft: 4,
  },
  fillInRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  fillInRequestText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  fillInRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fillInRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fillInRequestRole: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  fillInRequestDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fillInRequestService: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  fillInRequestMember: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fillInRequestReason: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
});

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

export default function HomeScreen() {
  const { 
    currentChurch, 
    members, 
    recurringServices, 
    churchRoles, 
    currentMember,
    fillInRequests,
    createFillInRequest,
    acceptFillInRequest,
    cancelFillInRequest,
    registerPushToken,
    refreshFillInRequests,
  } = useChurch();
  const { services, loading, createServiceFromTemplate, deleteService, addAssignment, updateAssignment, deleteAssignment, refreshServices } = useServices(currentChurch?.id || null);
  const { colors: themeColors } = useTheme();

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showRecurringServicePicker, setShowRecurringServicePicker] = useState(false);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [showFillInRequestModal, setShowFillInRequestModal] = useState(false);
  const [showFillInRequestsListModal, setShowFillInRequestsListModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [assignmentRole, setAssignmentRole] = useState('');
  const [assignmentPersonName, setAssignmentPersonName] = useState('');
  const [fillInReason, setFillInReason] = useState('');

  // Check if current user is admin
  const isAdmin = currentMember?.is_admin || false;

  // Register for push notifications
  useEffect(() => {
    const registerForPushNotifications = async () => {
      if (!currentMember) return;

      try {
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

        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log('Expo push token:', token);

        // Register token with backend
        await registerPushToken(currentMember.id, token, Platform.OS);
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    };

    registerForPushNotifications();
  }, [currentMember, registerPushToken]);

  // Count pending fill-in requests
  const pendingFillInCount = fillInRequests.filter(r => r.status === 'pending').length;

  // Log member status for debugging
  useEffect(() => {
    console.log('Current member admin status:', isAdmin);
    console.log('Current member details:', currentMember);
    console.log('Current church:', currentChurch?.name);
    console.log('Services count:', services.length);
  }, [isAdmin, currentMember, currentChurch, services]);

  // Refresh services when currentChurch changes
  useEffect(() => {
    if (currentChurch?.id) {
      console.log('Church changed, refreshing services for:', currentChurch.id);
      refreshServices();
    }
  }, [currentChurch?.id, refreshServices]);

  const handleSaveService = async () => {
    if (!currentChurch || !serviceType.trim()) {
      console.log('Missing required fields');
      return;
    }

    console.log('User tapped Save Service button');
    const dateString = selectedDate.toISOString().split('T')[0];
    await createServiceFromTemplate(currentChurch.id, dateString, serviceType, serviceNotes, []);
    setShowAddServiceModal(false);
    setServiceType('');
    setServiceNotes('');
    setSelectedDate(new Date());
  };

  const handleDeleteService = async () => {
    if (!selectedServiceId) return;

    console.log('User confirmed delete service');
    await deleteService(selectedServiceId);
    setShowDeleteServiceModal(false);
    setSelectedServiceId(null);
  };

  const handleSaveAssignment = async () => {
    if (!selectedServiceId || !assignmentRole.trim()) {
      console.log('Missing required fields for assignment');
      return;
    }

    console.log('User tapped Save Assignment button');
    await addAssignment(selectedServiceId, assignmentRole, assignmentPersonName || 'Open Slot');
    setShowAddServiceModal(false);
    setAssignmentRole('');
    setAssignmentPersonName('');
  };

  const handleSelectRecurringService = async (recurringService: any) => {
    if (!currentChurch) return;

    console.log('User selected recurring service template:', recurringService.name);
    const dateString = selectedDate.toISOString().split('T')[0];
    await createServiceFromTemplate(currentChurch.id, dateString, recurringService.name, recurringService.notes, recurringService.roles, recurringService.time);
    setShowRecurringServicePicker(false);
    setShowAddServiceModal(false);
  };

  const handleAssignMember = async () => {
    if (!selectedAssignmentId) return;

    console.log('User assigned member to slot');
    const member = members.find(m => m.name === assignmentPersonName);
    await updateAssignment(selectedAssignmentId, member?.id || '', assignmentPersonName);
    setShowAssignMemberModal(false);
    setSelectedAssignmentId(null);
    setAssignmentPersonName('');
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignmentId) return;

    console.log('User confirmed delete assignment');
    await deleteAssignment(selectedAssignmentId);
    setShowDeleteAssignmentModal(false);
    setSelectedAssignmentId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const onDateChange = (event: any) => {
    setShowDatePicker(false);
    if (event.type === 'set' && event.nativeEvent?.timestamp) {
      setSelectedDate(new Date(event.nativeEvent.timestamp));
    }
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('User tapped delete service button');
    setSelectedServiceId(serviceId);
    setShowDeleteServiceModal(true);
  };

  const openDeleteAssignmentModal = (serviceId: string, assignmentId: string) => {
    console.log('User tapped delete assignment button');
    setSelectedServiceId(serviceId);
    setSelectedAssignmentId(assignmentId);
    setShowDeleteAssignmentModal(true);
  };

  const openAssignMemberModal = (assignmentId: string) => {
    console.log('User tapped assign member button');
    setSelectedAssignmentId(assignmentId);
    setShowAssignMemberModal(true);
  };

  const openFillInRequestModal = (assignmentId: string, serviceId: string, roleName: string) => {
    console.log('User tapped request fill-in button');
    setSelectedAssignmentId(assignmentId);
    setSelectedServiceId(serviceId);
    setAssignmentRole(roleName);
    setShowFillInRequestModal(true);
  };

  const handleCreateFillInRequest = async () => {
    if (!currentMember || !currentChurch || !selectedAssignmentId || !selectedServiceId) {
      console.log('Missing required data for fill-in request');
      return;
    }

    console.log('User submitted fill-in request');
    const result = await createFillInRequest(
      selectedAssignmentId,
      selectedServiceId,
      currentChurch.id,
      currentMember.id,
      assignmentRole,
      fillInReason
    );

    if (result) {
      setShowFillInRequestModal(false);
      setFillInReason('');
      setSelectedAssignmentId(null);
      setSelectedServiceId(null);
      setAssignmentRole('');
      Alert.alert('Success', 'Fill-in request sent to members with the same role');
    }
  };

  const handleAcceptFillInRequest = async (requestId: string, assignmentId: string) => {
    if (!currentMember || !currentChurch) return;

    console.log('User accepted fill-in request');
    const success = await acceptFillInRequest(requestId, currentMember.id, currentChurch.id);

    if (success) {
      // Update the assignment with the new member
      const memberName = currentMember.name || currentMember.email;
      await updateAssignment(assignmentId, currentMember.id, memberName);
      await refreshServices();
      Alert.alert('Success', 'You have been assigned to this service');
    }
  };

  const handleCancelFillInRequest = async (requestId: string) => {
    if (!currentChurch) return;

    console.log('User cancelled fill-in request');
    const success = await cancelFillInRequest(requestId, currentChurch.id);

    if (success) {
      Alert.alert('Success', 'Fill-in request cancelled');
    }
  };

  const filteredServices = currentChurch 
    ? services.filter(s => s.church_id === currentChurch.id)
    : [];

  const noServicesText = 'No services scheduled yet';
  const addServiceText = isAdmin ? 'Add your first service' : 'Check back later for scheduled services';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Schedule',
          headerStyle: { backgroundColor: themeColors.card },
          headerTintColor: themeColors.text,
          headerRight: () => (
            pendingFillInCount > 0 ? (
              <TouchableOpacity
                onPress={() => setShowFillInRequestsListModal(true)}
                style={{ marginRight: 16, position: 'relative' }}
              >
                <IconSymbol ios_icon_name="bell.fill" android_material_icon_name="notifications" size={24} color={colors.primary} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingFillInCount}</Text>
                </View>
              </TouchableOpacity>
            ) : null
          ),
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredServices.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol ios_icon_name="calendar" android_material_icon_name="calendar-today" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>{noServicesText}</Text>
            <Text style={[styles.emptyStateText, { fontSize: 14, marginTop: 4 }]}>{addServiceText}</Text>
          </View>
        ) : (
          filteredServices.map((service) => {
            const formattedDate = formatDate(service.date);
            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceType}>{service.service_type}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => openDeleteServiceModal(service.id)}>
                      <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.serviceDate}>{formattedDate}</Text>

                {service.assignments.map((assignment) => {
                  const isOpenSlot = !assignment.member_id;
                  const displayName = assignment.person_name || 'Open Slot';
                  const isMyAssignment = assignment.member_id === currentMember?.id;
                  const hasFillInRequest = fillInRequests.some(
                    r => r.assignment_id === assignment.id && r.status === 'pending'
                  );
                  
                  return (
                    <View key={assignment.id}>
                      <TouchableOpacity
                        style={styles.assignmentRow}
                        onPress={() => isAdmin ? openAssignMemberModal(assignment.id) : null}
                        disabled={!isAdmin}
                      >
                        <Text style={styles.roleText}>{assignment.role}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={isOpenSlot ? styles.openSlotText : styles.personText}>
                            {displayName}
                          </Text>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => openDeleteAssignmentModal(service.id, assignment.id)}
                              style={{ marginLeft: 8 }}
                            >
                              <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color={colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                      {isMyAssignment && !hasFillInRequest && (
                        <TouchableOpacity
                          style={styles.cantAssistButton}
                          onPress={() => openFillInRequestModal(assignment.id, service.id, assignment.role)}
                        >
                          <IconSymbol ios_icon_name="exclamationmark.triangle" android_material_icon_name="warning" size={14} color={colors.error} />
                          <Text style={styles.cantAssistText}>Can&apos;t Assist</Text>
                        </TouchableOpacity>
                      )}
                      {hasFillInRequest && (
                        <View style={styles.fillInRequestBadge}>
                          <IconSymbol ios_icon_name="clock" android_material_icon_name="schedule" size={14} color={colors.primary} />
                          <Text style={styles.fillInRequestText}>Fill-in requested</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {isAdmin && (
                  <TouchableOpacity
                    style={{ marginTop: 12 }}
                    onPress={() => {
                      setSelectedServiceId(service.id);
                      setShowAddServiceModal(true);
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 14 }}>+ Add Assignment</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowRecurringServicePicker(true)}
        >
          <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={showRecurringServicePicker} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Service Template</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {recurringServices.map((template) => {
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][template.day_of_week];
                const rolesCount = template.roles?.length || 0;
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateItem}
                    onPress={() => handleSelectRecurringService(template)}
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDetails}>
                      {dayName} at {template.time} • {rolesCount} roles
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowRecurringServicePicker(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddServiceModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Assignment</Text>
            <TextInput
              style={styles.input}
              placeholder="Role (e.g., Worship Leader)"
              placeholderTextColor={colors.textSecondary}
              value={assignmentRole}
              onChangeText={setAssignmentRole}
            />
            <TextInput
              style={styles.input}
              placeholder="Person Name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={assignmentPersonName}
              onChangeText={setAssignmentPersonName}
            />
            <TouchableOpacity style={styles.button} onPress={handleSaveAssignment}>
              <Text style={styles.buttonText}>Save Assignment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddServiceModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAssignMemberModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Member</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {members.map((member) => {
                const displayName = member.name || member.email;
                const roleText = member.memberRoles && member.memberRoles.length > 0
                  ? member.memberRoles.map(r => r.role_name).join(', ')
                  : 'No roles assigned';
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.memberItem}
                    onPress={() => {
                      setAssignmentPersonName(displayName);
                      handleAssignMember();
                    }}
                  >
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberRole}>{roleText}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAssignMemberModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteServiceModal} animationType="fade" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Service?</Text>
            <Text style={{ color: colors.text, marginBottom: 16 }}>
              This will delete the service and all its assignments.
            </Text>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteService}>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDeleteServiceModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteAssignmentModal} animationType="fade" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Assignment?</Text>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAssignment}>
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDeleteAssignmentModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFillInRequestModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Fill-In</Text>
            <Text style={styles.modalSubtitle}>
              This will notify all members with the same role to fill in for you.
            </Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textSecondary}
              value={fillInReason}
              onChangeText={setFillInReason}
              multiline
            />
            <TouchableOpacity style={styles.button} onPress={handleCreateFillInRequest}>
              <Text style={styles.buttonText}>Send Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => {
              setShowFillInRequestModal(false);
              setFillInReason('');
            }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFillInRequestsListModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fill-In Requests</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {fillInRequests
                .filter(request => request.status === 'pending')
                .map((request) => {
                  const service = services.find(s => s.id === request.service_id);
                  const requestingMember = members.find(m => m.id === request.requesting_member_id);
                  const assignment = service?.assignments.find(a => a.id === request.assignment_id);
                  const canAccept = currentMember?.memberRoles.some(
                    role => role.role_name === request.role_name
                  );
                  const isMyRequest = request.requesting_member_id === currentMember?.id;

                  if (!service || !assignment) return null;

                  const serviceDateText = formatDate(service.date);
                  const requestingMemberName = requestingMember?.name || requestingMember?.email || 'Unknown';

                  return (
                    <View key={request.id} style={styles.fillInRequestCard}>
                      <View style={styles.fillInRequestHeader}>
                        <Text style={styles.fillInRequestRole}>{request.role_name}</Text>
                        <Text style={styles.fillInRequestDate}>{serviceDateText}</Text>
                      </View>
                      <Text style={styles.fillInRequestService}>{service.service_type}</Text>
                      <Text style={styles.fillInRequestMember}>
                        Requested by: {requestingMemberName}
                      </Text>
                      {request.reason && (
                        <Text style={styles.fillInRequestReason}>
                          Reason: {request.reason}
                        </Text>
                      )}
                      {canAccept && !isMyRequest && (
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => {
                            handleAcceptFillInRequest(request.id, assignment.id);
                            setShowFillInRequestsListModal(false);
                          }}
                        >
                          <Text style={styles.buttonText}>Accept & Fill In</Text>
                        </TouchableOpacity>
                      )}
                      {isMyRequest && (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => handleCancelFillInRequest(request.id)}
                        >
                          <Text style={styles.cancelButtonText}>Cancel Request</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              {fillInRequests.filter(r => r.status === 'pending').length === 0 && (
                <Text style={styles.emptyStateText}>No pending fill-in requests</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowFillInRequestsListModal(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
