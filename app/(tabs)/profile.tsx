
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { colors } from "@/styles/commonStyles";
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Animated } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack } from "expo-router";
import { useChurch } from "@/hooks/useChurch";
import { Calendar, DateData } from "react-native-calendars";
import type { Tables } from "@/lib/supabase/types";

type MemberUnavailability = Tables<'member_unavailability'>;

type ToastType = 'success' | 'error';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, loading, currentMember, currentChurch, signOut, fetchMemberUnavailability, saveUnavailableDates } = useChurch();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [savedDates, setSavedDates] = useState<MemberUnavailability[]>([]);
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setToastVisible(false);
    });
  };

  // Fetch unavailability dates when member loads
  useEffect(() => {
    const loadUnavailability = async () => {
      if (currentMember?.id) {
        console.log('Loading unavailability dates for member:', currentMember.id);
        setLoadingDates(true);
        const dates = await fetchMemberUnavailability(currentMember.id);
        setSavedDates(dates);
        const dateSet = new Set(dates.map(d => d.unavailable_date));
        setPendingDates(dateSet);
        setHasUnsavedChanges(false);
        setLoadingDates(false);
      }
    };

    loadUnavailability();
  }, [currentMember?.id, fetchMemberUnavailability]);

  const handleSignOut = async () => {
    console.log('User tapped Sign Out button');
    try {
      setSigningOut(true);
      setShowSignOutModal(false);
      await signOut();
      // Do NOT call router.replace here — the root layout's auth guard detects the
      // session clearing and redirects to /onboarding automatically. Calling replace
      // here as well causes a double-navigation crash on Android.
      console.log('Sign out successful — auth guard will redirect to onboarding');
    } catch (error) {
      console.error('Error signing out:', error);
      setSigningOut(false);
    }
  };

  const handleDayPress = (day: DateData) => {
    if (!currentMember?.id) {
      console.log('No current member, ignoring day press');
      return;
    }

    console.log('User tapped date (local toggle):', day.dateString);
    const dateString = day.dateString;

    setPendingDates(prev => {
      const next = new Set(prev);
      if (next.has(dateString)) {
        next.delete(dateString);
        console.log('Unmarked date locally:', dateString);
      } else {
        next.add(dateString);
        console.log('Marked date locally:', dateString);
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!currentMember?.id) return;
    const datesToSave = Array.from(pendingDates).sort();
    console.log('User tapped Save Unavailable Dates, saving', datesToSave.length, 'dates to Supabase');
    setSaving(true);
    try {
      const success = await saveUnavailableDates(currentMember.id, datesToSave);
      if (success) {
        console.log('Save successful, refreshing from Supabase');
        const refreshed = await fetchMemberUnavailability(currentMember.id);
        setSavedDates(refreshed);
        const refreshedSet = new Set(refreshed.map(d => d.unavailable_date));
        setPendingDates(refreshedSet);
        setHasUnsavedChanges(false);
        showToast('Unavailable dates saved!', 'success');
      } else {
        console.error('Save failed');
        showToast('Failed to save. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error saving unavailable dates:', err);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    console.log('[ProfileScreen] Showing loading state — loading:', loading, 'user:', !!user);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Profile',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 16, color: colors.textSecondary }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const displayName = currentMember?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = currentMember?.email || user?.email || '';
  const isAdmin = currentChurch?.admin_id === user?.id;
  const userRole = isAdmin ? 'Admin' : 'Member';

  const today = new Date();
  const minDateString = today.toISOString().split('T')[0];
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateString = maxDate.toISOString().split('T')[0];

  // Build markedDates from pendingDates (local state)
  const markedDates: { [key: string]: any } = {};
  pendingDates.forEach(date => {
    markedDates[date] = {
      selected: true,
      selectedColor: '#FF3B30',
      marked: true,
    };
  });

  const pendingCount = pendingDates.size;
  const countLabel = pendingCount === 1 ? '1 date selected' : `${pendingCount} dates selected`;
  const toastBg = toastType === 'success' ? '#34C759' : '#FF3B30';

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
              ios_icon_name="person.fill"
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
                ios_icon_name="calendar.badge.minus"
                android_material_icon_name="event-available"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0, marginLeft: 12 }]}>
                My Unavailability
              </Text>
            </View>
            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              Tap dates to mark or unmark them, then tap Save to persist your changes. The scheduling system uses these dates to avoid assigning you to services.
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
                  textDayFontWeight: '400' as any,
                  textMonthFontWeight: 'bold' as any,
                  textDayHeaderFontWeight: '600' as any,
                }}
              />
            )}

            <View style={styles.calendarFooter}>
              {pendingCount > 0 && (
                <View style={styles.countRow}>
                  <View style={[styles.countDot, { backgroundColor: '#FF3B30' }]} />
                  <Text style={[styles.countText, { color: colors.textSecondary }]}>
                    {countLabel}
                  </Text>
                  {hasUnsavedChanges && (
                    <View style={[styles.unsavedBadge, { backgroundColor: '#FF9500' }]}>
                      <Text style={styles.unsavedBadgeText}>Unsaved</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: hasUnsavedChanges ? colors.primary : colors.border },
                  saving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving || !hasUnsavedChanges}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="save"
                    size={18}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Unavailable Dates'}
                </Text>
              </TouchableOpacity>
            </View>
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
            ios_icon_name="rectangle.portrait.and.arrow.right"
            android_material_icon_name="logout"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Toast notification */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { backgroundColor: toastBg, opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

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
  calendarFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  countText: {
    fontSize: 14,
    flex: 1,
  },
  unsavedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unsavedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  cancelButton: {},
  confirmButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
