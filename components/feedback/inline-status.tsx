import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { sanitizeUserFacingMessage } from '@/lib/ui/package16';

export type InlineStatusTone = 'success' | 'error' | 'info';

export function InlineStatus({
  message,
  tone = 'info',
  live = true,
}: {
  message: string | null;
  tone?: InlineStatusTone;
  live?: boolean;
}) {
  const theme = useAppTheme();
  if (!message) return null;

  const palette = theme.status[tone];
  const isError = tone === 'error';
  const visibleMessage = sanitizeUserFacingMessage(message, tone);

  return (
    <View
      accessibilityLiveRegion={live ? (isError ? 'assertive' : 'polite') : 'none'}
      accessibilityRole={live && isError ? 'alert' : undefined}
      style={[
        styles.container,
        {
          backgroundColor: palette.surface,
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
