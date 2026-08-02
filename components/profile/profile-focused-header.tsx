import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { colors } from '@/styles/commonStyles';

export function ProfileFocusedHeader({
  title,
  subtitle,
  disabled = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Profile"
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={10}
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
          color={colors.headerText}
        />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {title}
        </Text>
        {subtitle ? (
          <WordSafeHeaderText
            accessible={false}
            maxFontSizeMultiplier={1.35}
            maxLines={2}
            style={styles.headerSubtitle}
            text={subtitle}
          />
        ) : null}
      </View>
      <View style={styles.headerButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: colors.headerBackground,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: colors.headerText,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
