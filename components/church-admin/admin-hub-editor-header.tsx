import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

export function AdminHubEditorHeader({
  title,
  summary,
  onBack,
  action,
}: {
  title: string;
  summary: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Back to Church Admin Hub"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={22} color={colors.primary} />
      </Pressable>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: {
    opacity: 0.55,
  },
  text: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  summary: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    minWidth: 44,
  },
});
