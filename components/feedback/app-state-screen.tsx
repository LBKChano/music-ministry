import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { sanitizeUserFacingMessage } from '@/lib/ui/package16';

type AndroidIcon = React.ComponentProps<
  typeof IconSymbol
>['android_material_icon_name'];

type StateAction = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function AppStateScreen({
  title,
  message,
  iosIcon = 'arrow.clockwise.circle.fill',
  androidIcon = 'refresh',
  iconTone = 'primary',
  loading = false,
  actions = [],
}: {
  title: string;
  message: string;
  iosIcon?: string;
  androidIcon?: AndroidIcon;
  iconTone?: 'primary' | 'error';
  loading?: boolean;
  actions?: StateAction[];
}) {
  const theme = useAppTheme();
  const iconColor = iconTone === 'error'
    ? theme.status.error.foreground
    : theme.colors.accent;
  const visibleMessage = sanitizeUserFacingMessage(
    message,
    iconTone === 'error' ? 'error' : 'info',
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={[styles.screen, { backgroundColor: theme.colors.canvas }]}
    >
      <View
        accessibilityElementsHidden
        style={[styles.iconFrame, { backgroundColor: `${iconColor}14` }]}
      >
        {loading ? (
          <ActivityIndicator size="large" color={iconColor} />
        ) : (
          <IconSymbol
            ios_icon_name={iosIcon}
            android_material_icon_name={androidIcon}
            size={38}
            color={iconColor}
          />
        )}
      </View>
      <ResponsiveText
        accessibilityRole="header"
        selectable
        style={styles.copyLane}
        text={title}
        textStyle={[styles.title, { color: theme.colors.textPrimary }]}
        variant="stateTitle"
      />
      <ResponsiveText
        selectable
        style={styles.copyLane}
        text={visibleMessage}
        textStyle={[styles.message, { color: theme.colors.textSecondary }]}
        variant="supportingCopy"
      />
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map(action => {
            const primary = action.variant !== 'secondary';
            return (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.accessibilityHint}
                accessibilityState={{
                  busy: action.loading,
                  disabled: action.disabled || action.loading,
                }}
                disabled={action.disabled || action.loading}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.action,
                  primary
                    ? { backgroundColor: theme.button.primarySurface }
                    : {
                        backgroundColor: theme.button.secondarySurface,
                        borderColor: theme.button.secondaryBorder,
                        borderWidth: 1,
                      },
                  pressed && styles.pressed,
                  (action.disabled || action.loading) && styles.disabled,
                ]}
              >
                {action.loading ? (
                  <ActivityIndicator
                    size="small"
                    color={primary
                      ? theme.button.primaryForeground
                      : theme.button.secondaryForeground}
                  />
                ) : null}
                <ResponsiveText
                  accessible={false}
                  style={styles.actionLabelLane}
                  text={action.label}
                  textStyle={[
                    primary ? styles.primaryText : styles.secondaryText,
                    {
                      color: primary
                        ? theme.button.primaryForeground
                        : theme.button.secondaryForeground,
                    },
                  ]}
                  variant="actionLabel"
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 8,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
    maxWidth: 440,
    textAlign: 'center',
  },
  copyLane: {
    maxWidth: 480,
    width: '100%',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 480,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
    maxWidth: 360,
    paddingTop: 8,
    width: '100%',
  },
  action: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionLabelLane: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.52,
  },
});
