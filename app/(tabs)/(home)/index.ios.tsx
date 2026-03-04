
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Assignment {
  id: string;
  role: string;
  personName: string;
}

interface Service {
  id: string;
  date: string;
  serviceType: string;
  notes: string;
  assignments: Assignment[];
}

export default function HomeScreen() {
  const theme = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  
  // Form states
  const [newServiceDate, setNewServiceDate] = useState(new Date());
  const [newServiceType, setNewServiceType] = useState('');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Assignment form states
  const [newRole, setNewRole] = useState('');
  const [newPersonName, setNewPersonName] = useState('');

  console.log('HomeScreen rendered (iOS), services count:', services.length);

  const handleAddService = () => {
    console.log('User tapped Add Service button');
    setShowAddModal(true);
  };

  const handleSaveService = () => {
    console.log('Saving new service:', { date: newServiceDate.toISOString(), serviceType: newServiceType, notes: newServiceNotes });
    
    // TODO: Backend Integration - POST /api/services with { date: ISO 8601 string, serviceType: string, notes?: string } → returns created service
    const newService: Service = {
      id: Date.now().toString(),
      date: newServiceDate.toISOString(),
      serviceType: newServiceType,
      notes: newServiceNotes,
      assignments: [],
    };
    
    setServices([newService, ...services]);
    setShowAddModal(false);
    setNewServiceType('');
    setNewServiceNotes('');
    setNewServiceDate(new Date());
  };

  const handleDeleteService = (serviceId: string) => {
    console.log('Deleting service:', serviceId);
    // TODO: Backend Integration - DELETE /api/services/:id → { success: true }
    setServices(services.filter(s => s.id !== serviceId));
  };

  const handleAddAssignment = (service: Service) => {
    console.log('User tapped Add Assignment for service:', service.id);
    setSelectedService(service);
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = () => {
    if (!selectedService) return;
    
    console.log('Saving assignment:', { serviceId: selectedService.id, role: newRole, personName: newPersonName });
    
    // TODO: Backend Integration - POST /api/services/:serviceId/assignments with { role: string, personName: string } → returns created assignment
    const newAssignment: Assignment = {
      id: Date.now().toString(),
      role: newRole,
      personName: newPersonName,
    };
    
    const updatedServices = services.map(s => {
      if (s.id === selectedService.id) {
        return { ...s, assignments: [...s.assignments, newAssignment] };
      }
      return s;
    });
    
    setServices(updatedServices);
    setShowAssignmentModal(false);
    setNewRole('');
    setNewPersonName('');
    setSelectedService(null);
  };

  const handleDeleteAssignment = (serviceId: string, assignmentId: string) => {
    console.log('Deleting assignment:', assignmentId);
    // TODO: Backend Integration - DELETE /api/assignments/:id → { success: true }
    const updatedServices = services.map(s => {
      if (s.id === serviceId) {
        return { ...s, assignments: s.assignments.filter(a => a.id !== assignmentId) };
      }
      return s;
    });
    setServices(updatedServices);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateDisplay = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const timeDisplay = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit'
    });
    return { dateDisplay, timeDisplay };
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewServiceDate(selectedDate);
    }
  };

  const commonRoles = ['Worship Leader', 'Piano', 'Guitar', 'Drums', 'Bass', 'Vocals', 'Sound Tech'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Service Schedule',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol 
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today" 
              size={64} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No services scheduled yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Tap the + button to add your first service
            </Text>
          </View>
        ) : (
          services.map((service) => {
            const { dateDisplay, timeDisplay } = formatDate(service.date);
            return (
              <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceType, { color: colors.text }]}>
                      {service.serviceType}
                    </Text>
                    <Text style={[styles.serviceDate, { color: colors.textSecondary }]}>
                      {dateDisplay}
                    </Text>
                    <Text style={[styles.serviceTime, { color: colors.textSecondary }]}>
                      {timeDisplay}
                    </Text>
                    {service.notes ? (
                      <Text style={[styles.serviceNotes, { color: colors.textSecondary }]}>
                        {service.notes}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleDeleteService(service.id)}
                    style={styles.deleteButton}
                  >
                    <IconSymbol 
                      ios_icon_name="trash"
                      android_material_icon_name="delete" 
                      size={24} 
                      color={colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.assignmentsSection}>
                  <View style={styles.assignmentsHeader}>
                    <Text style={[styles.assignmentsTitle, { color: colors.text }]}>
                      Team Members
                    </Text>
                    <TouchableOpacity 
                      onPress={() => handleAddAssignment(service)}
                      style={[styles.addAssignmentButton, { backgroundColor: colors.primary }]}
                    >
                      <IconSymbol 
                        ios_icon_name="plus"
                        android_material_icon_name="add" 
                        size={16} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.addAssignmentText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {service.assignments.length === 0 ? (
                    <Text style={[styles.noAssignments, { color: colors.textSecondary }]}>
                      No team members assigned yet
                    </Text>
                  ) : (
                    service.assignments.map((assignment) => (
                      <View key={assignment.id} style={styles.assignmentRow}>
                        <View style={styles.assignmentInfo}>
                          <Text style={[styles.assignmentRole, { color: colors.primary }]}>
                            {assignment.role}
                          </Text>
                          <Text style={[styles.assignmentPerson, { color: colors.text }]}>
                            {assignment.personName}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => handleDeleteAssignment(service.id, assignment.id)}
                        >
                          <IconSymbol 
                            ios_icon_name="xmark"
                            android_material_icon_name="close" 
                            size={20} 
                            color={colors.textSecondary} 
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleAddService}
      >
        <IconSymbol 
          ios_icon_name="plus"
          android_material_icon_name="add" 
          size={28} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>

      {/* Add Service Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add New Service
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <IconSymbol 
                  ios_icon_name="xmark"
                  android_material_icon_name="close" 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Service Type</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., Sunday Morning Service"
                placeholderTextColor={colors.textSecondary}
                value={newServiceType}
                onChangeText={setNewServiceType}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Date & Time</Text>
              <TouchableOpacity 
                style={[styles.dateButton, { borderColor: colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: colors.text }}>
                  {newServiceDate.toLocaleString()}
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
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="Add any notes..."
                placeholderTextColor={colors.textSecondary}
                value={newServiceNotes}
                onChangeText={setNewServiceNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveService}
            >
              <Text style={styles.saveButtonText}>Save Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Assignment Modal */}
      <Modal
        visible={showAssignmentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Add Team Member
              </Text>
              <TouchableOpacity onPress={() => setShowAssignmentModal(false)}>
                <IconSymbol 
                  ios_icon_name="xmark"
                  android_material_icon_name="close" 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Role</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., Worship Leader"
                placeholderTextColor={colors.textSecondary}
                value={newRole}
                onChangeText={setNewRole}
              />
              <View style={styles.quickRoles}>
                {commonRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.quickRoleButton, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}
                    onPress={() => setNewRole(role)}
                  >
                    <Text style={[styles.quickRoleText, { color: colors.primary }]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Person Name</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Enter name"
                placeholderTextColor={colors.textSecondary}
                value={newPersonName}
                onChangeText={setNewPersonName}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveAssignment}
            >
              <Text style={styles.saveButtonText}>Add Member</Text>
            </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  serviceCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    marginBottom: 2,
  },
  serviceTime: {
    fontSize: 14,
    marginBottom: 4,
  },
  serviceNotes: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  deleteButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  assignmentsSection: {
    marginTop: 4,
  },
  assignmentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignmentsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addAssignmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addAssignmentText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  noAssignments: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentRole: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignmentPerson: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  quickRoles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  quickRoleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickRoleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
