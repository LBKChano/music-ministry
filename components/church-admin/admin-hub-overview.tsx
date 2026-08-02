import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import type {
  ChurchAdminDestination,
  ChurchAdminSummary,
  ChurchAdminSummaryRow,
} from '@/lib/church-admin/summary';
import { colors } from '@/styles/commonStyles';

function DestinationIcon({ destination }: { destination: ChurchAdminDestination }) {
  switch (destination) {
    case 'details':
      return <IconSymbol ios_icon_name="building.2" android_material_icon_name="home" size={22} color={colors.primary} />;
    case 'roles':
      return <IconSymbol ios_icon_name="person.badge.shield.checkmark" android_material_icon_name="badge" size={22} color={colors.primary} />;
    case 'weekly_services':
      return <IconSymbol ios_icon_name="calendar.badge.clock" android_material_icon_name="event-repeat" size={22} color={colors.primary} />;
    case 'members':
      return <IconSymbol ios_icon_name="person.2" android_material_icon_name="group" size={22} color={colors.primary} />;
    case 'rules':
      return <IconSymbol ios_icon_name="slider.horizontal.3" android_material_icon_name="tune" size={22} color={colors.primary} />;
    case 'song_types':
      return <IconSymbol ios_icon_name="music.note.list" android_material_icon_name="queue-music" size={22} color={colors.primary} />;
    case 'reminders':
      return <IconSymbol ios_icon_name="bell.badge" android_material_icon_name="notifications" size={22} color={colors.primary} />;
    case 'prepare_services':
      return <IconSymbol ios_icon_name="calendar.badge.plus" android_material_icon_name="event" size={22} color={colors.primary} />;
    case 'assign_members':
      return <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="group-add" size={22} color={colors.primary} />;
  }
}

function DestinationRow({
  row,
  recommended,
  onPress,
  last,
}: {
  row: ChurchAdminSummaryRow;
  recommended: boolean;
  onPress: () => void;
  last: boolean;
}) {
  return (
    <Pressable
      accessibilityHint={`Opens ${row.title}`}
      accessibilityLabel={`${row.title}, ${row.summary}${recommended ? ', recommended next' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.iconLane}>
        <DestinationIcon destination={row.id} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <Text maxFontSizeMultiplier={1.35} style={styles.rowTitle}>
            {row.title}
          </Text>
          {recommended ? (
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>Next</Text>
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={1.35} style={styles.rowSummary}>
          {row.summary}
        </Text>
      </View>
      {row.ready ? (
        <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={19} color="#15803D" />
      ) : null}
      <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={21} color={colors.textSecondary} />
    </Pressable>
  );
}

function DestinationGroup({
  title,
  subtitle,
  rows,
  recommendedNext,
  onOpen,
}: {
  title: string;
  subtitle: string;
  rows: ChurchAdminSummaryRow[];
  recommendedNext: ChurchAdminDestination | null;
  onOpen: (destination: ChurchAdminDestination) => void;
}) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      <Text style={styles.groupSubtitle}>{subtitle}</Text>
      <View style={styles.rows}>
        {rows.map((row, index) => (
          <DestinationRow
            key={row.id}
            row={row}
            recommended={recommendedNext === row.id}
            onPress={() => onOpen(row.id)}
            last={index === rows.length - 1}
          />
        ))}
      </View>
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
  return (
    <View style={styles.container}>
      {!summary.setupReady ? (
        <View
          accessibilityLiveRegion="polite"
          style={styles.setupNotice}
        >
          <IconSymbol ios_icon_name="wand.and.stars" android_material_icon_name="auto-awesome" size={22} color={colors.primary} />
          <View style={styles.setupNoticeText}>
            <Text style={styles.setupNoticeTitle}>Finish Church Setup</Text>
            <Text style={styles.setupNoticeBody}>
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
    gap: 28,
    paddingVertical: 20,
  },
  setupNotice: {
    alignItems: 'center',
    backgroundColor: '#EEF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  setupNoticeText: {
    flex: 1,
    gap: 3,
  },
  setupNoticeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  setupNoticeBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    gap: 8,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    paddingHorizontal: 16,
  },
  groupSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  rows: {
    backgroundColor: colors.cardBackground,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: {
    backgroundColor: colors.inputBackground,
  },
  iconLane: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rowSummary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  recommendedBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recommendedText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
});
