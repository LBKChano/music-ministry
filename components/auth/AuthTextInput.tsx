import React, { forwardRef } from 'react';
import {
  TextInput,
  type TextInputProps,
} from 'react-native';

export type AuthCredentialType =
  | 'email'
  | 'username'
  | 'new-username'
  | 'current-password'
  | 'new-password';

export interface AuthTextInputProps extends TextInputProps {
  credentialType: AuthCredentialType;
}

const credentialProps: Record<
  AuthCredentialType,
  Pick<TextInputProps, 'autoComplete' | 'textContentType' | 'importantForAutofill'>
> = {
  email: {
    autoComplete: 'email',
    textContentType: 'emailAddress',
    importantForAutofill: 'yes',
  },
  username: {
    autoComplete: 'username',
    textContentType: 'username',
    importantForAutofill: 'yes',
  },
  'new-username': {
    autoComplete: 'username-new',
    textContentType: 'username',
    importantForAutofill: 'yes',
  },
  'current-password': {
    autoComplete: 'current-password',
    textContentType: 'password',
    importantForAutofill: 'yes',
  },
  'new-password': {
    autoComplete: 'new-password',
    textContentType: 'newPassword',
    importantForAutofill: 'yes',
  },
};

export const AuthTextInput = forwardRef<TextInput, AuthTextInputProps>(
  function AuthTextInput({ credentialType, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        {...credentialProps[credentialType]}
        {...props}
      />
    );
  }
);
