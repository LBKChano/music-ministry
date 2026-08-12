import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import {
  AppDivider,
  AppGroupedSurface,
  AppIconTile,
  AppSectionHeader,
  AppStatusBadge,
} from '@/components/ui/app-surface';
import { useAppTheme } from '@/contexts/AppThemeContext';
import type {
  ChurchAdminDestination,
  ChurchAdminSummary,
  ChurchAdminSummaryRow,
} from '@/lib/church-admin/summary';
import { resolveSurfaceOpacity } from '@/lib/ui/surface-system';

function DestinationIcon({
  color,
  destination,
}: {
  color: string;
  destination: ChurchAdminDestination;
}) {
  switch (destination) {
    case 'details':
      return <IconSymbol ios_icon_name="building.2" android_material_icon_name="home" size={22} color={color} />;
    case 'roles':
      return <IconSymbol ios_icon_name="person.badge.shield.checkmark" android_material_icon_name="badge" size={22} color={color} />;
    case 'weekly_services':
      return <IconSymbol ios_icon_name="calendar.badge.clock" android_material_icon_name="event-repeat" size={22} color={color} />;
    case 'members':
      return <IconSymbol ios_icon_name="person.2" android_material_icon_name="group" size={22} color={color} />;
    case 'rules':
      return <IconSymbol ios_icon_name="slider.horizontal.3" android_material_icon_name="tune" size={22} color={color} />;
    case 'song_types':
      return <IconSymbol ios_icon_name="music.note.list" android_material_icon_name="queue-music" size={22} color={color} />;
    case 'reminders':
      return <IconSymbol ios_icon_name="bell.badge" android_material_icon_name="notifications" size={22} color={color} />;
    case 'prepare_services':
      return <IconSymbol ios_icon_name="calendar.badge.plus" android_material_icon_name="event" size={22} color={color} />;
    case 'assign_members':
      return <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="group-add" size={22} color={color} />;
  }
}

function DestinationRow({
  row,
  recommended,
  onPress,
}: {
  row: ChurchAdminSummaryRow;
  recommended: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityHint={`Opens ${row.title}`}
      accessibilityLabel={`${row.title}, ${row.summary}${recommended ? ', recommended next' : ''}${row.ready ? ', ready' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? theme.colors.surfaceMuted
            : theme.colors.surface,
          opacity: resolveSurfaceOpacity({ disabled: false, pressed, theme }),
        },
      ]}
    >
      <AppIconTile compact>
        <DestinationIcon
          color={theme.iconTile.foreground}
          destination={row.id}
        />
      </AppIconTile>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <Text
            maxFontSizeMultiplier={1.35}
            style={[styles.rowTitle, { color: theme.colors.textPrimary }]}
          >
            {row.title}
          </Text>
          {recommended ? (
            <AppStatusBadge label="Next" tone="personal" />
          ) : null}
        </View>
        <Text
          maxFontSizeMultiplier={1.35}
          style={[styles.rowSummary, { color: theme.colors.textSecondary }]}
        >
          {row.summary}
        </Text>
      </View>
      {row.ready ? (
        <AppStatusBadge
          icon={(
            <IconSymbol
              ios_icon_name="checkmark"
              android_material_icon_name="check"
              size={13}
              color={theme.status.success.foreground}
            />
          )}
          label="Ready"
          tone="success"
        />
      ) : null}
      <IconSymbol
        ios_icon_name="chevron.right"
        android_material_icon_name="chevron-right"
        size={21}
        color={theme.colors.textTertiary}
      />
    </Pressable>
  );
}

function DestinationGroup({
  title,
  subtitle,
  rows,
  recommendedNext,
  onOpen,
  emphasis = 'setup',
}: {
  title: string;
  subtitle: string;
  rows: ChurchAdminSummaryRow[];
  recommendedNext: ChurchAdminDestination | null;
  onOpen: (destination: ChurchAdminDestination) => void;
  emphasis?: 'setup' | 'schedule';
}) {
  const theme = useAppTheme();

  return (
    <View style={[
      styles.group,
      emphasis === 'schedule' && [
        styles.scheduleGroup,
        { borderTopColor: theme.colors.borderStrong },
      ],
    ]}>
      <AppSectionHeader
        description={subtitle}
        style={[
          styles.groupHeader,
          {
            borderLeftColor: emphasis === 'schedule'
              ? theme.status.info.foreground
              : theme.colors.accent,
          },
        ]}
        title={title}
      />
      <AppGroupedSurface>
        {rows.map((row, index) => (
          <React.Fragment key={row.id}>
            {index > 0 ? <AppDivider inset={68} /> : null}
            <DestinationRow
              row={row}
              recommended={recommendedNext === row.id}
              onPress={() => onOpen(row.id)}
            />
          </React.Fragment>
        ))}
      </AppGroupedSurface>
    </View>
  );
}

export function AdminHubOverview({
  summary,
  onOpen,
}: {
  summary: ChurchAdminSummary;
  onOpen: (destination: ChurchAdminDestination) => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      {!summary.setupReady ? (
        <View
          accessibilityLabel="Finish Church Setup. Complete the recommended step to prepare reliable schedules."
          accessibilityLiveRegion="polite"
          accessible
          style={[
            styles.setupNotice,
            {
              backgroundColor: theme.status.warning.surface,
              borderColor: theme.status.warning.border,
              borderRadius: theme.radii.surface,
            },
          ]}
        >
          <IconSymbol
            ios_icon_name="wand.and.stars"
            android_material_icon_name="auto-awesome"
            size={22}
            color={theme.status.warning.foreground}
          />
          <View style={styles.setupNoticeText}>
            <Text
              accessible={false}
              style={[styles.setupNoticeTitle, { color: theme.status.warning.foreground }]}
            >
              Finish Church Setup
            </Text>
            <Text
              accessible={false}
              style={[styles.setupNoticeBody, { color: theme.status.warning.foreground }]}
            >
              Complete the recommended step to prepare reliable schedules.
            </Text>
          </View>
        </View>
      ) : null}

      <DestinationGroup
        title="Church Setup"
        subtitle="Keep your church, people, roles, and scheduling defaults organized."
        rows={summary.setupRows}
        recommendedNext={summary.recommendedNext}
        onOpen={onOpen}
      />
      <DestinationGroup
        emphasis="schedule"
        title="Schedule Management"
        subtitle="Create services first, then assign the team."
        rows={summary.scheduleRows}
        recommendedNext={null}
        onOpen={onOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: 12,
    maxWidth: 760,
    paddingBottom: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  setupNotice: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    padding: 14,
  },
  setupNoticeText: {
    flex: 1,
    gap: 3,
  },
  setupNoticeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  setupNoticeBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  group: {
    gap: 0,
  },
  scheduleGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 4,
  },
  groupHeader: {
    borderLeftWidth: 3,
    paddingHorizontal: 4,
    paddingLeft: 11,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  rowSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
});
