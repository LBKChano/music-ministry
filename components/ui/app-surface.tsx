import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';
import {
  resolveSurfaceStatusTokens,
  type AppSurfaceStatusTone,
} from '@/lib/ui/surface-system';

export function AppSectionHeader({
  title,
  description,
  accent = 'brand',
  style,
}: {
  title: string;
  description?: string;
  accent?: 'brand' | 'info';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const accentColor = accent === 'info'
    ? theme.status.info.foreground
    : theme.colors.accent;

  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleRow}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.sectionAccent, { backgroundColor: accentColor }]}
        />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}
        >
          {title}
        </Text>
      </View>
      {description ? (
        <Text
          maxFontSizeMultiplier={1.45}
          style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function AppGroupedSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.groupedSurface,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function AppDivider({ inset = 0 }: { inset?: number }) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        backgroundColor: theme.divider.color,
        height: theme.divider.width,
        marginLeft: inset,
      }}
    />
  );
}

export function AppIconTile({
  children,
  compact = false,
  tone,
}: {
  children: ReactNode;
  compact?: boolean;
  tone?: AppSurfaceStatusTone;
}) {
  const theme = useAppTheme();
  const status = tone ? resolveSurfaceStatusTokens(theme, tone) : null;
  const size = compact ? 40 : theme.iconTile.size;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: status?.surface ?? theme.iconTile.surface,
        borderColor: status?.border ?? theme.colors.borderSubtle,
        borderRadius: theme.iconTile.radius,
        borderWidth: StyleSheet.hairlineWidth,
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      {children}
    </View>
  );
}

function AppChip({
  label,
  tone,
  variant,
}: {
  label: string;
  tone: AppSurfaceStatusTone;
  variant: 'value' | 'metadata';
}) {
  const theme = useAppTheme();
  const status = resolveSurfaceStatusTokens(theme, tone);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[
        styles.chip,
        variant === 'metadata' && styles.metadataChip,
        {
          backgroundColor: status.surface,
          borderColor: status.border,
          borderRadius: theme.radii.compact,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.35}
        numberOfLines={2}
        style={[
          styles.chipText,
          variant === 'metadata' && styles.metadataChipText,
          { color: status.foreground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function AppValueChip({
  label,
  tone = 'info',
}: {
  label: string;
  tone?: AppSurfaceStatusTone;
}) {
  return <AppChip label={label} tone={tone} variant="value" />;
}

export function AppMetadataChip({
  label,
  tone = 'unassigned',
}: {
  label: string;
  tone?: AppSurfaceStatusTone;
}) {
  return <AppChip label={label} tone={tone} variant="metadata" />;
}

export function AppStatusBadge({
  icon,
  label,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  tone: AppSurfaceStatusTone;
}) {
  const theme = useAppTheme();
  const status = resolveSurfaceStatusTokens(theme, tone);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[
        styles.statusBadge,
        {
          backgroundColor: status.surface,
          borderColor: status.border,
          borderRadius: theme.radii.compact,
        },
      ]}
    >
      {icon}
      <Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={2}
        style={[styles.statusBadgeText, { color: status.foreground }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    gap: 4,
    paddingBottom: 10,
    paddingHorizontal: 4,
    paddingTop: 22,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionAccent: {
    borderRadius: 1,
    height: 15,
    width: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  groupedSurface: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  chip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    maxWidth: 150,
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metadataChip: {
    minHeight: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  metadataChipText: {
    fontSize: 11,
    lineHeight: 15,
  },
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    minHeight: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
});
