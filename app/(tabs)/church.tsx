
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useChurch } from '@/hooks/useChurch';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/lib/supabase/client';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

export default function ChurchScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const {
    churches,
    currentChurch,
    setCurrentChurch,
    members,
    recurringServices,
    churchRoles,
    loading,
    error,
    user,
    createChurch,
    addMember,
    deleteMember,
    updateMember,
    addRecurringService,
    deleteRecurringService,
    addChurchRole,
    deleteChurchRole,
    addMemberRole,
    removeMemberRole,
    fetchMemberUnavailability,
  } = useChurch();

  const { services, createServiceFromTemplate, updateAssignment } = useServices(currentChurch?.id || null);

  const [activeTab, setActiveTab] = useState<'members' | 'services' | 'roles'>('members');
  const [isCreateChurchModalVisible, setCreateChurchModalVisible] = useState(false);
  const [isAddMemberModalVisible, setAddMemberModalVisible] = useState(false);
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
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const [newChurchName, setNewChurchName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRoles, setNewMemberRoles] = useState<string[]>([]);
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRoles, setEditMemberRoles] = useState<string[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDay, setNewServiceDay] = useState(0);
  const [newServiceTime, setNewServiceTime] = useState('09:00');
  const [newServiceNotes, setNewServiceNotes] = useState('');
  const [selectedServiceRoles, setSelectedServiceRoles] = useState<string[]>([]);
  const [showServiceRolePicker, setShowServiceRolePicker] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // Quarterly assignment states
  const [showPrepareQuarterModal, setShowPrepareQuarterModal] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [blockedServices, setBlockedServices] = useState<Set<string>>(new Set());
  const [specialServices, setSpecialServices] = useState<SpecialService[]>([]);
  const [showAddSpecialService, setShowAddSpecialService] = useState(false);
  const [specialServiceDate, setSpecialServiceDate] = useState(new Date());
  const [specialServiceName, setSpecialServiceName] = useState('');
  const [specialServiceTime, setSpecialServiceTime] = useState('10:00');
  const [specialServiceNotes, setSpecialServiceNotes] = useState('');
  const [specialServiceRoles, setSpecialServiceRoles] = useState<string[]>([]);
  const [showSpecialServiceTimePicker, setShowSpecialServiceTimePicker] = useState(false);
  const [showSpecialServiceDatePicker, setShowSpecialServiceDatePicker] = useState(false);

  const handleCreateChurch = async () => {
    console.log('User tapped Create Church button');
    if (!newChurchName.trim()) {
      return;
    }

    const result = await createChurch(newChurchName.trim());
    if (result) {
      setNewChurchName('');
      setCreateChurchModalVisible(false);
    }
  };

  const handleAddMember = async () => {
    console.log('User tapped Add Member button');
    if (!currentChurch || !newMemberEmail.trim()) {
      return;
    }

    const result = await addMember(
      currentChurch.id,
      newMemberEmail.trim(),
      newMemberName.trim() || undefined,
      undefined
    );

    if (result && newMemberRoles.length > 0) {
      for (const roleName of newMemberRoles) {
        const role = churchRoles.find(r => r.name === roleName);
        if (role) {
          await addMemberRole(result.id, role.id, currentChurch.id);
        }
      }
    }

    if (result) {
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRoles([]);
      setAddMemberModalVisible(false);
    }
  };

  const openEditMemberModal = (memberId: string) => {
    console.log('User tapped edit member:', memberId);
    const member = members.find(m => m.id === memberId);
    if (!member) {
      return;
    }

    setMemberToEdit(memberId);
    setEditMemberEmail(member.email);
    setEditMemberName(member.name || '');
    setEditMemberRoles(member.memberRoles?.map(r => r.role_name) || []);
    setEditMemberModalVisible(true);
  };

  const handleEditMember = async () => {
    console.log('User tapped Save Edit Member button');
    if (!memberToEdit || !currentChurch) {
      return;
    }

    const updates: { name?: string; email?: string } = {};
    
    if (editMemberEmail.trim()) {
      updates.email = editMemberEmail.trim();
    }
    if (editMemberName.trim()) {
      updates.name = editMemberName.trim();
    }

    const success = await updateMember(memberToEdit, currentChurch.id, updates);
    
    if (success) {
      const member = members.find(m => m.id === memberToEdit);
      const currentRoleNames = member?.memberRoles?.map(r => r.role_name) || [];
      
      console.log('Current roles:', currentRoleNames);
      console.log('New roles:', editMemberRoles);
      
      const rolesToRemove = currentRoleNames.filter(roleName => !editMemberRoles.includes(roleName));
      const rolesToAdd = editMemberRoles.filter(roleName => !currentRoleNames.includes(roleName));
      
      console.log('Roles to remove:', rolesToRemove);
      console.log('Roles to add:', rolesToAdd);
      
      for (const roleNameToRemove of rolesToRemove) {
        const role = churchRoles.find(r => r.name === roleNameToRemove);
        if (role) {
          console.log('Removing role:', roleNameToRemove);
          await removeMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      for (const roleNameToAdd of rolesToAdd) {
        const role = churchRoles.find(r => r.name === roleNameToAdd);
        if (role) {
          console.log('Adding role:', roleNameToAdd);
          await addMemberRole(memberToEdit, role.id, currentChurch.id);
        }
      }
      
      setMemberToEdit(null);
      setEditMemberEmail('');
      setEditMemberName('');
      setEditMemberRoles([]);
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
      await supabase.auth.signOut();
      console.log('User signed out successfully');
      setSignOutModalVisible(false);
      router.replace('/onboarding');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const openDeleteModal = (memberId: string) => {
    console.log('User tapped delete member:', memberId);
    setMemberToDelete(memberId);
    setDeleteModalVisible(true);
  };

  const handleAddService = async () => {
    console.log('User tapped Add Service button');
    if (!currentChurch || !newServiceName.trim()) {
      return;
    }

    const result = await addRecurringService(
      currentChurch.id,
      newServiceName.trim(),
      newServiceDay,
      newServiceTime,
      newServiceNotes.trim() || undefined,
      selectedServiceRoles
    );

    if (result) {
      setNewServiceName('');
      setNewServiceDay(0);
      setNewServiceTime('09:00');
      setNewServiceNotes('');
      setSelectedServiceRoles([]);
      setAddServiceModalVisible(false);
    }
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

  const toggleServiceRole = (roleName: string) => {
    console.log('User toggled service role:', roleName);
    if (selectedServiceRoles.includes(roleName)) {
      setSelectedServiceRoles(selectedServiceRoles.filter(r => r !== roleName));
    } else {
      setSelectedServiceRoles([...selectedServiceRoles, roleName]);
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
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const getQuarterDates = (quarter: number, year: number) => {
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    return { startDate, endDate };
  };

  const generateQuarterServices = () => {
    const { startDate, endDate } = getQuarterDates(selectedQuarter, selectedYear);
    const generatedServices: Array<{ date: Date; template: any }> = [];

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
    if (!currentChurch?.id) {
      Alert.alert('Error', 'No church selected. Please ensure your account is linked to a church.');
      return;
    }

    console.log('User tapped Prepare Quarter button for church:', currentChurch.id);
    const generatedServices = generateQuarterServices();

    for (const { date, template } of generatedServices) {
      const dateString = date.toISOString().split('T')[0];
      await createServiceFromTemplate(currentChurch.id, dateString, template.name, template.notes, template.roles, template.time);
    }

    for (const special of specialServices) {
      const dateString = special.date.toISOString().split('T')[0];
      
      const roleNames = special.selectedRoleIds
        .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
        .filter((name): name is string => name !== undefined);
      
      console.log('Creating special service with roles:', { name: special.name, roleNames });
      await createServiceFromTemplate(currentChurch.id, dateString, special.name, special.notes, roleNames, special.time);
    }

    setShowPrepareQuarterModal(false);
    setBlockedServices(new Set());
    setSpecialServices([]);
    Alert.alert('Success', 'Quarter services generated successfully!');
  };

  const handleAutoAssign = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    console.log('User tapped Auto-Assign button');

    const membersByRole: { [role: string]: any[] } = {};
    members.forEach(member => {
      if (member.memberRoles && member.memberRoles.length > 0) {
        member.memberRoles.forEach(memberRole => {
          if (!membersByRole[memberRole.role_name]) {
            membersByRole[memberRole.role_name] = [];
          }
          membersByRole[memberRole.role_name].push(member);
        });
      }
    });

    const assignmentCounts: { [memberId: string]: number } = {};
    members.forEach(member => {
      assignmentCounts[member.id] = 0;
    });

    const memberUnavailability: { [memberId: string]: Set<string> } = {};
    for (const member of members) {
      const unavailableDates = await fetchMemberUnavailability(member.id);
      memberUnavailability[member.id] = new Set(
        unavailableDates.map(u => u.unavailable_date)
      );
    }

    const filteredServices = services.filter(s => s.church_id === currentChurch.id);

    for (const service of filteredServices) {
      const serviceDate = service.date;
      
      for (const assignment of service.assignments) {
        if (!assignment.member_id && assignment.role) {
          const availableMembers = (membersByRole[assignment.role] || []).filter(member => {
            const isUnavailable = memberUnavailability[member.id]?.has(serviceDate);
            return !isUnavailable;
          });
          
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
    Alert.alert('Success', 'Auto-assignment completed!');
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

    console.log('User added special service with roles:', specialServiceRoles);
    const newSpecialService: SpecialService = {
      id: `special-${Date.now()}`,
      name: specialServiceName,
      date: specialServiceDate,
      time: specialServiceTime,
      notes: specialServiceNotes,
      selectedRoleIds: specialServiceRoles,
    };

    setSpecialServices([...specialServices, newSpecialService]);
    setShowAddSpecialService(false);
    setSpecialServiceName('');
    setSpecialServiceTime('10:00');
    setSpecialServiceNotes('');
    setSpecialServiceRoles([]);
    setSpecialServiceDate(new Date());
  };

  if (loading && churches.length === 0) {
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
        </View>
      </SafeAreaView>
    );
  }

  const noChurchesText = 'No churches yet';
  const createFirstChurchText = 'Create your first church to get started';
  const noMembersText = 'No members yet';
  const addFirstMemberText = 'Add members to your church';
  const signOutText = 'Sign Out';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Church Management',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                console.log('User tapped Sign Out');
                setSignOutModalVisible(true);
              }}
              style={styles.signOutButton}
            >
              <IconSymbol
                ios_icon_name="arrow.right.square"
                android_material_icon_name="logout"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Church Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Churches</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                console.log('User tapped Create Church');
                setCreateChurchModalVisible(true);
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

          {churches.length === 0 ? (
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
              {churches.map((church) => {
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
              onPress={() => setShowPrepareQuarterModal(true)}
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
              onPress={handleAutoAssign}
            >
              <IconSymbol
                ios_icon_name="person.2.fill"
                android_material_icon_name="group"
                size={24}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Auto-Assign Members</Text>
            </TouchableOpacity>
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
            </View>

            {/* Members Tab */}
            {activeTab === 'members' && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('User tapped Add Member');
                      setAddMemberModalVisible(true);
                    }}
                  >
                    <IconSymbol
                      ios_icon_name="person.badge.plus"
                      android_material_icon_name="person-add"
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {members.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                      {noMembersText}
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                      {addFirstMemberText}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.membersList}>
                    {members.map((member) => {
                      const displayName = member.name || member.email;
                      const displayRoles = member.memberRoles && member.memberRoles.length > 0
                        ? member.memberRoles.map(r => r.role_name).join(', ')
                        : 'No roles assigned';
                      return (
                        <View
                          key={member.id}
                          style={[styles.memberCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.memberInfo}>
                            <IconSymbol
                              ios_icon_name="person.circle"
                              android_material_icon_name="account-circle"
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
                      setAddServiceModalVisible(true);
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

                {recurringServices.length === 0 ? (
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
                    {recurringServices.map((service) => {
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

                {churchRoles.length === 0 ? (
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
                    {churchRoles.map((role) => {
                      return (
                        <View
                          key={role.id}
                          style={[styles.roleCard, { backgroundColor: colors.cardBackground }]}
                        >
                          <View style={styles.roleInfo}>
                            <IconSymbol
                              ios_icon_name="person.badge.shield.checkmark"
                              android_material_icon_name="badge"
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
          </>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: '#ffebee' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* All modals remain the same as before... */}
      {/* Create Church Modal */}
      <Modal
        visible={isCreateChurchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateChurchModalVisible(false)}
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
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled create church');
                  setCreateChurchModalVisible(false);
                  setNewChurchName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateChurch}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        visible={isAddMemberModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Member</Text>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Email (required)"
                placeholderTextColor={colors.textSecondary}
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newMemberName}
                onChangeText={setNewMemberName}
              />

              <View style={styles.pickerContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Roles (optional - select multiple)</Text>
                {churchRoles.length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {churchRoles.map((role) => {
                      const isSelected = newMemberRoles.includes(role.name);
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
                              setNewMemberRoles(newMemberRoles.filter(r => r !== role.name));
                            } else {
                              setNewMemberRoles([...newMemberRoles, role.name]);
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

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled add member');
                    setAddMemberModalVisible(false);
                    setNewMemberEmail('');
                    setNewMemberName('');
                    setNewMemberRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddMember}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
                {churchRoles.length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {churchRoles.map((role) => {
                      const isSelected = editMemberRoles.includes(role.name);
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

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled edit member');
                    setEditMemberModalVisible(false);
                    setMemberToEdit(null);
                    setEditMemberEmail('');
                    setEditMemberName('');
                    setEditMemberRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete');
                  setDeleteModalVisible(false);
                  setMemberToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
        onRequestClose={() => setAddServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Weekly Service</Text>

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
                {churchRoles.length > 0 ? (
                  <View style={styles.roleCheckboxContainer}>
                    {churchRoles.map((role) => {
                      const isSelected = selectedServiceRoles.includes(role.name);
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
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('User cancelled add service');
                    setAddServiceModalVisible(false);
                    setNewServiceName('');
                    setNewServiceDay(0);
                    setNewServiceTime('09:00');
                    setNewServiceNotes('');
                    setSelectedServiceRoles([]);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddService}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled add role');
                  setAddRoleModalVisible(false);
                  setNewRoleName('');
                  setNewRoleDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled delete role');
                  setDeleteRoleModalVisible(false);
                  setRoleToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setSignOutModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
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

      {/* Prepare Quarter Modal */}
      <Modal visible={showPrepareQuarterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Prepare Quarter</Text>
              
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Quarter</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4].map(q => {
                  const isSelected = selectedQuarter === q;
                  const quarterText = `Q${q}`;
                  return (
                    <TouchableOpacity
                      key={q}
                      style={[
                        styles.quarterButton,
                        { flex: 1, marginHorizontal: 4, backgroundColor: colors.inputBackground },
                        isSelected && { backgroundColor: colors.primary }
                      ]}
                      onPress={() => setSelectedQuarter(q)}
                    >
                      <Text style={[
                        styles.quarterButtonText,
                        { color: isSelected ? '#fff' : colors.text }
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
                        style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}
                        onPress={() => toggleBlockService(serviceKey)}
                      >
                        <Text style={[styles.blockServiceText, { color: colors.text }]}>
                          {template.name} - {dateText}
                        </Text>
                        <View style={[
                          styles.checkbox,
                          { borderColor: colors.primary },
                          isBlocked && { backgroundColor: colors.primary }
                        ]}>
                          {isBlocked && (
                            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })}
              </ScrollView>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Special Services</Text>
              {specialServices.map((special) => {
                const dateText = formatDate(special.date.toISOString());
                const roleNames = special.selectedRoleIds
                  .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <View key={special.id} style={[styles.blockServiceItem, { backgroundColor: colors.inputBackground }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.blockServiceText, { color: colors.text }]}>
                        {special.name} - {dateText} at {special.time}
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

              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handlePrepareQuarter}>
                <Text style={styles.buttonText}>Generate Services</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.border }]} onPress={() => setShowPrepareQuarterModal(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Special Service Modal */}
      <Modal visible={showAddSpecialService} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Special Service</Text>
              
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Christmas Eve)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceName}
                onChangeText={setSpecialServiceName}
              />

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => setShowSpecialServiceDatePicker(true)}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {formatDate(specialServiceDate.toISOString())}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceDatePicker && (
                <DateTimePicker
                  value={specialServiceDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowSpecialServiceDatePicker(false);
                    if (date) setSpecialServiceDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground }]}
                onPress={() => setShowSpecialServiceTimePicker(true)}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {specialServiceTime}
                </Text>
              </TouchableOpacity>
              {showSpecialServiceTimePicker && (
                <DateTimePicker
                  value={new Date(`2000-01-01T${specialServiceTime}:00`)}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowSpecialServiceTimePicker(false);
                    if (date) {
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      setSpecialServiceTime(`${hours}:${minutes}`);
                    }
                  }}
                />
              )}

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Roles</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {churchRoles.map(role => {
                  const isSelected = specialServiceRoles.includes(role.id);
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
                        isSelected && { backgroundColor: colors.primary }
                      ]}>
                        {isSelected && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={specialServiceNotes}
                onChangeText={setSpecialServiceNotes}
                multiline
              />

              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleAddSpecialService}>
                <Text style={styles.buttonText}>Add Service</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.border }]} onPress={() => setShowAddSpecialService(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
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
  signOutButton: {
    marginRight: 16,
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
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editIconButton: {
    padding: 8,
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
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
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
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quarterButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  quarterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  blockServiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  blockServiceText: {
    fontSize: 14,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleItemText: {
    fontSize: 14,
    flex: 1,
  },
  dateButton: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateButtonText: {
    fontSize: 16,
  },
});
