import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { AppModal } from '@/components/ui/app-modal';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { ResponsiveText } from '@/components/ui/responsive-text';
import {
  EMPTY_SCHEDULE_VIEW_FILTERS,
  type ScheduleViewFilters,
} from '@/lib/schedules/schedule-view';

type FilterOption<T extends string | number | null> = {
  label: string;
  value: T;
};

const DATE_OPTIONS: readonly FilterOption<number | null>[] = [
  { label: 'All loaded dates', value: null },
  { label: 'Next 30 days', value: 30 },
  { label: 'Next 90 days', value: 90 },
];

function FilterGroup<T extends string | number | null>({
  label,
  options,
  selectedValue,
  onChange,
}: {
  label: string;
  options: readonly FilterOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.group}>
      <Text
        accessibilityRole="header"
        style={[styles.groupTitle, { color: theme.colors.textPrimary }]}
      >
        {label}
      </Text>
      <View style={[styles.options, { borderColor: theme.colors.borderSubtle }]}>
        {options.map(option => {
          const selected = selectedValue === option.value;
          return (
            <Pressable
              key={`${label}-${String(option.value)}`}
              accessibilityHint={`Selects ${option.label.toLowerCase()} for ${label.toLowerCase()}`}
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected
                    ? theme.colors.accentSoft
                    : theme.colors.surface,
                  borderBottomColor: theme.colors.borderSubtle,
                },
                pressed && styles.optionPressed,
              ]}
            >
              <ResponsiveText
                accessible={false}
                style={styles.optionLabelLane}
                text={option.label}
                textStyle={[
                  styles.optionText,
                  {
                    color: selected
                      ? theme.colors.textPrimary
                      : theme.colors.textSecondary,
                  },
                  selected && styles.optionTextSelected,
                ]}
                variant={label === 'Service Type' ? 'serviceType' : 'roleName'}
              />
              <View style={styles.optionActionLane}>
                <IconSymbol
                  ios_icon_name={selected ? 'checkmark.circle.fill' : 'circle'}
                  android_material_icon_name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  color={selected ? theme.colors.accent : theme.colors.textTertiary}
                  size={20}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ScheduleFilterModal({
  visible,
  filters,
  serviceTypes,
  roleNames,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: ScheduleViewFilters;
  serviceTypes: readonly string[];
  roleNames: readonly string[];
  onApply: (filters: ScheduleViewFilters) => void;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [filters, visible]);

  const serviceTypeOptions: FilterOption<string | null>[] = [
    { label: 'All service types', value: null },
    ...serviceTypes.map(value => ({ label: value, value })),
  ];
  const roleOptions: FilterOption<string | null>[] = [
    { label: 'All roles', value: null },
    ...roleNames.map(value => ({ label: value, value })),
  ];

  return (
    <AppModal
      bodyScroll
      headerIcon={<IconSymbol ios_icon_name="line.3.horizontal.decrease.circle.fill" android_material_icon_name="filter-list" size={22} color={theme.modalHeader.accent} />}
      onClose={onClose}
      primaryAction={{
        label: 'Apply Filters',
        onPress: () => onApply(draft),
      }}
      secondaryAction={{
        label: 'Clear',
        onPress: () => onApply({ ...EMPTY_SCHEDULE_VIEW_FILTERS }),
      }}
      subtitle="Filters apply only to services already loaded on this device."
      testID="schedule-filter-modal"
      title="Filter Schedule"
      variant="tall-form"
      visible={visible}
    >
      <View style={styles.content}>
        <FilterGroup
          label="Service Type"
          onChange={serviceType => setDraft(current => ({ ...current, serviceType }))}
          options={serviceTypeOptions}
          selectedValue={draft.serviceType}
        />
        <FilterGroup
          label="Role"
          onChange={roleName => setDraft(current => ({ ...current, roleName }))}
          options={roleOptions}
          selectedValue={draft.roleName}
        />
        <FilterGroup
          label="Date Range"
          onChange={dateRangeDays => setDraft(current => ({ ...current, dateRangeDays }))}
          options={DATE_OPTIONS}
          selectedValue={draft.dateRangeDays}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingBottom: 4,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  options: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionPressed: {
    opacity: 0.72,
  },
  optionText: {
    fontSize: 15,
    lineHeight: 20,
  },
  optionLabelLane: {
    flex: 1,
    minWidth: 0,
  },
  optionActionLane: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
  },
  optionTextSelected: {
    fontWeight: '700',
  },
});
