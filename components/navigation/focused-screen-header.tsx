import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { colors } from '@/styles/commonStyles';

type FocusedScreenHeaderTone = 'brand' | 'surface';

export function FocusedScreenHeader({
  title,
  subtitle,
  disabled = false,
  tone = 'brand',
  backAccessibilityLabel,
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  tone?: FocusedScreenHeaderTone;
  backAccessibilityLabel: string;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  const isBrand = tone === 'brand';
  const foreground = isBrand ? colors.headerText : colors.text;
  const secondary = isBrand ? '#DBEAFE' : colors.textSecondary;

  return (
    <View
      style={[
        styles.header,
        isBrand ? styles.brandHeader : styles.surfaceHeader,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandHeader: {
    backgroundColor: colors.headerBackground,
  },
  surfaceHeader: {
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    paddingTop: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.48,
  },
});
