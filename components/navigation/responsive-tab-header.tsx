import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdaptiveHeaderText } from '@/components/navigation/adaptive-header-text';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import {
  calculateHeaderTitleLaneWidth,
  type HeaderTypographyVariant,
} from '@/lib/ui/header-typography';

type ResponsiveTabHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  children?: ReactNode;
  accessibilityTitle?: string;
  titleVariant?: HeaderTypographyVariant;
  subtitleVariant?: HeaderTypographyVariant;
  trailingWidth?: number;
  density?: 'default' | 'compact';
};

type TabHeaderPillProps = {
  icon?: ReactNode;
  label: string;
  detail?: string;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
};

type TabHeaderIconButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  onPress: () => void;
};

export function ResponsiveTabHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
  children,
  accessibilityTitle,
  titleVariant = 'primaryTitle',
  subtitleVariant = 'secondaryChurchName',
  trailingWidth,
  density = 'default',
}: ResponsiveTabHeaderProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const reservedTrailingWidth = trailing ? trailingWidth ?? 54 : 0;
  const titleLaneWidth = calculateHeaderTitleLaneWidth({
    windowWidth,
    trailingWidth: reservedTrailingWidth,
  });

  return (
    <View
      style={[
        styles.shadowContainer,
        {
          borderBottomLeftRadius: theme.radii.header,
          borderBottomRightRadius: theme.radii.header,
          boxShadow: theme.header.shadow,
        },
      ]}
    >
      <LinearGradient
        colors={theme.header.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          density === 'compact' && styles.compactContainer,
          {
            borderBottomLeftRadius: theme.radii.header,
            borderBottomRightRadius: theme.radii.header,
            paddingTop: insets.top + 14,
          },
        ]}
      >
        <View
          style={[
            styles.accentPanel,
            { backgroundColor: theme.header.accentPanel },
          ]}
          pointerEvents="none"
        />
        <View
          style={[
            styles.accentLine,
            { backgroundColor: theme.header.accentLine },
          ]}
          pointerEvents="none"
        />

        <View style={[
          styles.topRow,
          density === 'compact' && styles.compactTopRow,
        ]}>
          <View style={styles.titleLane}>
            <Text style={[styles.eyebrow, { color: theme.header.eyebrow }]}>
              {eyebrow}
            </Text>
            <AdaptiveHeaderText
              accessibilityLabel={accessibilityTitle ?? title}
              accessibilityRole="header"
              availableWidth={titleLaneWidth}
              color={theme.header.title}
              fontScale={fontScale}
              text={title}
              variant={titleVariant}
            />
            {subtitle ? (
              <AdaptiveHeaderText
                availableWidth={titleLaneWidth}
                color={theme.header.subtitle}
                fontScale={fontScale}
                style={styles.subtitle}
                text={subtitle}
                variant={subtitleVariant}
              />
            ) : null}
          </View>

          {trailing ? (
            <View
              style={[
                styles.trailing,
                { width: reservedTrailingWidth },
              ]}
            >
              {trailing}
            </View>
          ) : null}
        </View>

        {children ? (
          <View style={[
            styles.metaRow,
            density === 'compact' && styles.compactMetaRow,
          ]}>
            {children}
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

export function TabHeaderPill({
  icon,
  label,
  detail,
  trailing,
  accessibilityLabel,
  onPress,
}: TabHeaderPillProps) {
  const theme = useAppTheme();
  const content = (
    <>
      {icon}
      <View style={styles.pillText}>
        {detail ? (
          <Text style={[styles.pillLabel, { color: theme.header.eyebrow }]}>
            {label}
          </Text>
        ) : null}
        <ResponsiveText
          accessible={!onPress}
          numberOfLines={1}
          selectable={!onPress}
          text={detail ?? label}
          textStyle={[
            detail ? styles.pillDetail : styles.pillSingleLine,
            { color: theme.header.title },
          ]}
          variant="compactLabel"
        />
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        activeOpacity={0.78}
        onPress={onPress}
        style={[
          styles.pill,
          {
            backgroundColor: theme.header.controlSurface,
            borderColor: theme.header.controlBorder,
            borderRadius: theme.radii.control,
          },
        ]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.pill,
        {
          backgroundColor: theme.header.controlSurface,
          borderColor: theme.header.controlBorder,
          borderRadius: theme.radii.control,
        },
      ]}
    >
      {content}
    </View>
  );
}

export function TabHeaderMetaText({
  accessibilityLabel,
  children,
}: {
  accessibilityLabel?: string;
  children: string;
}) {
  const theme = useAppTheme();
  return (
    <ResponsiveText
      accessibilityLabel={accessibilityLabel}
      numberOfLines={1}
      selectable
      style={styles.metaTextLane}
      text={children}
      textStyle={[styles.metaText, { color: theme.header.subtitle }]}
      variant="supportingCopy"
    />
  );
}

export function TabHeaderIconButton({
  accessibilityLabel,
  children,
  onPress,
}: TabHeaderIconButtonProps) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.78}
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          backgroundColor: theme.header.controlSurface,
          borderColor: theme.header.controlBorder,
          borderRadius: theme.radii.control,
        },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

export function TabHeaderIconSurface({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.iconSurface,
        {
          backgroundColor: theme.header.controlSurface,
          borderColor: theme.header.controlBorder,
          borderRadius: theme.radii.control,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    marginBottom: 16,
  },
  container: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  compactContainer: {
    paddingBottom: 16,
  },
  accentPanel: {
    position: 'absolute',
    right: -28,
    top: 18,
    width: 132,
    height: 72,
    borderRadius: 8,
    transform: [{ rotate: '-12deg' }],
  },
  accentLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    height: 3,
    borderRadius: 3,
  },
  topRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  compactTopRow: {
    minHeight: 66,
  },
  titleLane: {
    flex: 1,
    minWidth: 0,
  },
  trailing: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  eyebrow: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  compactMetaRow: {
    marginTop: 10,
  },
  pill: {
    minHeight: 38,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
  },
  pillText: {
    minWidth: 0,
    flexShrink: 1,
  },
  pillLabel: {
    marginBottom: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  pillDetail: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pillSingleLine: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  metaTextLane: {
    flexShrink: 1,
    minWidth: 120,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconSurface: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
