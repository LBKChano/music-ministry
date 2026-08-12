import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { AppModal } from '@/components/ui/app-modal';
import { useAppTheme } from '@/contexts/AppThemeContext';
import type { ServiceWithAssignments } from '@/hooks/useServices';
import {
  MAX_BULK_SERVICE_DELETE_COUNT,
  formatBulkServiceDeleteTime,
  type BulkServiceDeleteItem,
  type BulkServiceDeleteMode,
  type BulkServiceDeleteResult,
  type BulkServiceDeleteSelection,
} from '@/lib/admin/bulk-service-deletion';

type BulkServiceDeleteModalProps = {
  visible: boolean;
  churchName: string;
  services: ServiceWithAssignments[];
  loadingMore: boolean;
  loadedThrough: string | null;
  onLoadMore: () => void;
  onClose: () => void;
  onPreview: (
    selection: BulkServiceDeleteSelection
  ) => Promise<BulkServiceDeleteResult | null>;
  onApply: (
    previewedServiceIds: string[]
  ) => Promise<BulkServiceDeleteResult | null>;
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDatabaseDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string | Date): string {
  const date = value instanceof Date
    ? value
    : new Date(`${value.split('T')[0]}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function dependentCount(item: BulkServiceDeleteItem): number {
  return item.assignment_count
    + item.fill_in_request_count
    + item.song_count
    + item.sent_reminder_count
    + item.member_notification_count
    + item.notification_log_count;
}

export function BulkServiceDeleteModal({
  visible,
  churchName,
  services,
  loadingMore,
  loadedThrough,
  onLoadMore,
  onClose,
  onPreview,
  onApply,
}: BulkServiceDeleteModalProps) {
  const theme = useAppTheme();
  const [mode, setMode] = useState<BulkServiceDeleteMode>('date_range');
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [endDate, setEndDate] = useState(() => addDays(startOfDay(new Date()), 90));
  const [draftDate, setDraftDate] = useState(() => startOfDay(new Date()));
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<BulkServiceDeleteResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const orderedServices = useMemo(
    () => [...services].sort((left, right) => {
      const dateComparison = left.date.localeCompare(right.date);
      if (dateComparison !== 0) return dateComparison;
      const timeComparison = (left.time ?? '').localeCompare(right.time ?? '');
      if (timeComparison !== 0) return timeComparison;
      return left.id.localeCompare(right.id);
    }),
    [services]
  );

  useEffect(() => {
    if (!visible) return;
    setMode('date_range');
    setStartDate(startOfDay(new Date()));
    setEndDate(addDays(startOfDay(new Date()), 90));
    setSelectedIds(new Set());
    setPreview(null);
    setActiveDateField(null);
    setIsPreviewing(false);
    setIsApplying(false);
  }, [visible]);

  const editSelection = () => {
    setPreview(null);
  };

  const selectMode = (nextMode: BulkServiceDeleteMode) => {
    if (isPreviewing || isApplying) return;
    setMode(nextMode);
    setPreview(null);
    setActiveDateField(null);
  };

  const toggleService = (serviceId: string) => {
    if (isPreviewing || isApplying) return;
    setPreview(null);
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else if (next.size < MAX_BULK_SERVICE_DELETE_COUNT) next.add(serviceId);
      else {
        Alert.alert(
          'Selection Limit',
          `Select no more than ${MAX_BULK_SERVICE_DELETE_COUNT} services at once.`
        );
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    if (isPreviewing || isApplying) return;
    if (orderedServices.length > MAX_BULK_SERVICE_DELETE_COUNT) {
      Alert.alert(
        'Selection Limit',
        `Only the first ${MAX_BULK_SERVICE_DELETE_COUNT} visible services were selected.`
      );
    }
    setPreview(null);
    setSelectedIds(new Set(
      orderedServices
        .slice(0, MAX_BULK_SERVICE_DELETE_COUNT)
        .map(service => service.id)
    ));
  };

  const clearSelection = () => {
    if (isPreviewing || isApplying) return;
    setPreview(null);
    setSelectedIds(new Set());
  };

  const openDatePicker = (field: 'start' | 'end') => {
    if (isPreviewing || isApplying) return;
    setDraftDate(field === 'start' ? startDate : endDate);
    setActiveDateField(field);
  };

  const commitDate = (field: 'start' | 'end', date: Date) => {
    const normalized = startOfDay(date);
    setPreview(null);
    if (field === 'start') {
      setStartDate(normalized);
      if (normalized > endDate) setEndDate(normalized);
    } else {
      setEndDate(normalized);
      if (normalized < startDate) setStartDate(normalized);
    }
    setActiveDateField(null);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (!activeDateField) return;
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date) commitDate(activeDateField, date);
      else setActiveDateField(null);
      return;
    }
    if (date) setDraftDate(date);
  };

  const generatePreview = async () => {
    const selection: BulkServiceDeleteSelection = mode === 'date_range'
      ? {
        startDate: formatDatabaseDate(startDate),
        endDate: formatDatabaseDate(endDate),
        serviceIds: null,
      }
      : {
        startDate: null,
        endDate: null,
        serviceIds: [...selectedIds],
      };

    if (mode === 'individual' && selectedIds.size === 0) {
      Alert.alert('No Services Selected', 'Select at least one scheduled service.');
      return;
    }

    setIsPreviewing(true);
    try {
      const result = await onPreview(selection);
      if (!result) {
        Alert.alert(
          'Could Not Generate Preview',
          'Check your connection and confirm the Supabase migration is deployed.'
        );
        return;
      }
      setPreview(result);
    } finally {
      setIsPreviewing(false);
    }
  };

  const applyDeletion = () => {
    if (!preview || preview.service_count === 0 || isApplying) return;
    const count = preview.service_count;
    Alert.alert(
      `Delete ${count} Scheduled Service${count === 1 ? '' : 's'}?`,
      'This permanently removes the selected services and their assignments, fill-in requests, songs, reminders, and related notification history. Weekly recurring templates will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${count}`,
          style: 'destructive',
          onPress: async () => {
            setIsApplying(true);
            try {
              const result = await onApply(preview.service_ids);
              if (!result) {
                Alert.alert(
                  'Deletion Failed',
                  'Nothing was partially deleted. Refresh the preview and try again.'
                );
                return;
              }
              Alert.alert(
                'Services Deleted',
                `${result.deleted_service_ids.length} scheduled service${result.deleted_service_ids.length === 1 ? '' : 's'} deleted.`
              );
              onClose();
            } finally {
              setIsApplying(false);
            }
          },
        },
      ]
    );
  };

  const renderSelectionService = ({ item }: { item: ServiceWithAssignments }) => {
    const selected = selectedIds.has(item.id);
    const time = formatBulkServiceDeleteTime(item.time);
    return (
      <TouchableOpacity
        style={[styles.serviceRow, { borderBottomColor: theme.colors.borderSubtle }]}
        onPress={() => toggleService(item.id)}
        disabled={isPreviewing || isApplying}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${item.service_type}, ${formatDisplayDate(item.date)}${time ? ` at ${time}` : ''}`}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: selected ? theme.colors.accent : theme.input.border },
            selected && { backgroundColor: theme.button.primarySurface },
          ]}
        >
          {selected ? (
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="done"
              size={15}
              color={theme.button.primaryForeground}
            />
          ) : null}
        </View>
        <View style={styles.serviceText}>
          <Text style={[styles.serviceName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {item.service_type}
          </Text>
          <Text style={[styles.serviceDate, { color: theme.colors.textSecondary }]}>
            {formatDisplayDate(item.date)}
            {time ? ` at ${time}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPreviewService = ({ item }: { item: BulkServiceDeleteItem }) => {
    const time = formatBulkServiceDeleteTime(item.time);
    const dependencies = dependentCount(item);
    return (
      <View style={[styles.previewRow, { borderBottomColor: theme.colors.borderSubtle }]}>
        <View style={styles.serviceText}>
          <Text style={[styles.serviceName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
            {item.service_type}
          </Text>
          <Text style={[styles.serviceDate, { color: theme.colors.textSecondary }]}>
            {formatDisplayDate(item.date)}
            {time ? ` at ${time}` : ''}
          </Text>
          <Text style={[styles.dependencyText, { color: theme.colors.textSecondary }]}>
            {item.assignment_count} assignments, {item.fill_in_request_count} fill-ins, {item.song_count} songs
          </Text>
        </View>
        <View
          style={[
            styles.dependencyBadge,
            {
              backgroundColor: theme.status.error.surface,
              borderColor: theme.status.error.border,
            },
          ]}
        >
          <Text style={[styles.dependencyBadgeText, { color: theme.status.error.foreground }]}>
            {dependencies}
          </Text>
        </View>
      </View>
    );
  };

  const listData = preview
    ? preview.services
    : mode === 'individual'
      ? orderedServices
      : [];

  const header = (
    <View>
      <Text style={[styles.intro, { color: theme.colors.textSecondary }]}>
        Delete generated or one-time scheduled services. Weekly recurring templates are never changed.
      </Text>

      {!preview ? (
        <>
          <View
            style={[
              styles.segmentedControl,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderSubtle,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segment,
                mode === 'date_range' && { backgroundColor: theme.button.primarySurface },
              ]}
              onPress={() => selectMode('date_range')}
              disabled={isPreviewing || isApplying}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'date_range' }}
            >
              <Text style={[
                styles.segmentText,
                {
                  color: mode === 'date_range'
                    ? theme.button.primaryForeground
                    : theme.colors.textPrimary,
                },
              ]}>
                Date Range
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                mode === 'individual' && { backgroundColor: theme.button.primarySurface },
              ]}
              onPress={() => selectMode('individual')}
              disabled={isPreviewing || isApplying}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'individual' }}
            >
              <Text style={[
                styles.segmentText,
                {
                  color: mode === 'individual'
                    ? theme.button.primaryForeground
                    : theme.colors.textPrimary,
                },
              ]}>
                Individual
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'date_range' ? (
            <View style={styles.rangeFields}>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: theme.input.surface,
                    borderColor: theme.input.border,
                  },
                ]}
                onPress={() => openDatePicker('start')}
                disabled={isPreviewing || isApplying}
                accessibilityLabel={`Start date ${formatDisplayDate(startDate)}`}
              >
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Start</Text>
                <Text style={[styles.dateValue, { color: theme.input.foreground }]}>
                  {formatDisplayDate(startDate)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: theme.input.surface,
                    borderColor: theme.input.border,
                  },
                ]}
                onPress={() => openDatePicker('end')}
                disabled={isPreviewing || isApplying}
                accessibilityLabel={`End date ${formatDisplayDate(endDate)}`}
              >
                <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>End</Text>
                <Text style={[styles.dateValue, { color: theme.input.foreground }]}>
                  {formatDisplayDate(endDate)}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectionToolbar}>
              <Text style={[styles.selectionCount, { color: theme.colors.textPrimary }]}>
                {selectedIds.size} selected
              </Text>
              <TouchableOpacity onPress={selectAllVisible} style={styles.toolbarButton}>
                <Text style={[styles.toolbarText, { color: theme.colors.accent }]}>
                  Select All Visible
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearSelection}
                style={styles.toolbarButton}
                disabled={selectedIds.size === 0}
              >
                <Text style={[
                  styles.toolbarText,
                  {
                    color: selectedIds.size === 0
                      ? theme.colors.textTertiary
                      : theme.colors.accent,
                  },
                ]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View
          style={[
            styles.previewSummary,
            {
              backgroundColor: theme.status.error.surface,
              borderColor: theme.status.error.border,
            },
          ]}
        >
          <Text style={[styles.previewTitle, { color: theme.status.error.foreground }]}>
            {preview.service_count} service{preview.service_count === 1 ? '' : 's'} will be deleted
          </Text>
          <Text style={[styles.previewDetail, { color: theme.colors.textSecondary }]}>
            {preview.dependent_counts.assignments} assignments,{' '}
            {preview.dependent_counts.fill_in_requests} fill-ins,{' '}
            {preview.dependent_counts.songs} songs
          </Text>
          <Text style={[styles.previewDetail, { color: theme.colors.textSecondary }]}>
            {preview.dependent_counts.sent_reminders} reminder records,{' '}
            {preview.dependent_counts.member_notifications} notifications,{' '}
            {preview.dependent_counts.notification_logs} logs
          </Text>
        </View>
      )}
    </View>
  );

  const empty = (
    <View style={styles.emptyState}>
      <IconSymbol
        ios_icon_name="calendar.badge.exclamationmark"
        android_material_icon_name="event-busy"
        size={32}
        color={theme.colors.textTertiary}
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
        {preview ? 'No matching services' : 'Choose a date range'}
      </Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        {preview
          ? 'Return to the selection and choose services to delete.'
          : 'Generate a preview to see every service and dependent record before deletion.'}
      </Text>
    </View>
  );

  const listFooter = !preview && mode === 'individual' ? (
    <View style={styles.loadMoreArea}>
      {loadedThrough ? (
        <Text style={[styles.loadedThrough, { color: theme.colors.textSecondary }]}>
          Loaded through {formatDisplayDate(loadedThrough)}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[
          styles.loadMoreButton,
          {
            backgroundColor: theme.button.secondarySurface,
            borderColor: theme.button.secondaryBorder,
          },
        ]}
        onPress={onLoadMore}
        disabled={loadingMore || isPreviewing || isApplying}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <>
            <IconSymbol
              ios_icon_name="calendar.badge.plus"
              android_material_icon_name="event"
              size={17}
              color={theme.colors.accent}
            />
            <Text style={[styles.loadMoreText, { color: theme.button.secondaryForeground }]}>
              Load More Services
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <AppModal
      bodyScroll={false}
      busy={isApplying || isPreviewing}
      footer={(
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.modal.footerSurface,
              borderTopColor: theme.modal.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.footerButton,
              styles.secondaryButton,
              {
                backgroundColor: theme.button.secondarySurface,
                borderColor: theme.button.secondaryBorder,
              },
            ]}
            onPress={preview ? editSelection : onClose}
            disabled={isPreviewing || isApplying}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.button.secondaryForeground }]}>
              {preview ? 'Edit Selection' : 'Cancel'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerButton,
              {
                backgroundColor: preview
                  ? theme.button.destructiveSurface
                  : theme.button.primarySurface,
                opacity: (
                  isPreviewing
                  || isApplying
                  || activeDateField !== null
                  || (preview ? preview.service_count === 0 : false)
                ) ? 0.5 : 1,
              },
            ]}
            onPress={preview ? applyDeletion : generatePreview}
            disabled={
              isPreviewing
              || isApplying
              || activeDateField !== null
              || (preview ? preview.service_count === 0 : false)
            }
          >
            {isPreviewing || isApplying ? (
              <ActivityIndicator
                size="small"
                color={preview
                  ? theme.button.destructiveForeground
                  : theme.button.primaryForeground}
              />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name={preview ? 'trash' : 'doc.text.magnifyingglass'}
                  android_material_icon_name={preview ? 'delete' : 'preview'}
                  size={18}
                  color={preview
                    ? theme.button.destructiveForeground
                    : theme.button.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color: preview
                        ? theme.button.destructiveForeground
                        : theme.button.primaryForeground,
                    },
                  ]}
                >
                  {preview ? `Delete ${preview.service_count}` : 'Preview'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      maxWidth={620}
      headerIcon={(
        <IconSymbol
          ios_icon_name="calendar.badge.minus"
          android_material_icon_name="event-busy"
          size={22}
          color={theme.modalHeader.accent}
        />
      )}
      onClose={onClose}
      subtitle={(
        <Text
          style={[styles.churchName, { color: theme.modalHeader.mutedForeground }]}
          numberOfLines={2}
        >
          {churchName}
        </Text>
      )}
      title="Manage Scheduled Services"
      variant="long-content"
      visible={visible}
    >
      {activeDateField ? (
            <View
              style={[
                styles.pickerPanel,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderBottomColor: theme.colors.borderSubtle,
                },
              ]}
            >
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
              {Platform.OS === 'ios' ? (
                <View style={styles.pickerActions}>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      {
                        backgroundColor: theme.button.secondarySurface,
                        borderColor: theme.button.secondaryBorder,
                      },
                    ]}
                    onPress={() => setActiveDateField(null)}
                  >
                    <Text style={[styles.pickerButtonText, { color: theme.button.secondaryForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      { backgroundColor: theme.button.primarySurface },
                    ]}
                    onPress={() => commitDate(activeDateField, draftDate)}
                  >
                    <Text style={[styles.pickerButtonText, { color: theme.button.primaryForeground }]}>Use Date</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
      ) : null}

      <FlatList
        style={styles.list}
        data={listData}
        keyExtractor={item => item.id}
        renderItem={preview
          ? renderPreviewService as ({ item }: { item: BulkServiceDeleteItem | ServiceWithAssignments }) => React.ReactElement
          : renderSelectionService as ({ item }: { item: BulkServiceDeleteItem | ServiceWithAssignments }) => React.ReactElement}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  churchName: {
    fontSize: 13,
    marginTop: 2,
  },
  pickerPanel: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    paddingTop: 16,
    marginBottom: 14,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rangeFields: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  dateButton: {
    flex: 1,
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectionToolbar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '800',
    marginRight: 'auto',
  },
  toolbarButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  toolbarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  serviceRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceText: {
    flex: 1,
    minWidth: 0,
  },
  serviceName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  serviceDate: {
    fontSize: 13,
    marginTop: 3,
  },
  previewSummary: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    marginBottom: 6,
  },
  previewDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  dependencyText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  dependencyBadge: {
    minWidth: 34,
    height: 28,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dependencyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyText: {
    maxWidth: 360,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  loadMoreArea: {
    alignItems: 'center',
    paddingTop: 16,
  },
  loadedThrough: {
    fontSize: 12,
    marginBottom: 8,
  },
  loadMoreButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
