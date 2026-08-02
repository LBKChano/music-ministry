import React, { type ComponentProps, type ReactNode } from 'react';
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
import { colors } from '@/styles/commonStyles';

type AndroidIconName = ComponentProps<typeof IconSymbol>['android_material_icon_name'];

interface ProfileSectionProps {
  title: string;
  description?: string;
}

export function ProfileSection({
  title,
  description,
}: ProfileSectionProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        style={styles.sectionTitle}
      >
        {title}
      </Text>
      {description ? (
        <Text
          maxFontSizeMultiplier={1.45}
          style={styles.sectionDescription}
        >
          {description}
        </Text>
      ) : null}
    </View>
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
}: ProfileRowProps) {
  const foreground = destructive ? colors.error : colors.text;
  const iconBackground = destructive
    ? colors.errorBackground
    : colors.inputBackground;

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
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={[styles.iconFrame, { backgroundColor: iconBackground }]}>
        <IconSymbol
          ios_icon_name={iosIcon}
          android_material_icon_name={androidIcon}
          size={22}
          color={destructive ? colors.error : colors.primary}
        />
      </View>

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
            style={styles.rowSummary}
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
            color={destructive ? colors.error : colors.primary}
          />
        </View>
      ) : trailing ? (
        <View style={styles.trailingFrame}>{trailing}</View>
      ) : (
        <View style={styles.trailing}>
          {value ? (
            <Text
              maxFontSizeMultiplier={1.35}
              numberOfLines={2}
              style={[
                styles.value,
                { color: destructive ? colors.error : colors.textSecondary },
              ]}
            >
              {value}
            </Text>
          ) : null}
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={22}
            color={colors.textTertiary}
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
  if (!message) return null;

  const isError = tone === 'error';
  const isSuccess = tone === 'success';
  const foreground = isError
    ? colors.error
    : isSuccess
      ? '#166534'
      : colors.primary;
  const background = isError
    ? colors.errorBackground
    : isSuccess
      ? '#F0FDF4'
      : colors.backgroundAlt;
  const border = isError
    ? colors.errorBorder
    : isSuccess
      ? '#BBF7D0'
      : colors.border;

  return (
    <View
      accessibilityLiveRegion={live ? (isError ? 'assertive' : 'polite') : 'none'}
      accessibilityRole={live && isError ? 'alert' : undefined}
      style={[
        styles.status,
        { backgroundColor: background, borderColor: border },
      ]}
    >
      <IconSymbol
        ios_icon_name={
          isError
            ? 'exclamationmark.circle.fill'
            : isSuccess
              ? 'checkmark.circle.fill'
              : 'info.circle.fill'
        }
        android_material_icon_name={
          isError ? 'error' : isSuccess ? 'check-circle' : 'info'
        }
        size={19}
        color={foreground}
      />
      <Text
        maxFontSizeMultiplier={1.45}
        selectable
        style={[styles.statusText, { color: foreground }]}
      >
        {message}
      </Text>
    </View>
  );
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
          tintColor={colors.primary}
          colors={[colors.primary]}
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
    gap: 3,
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
    color: colors.textSecondary,
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
  value: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  status: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 4,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 144,
    paddingHorizontal: 16,
  },
  listStatus: {
    paddingTop: 12,
  },
});
