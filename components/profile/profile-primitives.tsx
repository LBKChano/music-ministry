import React, { Children, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { InlineStatus } from '@/components/feedback/inline-status';
import {
  AppGroupedSurface,
  AppDivider,
  AppIconTile,
  AppSectionHeader,
  AppValueChip,
} from '@/components/ui/app-surface';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { resolveSurfaceOpacity } from '@/lib/ui/surface-system';
import type { AppSurfaceStatusTone } from '@/lib/ui/surface-system';

type AndroidIconName = ComponentProps<typeof IconSymbol>['android_material_icon_name'];

interface ProfileSectionProps {
  title: string;
  description?: string;
}

export function ProfileSection({
  title,
  description,
}: ProfileSectionProps) {
  const theme = useAppTheme();
  return (
    <AppSectionHeader
      title={title}
      description={description}
      style={[styles.sectionHeader, { borderLeftColor: theme.colors.accent }]}
    />
  );
}

export function ProfileRowGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);

  return (
    <AppGroupedSurface>
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <AppDivider inset={66} /> : null}
          {row}
        </React.Fragment>
      ))}
    </AppGroupedSurface>
  );
}

export interface ProfileRowProps {
  title: string;
  summary?: string;
  value?: string;
  iosIcon: string;
  androidIcon: AndroidIconName;
  onPress: () => void;
  accessibilityHint: string;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  valueTone?: AppSurfaceStatusTone;
}

export function ProfileRow({
  title,
  summary,
  value,
  iosIcon,
  androidIcon,
  onPress,
  accessibilityHint,
  disabled = false,
  busy = false,
  destructive = false,
  trailing,
  valueTone = 'unassigned',
}: ProfileRowProps) {
  const theme = useAppTheme();
  const foreground = destructive
    ? theme.status.error.foreground
    : theme.colors.textPrimary;
  const iconTone = destructive ? 'error' : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.colors.surface },
        {
          opacity: resolveSurfaceOpacity({ disabled, pressed, theme }),
        },
      ]}
    >
      <AppIconTile compact tone={iconTone}>
        <IconSymbol
          ios_icon_name={iosIcon}
          android_material_icon_name={androidIcon}
          size={22}
          color={destructive ? theme.status.error.foreground : theme.iconTile.foreground}
        />
      </AppIconTile>

      <View style={styles.rowCopy}>
        <Text
          maxFontSizeMultiplier={1.4}
          numberOfLines={2}
          style={[styles.rowTitle, { color: foreground }]}
        >
          {title}
        </Text>
        {summary ? (
          <Text
            maxFontSizeMultiplier={1.45}
            numberOfLines={3}
            style={[styles.rowSummary, { color: theme.colors.textSecondary }]}
          >
            {summary}
          </Text>
        ) : null}
      </View>

      {busy ? (
        <View style={styles.trailingFrame}>
          <ActivityIndicator
            accessibilityLabel={`${title} in progress`}
            size="small"
            color={destructive ? theme.status.error.foreground : theme.colors.accent}
          />
        </View>
      ) : trailing ? (
        <View style={styles.trailingFrame}>{trailing}</View>
      ) : (
        <View style={styles.trailing}>
          {value ? (
            <AppValueChip
              label={value}
              tone={destructive ? 'error' : valueTone}
            />
          ) : null}
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={22}
            color={theme.colors.textTertiary}
          />
        </View>
      )}
    </Pressable>
  );
}

export function ProfileDangerRow(
  props: Omit<ProfileRowProps, 'destructive'>,
) {
  return <ProfileRow {...props} destructive />;
}

interface ProfileStatusProps {
  message: string | null;
  tone?: 'success' | 'error' | 'info';
  live?: boolean;
}

export function ProfileStatus({
  message,
  tone = 'info',
  live = true,
}: ProfileStatusProps) {
  return <InlineStatus live={live} message={message} tone={tone} />;
}

export interface ProfileOverviewSection {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
}

interface ProfileOverviewListProps {
  sections: ProfileOverviewSection[];
  refreshing: boolean;
  onRefresh: () => void;
  status?: ReactNode;
}

export function ProfileOverviewList({
  sections,
  refreshing,
  onRefresh,
  status,
}: ProfileOverviewListProps) {
  const theme = useAppTheme();

  return (
    <SectionList
      accessibilityLabel="Profile settings"
      contentContainerStyle={styles.listContent}
      contentInsetAdjustmentBehavior="automatic"
      initialNumToRender={5}
      keyboardShouldPersistTaps="handled"
      keyExtractor={item => item.id}
      ListHeaderComponent={status ? <View style={styles.listStatus}>{status}</View> : null}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      )}
      renderItem={({ item }) => <>{item.content}</>}
      renderSectionHeader={({ section }) => (
        <ProfileSection
          title={section.title}
          description={section.description}
        />
      )}
      sections={sections.map(section => ({
        ...section,
        data: [{ id: section.id, content: section.content }],
      }))}
      stickySectionHeadersEnabled={false}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    borderLeftWidth: 3,
    marginTop: 4,
    paddingLeft: 11,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  rowSummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-end',
    maxWidth: '42%',
  },
  trailingFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  list: {
    flex: 1,
  },
  listContent: {
    alignSelf: 'center',
    maxWidth: 760,
    paddingBottom: 144,
    paddingHorizontal: 16,
    width: '100%',
  },
  listStatus: {
    paddingTop: 12,
  },
});
