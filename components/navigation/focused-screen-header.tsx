import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { useAppTheme } from '@/contexts/AppThemeContext';

type FocusedScreenHeaderTone = 'brand' | 'surface';

export function FocusedScreenHeader({
  title,
  subtitle,
  disabled = false,
  tone = 'brand',
  backAccessibilityLabel,
  onBack,
  trailing,
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
  iosIcon?: string;
  androidIcon?: React.ComponentProps<typeof IconSymbol>['android_material_icon_name'];
}) {
  const theme = useAppTheme();
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

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surface,
          borderBottomColor: theme.modalHeader.accent,
          boxShadow: theme.elevation.low,
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
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.45}
          numberOfLines={2}
          style={[styles.title, { color: foreground }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <WordSafeHeaderText
            accessible={false}
            maxFontSizeMultiplier={1.4}
            maxLines={2}
            style={[styles.subtitle, { color: secondary }]}
            text={subtitle}
          />
        ) : null}
      </View>

      <View style={styles.headerButton}>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 76,
    borderBottomWidth: 3,
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
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
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
});
