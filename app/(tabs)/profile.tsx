
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { colors } from "@/styles/commonStyles";
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack, useRouter } from "expo-router";
import { useChurch } from "@/hooks/useChurch";
import { Calendar, DateData } from "react-native-calendars";
import type { Tables } from "@/lib/supabase/types";

type MemberUnavailability = Tables<'member_unavailability'>;

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, currentMember, currentChurch, signOut, fetchMemberUnavailability, addMemberUnavailability, removeMemberUnavailability } = useChurch();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [unavailabilityDates, setUnavailabilityDates] = useState<MemberUnavailability[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});

  // Fetch unavailability dates when member loads
  useEffect(() => {
    const loadUnavailability = async () => {
      if (currentMember?.id) {
        console.log('Loading unavailability dates for member:', currentMember.id);
        setLoadingDates(true);
        const dates = await fetchMemberUnavailability(currentMember.id);
        setUnavailabilityDates(dates);
        
        // Build marked dates object for calendar
        const marked: { [key: string]: any } = {};
        dates.forEach(d => {
          marked[d.unavailable_date] = {
            selected: true,
            selectedColor: '#FF3B30',
            marked: true,
          };
        });
        setMarkedDates(marked);
        setLoadingDates(false);
      }
    };

    loadUnavailability();
  }, [currentMember?.id, fetchMemberUnavailability]);

  const handleSignOut = async () => {
    console.log('User tapped Sign Out button');
    try {
      setSigningOut(true);
      await signOut();
      console.log('Sign out successful, navigating to onboarding');
      setShowSignOutModal(false);
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error signing out:', error);
      setSigningOut(false);
    }
  };

  const handleDayPress = async (day: DateData) => {
    if (!currentMember?.id) {
      console.log('No current member');
      return;
    }

    console.log('User tapped date:', day.dateString);
    const dateString = day.dateString;
    
    // Check if date is already marked as unavailable
    const existingUnavailability = unavailabilityDates.find(d => d.unavailable_date === dateString);
    
    if (existingUnavailability) {
      // Remove unavailability
      console.log('Removing unavailability for date:', dateString);
      const success = await removeMemberUnavailability(existingUnavailability.id);
      if (success) {
        const updatedDates = unavailabilityDates.filter(d => d.id !== existingUnavailability.id);
        setUnavailabilityDates(updatedDates);
        
        const newMarked = { ...markedDates };
        delete newMarked[dateString];
        setMarkedDates(newMarked);
      }
    } else {
      // Add unavailability
      console.log('Adding unavailability for date:', dateString);
      const success = await addMemberUnavailability(currentMember.id, [dateString]);
      if (success) {
        // Refresh the dates
        const dates = await fetchMemberUnavailability(currentMember.id);
        setUnavailabilityDates(dates);
        
        const marked: { [key: string]: any } = {};
        dates.forEach(d => {
          marked[d.unavailable_date] = {
            selected: true,
            selectedColor: '#FF3B30',
            marked: true,
          };
        });
        setMarkedDates(marked);
      }
    }
  };

  const displayName = currentMember?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = currentMember?.email || user?.email || '';
  const isAdmin = currentChurch?.admin_id === user?.id;
  const userRole = isAdmin ? 'Admin' : 'Member';
  
  // FIXED: Allow marking from current date forward (not just next quarter)
  const today = new Date();
  const minDateString = today.toISOString().split('T')[0];
  
  // Set max date to 1 year from now
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateString = maxDate.toISOString().split('T')[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Profile',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
            <IconSymbol 
              android_material_icon_name="person" 
              size={48} 
              color="#FFFFFF" 
            />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{displayEmail}</Text>
          <View style={[styles.roleBadge, { backgroundColor: isAdmin ? colors.primary : colors.secondary }]}>
            <Text style={styles.roleBadgeText}>{userRole}</Text>
          </View>
        </View>

        {currentMember && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <IconSymbol 
                android_material_icon_name="event-busy" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0, marginLeft: 12 }]}>
                My Unavailability
              </Text>
            </View>
            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              Select dates when you won&apos;t be available to assist. Tap a date to mark/unmark it. This helps the admin avoid scheduling you on those days.
            </Text>
            
            {loadingDates ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <Calendar
                minDate={minDateString}
                maxDate={maxDateString}
                onDayPress={handleDayPress}
                markedDates={markedDates}
                theme={{
                  backgroundColor: colors.card,
                  calendarBackground: colors.card,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: '#FF3B30',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textSecondary,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                  textDayFontWeight: '400',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                }}
              />
            )}
            
            {unavailabilityDates.length > 0 && (
              <View style={styles.unavailabilityList}>
                <Text style={[styles.unavailabilityListTitle, { color: colors.text }]}>
                  Unavailable Dates
                </Text>
                <Text style={[styles.unavailabilityCount, { color: colors.textSecondary }]}>
                  {unavailabilityDates.length}
                </Text>
                <Text style={[styles.unavailabilityCount, { color: colors.textSecondary }]}>
                  {unavailabilityDates.length === 1 ? 'date' : 'dates'}
                </Text>
                <Text style={[styles.unavailabilityCount, { color: colors.textSecondary }]}>
                  selected
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: '#FF3B30' }]}
          onPress={() => {
            console.log('User tapped Sign Out button');
            setShowSignOutModal(true);
          }}
        >
          <IconSymbol 
            android_material_icon_name="logout" 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.border }]}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setShowSignOutModal(false);
                }}
                disabled={signingOut}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailabilityList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unavailabilityListTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  unavailabilityCount: {
    fontSize: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  signOutButtonText: {
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
    width: '80%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    // backgroundColor set dynamically
  },
  confirmButton: {
    // backgroundColor set dynamically
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
