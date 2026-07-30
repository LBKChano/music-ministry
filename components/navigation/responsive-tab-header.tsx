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
}: ResponsiveTabHeaderProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const reservedTrailingWidth = trailing ? trailingWidth ?? 54 : 0;
  const titleLaneWidth = calculateHeaderTitleLaneWidth({
    windowWidth,
    trailingWidth: reservedTrailingWidth,
  });

  return (
    <View style={styles.shadowContainer}>
      <LinearGradient
        colors={['#0F172A', '#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { paddingTop: insets.top + 14 }]}
      >
        <View style={styles.accentPanel} pointerEvents="none" />
        <View style={styles.accentLine} pointerEvents="none" />

        <View style={styles.topRow}>
          <View style={styles.titleLane}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <AdaptiveHeaderText
              accessibilityLabel={accessibilityTitle ?? title}
              accessibilityRole="header"
              availableWidth={titleLaneWidth}
              color="#FFFFFF"
              fontScale={fontScale}
              text={title}
              variant={titleVariant}
            />
            {subtitle ? (
              <AdaptiveHeaderText
                availableWidth={titleLaneWidth}
                color="#DBEAFE"
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

        {children ? <View style={styles.metaRow}>{children}</View> : null}
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
  const content = (
    <>
      {icon}
      <View style={styles.pillText}>
        {detail ? <Text style={styles.pillLabel}>{label}</Text> : null}
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          numberOfLines={1}
          selectable={!onPress}
          style={detail ? styles.pillDetail : styles.pillSingleLine}
        >
          {detail ?? label}
        </Text>
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
        style={styles.pill}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={styles.pill}
    >
      {content}
    </View>
  );
}

export function TabHeaderMetaText({ children }: { children: string }) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.82}
      numberOfLines={1}
      selectable
      style={styles.metaText}
    >
      {children}
    </Text>
  );
}

export function TabHeaderIconButton({
  accessibilityLabel,
  children,
  onPress,
}: TabHeaderIconButtonProps) {
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.78}
      onPress={onPress}
      style={styles.iconButton}
    >
      {children}
    </TouchableOpacity>
  );
}

export function TabHeaderIconSurface({ children }: { children: ReactNode }) {
  return <View style={styles.iconSurface}>{children}</View>;
}

const styles = StyleSheet.create({
  shadowContainer: {
    marginBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: '0 8px 14px rgba(15, 23, 42, 0.18)',
  },
  container: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  accentPanel: {
    position: 'absolute',
    right: -28,
    top: 18,
    width: 132,
    height: 72,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    transform: [{ rotate: '-12deg' }],
  },
  accentLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  topRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
    color: '#BFDBFE',
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
  pill: {
    minHeight: 38,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  pillText: {
    minWidth: 0,
    flexShrink: 1,
  },
  pillLabel: {
    marginBottom: 1,
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  pillDetail: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pillSingleLine: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  metaText: {
    minWidth: 0,
    flexShrink: 1,
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  iconSurface: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
});
