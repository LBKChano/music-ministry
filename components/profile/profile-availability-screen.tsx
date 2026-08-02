import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import { useMemberAvailability } from '@/hooks/useMemberAvailability';
import {
  areAvailabilityDateSetsEqual,
  countAvailabilityDatesInRange,
  createAvailabilityEditorRange,
  formatAvailabilityDate,
  normalizeAvailabilityDates,
  toggleAvailabilityDate,
} from '@/lib/profile/availability';
import { colors } from '@/styles/commonStyles';

type StatusTone = 'success' | 'error' | 'info';

function AvailabilityCalendarDay({
  date,
  state,
  selected,
  onToggle,
}: {
  date?: DateData;
  state?: string;
  selected: boolean;
  onToggle: (date: string) => void;
}) {
  if (!date) return <View style={styles.dayCell} />;

  const disabled = state === 'disabled';
  const accessibilityDate = formatAvailabilityDate(date.dateString, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${accessibilityDate}, ${selected ? 'unavailable' : 'available'}`}
      accessibilityHint="Toggles whether this date is a hard scheduling exclusion."
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      hitSlop={2}
      onPress={() => onToggle(date.dateString)}
      style={({ pressed }) => [
        styles.dayCell,
        selected && styles.dayCellSelected,
        disabled && styles.dayCellDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.dayText,
          selected && styles.dayTextSelected,
          disabled && styles.dayTextDisabled,
        ]}
      >
        {date.day}
      </Text>
      {selected ? (
        <View style={styles.dayCheck}>
          <IconSymbol
            ios_icon_name="checkmark"
            android_material_icon_name="check"
            size={10}
            color={colors.headerText}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function ProfileAvailabilityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    currentChurch,
    currentMember,
    saveUnavailableDates,
    sessionStatus,
    user,
  } = useChurch();
  const accountId = user?.id ?? null;
  const churchId = currentChurch?.id ?? null;
  const memberId = currentMember?.id ?? null;
  const identityKey = accountId && churchId && memberId
    ? `${accountId}:${churchId}:${memberId}`
    : null;
  const availabilityQuery = useMemberAvailability({
    accountId,
    churchId,
    memberId,
  });
  const range = useMemo(() => createAvailabilityEditorRange(), []);
  const serverDates = useMemo(
    () => new Set(normalizeAvailabilityDates(availabilityQuery.data ?? [])),
    [availabilityQuery.data],
  );
  const serverSignature = [...serverDates].join('|');
  const hasServerSnapshot = availabilityQuery.data !== undefined;
  const availabilityLoadFailed = availabilityQuery.isError && !hasServerSnapshot;
  const [baselineDates, setBaselineDates] = useState<Set<string>>(new Set());
  const [draftDates, setDraftDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [externalChangeDetected, setExternalChangeDetected] = useState(false);
  const initializedIdentityRef = useRef<string | null>(null);
  const activeIdentityRef = useRef<string | null>(identityKey);
  const lastObservedIdentityRef = useRef<string | null>(identityKey);
  const hasChanges = !areAvailabilityDateSetsEqual(baselineDates, draftDates);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;
  activeIdentityRef.current = identityKey;

  useEffect(() => {
    const previousIdentity = lastObservedIdentityRef.current;
    if (
      previousIdentity
      && identityKey
      && previousIdentity !== identityKey
      && hasChangesRef.current
    ) {
      Alert.alert(
        'Church Changed',
        'Your unavailable-date draft belonged to the previous church and was not saved.',
      );
    }

    if (previousIdentity !== identityKey) {
      lastObservedIdentityRef.current = identityKey;
      initializedIdentityRef.current = null;
      setBaselineDates(new Set());
      setDraftDates(new Set());
      setExternalChangeDetected(false);
      setSaving(false);
      setStatus(null);
    }
  }, [identityKey]);

  useEffect(() => {
    if (!identityKey || !hasServerSnapshot) return;

    if (initializedIdentityRef.current !== identityKey) {
      initializedIdentityRef.current = identityKey;
      setBaselineDates(new Set(serverDates));
      setDraftDates(new Set(serverDates));
      setExternalChangeDetected(false);
      return;
    }

    const baselineSignature = [...baselineDates].sort().join('|');
    if (!hasChanges && baselineSignature !== serverSignature) {
      setBaselineDates(new Set(serverDates));
      setDraftDates(new Set(serverDates));
      setExternalChangeDetected(false);
    } else if (hasChanges && baselineSignature !== serverSignature) {
      setExternalChangeDetected(true);
    }
  }, [
    baselineDates,
    hasChanges,
    hasServerSnapshot,
    identityKey,
    serverDates,
    serverSignature,
  ]);

  usePreventRemove(hasChanges || saving, ({ data }) => {
    if (saving) {
      Alert.alert(
        'Save in Progress',
        'Wait for unavailable dates to finish saving before leaving.',
      );
      return;
    }

    Alert.alert(
      'Discard Changes?',
      'Your unavailable-date changes have not been saved.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  const visibleSelectedCount = countAvailabilityDatesInRange(draftDates, range);
  const retainedOutsideRangeCount = draftDates.size - visibleSelectedCount;

  const handleToggle = (date: string) => {
    if (saving || date < range.startDate || date > range.endDate) return;
    setDraftDates(previous => toggleAvailabilityDate(previous, date));
    setStatus(null);
  };

  const handleSave = async () => {
    if (!identityKey || !memberId || saving) return;

    const saveIdentity = identityKey;
    const datesToSave = [...draftDates].sort();
    setSaving(true);
    setStatus(null);
    setExternalChangeDetected(false);

    try {
      const saved = await saveUnavailableDates(memberId, datesToSave);
      if (activeIdentityRef.current !== saveIdentity) return;

      if (!saved) {
        setStatus('Unavailable dates could not be saved. Your draft is still here.');
        setStatusTone('error');
        return;
      }

      const verifiedResult = await availabilityQuery.refetch();
      if (activeIdentityRef.current !== saveIdentity) return;
      if (verifiedResult.error) throw verifiedResult.error;

      const verifiedDates = new Set(
        normalizeAvailabilityDates(verifiedResult.data ?? []),
      );
      if (!areAvailabilityDateSetsEqual(verifiedDates, draftDates)) {
        setExternalChangeDetected(true);
        setStatus('The saved dates changed on another device. Review your draft and retry.');
        setStatusTone('error');
        return;
      }

      setBaselineDates(new Set(verifiedDates));
      setDraftDates(new Set(verifiedDates));
      setStatus(
        verifiedDates.size === 0
          ? 'All unavailable dates were cleared.'
          : 'Unavailable dates were saved.',
      );
      setStatusTone('success');
    } catch (error) {
      if (activeIdentityRef.current !== saveIdentity) return;
      console.error('[ProfileAvailability] Save verification failed:', error);
      setStatus('Unavailable dates could not be verified. Your draft is still here.');
      setStatusTone('error');
    } finally {
      if (activeIdentityRef.current === saveIdentity) setSaving(false);
    }
  };

  if (!user || !currentChurch || !currentMember) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        {sessionStatus === 'ready' ? (
          <>
            <IconSymbol
              ios_icon_name="calendar.badge.exclamationmark"
              android_material_icon_name="event-busy"
              size={42}
              color={colors.primary}
            />
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Availability unavailable
            </Text>
            <Text style={styles.stateCopy}>
              Return to Profile and select a church membership.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.stateButton}
            >
              <Text style={styles.stateButtonText}>Back to Profile</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateCopy}>Loading availability...</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
          disabled={saving}
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.headerText}
          />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.headerTitle}>
            Unavailable Dates
          </Text>
          <WordSafeHeaderText
            accessible={false}
            maxFontSizeMultiplier={1.35}
            maxLines={2}
            style={styles.headerSubtitle}
            text={currentChurch.name}
          />
        </View>
        <View style={styles.headerButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 116 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {availabilityQuery.isLoading && !hasServerSnapshot ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading unavailable dates...</Text>
          </View>
        ) : availabilityLoadFailed ? (
          <View style={styles.loadingCard}>
            <IconSymbol
              ios_icon_name="exclamationmark.circle.fill"
              android_material_icon_name="error"
              size={34}
              color={colors.error}
            />
            <Text accessibilityRole="alert" style={styles.errorTitle}>
              Unavailable dates could not be loaded
            </Text>
            <Text style={styles.loadingText}>
              Check your connection and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void availabilityQuery.refetch();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {availabilityQuery.isError ? (
              <ProfileStatus
                message="The latest refresh failed. Your last loaded dates are still shown."
                tone="error"
              />
            ) : null}
            <ProfileStatus message={status} tone={statusTone} />
            <View style={styles.explainer}>
              <View style={styles.explainerIcon}>
                <IconSymbol
                  ios_icon_name="calendar.badge.exclamationmark"
                  android_material_icon_name="event-busy"
                  size={24}
                  color={colors.error}
                />
              </View>
              <View style={styles.explainerCopy}>
                <Text style={styles.explainerTitle}>Hard scheduling exclusions</Text>
                <Text style={styles.explainerText}>
                  Auto-assign will not schedule you on selected dates.
                </Text>
              </View>
            </View>

            {externalChangeDetected ? (
              <ProfileStatus
                message="Availability changed on another device while you were editing. Your local draft was kept."
                tone="info"
              />
            ) : null}

            <View style={styles.calendarCard}>
              <View style={styles.calendarMeta}>
                <View>
                  <Text style={styles.calendarMetaLabel}>Scheduling window</Text>
                  <Text style={styles.calendarMetaValue}>
                    {formatAvailabilityDate(range.startDate, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' - '}
                    {formatAvailabilityDate(range.endDate, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {visibleSelectedCount} selected
                  </Text>
                </View>
              </View>

              <Calendar
                dayComponent={({ date, state }) => (
                  <AvailabilityCalendarDay
                    date={date}
                    state={state}
                    selected={Boolean(date && draftDates.has(date.dateString))}
                    onToggle={handleToggle}
                  />
                )}
                disableAllTouchEventsForDisabledDays
                firstDay={0}
                hideExtraDays={false}
                maxDate={range.endDate}
                minDate={range.startDate}
                theme={{
                  arrowColor: colors.primary,
                  calendarBackground: colors.card,
                  monthTextColor: colors.text,
                  textMonthFontSize: 17,
                  textMonthFontWeight: '800',
                  textSectionTitleColor: colors.textSecondary,
                  todayTextColor: colors.primary,
                }}
              />
            </View>

            <View style={styles.draftSummary}>
              <View style={styles.draftSummaryRow}>
                <IconSymbol
                  ios_icon_name={hasChanges ? 'pencil.circle.fill' : 'checkmark.circle.fill'}
                  android_material_icon_name={hasChanges ? 'edit' : 'check-circle'}
                  size={21}
                  color={hasChanges ? '#9A3412' : '#166534'}
                />
                <Text style={styles.draftSummaryText}>
                  {hasChanges
                    ? `${draftDates.size} total selected - unsaved changes`
                    : `${draftDates.size} total selected - saved`}
                </Text>
              </View>
              {retainedOutsideRangeCount > 0 ? (
                <Text style={styles.retainedText}>
                  {retainedOutsideRangeCount} saved date
                  {retainedOutsideRangeCount === 1 ? '' : 's'} outside this window
                  {retainedOutsideRangeCount === 1 ? ' is' : ' are'} kept automatically.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel availability editing"
          disabled={saving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save unavailable dates"
          accessibilityHint="Saves every selected date as a hard scheduling exclusion."
          accessibilityState={{
            busy: saving,
            disabled: saving || !hasChanges || availabilityLoadFailed,
          }}
          disabled={saving || !hasChanges || availabilityLoadFailed}
          onPress={() => {
            void handleSave();
          }}
          style={({ pressed }) => [
            styles.saveButton,
            (saving || !hasChanges || availabilityLoadFailed)
              && styles.saveButtonDisabled,
            pressed && hasChanges && !saving && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.headerText} />
          ) : (
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="save"
              size={20}
              color={colors.headerText}
            />
          )}
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.headerBackground,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerButtonSpacer: {
    height: 44,
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: colors.headerText,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  headerSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 1,
    maxWidth: '100%',
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 240,
    padding: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: colors.headerText,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  explainer: {
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  explainerIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  explainerCopy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
  },
  explainerTitle: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  explainerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  calendarCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  calendarMeta: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
  },
  calendarMetaLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  calendarMetaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  countBadgeText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  dayCell: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dayCellSelected: {
    backgroundColor: colors.error,
    borderColor: '#991B1B',
  },
  dayCellDisabled: {
    opacity: 0.28,
  },
  dayText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  dayTextSelected: {
    color: colors.headerText,
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: colors.textTertiary,
  },
  dayCheck: {
    alignItems: 'center',
    bottom: 1,
    height: 12,
    justifyContent: 'center',
    position: 'absolute',
    right: 1,
    width: 12,
  },
  draftSummary: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  draftSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  draftSummaryText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  retainedText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    paddingLeft: 30,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1.4,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    backgroundColor: colors.textTertiary,
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  stateCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 4,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stateButtonText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
