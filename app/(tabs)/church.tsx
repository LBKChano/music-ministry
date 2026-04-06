
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
  Switch,
  RefreshControl,
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
import * as Clipboard from 'expo-clipboard';

interface SpecialService {
  id: string;
  name: string;
  date: Date;
  time: string;
  notes: string;
  selectedRoleIds: string[];
}

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateForDatabase(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format time from Date object as HH:MM
function formatTimeForDatabase(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
    notificationSettings,
    loading,
    error,
    user,
    createChurch,
    deleteMember,
    updateMember,
    addRecurringService,
    deleteRecurringService,
    addChurchRole,
    deleteChurchRole,
    updateRoleOrder,
    addMemberRole,
    removeMemberRole,
    fetchMemberUnavailability,
    updateNotificationSettings,
    refreshChurches,
    refreshMembers,
    refreshRecurringServices,
    refreshChurchRoles,
    refreshNotificationSettings,
  } = useChurch();

  const { services, batchUpdateAssignments, createServiceFromTemplate, refreshServices } = useServices(currentChurch?.id || null);

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
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);

  const [newChurchName, setNewChurchName] = useState('');
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

  // Notification settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationSettings?.enabled ?? true);
  const [selectedNotificationHours, setSelectedNotificationHours] = useState<number[]>(
    notificationSettings?.notification_hours ?? [24, 6]
  );
  const [customHourInput, setCustomHourInput] = useState('');
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Quarterly assignment states
  const [showPrepareQuarterModal, setShowPrepareQuarterModal] = useState(false);
  const [prepareQuarterStep, setPrepareQuarterStep] = useState<'block' | 'special'>('block');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [blockedServices, setBlockedServices] = useState<Set<string>>(new Set());
  const [specialServices, setSpecialServices] = useState<SpecialService[]>([]);
  const [showAddSpecialService, setShowAddSpecialService] = useState(false);
  const [specialServiceDate, setSpecialServiceDate] = useState(new Date());
  const [specialServiceName, setSpecialServiceName] = useState('');
  const [specialServiceTime, setSpecialServiceTime] = useState(new Date());
  const [specialServiceNotes, setSpecialServiceNotes] = useState('');
  const [specialServiceRoles, setSpecialServiceRoles] = useState<string[]>([]);
  const [showSpecialServiceTimePicker, setShowSpecialServiceTimePicker] = useState(false);
  const [showSpecialServiceDatePicker, setShowSpecialServiceDatePicker] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Ad-hoc service modal states
  const [showAdHocServiceModal, setShowAdHocServiceModal] = useState(false);
  const [adHocServiceName, setAdHocServiceName] = useState('');
  const [adHocServiceDate, setAdHocServiceDate] = useState(new Date());
  const [adHocServiceTime, setAdHocServiceTime] = useState(new Date());
  const [adHocServiceNotes, setAdHocServiceNotes] = useState('');
  const [adHocServiceRoles, setAdHocServiceRoles] = useState<string[]>([]);
  const [showAdHocDatePicker, setShowAdHocDatePicker] = useState(false);
  const [showAdHocTimePicker, setShowAdHocTimePicker] = useState(false);
  const [isCreatingAdHocService, setIsCreatingAdHocService] = useState(false);

  // Quarter preparation loading state
  const [isPreparing, setIsPreparing] = useState(false);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Update notification states when settings change
  React.useEffect(() => {
    if (notificationSettings) {
      setNotificationsEnabled(notificationSettings.enabled);
      setSelectedNotificationHours(notificationSettings.notification_hours);
    }
  }, [notificationSettings]);

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
        currentChurch ? refreshServices() : Promise.resolve(),
      ]);
      console.log('Church Management data refreshed successfully');
    } catch (err) {
      console.error('Error refreshing Church Management data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshChurches, refreshMembers, refreshRecurringServices, refreshChurchRoles, refreshNotificationSettings, refreshServices, currentChurch]);

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

  const copyInvitationCode = async () => {
    if (currentChurch?.invitation_code) {
      console.log('User copied invitation code:', currentChurch.invitation_code);
      await Clipboard.setStringAsync(currentChurch.invitation_code);
      Alert.alert('Copied!', 'Invitation code copied to clipboard');
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
      setSignOutModalVisible(false);
      await supabase.auth.signOut();
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

  const moveRoleUp = async (index: number) => {
    if (index === 0 || !currentChurch) return;
    
    console.log('User moved role up:', churchRoles[index].name);
    const newRoles = [...churchRoles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index - 1];
    newRoles[index - 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const moveRoleDown = async (index: number) => {
    if (index === churchRoles.length - 1 || !currentChurch) return;
    
    console.log('User moved role down:', churchRoles[index].name);
    const newRoles = [...churchRoles];
    const temp = newRoles[index];
    newRoles[index] = newRoles[index + 1];
    newRoles[index + 1] = temp;
    
    const roleIds = newRoles.map(r => r.id);
    await updateRoleOrder(currentChurch.id, roleIds);
  };

  const toggleServiceRole = (roleName: string) => {
    console.log('User toggled service role:', roleName);
    if (selectedServiceRoles.includes(roleName)) {
      setSelectedServiceRoles(selectedServiceRoles.filter(r => r !== roleName));
    } else {
      setSelectedServiceRoles([...selectedServiceRoles, roleName]);
    }
  };

  const toggleNotificationHour = (hour: number) => {
    console.log('User toggled notification hour:', hour);
    if (selectedNotificationHours.includes(hour)) {
      setSelectedNotificationHours(selectedNotificationHours.filter(h => h !== hour));
    } else {
      setSelectedNotificationHours([...selectedNotificationHours, hour].sort((a, b) => b - a));
    }
  };

  const addCustomNotificationHour = () => {
    const hour = parseInt(customHourInput);
    if (isNaN(hour) || hour < 1 || hour > 168) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 168 hours');
      return;
    }
    
    if (selectedNotificationHours.includes(hour)) {
      Alert.alert('Already Added', 'This notification time is already in the list');
      return;
    }

    console.log('User added custom notification hour:', hour);
    setSelectedNotificationHours([...selectedNotificationHours, hour].sort((a, b) => b - a));
    setCustomHourInput('');
  };

  const removeNotificationHour = (hour: number) => {
    console.log('User removed notification hour:', hour);
    setSelectedNotificationHours(selectedNotificationHours.filter(h => h !== hour));
  };

  const handleSaveNotificationSettings = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    if (selectedNotificationHours.length === 0) {
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

  const handleSaveBlockedDates = () => {
    console.log('User saved blocked dates, moving to special services step');
    setPrepareQuarterStep('special');
  };

  const handlePrepareQuarter = async () => {
    if (!currentChurch?.id) {
      Alert.alert('Error', 'No church selected. Please ensure your account is linked to a church.');
      return;
    }

    console.log('User tapped Generate Services button for church:', currentChurch.id);
    setIsPreparing(true);

    const generatedServices = generateQuarterServices();
    let successCount = 0;
    let failCount = 0;

    for (const { date, template } of generatedServices) {
      const dateString = formatDateForDatabase(date);
      try {
        const result = await createServiceFromTemplate(currentChurch.id, dateString, template.name, template.notes, template.roles, template.time);
        if (result) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Error creating service from template:', err);
        failCount++;
      }
    }

    for (const special of specialServices) {
      const dateString = formatDateForDatabase(special.date);
      const roleNames = special.selectedRoleIds
        .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
        .filter((name): name is string => name !== undefined);

      console.log('Creating special service with roles:', { name: special.name, roleNames, time: special.time });
      try {
        const result = await createServiceFromTemplate(currentChurch.id, dateString, special.name, special.notes, roleNames, special.time);
        if (result) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Error creating special service:', err);
        failCount++;
      }
    }

    setIsPreparing(false);
    setShowPrepareQuarterModal(false);
    setPrepareQuarterStep('block');
    setBlockedServices(new Set());
    setSpecialServices([]);

    if (failCount > 0) {
      Alert.alert(
        'Partial Success',
        `${successCount} service${successCount !== 1 ? 's' : ''} created successfully, ${failCount} failed. Please check your connection and try again for any missing services.`
      );
    } else {
      Alert.alert('Success', `${successCount} quarter service${successCount !== 1 ? 's' : ''} generated successfully!`);
    }
  };

  const handleAutoAssign = async () => {
    if (!currentChurch) {
      Alert.alert('Error', 'No church selected');
      return;
    }

    console.log('User tapped Auto-Assign button');
    setIsAutoAssigning(true);

    try {
      // OPTIMIZATION 1: Build member-by-role map once
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

      // OPTIMIZATION 2: Fetch ALL unavailability in a single query
      // Include all member IDs; guard against empty array to avoid Supabase .in() error
      const memberIds = members.map(m => m.id);
      console.log('Fetching all member unavailability in one query for', memberIds.length, 'members...');

      const memberUnavailability: { [memberId: string]: Set<string> } = {};
      members.forEach(member => {
        memberUnavailability[member.id] = new Set();
      });

      if (memberIds.length > 0) {
        const { data: allUnavailability, error: unavailError } = await supabase
          .from('member_unavailability')
          .select('member_id, unavailable_date')
          .in('member_id', memberIds);

        if (unavailError) {
          console.error('Error fetching unavailability:', unavailError);
          Alert.alert('Error', 'Failed to fetch member availability');
          setIsAutoAssigning(false);
          return;
        }

        (allUnavailability || []).forEach(unavail => {
          if (!memberUnavailability[unavail.member_id]) {
            memberUnavailability[unavail.member_id] = new Set();
          }
          memberUnavailability[unavail.member_id].add(unavail.unavailable_date);
        });

        console.log('Unavailability data loaded:', (allUnavailability || []).length, 'unavailability records for', memberIds.length, 'members');
      } else {
        console.log('No members found, skipping unavailability fetch');
      }

      // OPTIMIZATION 3: Track assignment counts
      const assignmentCounts: { [memberId: string]: number } = {};
      members.forEach(member => {
        assignmentCounts[member.id] = 0;
      });

      // OPTIMIZATION 4: Collect all updates for batch processing
      const assignmentUpdates: { id: string; member_id: string; person_name: string }[] = [];
      const filteredServices = services.filter(s => s.church_id === currentChurch.id);

      let skippedCount = 0;

      for (const service of filteredServices) {
        const serviceDate = service.date;
        
        for (const assignment of service.assignments) {
          if (!assignment.member_id && assignment.role) {
            const availableMembers = (membersByRole[assignment.role] || []).filter(member => {
              const isUnavailable = memberUnavailability[member.id]?.has(serviceDate);
              return !isUnavailable;
            });
            
            if (availableMembers.length > 0) {
              // Sort by current assignment count for load balancing
              availableMembers.sort((a, b) => 
                (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0)
              );

              const selectedMember = availableMembers[0];
              
              assignmentUpdates.push({
                id: assignment.id,
                member_id: selectedMember.id,
                person_name: selectedMember.name || selectedMember.email,
              });
              
              assignmentCounts[selectedMember.id] = (assignmentCounts[selectedMember.id] || 0) + 1;
            } else {
              skippedCount++;
            }
          }
        }
      }

      // OPTIMIZATION 5: Batch update all assignments at once
      console.log('Batch updating', assignmentUpdates.length, 'assignments...');
      if (assignmentUpdates.length > 0) {
        const success = await batchUpdateAssignments(assignmentUpdates);
        
        if (success) {
          console.log(`Auto-assignment completed: ${assignmentUpdates.length} assigned, ${skippedCount} skipped`);
          Alert.alert('Success', `Auto-assignment completed!\n${assignmentUpdates.length} slots assigned\n${skippedCount} slots remain open (no available members)`);
        } else {
          Alert.alert('Error', 'Some assignments failed to update');
        }
      } else {
        Alert.alert('Info', 'No open slots to assign');
      }
    } catch (err) {
      console.error('Error in auto-assign:', err);
      Alert.alert('Error', 'Auto-assignment failed');
    } finally {
      setIsAutoAssigning(false);
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
      
      const roleNames = adHocServiceRoles
        .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
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

  if (!user) {
    return null;
  }

  const noChurchesText = 'No churches yet';
  const createFirstChurchText = 'Create your first church to get started';
  const noMembersText = 'No members yet';
  const inviteMembersText = 'Share your invitation code with members to join';
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

      <ScrollView 
        style={styles.scrollView}
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

        {/* Invitation Code Display */}
        {currentChurch && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Invitation Code</Text>
            </View>
            <View style={[styles.invitationCodeCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.invitationCodeContent}>
                <IconSymbol
                  ios_icon_name="ticket"
                  android_material_icon_name="confirmation-number"
                  size={32}
                  color={colors.primary}
                />
                <View style={styles.invitationCodeDetails}>
                  <Text style={[styles.invitationCodeLabel, { color: colors.textSecondary }]}>
                    Share this code with members:
                  </Text>
                  <Text style={[styles.invitationCode, { color: colors.primary }]}>
                    {currentChurch.invitation_code}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.copyButton, { backgroundColor: colors.primary }]}
                onPress={copyInvitationCode}
              >
                <IconSymbol
                  ios_icon_name="doc.on.doc"
                  android_material_icon_name="content-copy"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Members can use this code when creating their account to automatically join your church
            </Text>
          </View>
        )}

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
              onPress={handleAutoAssign}
              disabled={isAutoAssigning}
            >
              {isAutoAssigning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="person.2.fill"
                    android_material_icon_name="group"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>Auto-Assign Members</Text>
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

                {members.length === 0 ? (
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

                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 12 }]}>
                  Drag roles to reorder how they appear in services
                </Text>

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
                    {churchRoles.map((role, index) => {
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
                                  android_material_icon_name="arrow-upward"
                                  size={20}
                                  color={index === 0 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => moveRoleDown(index)}
                                disabled={index === churchRoles.length - 1}
                                style={[styles.orderButton, index === churchRoles.length - 1 && styles.orderButtonDisabled]}
                              >
                                <IconSymbol
                                  ios_icon_name="chevron.down"
                                  android_material_icon_name="arrow-downward"
                                  size={20}
                                  color={index === churchRoles.length - 1 ? colors.textSecondary : colors.primary}
                                />
                              </TouchableOpacity>
                            </View>
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
                      android_material_icon_name="check-circle"
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
                      const isSelected = selectedNotificationHours.includes(hour);
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
                  {selectedNotificationHours.length > 0 && (
                    <View style={styles.selectedTimesContainer}>
                      <Text style={[styles.selectedTimesLabel, { color: colors.text }]}>
                        Selected reminder times:
                      </Text>
                      {selectedNotificationHours.map((hour) => {
                        const hourLabel = hour === 1 ? '1 hour before' : hour < 24 ? `${hour} hours before` : hour === 24 ? '1 day before' : hour === 48 ? '2 days before' : hour === 72 ? '3 days before' : hour === 168 ? '1 week before' : `${hour} hours before`;
                        return (
                          <View key={hour} style={[styles.selectedTimeChip, { backgroundColor: colors.inputBackground }]}>
                            <Text style={[styles.selectedTimeText, { color: colors.text }]}>
                              {hourLabel}
                            </Text>
                            <TouchableOpacity onPress={() => removeNotificationHour(hour)}>
                              <IconSymbol
                                ios_icon_name="xmark.circle.fill"
                                android_material_icon_name="cancel"
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
                        android_material_icon_name="check-circle"
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
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                onPress={() => {
                  console.log('User cancelled create church');
                  setCreateChurchModalVisible(false);
                  setNewChurchName('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
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
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
                  onPress={() => {
                    console.log('User cancelled edit member');
                    setEditMemberModalVisible(false);
                    setMemberToEdit(null);
                    setEditMemberEmail('');
                    setEditMemberName('');
                    setEditMemberRoles([]);
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
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: '#e0e0e0' }]}
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
                  <Text style={[styles.cancelButtonText, { color: '#333' }]}>Cancel</Text>
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
                                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color="#fff" />
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
                    onPress={() => setShowSpecialServiceDatePicker(true)}
                  >
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {specialServiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  {showSpecialServiceDatePicker && (
                    <View style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginVertical: 8,
                    }}>
                      <DateTimePicker
                        value={specialServiceDate}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        textColor="#000000"
                        onChange={(event, date) => {
                          setShowSpecialServiceDatePicker(false);
                          if (date) setSpecialServiceDate(date);
                        }}
                      />
                    </View>
                  )}
                  <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={() => setShowSpecialServiceTimePicker(true)}
                  >
                    <Text style={[styles.dateButtonText, { color: colors.text }]}>
                      {specialServiceTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                  {showSpecialServiceTimePicker && (
                    <View style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginVertical: 8,
                    }}>
                      <DateTimePicker
                        value={specialServiceTime}
                        mode="time"
                        display="spinner"
                        themeVariant="light"
                        textColor="#000000"
                        onChange={(event, time) => {
                          setShowSpecialServiceTimePicker(false);
                          if (time) setSpecialServiceTime(time);
                        }}
                      />
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
                    {churchRoles.map(role => {
                      const isSelected = specialServiceRoles.includes(role.id);
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
                    const roleNames = special.selectedRoleIds
                      .map(roleId => churchRoles.find(r => r.id === roleId)?.name)
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
                          <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={24} color="#ff3b30" />
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
                  <TouchableOpacity 
                    style={[styles.secondaryButton, { backgroundColor: '#e0e0e0', marginTop: 12 }]} 
                    onPress={() => {
                      console.log('User went back to block dates step');
                      setPrepareQuarterStep('block');
                    }}
                  >
                    <Text style={[styles.secondaryButtonText, { color: '#333' }]}>Back to Block Dates</Text>
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
                  value={specialServiceDate}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  onChange={(event, date) => {
                    console.log('User selected date:', date);
                    setShowSpecialServiceDatePicker(false);
                    if (date) setSpecialServiceDate(date);
                  }}
                />
                </View>
              )}

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {
                  console.log('User tapped time picker button');
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
                  value={specialServiceTime}
                  mode="time"
                  display="spinner"
                  themeVariant="light"
                  onChange={(event, date) => {
                    console.log('User selected time:', date);
                    setShowSpecialServiceTimePicker(false);
                    if (date) setSpecialServiceTime(date);
                  }}
                />
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Select Roles</Text>
              <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
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
                        isSelected && { backgroundColor: colors.primary },
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

      {/* Add Ad-Hoc Service Modal - UPDATED TO MATCH PREPARE QUARTER MODAL SIZE */}
      <Modal visible={showAdHocServiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#fff', maxWidth: 500 }]}>
              <Text style={[styles.modalTitle, { color: colors.text, fontSize: 22, marginBottom: 8 }]}>Add Single Service</Text>
              <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 16 }]}>
                Create a one-time service that will appear in the Schedules tab and trigger reminder notifications
              </Text>
              
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Service Name (e.g., Special Prayer Meeting)"
                placeholderTextColor={colors.textSecondary}
                value={adHocServiceName}
                onChangeText={setAdHocServiceName}
              />

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {
                  console.log('User tapped ad-hoc date picker button');
                  setShowAdHocDatePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Date: {adHocServiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showAdHocDatePicker && (
                <View style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  overflow: 'hidden',
                  marginVertical: 8,
                }}>
                  <DateTimePicker
                    value={adHocServiceDate}
                    mode="date"
                    display="spinner"
                    themeVariant="light"
                    textColor="#000000"
                    onChange={(event, date) => {
                      console.log('User selected ad-hoc date:', date);
                      setShowAdHocDatePicker(false);
                      if (date) setAdHocServiceDate(date);
                    }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {
                  console.log('User tapped ad-hoc time picker button');
                  setShowAdHocTimePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>
                  Time: {adHocServiceTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
              {showAdHocTimePicker && (
                <View style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  overflow: 'hidden',
                  marginVertical: 8,
                }}>
                  <DateTimePicker
                    value={adHocServiceTime}
                    mode="time"
                    display="spinner"
                    themeVariant="light"
                    textColor="#000000"
                    onChange={(event, date) => {
                      console.log('User selected ad-hoc time:', date);
                      setShowAdHocTimePicker(false);
                      if (date) setAdHocServiceTime(date);
                    }}
                  />
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Select Roles</Text>
              <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
                {churchRoles.map(role => {
                  const isSelected = adHocServiceRoles.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleItem, { backgroundColor: colors.inputBackground }]}
                      onPress={() => toggleAdHocServiceRole(role.id)}
                    >
                      <Text style={[styles.roleItemText, { color: colors.text }]}>{role.name}</Text>
                      <View style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        isSelected && { backgroundColor: colors.primary },
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
                style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]}
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={adHocServiceNotes}
                onChangeText={setAdHocServiceNotes}
                multiline
              />

              <TouchableOpacity 
                style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 20 }]} 
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
                style={[styles.secondaryButton, { backgroundColor: '#e0e0e0', marginTop: 12 }]} 
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
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
  invitationCodeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  invitationCodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  invitationCodeDetails: {
    flex: 1,
  },
  invitationCodeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  invitationCode: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
