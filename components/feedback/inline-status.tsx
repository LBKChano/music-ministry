import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { sanitizeUserFacingMessage } from '@/lib/ui/package16';
import { colors } from '@/styles/commonStyles';

export type InlineStatusTone = 'success' | 'error' | 'info';

const STATUS_COLORS: Record<InlineStatusTone, {
  background: string;
  border: string;
  foreground: string;
}> = {
  success: {
    background: '#F0FDF4',
    border: '#BBF7D0',
    foreground: '#166534',
  },
  error: {
    background: colors.errorBackground,
    border: colors.errorBorder,
    foreground: colors.error,
  },
  info: {
    background: colors.backgroundAlt,
    border: colors.border,
    foreground: colors.primary,
  },
};

export function InlineStatus({
  message,
  tone = 'info',
  live = true,
}: {
  message: string | null;
  tone?: InlineStatusTone;
  live?: boolean;
}) {
  if (!message) return null;

  const palette = STATUS_COLORS[tone];
  const isError = tone === 'error';
  const visibleMessage = sanitizeUserFacingMessage(message, tone);

  return (
    <View
      accessibilityLiveRegion={live ? (isError ? 'assertive' : 'polite') : 'none'}
      accessibilityRole={live && isError ? 'alert' : undefined}
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}
    >
      <IconSymbol
        ios_icon_name={
          isError
            ? 'exclamationmark.circle.fill'
            : tone === 'success'
              ? 'checkmark.circle.fill'
              : 'info.circle.fill'
        }
        android_material_icon_name={
          isError ? 'error' : tone === 'success' ? 'check-circle' : 'info'
        }
        size={19}
        color={palette.foreground}
      />
      <ResponsiveText
        accessibilityLabel={visibleMessage}
        accessible={false}
        selectable
        style={styles.textLane}
        text={visibleMessage}
        textStyle={[styles.text, { color: palette.foreground }]}
        variant="supportingCopy"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: '100%',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  textLane: {
    flex: 1,
  },
});
