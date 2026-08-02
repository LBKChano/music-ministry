import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import type { ScheduleViewMode } from '@/lib/schedules/schedule-view';
import { colors } from '@/styles/commonStyles';

const OPTIONS: readonly { label: string; value: ScheduleViewMode }[] = [
  { label: 'All Services', value: 'all' },
  { label: 'My Schedule', value: 'mine' },
];

export function ScheduleViewControls({
  mode,
  onChange,
  activeFilterCount,
  onOpenFilters,
}: {
  mode: ScheduleViewMode;
  onChange: (mode: ScheduleViewMode) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.controlRow}>
        <View
          accessibilityLabel="Schedule view"
          accessibilityRole="tablist"
          style={styles.container}
        >
          {OPTIONS.map(option => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityHint={`Shows ${option.label.toLowerCase()}`}
                accessibilityLabel={option.label}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <ResponsiveText
                  accessible={false}
                  style={styles.optionLabelLane}
                  text={option.label}
                  textStyle={[styles.optionText, selected && styles.optionTextSelected]}
                  variant="compactLabel"
                />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityHint="Filters the services already loaded on this device"
          accessibilityLabel={activeFilterCount > 0
            ? `Schedule filters, ${activeFilterCount} active`
            : 'Schedule filters'}
          accessibilityRole="button"
          accessibilityValue={{
            text: activeFilterCount > 0
              ? `${activeFilterCount} active`
              : 'No active filters',
          }}
          onPress={onOpenFilters}
          style={({ pressed }) => [
            styles.filterButton,
            activeFilterCount > 0 && styles.filterButtonActive,
            pressed && styles.optionPressed,
          ]}
        >
          <IconSymbol
            ios_icon_name="line.3.horizontal.decrease"
            android_material_icon_name="filter-list"
            color={activeFilterCount > 0 ? '#FFFFFF' : colors.text}
            size={22}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  controlRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    maxWidth: 520,
    width: '100%',
  },
  container: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flex: 1,
    gap: 4,
    padding: 4,
  },
  option: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  optionPressed: {
    opacity: 0.78,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabelLane: {
    width: '100%',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    position: 'relative',
    width: 54,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBadge: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 5,
    top: 5,
    width: 18,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
});
