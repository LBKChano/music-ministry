import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface RefreshErrorNoticeProps {
  message: string | null;
}

export function RefreshErrorNotice({ message }: RefreshErrorNoticeProps) {
  if (!message) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.container}
    >
      <IconSymbol
        ios_icon_name="exclamationmark.circle"
        android_material_icon_name="error-outline"
        size={18}
        color={colors.error}
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderBottomColor: colors.errorBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    color: colors.error,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
