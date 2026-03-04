
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch } from '@/hooks/useChurch';
import { useServices } from '@/hooks/useServices';

export default function HomeScreen() {
  const { colors: themeColors } = useTheme();
  const { currentChurch, members, recurringServices, churchRoles } = useChurch();
  const {
    services,
    loading,
    error,
    createService,
    deleteService,
    addAssignment,
    deleteAssignment,
  } = useServices(currentChurch?.id || null);

  const [isAddServiceModalVisible, setAddServiceModalVisible] = useState(false);
  const [isAddAssignmentModalVisible, setAddAssignmentModalVisible] = useState(false);
  const [isDeleteServiceModalVisible, setDeleteServiceModalVisible] = useState(false);
  const [isDeleteAssignmentModalVisible, setDeleteAssignmentModalVisible] = useState(false);
  const [isRecurringServicePickerVisible, setRecurringServicePickerVisible] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<{
    serviceId: string;
    assignmentId: string;
  } | null>(null);

  const [newServiceDate, setNewServiceDate] = useState(new Date());
  const [newServiceType, setNewServiceType] = useState('');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [newAssignmentRole, setNewAssignmentRole] = useState('');
  const [newAssignmentPerson, setNewAssignmentPerson] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const handleSaveService = async () => {
    console.log('User tapped Save Service button');
    if (!newServiceType.trim()) {
      return;
    }

    const result = await createService(
      newServiceDate.toISOString(),
      newServiceType.trim(),
      newServiceNotes.trim() || undefined
    );

    if (result) {
      setNewServiceType('');
      setNewServiceNotes('');
      setNewServiceDate(new Date());
      setAddServiceModalVisible(false);
    }
  };

  const handleDeleteService = async () => {
    console.log('User confirmed delete service');
    if (!serviceToDelete) {
      return;
    }

    const success = await deleteService(serviceToDelete);
    if (success) {
      setServiceToDelete(null);
      setDeleteServiceModalVisible(false);
    }
  };

  const handleSaveAssignment = async () => {
    console.log('User tapped Save Assignment button');
    if (!selectedServiceId || !newAssignmentRole.trim() || !newAssignmentPerson.trim()) {
      return;
    }

    const result = await addAssignment(
      selectedServiceId,
      newAssignmentRole.trim(),
      newAssignmentPerson.trim()
    );

    if (result) {
      setNewAssignmentRole('');
      setNewAssignmentPerson('');
      setSelectedServiceId(null);
      setShowRolePicker(false);
      setShowMemberPicker(false);
      setAddAssignmentModalVisible(false);
    }
  };

  const handleDeleteAssignment = async () => {
    console.log('User confirmed delete assignment');
    if (!assignmentToDelete) {
      return;
    }

    const success = await deleteAssignment(assignmentToDelete.assignmentId);
    if (success) {
      setAssignmentToDelete(null);
      setDeleteAssignmentModalVisible(false);
    }
  };

  const handleSelectRecurringService = (recurringService: any) => {
    console.log('User selected recurring service:', recurringService.name);
    
    // Calculate next occurrence of this day
    const today = new Date();
    const targetDay = recurringService.day_of_week;
    const currentDay = today.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7;
    }
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilTarget);
    
    // Set time
    const [hours, minutes] = recurringService.time.split(':');
    nextDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    
    setNewServiceDate(nextDate);
    setNewServiceType(recurringService.name);
    setNewServiceNotes(recurringService.notes || '');
    setRecurringServicePickerVisible(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewServiceDate(selectedDate);
    }
  };

  const openDeleteServiceModal = (serviceId: string) => {
    console.log('User tapped delete service:', serviceId);
    setServiceToDelete(serviceId);
    setDeleteServiceModalVisible(true);
  };

  const openDeleteAssignmentModal = (serviceId: string, assignmentId: string) => {
    console.log('User tapped delete assignment:', assignmentId);
    setAssignmentToDelete({ serviceId, assignmentId });
    setDeleteAssignmentModalVisible(true);
  };

  const noChurchText = 'No church selected';
  const selectChurchText = 'Please create or select a church in the Church tab';
  const noServicesText = 'No services scheduled';
  const addFirstServiceText = 'Tap + to schedule your first service';

  if (!currentChurch) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Service Schedule',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="building.2"
            android_material_icon_name="home"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{noChurchText}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {selectChurchText}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: 'Service Schedule',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Service Schedule',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{noServicesText}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {addFirstServiceText}
            </Text>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map((service) => {
              const formattedDate = formatDate(service.date);
              const assignmentCount = service.assignments.length;
              const assignmentCountText = `${assignmentCount} ${
                assignmentCount === 1 ? 'assignment' : 'assignments'
              }`;

              return (
                <View
                  key={service.id}
                  style={[styles.serviceCard, { backgroundColor: colors.cardBackground }]}
                >
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceType, { color: colors.text }]}>
                        {service.service_type}
                      </Text>
                      <Text style={[styles.serviceDate, { color: colors.textSecondary }]}>
                        {formattedDate}
                      </Text>
                      {service.notes && (
                        <Text style={[styles.serviceNotes, { color: colors.textSecondary }]}>
                          {service.notes}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => openDeleteServiceModal(service.id)}
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

                  <View style={styles.assignmentsSection}>
                    <View style={styles.assignmentsHeader}>
                      <Text style={[styles.assignmentsTitle, { color: colors.text }]}>
                        {assignmentCountText}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          console.log('User tapped Add Assignment for service:', service.id);
                          setSelectedServiceId(service.id);
                          setAddAssignmentModalVisible(true);
                        }}
                        style={[styles.addAssignmentButton, { backgroundColor: colors.primary }]}
                      >
                        <IconSymbol
                          ios_icon_name="plus"
                          android_material_icon_name="add"
                          size={16}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    </View>

                    {service.assignments.map((assignment) => (
                      <View key={assignment.id} style={styles.assignmentRow}>
                        <View style={styles.assignmentInfo}>
                          <Text style={[styles.assignmentRole, { color: colors.primary }]}>
                            {assignment.role}
                          </Text>
                          <Text style={[styles.assignmentPerson, { color: colors.text }]}>
                            {assignment.person_name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            openDeleteAssignmentModal(service.id, assignment.id)
                          }
                        >
                          <IconSymbol
                            ios_icon_name="xmark.circle"
                            android_material_icon_name="close"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          console.log('User tapped Add Service FAB');
          if (recurringServices.length > 0) {
            setRecurringServicePickerVisible(true);
          } else {
            setAddServiceModalVisible(true);
          }
        }}
      >
        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Recurring Service Picker Modal */}
      <Modal
        visible={isRecurringServicePickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRecurringServicePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Service Type</Text>
            
            <ScrollView style={styles.recurringServiceList}>
              {recurringServices.map((recurringService) => {
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurringService.day_of_week];
                return (
                  <TouchableOpacity
                    key={recurringService.id}
                    style={[styles.recurringServiceItem, { borderColor: colors.border }]}
                    onPress={() => handleSelectRecurringService(recurringService)}
                  >
                    <Text style={[styles.recurringServiceName, { color: colors.text }]}>
                      {recurringService.name}
                    </Text>
                    <Text style={[styles.recurringServiceDay, { color: colors.textSecondary }]}>
                      {dayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.recurringServiceItem, { borderColor: colors.border }]}
                onPress={() => {
                  console.log('User chose custom service');
                  setRecurringServicePickerVisible(false);
                  setAddServiceModalVisible(true);
                }}
              >
                <Text style={[styles.recurringServiceName, { color: colors.primary }]}>
                  Custom Service
                </Text>
                <Text style={[styles.recurringServiceDay, { color: colors.textSecondary }]}>
                  Create a one-time service
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]}
              onPress={() => {
                console.log('User cancelled service picker');
                setRecurringServicePickerVisible(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Service Modal */}
      <Modal
        visible={isAddServiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Service</Text>

            <TouchableOpacity
              style={[styles.dateButton, { borderColor: colors.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
                {newServiceDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={newServiceDate}
                mode="datetime"
                display="default"
                onChange={onDateChange}
              />
            )}

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Service Type (e.g., Sunday Morning)"
              placeholderTextColor={colors.textSecondary}
              value={newServiceType}
              onChangeText={setNewServiceType}
            />

            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newServiceNotes}
              onChangeText={setNewServiceNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled add service');
                  setAddServiceModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveService}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Assignment Modal */}
      <Modal
        visible={isAddAssignmentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddAssignmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Assignment</Text>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Role</Text>
                {churchRoles.length > 0 ? (
                  <>
                    <TouchableOpacity
                      style={[styles.input, { borderColor: colors.border, justifyContent: 'center' }]}
                      onPress={() => {
                        console.log('User tapped role picker');
                        setShowRolePicker(!showRolePicker);
                      }}
                    >
                      <Text style={[{ color: newAssignmentRole ? colors.text : colors.textSecondary }]}>
                        {newAssignmentRole || 'Select a role'}
                      </Text>
                    </TouchableOpacity>
                    {showRolePicker && (
                      <View style={[styles.pickerList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        {churchRoles.map((role) => (
                          <TouchableOpacity
                            key={role.id}
                            style={styles.pickerItem}
                            onPress={() => {
                              console.log('User selected role:', role.name);
                              setNewAssignmentRole(role.name);
                              setShowRolePicker(false);
                            }}
                          >
                            <Text style={[styles.pickerItemText, { color: colors.text }]}>
                              {role.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Role (e.g., Worship Leader, Piano)"
                    placeholderTextColor={colors.textSecondary}
                    value={newAssignmentRole}
                    onChangeText={setNewAssignmentRole}
                  />
                )}
              </View>

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Person</Text>
                {members.length > 0 ? (
                  <>
                    <TouchableOpacity
                      style={[styles.input, { borderColor: colors.border, justifyContent: 'center' }]}
                      onPress={() => {
                        console.log('User tapped member picker');
                        setShowMemberPicker(!showMemberPicker);
                      }}
                    >
                      <Text style={[{ color: newAssignmentPerson ? colors.text : colors.textSecondary }]}>
                        {newAssignmentPerson || 'Select a member'}
                      </Text>
                    </TouchableOpacity>
                    {showMemberPicker && (
                      <View style={[styles.pickerList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        {members.map((member) => {
                          const displayName = member.name || member.email;
                          return (
                            <TouchableOpacity
                              key={member.id}
                              style={styles.pickerItem}
                              onPress={() => {
                                console.log('User selected member:', displayName);
                                setNewAssignmentPerson(displayName);
                                setShowMemberPicker(false);
                              }}
                            >
                              <Text style={[styles.pickerItemText, { color: colors.text }]}>
                                {displayName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    placeholder="Person Name"
                    placeholderTextColor={colors.textSecondary}
                    value={newAssignmentPerson}
                    onChangeText={setNewAssignmentPerson}
                  />
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled add assignment');
                    setAddAssignmentModalVisible(false);
                    setSelectedServiceId(null);
                    setShowRolePicker(false);
                    setShowMemberPicker(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveAssignment}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Service Modal */}
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
              Are you sure you want to delete this service and all its assignments?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete service');
                  setDeleteServiceModalVisible(false);
                  setServiceToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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

      {/* Delete Assignment Modal */}
      <Modal
        visible={isDeleteAssignmentModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteAssignmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Remove Assignment</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove this assignment?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete assignment');
                  setDeleteAssignmentModalVisible(false);
                  setAssignmentToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ff3b30' }]}
                onPress={handleDeleteAssignment}
              >
                <Text style={styles.saveButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  servicesList: {
    padding: 16,
    gap: 16,
  },
  serviceCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  serviceDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  serviceNotes: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 4,
  },
  assignmentsSection: {
    marginTop: 8,
  },
  assignmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  addAssignmentButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(106, 13, 173, 0.05)',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentRole: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignmentPerson: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
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
    maxHeight: '80%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
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
  pickerList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerItemText: {
    fontSize: 16,
  },
  recurringServiceList: {
    maxHeight: 400,
  },
  recurringServiceItem: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  recurringServiceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recurringServiceDay: {
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
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
});
