
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@react-navigation/native';
import React, { useState } from 'react';
import { IconSymbol } from '@/components/IconSymbol';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  serviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  serviceType: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  serviceDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  personText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  openSlotText: {
    fontSize: 14,
    color: colors.primary,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  prepareQuarterFab: {
    position: 'absolute',
    right: 20,
    bottom: 160,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
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
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  templateItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  templateDetails: {
    fontSize: 14,
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
  quarterButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  quarterButtonSelected: {
    backgroundColor: colors.primary,
  },
  quarterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quarterButtonTextSelected: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  autoAssignButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  blockServiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  blockServiceText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
});

export default function HomeScreen() {
  const { services, loading, createServiceFromTemplate, deleteService, addAssignment, updateAssignment, deleteAssignment } = useServices(null);
  const { colors: themeColors } = useTheme();
  const { currentChurch, members, recurringServices } = useChurch();

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showRecurringServicePicker, setShowRecurringServicePicker] = useState(false);
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(false);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [showPrepareQuarterModal, setShowPrepareQuarterModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [assignmentRole, setAssignmentRole] = useState('');
  const [assignmentPersonName, setAssignmentPersonName] = useState('');

  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [blockedServices, setBlockedServices] = useState<Set<string>>(new Set());
  const [specialServices, setSpecialServices] = useState<{ date: Date; type: string; notes: string }[]>([]);
  const [showAddSpecialService, setShowAddSpecialService] = useState(false);
  const [specialServiceDate, setSpecialServiceDate] = useState(new Date());
  const [specialServiceType, setSpecialServiceType] = useState('');
  const [specialServiceNotes, setSpecialServiceNotes] = useState('');

  const handleSaveService = async () => {
    if (!currentChurch || !serviceType.trim()) {
      console.log('Missing required fields');
      return;
    }

    console.log('User tapped Save Service button');
    const dateString = selectedDate.toISOString().split('T')[0];
    await createServiceFromTemplate(dateString, serviceType, serviceNotes, []);
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
    await createServiceFromTemplate(dateString, recurringService.name, recurringService.notes, recurringService.roles);
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

      recurringServices.forEach(template => {
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

  const handlePrepareQuarter = async () => {
    if (!currentChurch) return;

    console.log('User tapped Prepare Quarter button');
    const generatedServices = generateQuarterServices();

    for (const { date, template } of generatedServices) {
      const dateString = date.toISOString().split('T')[0];
      await createServiceFromTemplate(dateString, template.name, template.notes, template.roles);
    }

    for (const special of specialServices) {
      const dateString = special.date.toISOString().split('T')[0];
      await createServiceFromTemplate(dateString, special.type, special.notes, []);
    }

    setShowPrepareQuarterModal(false);
    setBlockedServices(new Set());
    setSpecialServices([]);
  };

  const handleAutoAssign = async () => {
    if (!currentChurch) return;

    console.log('User tapped Auto-Assign button');

    const membersByRole: { [role: string]: any[] } = {};
    members.forEach(member => {
      if (member.role) {
        if (!membersByRole[member.role]) {
          membersByRole[member.role] = [];
        }
        membersByRole[member.role].push(member);
      }
    });

    const assignmentCounts: { [memberId: string]: number } = {};
    members.forEach(member => {
      assignmentCounts[member.id] = 0;
    });

    for (const service of services) {
      for (const assignment of service.assignments) {
        if (!assignment.member_id && assignment.role) {
          const availableMembers = membersByRole[assignment.role] || [];
          
          if (availableMembers.length > 0) {
            availableMembers.sort((a, b) => 
              (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0)
            );

            const selectedMember = availableMembers[0];
            await updateAssignment(assignment.id, selectedMember.id, selectedMember.name || selectedMember.email);
            assignmentCounts[selectedMember.id] = (assignmentCounts[selectedMember.id] || 0) + 1;
          }
        }
      }
    }

    console.log('Auto-assignment completed');
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

  const handleAddSpecialService = () => {
    if (!specialServiceType.trim()) return;

    console.log('User added special service');
    setSpecialServices([...specialServices, {
      date: specialServiceDate,
      type: specialServiceType,
      notes: specialServiceNotes,
    }]);
    setShowAddSpecialService(false);
    setSpecialServiceType('');
    setSpecialServiceNotes('');
    setSpecialServiceDate(new Date());
  };

  const filteredServices = currentChurch 
    ? services.filter(s => s.church_id === currentChurch.id)
    : [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Schedule',
          headerStyle: { backgroundColor: themeColors.card },
          headerTintColor: themeColors.text,
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
            <Text style={styles.emptyStateText}>No services scheduled yet</Text>
          </View>
        ) : (
          filteredServices.map((service) => {
            const formattedDate = formatDate(service.date);
            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceType}>{service.service_type}</Text>
                  <TouchableOpacity onPress={() => openDeleteServiceModal(service.id)}>
                    <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.serviceDate}>{formattedDate}</Text>

                {service.assignments.map((assignment) => {
                  const isOpenSlot = !assignment.member_id;
                  const displayName = assignment.person_name || 'Open Slot';
                  return (
                    <TouchableOpacity
                      key={assignment.id}
                      style={styles.assignmentRow}
                      onPress={() => openAssignMemberModal(assignment.id)}
                    >
                      <Text style={styles.roleText}>{assignment.role}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={isOpenSlot ? styles.openSlotText : styles.personText}>
                          {displayName}
                        </Text>
                        <TouchableOpacity
                          onPress={() => openDeleteAssignmentModal(service.id, assignment.id)}
                          style={{ marginLeft: 8 }}
                        >
                          <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => {
                    setSelectedServiceId(service.id);
                    setShowAddServiceModal(true);
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 14 }}>+ Add Assignment</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.prepareQuarterFab}
        onPress={() => setShowPrepareQuarterModal(true)}
      >
        <IconSymbol ios_icon_name="calendar.badge.plus" android_material_icon_name="event" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowRecurringServicePicker(true)}
      >
        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showRecurringServicePicker} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Service Template</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {recurringServices.map((template) => {
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][template.day_of_week];
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateItem}
                    onPress={() => handleSelectRecurringService(template)}
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDetails}>
                      {dayName} at {template.time} • {template.roles.length} roles
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
                const roleText = member.role || 'No role';
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

      <Modal visible={showPrepareQuarterModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Prepare Quarter</Text>
            
            <Text style={styles.sectionTitle}>Select Quarter</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4].map(q => {
                const isSelected = selectedQuarter === q;
                const quarterText = `Q${q}`;
                return (
                  <TouchableOpacity
                    key={q}
                    style={[styles.quarterButton, { flex: 1, marginHorizontal: 4 }, isSelected && styles.quarterButtonSelected]}
                    onPress={() => setSelectedQuarter(q)}
                  >
                    <Text style={[styles.quarterButtonText, isSelected && styles.quarterButtonTextSelected]}>
                      {quarterText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Year</Text>
            <TextInput
              style={styles.input}
              placeholder="Year"
              placeholderTextColor={colors.textSecondary}
              value={selectedYear.toString()}
              onChangeText={(text) => setSelectedYear(parseInt(text) || new Date().getFullYear())}
              keyboardType="number-pad"
            />

            <Text style={styles.sectionTitle}>Block Recurring Services</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {recurringServices.map(template => {
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
                      style={styles.blockServiceItem}
                      onPress={() => toggleBlockService(serviceKey)}
                    >
                      <Text style={styles.blockServiceText}>
                        {template.name} - {dateText}
                      </Text>
                      <View style={[styles.checkbox, isBlocked && styles.checkboxChecked]}>
                        {isBlocked && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })}
            </ScrollView>

            <Text style={styles.sectionTitle}>Special Services</Text>
            {specialServices.map((special, index) => {
              const dateText = formatDate(special.date.toISOString());
              return (
                <View key={index} style={styles.blockServiceItem}>
                  <Text style={styles.blockServiceText}>
                    {special.type} - {dateText}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    const newSpecial = [...specialServices];
                    newSpecial.splice(index, 1);
                    setSpecialServices(newSpecial);
                  }}>
                    <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              style={{ marginTop: 8 }}
              onPress={() => setShowAddSpecialService(true)}
            >
              <Text style={{ color: colors.primary, fontSize: 14 }}>+ Add Special Service</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handlePrepareQuarter}>
              <Text style={styles.buttonText}>Generate Services</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.autoAssignButton} onPress={handleAutoAssign}>
              <Text style={styles.buttonText}>Auto-Assign Members</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPrepareQuarterModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddSpecialService} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Special Service</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {formatDate(specialServiceDate.toISOString())}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={specialServiceDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSpecialServiceDate(date);
                }}
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Service Type"
              placeholderTextColor={colors.textSecondary}
              value={specialServiceType}
              onChangeText={setSpecialServiceType}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textSecondary}
              value={specialServiceNotes}
              onChangeText={setSpecialServiceNotes}
            />
            <TouchableOpacity style={styles.button} onPress={handleAddSpecialService}>
              <Text style={styles.buttonText}>Add Service</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddSpecialService(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
