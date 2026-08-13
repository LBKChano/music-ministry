/**
 * Loading Button Component Template
 *
 * A button that shows a loading indicator when processing.
 * Commonly used for API calls, form submissions, etc.
 *
 * Features:
 * - Shows loading spinner when loading=true
 * - Disables interaction when loading
 * - Customizable styles
 * - Works with Pressable for better touch feedback
 *
 * Usage:
 * ```tsx
 * <LoadingButton
 *   loading={isSubmitting}
 *   onPress={handleSubmit}
 *   title="Submit"
 * />
 * ```
 */

import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useAppTheme } from '@/contexts/AppThemeContext';

interface LoadingButtonProps {
  onPress: () => void;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
  loadingColor?: string;
}

export function LoadingButton({
  onPress,
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  loadingColor,
}: LoadingButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const variantStyle = variant === 'primary'
    ? { backgroundColor: theme.button.primarySurface }
    : variant === 'secondary'
      ? { backgroundColor: theme.button.secondarySurface }
      : {
          backgroundColor: 'transparent',
          borderColor: theme.button.secondaryBorder,
          borderWidth: 1,
        };
  const foreground = variant === 'primary'
    ? theme.button.primaryForeground
    : theme.button.secondaryForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={loadingColor || foreground}
        />
      ) : (
        <Text
          style={[
            styles.text,
            { color: foreground },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
