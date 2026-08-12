import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { AdaptiveHeaderText } from '@/components/navigation/adaptive-header-text';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { calculateFocusedHeaderTitleLaneWidth } from '@/lib/ui/header-typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FocusedScreenHeaderTone = 'brand' | 'surface';

export function FocusedScreenHeader({
  title,
  subtitle,
  disabled = false,
  tone = 'brand',
  backAccessibilityLabel,
  onBack,
  trailing,
  extendIntoTopSafeArea = false,
  iosIcon = 'slider.horizontal.3',
  androidIcon = 'tune',
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  tone?: FocusedScreenHeaderTone;
  backAccessibilityLabel: string;
  onBack: () => void;
  trailing?: ReactNode;
  extendIntoTopSafeArea?: boolean;
  iosIcon?: string;
  androidIcon?: React.ComponentProps<typeof IconSymbol>['android_material_icon_name'];
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const isBrand = tone === 'brand';
  const foreground = isBrand
    ? theme.strongSurface.foreground
    : theme.modalHeader.foreground;
  const secondary = isBrand
    ? theme.strongSurface.mutedForeground
    : theme.modalHeader.mutedForeground;
  const surface = isBrand
    ? theme.colors.surfaceStrong
    : theme.modalHeader.surface;
  const titleLaneWidth = calculateFocusedHeaderTitleLaneWidth({
    windowWidth,
    hasTrailingAction: Boolean(trailing),
  });

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surface,
          borderBottomColor: theme.modalHeader.accent,
          boxShadow: theme.elevation.low,
          minHeight: styles.header.minHeight + (extendIntoTopSafeArea ? insets.top : 0),
          paddingTop: styles.header.paddingVertical + (extendIntoTopSafeArea ? insets.top : 0),
        },
      ]}
    >
      <Pressable
        accessibilityHint="Returns to the previous screen"
        accessibilityRole="button"
        accessibilityLabel={backAccessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [
          styles.headerButton,
          {
            backgroundColor: isBrand
              ? theme.header.controlSurface
              : theme.colors.surface,
            borderColor: isBrand
              ? theme.header.controlBorder
              : theme.colors.borderStrong,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow-back"
          size={24}
          color={foreground}
        />
      </Pressable>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.contextIcon,
          {
            backgroundColor: isBrand
              ? theme.header.accentPanel
              : theme.colors.accentSoft,
            borderColor: isBrand
              ? theme.header.controlBorder
              : theme.modalHeader.accent,
          },
        ]}
      >
        <IconSymbol
          ios_icon_name={iosIcon}
          android_material_icon_name={androidIcon}
          size={23}
          color={isBrand ? foreground : theme.modalHeader.accent}
        />
      </View>

      <View style={styles.copy}>
        <AdaptiveHeaderText
          accessibilityLabel={title}
          accessibilityRole="header"
          availableWidth={titleLaneWidth}
          color={foreground}
          fontScale={fontScale}
          style={styles.title}
          text={title}
          variant="focusedTitle"
        />
        {subtitle ? (
          <WordSafeHeaderText
            accessible={false}
            availableWidth={titleLaneWidth}
            fontScale={Math.min(Math.max(fontScale, 1), 1.4)}
            fontSize={13}
            maxFontSizeMultiplier={1.4}
            maxLines={2}
            style={[styles.subtitle, { color: secondary }]}
            text={subtitle}
          />
        ) : null}
      </View>

      {trailing ? (
        <View style={styles.trailingAction}>
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 76,
    borderBottomWidth: 2,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  contextIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
  },
  title: {
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    paddingTop: 1,
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.48,
  },
  trailingAction: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
