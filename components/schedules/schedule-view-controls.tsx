import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import type { ScheduleViewMode } from '@/lib/schedules/schedule-view';
import { resolveSurfaceOpacity } from '@/lib/ui/surface-system';

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
  const theme = useAppTheme();

  return (
    <View style={styles.wrapper}>
      <View style={styles.controlRow}>
        <View
          accessibilityLabel="Schedule view"
          accessibilityRole="tablist"
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderSubtle,
            },
          ]}
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
                  selected && { backgroundColor: theme.colors.accent },
                  {
                    opacity: resolveSurfaceOpacity({
                      disabled: false,
                      pressed,
                      theme,
                    }),
                  },
                ]}
              >
                <ResponsiveText
                  accessible={false}
                  style={styles.optionLabelLane}
                  text={option.label}
                  textStyle={[
                    styles.optionText,
                    { color: theme.colors.textSecondary },
                    selected && styles.optionTextSelected,
                    selected && { color: theme.strongSurface.foreground },
                  ]}
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
            {
              backgroundColor: activeFilterCount > 0
                ? theme.colors.accent
                : theme.colors.surface,
              borderColor: activeFilterCount > 0
                ? theme.colors.accent
                : theme.colors.borderSubtle,
              opacity: resolveSurfaceOpacity({
                disabled: false,
                pressed,
                theme,
              }),
            },
          ]}
        >
          <IconSymbol
            ios_icon_name="line.3.horizontal.decrease"
            android_material_icon_name="filter-list"
            color={activeFilterCount > 0
              ? theme.strongSurface.foreground
              : theme.colors.textPrimary}
            size={22}
          />
          {activeFilterCount > 0 ? (
            <View style={[
              styles.filterBadge,
              {
                backgroundColor: theme.status.info.foreground,
                borderColor: theme.colors.surface,
              },
            ]}>
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
  optionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabelLane: {
    width: '100%',
  },
  optionTextSelected: {
    fontWeight: '900',
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    position: 'relative',
    width: 54,
  },
  filterBadge: {
    alignItems: 'center',
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
