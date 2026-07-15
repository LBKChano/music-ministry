
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Animated } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useChurch } from "@/hooks/useChurch";
import { Calendar, DateData } from "react-native-calendars";
import type { Tables } from "@/lib/supabase/types";

type MemberUnavailability = Tables<'member_unavailability'>;

type ToastType = 'success' | 'error';

export default function ProfileScreen() {
  const { user, loading, currentMember, currentChurch, signOut, deleteAccount, fetchMemberUnavailability, saveUnavailableDates } = useChurch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

    loadUnavailability().catch(err => console.error('[ProfileScreen] loadUnavailability error:', err));
  }, [currentMember?.id, fetchMemberUnavailability]);

  const handleDeleteAccount = async () => {
    console.log('User confirmed account deletion');
    try {
      setDeleting(true);
      setShowDeleteModal(false);
      await deleteAccount();
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error deleting account:', error);
      showToast('Failed to delete account. Please try again.', 'error');
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    console.log('User tapped Sign Out button');
    try {
      setSigningOut(true);
      setShowSignOutModal(false);
      await signOut();
      router.replace('/onboarding');
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
            headerShown: false,
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 16, color: colors.textSecondary }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const displayName = currentMember?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = currentMember?.email || user?.email || '';
  const isAdmin = currentChurch?.admin_id === user?.id || currentMember?.is_admin;
  const userRole = isAdmin ? 'Admin' : 'Member';
  const profileSubtitle = userRole;

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.profileHeaderContainer, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.headerAccentPanel} />
        <View style={styles.headerAccentLine} />
        <View style={styles.profileHeaderTopRow}>
          <View style={styles.profileHeaderTextWrap}>
            <Text style={styles.headerEyebrow}>Profile</Text>
            <Text
              style={styles.profileHeaderTitle}
              numberOfLines={2}
            >
              {displayName}
            </Text>
            {currentChurch?.name ? (
              <Text
                style={styles.profileChurchTitle}
                numberOfLines={2}
              >
                {currentChurch.name}
              </Text>
            ) : null}
          </View>
          <View style={styles.profileHeaderAvatar}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={30}
              color="#FFFFFF"
            />
          </View>
        </View>
        <View style={styles.headerMetaRow}>
          <View style={styles.headerStatPill}>
            <IconSymbol ios_icon_name="person.badge.key.fill" android_material_icon_name="verified-user" size={16} color="#FFFFFF" />
            <Text style={styles.headerStatText}>{profileSubtitle}</Text>
          </View>
          <Text style={styles.headerPeriodText} numberOfLines={1}>{displayEmail}</Text>
        </View>
      </LinearGradient>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {currentMember && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="calendar.badge.minus"
                android_material_icon_name="event"
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
                    android_material_icon_name="save-alt"
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

        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => {
            console.log('User tapped Delete Account button');
            setShowDeleteModal(true);
          }}
          disabled={deleting}
        >
          <IconSymbol
            ios_icon_name="trash"
            android_material_icon_name="delete"
            size={18}
            color="#FF3B30"
          />
          <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
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

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Account</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will permanently delete your account and all your data. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.border }]}
                onPress={() => {
                  console.log('User cancelled account deletion');
                  setShowDeleteModal(false);
                }}
                disabled={deleting}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                )}
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
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  profileHeaderContainer: {
    paddingBottom: 22,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  headerAccentPanel: {
    position: 'absolute',
    right: -24,
    top: 18,
    width: 132,
    height: 74,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    transform: [{ rotate: '-12deg' }],
  },
  headerAccentLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  profileHeaderTopRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  profileHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileHeaderAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  headerEyebrow: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  profileHeaderTitle: {
    fontSize: 36,
    lineHeight: 41,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  profileChurchTitle: {
    marginTop: 5,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    color: '#DBEAFE',
    textAlign: 'left',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  headerStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerStatText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'left',
  },
  headerPeriodText: {
    flexShrink: 1,
    fontSize: 13,
    color: '#DBEAFE',
    fontWeight: '700',
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
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    backgroundColor: 'transparent',
  },
  deleteAccountButtonText: {
    color: '#FF3B30',
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
