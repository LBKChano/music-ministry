import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { AuthTextInput, type AuthCredentialType } from '@/components/auth/AuthTextInput';
import { useAppTheme } from '@/contexts/AppThemeContext';

interface LabeledTextInputProps extends TextInputProps {
  label: string;
  error?: string;
  credentialType?: AuthCredentialType;
  colors: {
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
  };
}

export const LabeledTextInput = forwardRef<TextInput, LabeledTextInputProps>(
  function LabeledTextInput(
    {
      label,
      error,
      credentialType,
      colors,
      style,
      ...props
    },
    ref,
  ) {
    const theme = useAppTheme();
    const inputProps: TextInputProps = {
      accessibilityLabel: label,
      accessibilityHint: error,
      placeholderTextColor: colors.textSecondary,
      style: [
        styles.input,
        {
          color: colors.text,
          backgroundColor: theme.input.surface,
          borderColor: error ? theme.status.error.border : theme.input.border,
        },
        style,
      ],
      ...props,
    };

    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {label}
        </Text>
        {credentialType ? (
          <AuthTextInput
            {...inputProps}
            ref={ref}
            credentialType={credentialType}
          />
        ) : (
          <TextInput {...inputProps} ref={ref} />
        )}
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.error, { color: theme.status.error.foreground }]}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
});
