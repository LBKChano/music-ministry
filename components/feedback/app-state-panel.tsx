import React from 'react';
import {
  ActivityIndicator,
  Pressable,
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

type AppStatePanelAction = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function AppStatePanel({
  title,
  message,
  iosIcon = 'calendar.badge.exclamationmark',
  androidIcon = 'event-busy',
  tone = 'info',
  loading = false,
  actions = [],
}: {
  title: string;
  message: string;
  iosIcon?: string;
  androidIcon?: AndroidIcon;
  tone?: 'info' | 'error';
  loading?: boolean;
  actions?: AppStatePanelAction[];
}) {
  const theme = useAppTheme();
  const iconColor = tone === 'error'
    ? theme.status.error.foreground
    : theme.colors.accent;
  const visibleMessage = sanitizeUserFacingMessage(message, tone);

  return (
    <View style={styles.container}>
      <View
        accessibilityElementsHidden
        style={[styles.iconFrame, { backgroundColor: `${iconColor}12` }]}
      >
        {loading ? (
          <ActivityIndicator color={iconColor} />
        ) : (
          <IconSymbol
            android_material_icon_name={androidIcon}
            color={iconColor}
            ios_icon_name={iosIcon}
            size={30}
          />
        )}
      </View>
      <ResponsiveText
        accessibilityRole="header"
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
                accessibilityHint={action.accessibilityHint}
                accessibilityLabel={action.label}
                accessibilityRole="button"
                accessibilityState={{
                  busy: action.loading,
                  disabled: action.disabled || action.loading,
                }}
                disabled={action.disabled || action.loading}
                key={action.label}
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
                    color={primary
                      ? theme.button.primaryForeground
                      : theme.button.secondaryForeground}
                    size="small"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 36,
    width: '100%',
  },
  iconFrame: {
    alignItems: 'center',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    maxWidth: 440,
    textAlign: 'center',
  },
  copyLane: {
    maxWidth: 480,
    width: '100%',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 480,
    textAlign: 'center',
  },
  actions: {
    gap: 9,
    maxWidth: 340,
    paddingTop: 8,
    width: '100%',
  },
  action: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionLabelLane: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
