import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { sanitizeUserFacingMessage } from '@/lib/ui/package16';
import { colors } from '@/styles/commonStyles';

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
  const iconColor = tone === 'error' ? colors.error : colors.primary;
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
        textStyle={styles.title}
        variant="stateTitle"
      />
      <ResponsiveText
        selectable
        style={styles.copyLane}
        text={visibleMessage}
        textStyle={styles.message}
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
                  primary ? styles.primaryAction : styles.secondaryAction,
                  pressed && styles.pressed,
                  (action.disabled || action.loading) && styles.disabled,
                ]}
              >
                {action.loading ? (
                  <ActivityIndicator
                    color={primary ? colors.headerText : colors.primary}
                    size="small"
                  />
                ) : null}
                <ResponsiveText
                  accessible={false}
                  style={styles.actionLabelLane}
                  text={action.label}
                  textStyle={primary ? styles.primaryText : styles.secondaryText}
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
    color: colors.text,
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
    color: colors.textSecondary,
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
  primaryAction: {
    backgroundColor: colors.primary,
  },
  secondaryAction: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  primaryText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryText: {
    color: colors.primary,
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
