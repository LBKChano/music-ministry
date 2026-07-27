import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ModalAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type AdminFormModalProps = {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryAction: ModalAction;
  secondaryAction?: ModalAction;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  primaryColor: string;
  maxWidth?: number;
  maxRestingHeight?: number;
};

export function AdminFormModal({
  visible,
  title,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  backgroundColor,
  textColor,
  borderColor,
  primaryColor,
  maxWidth = 460,
  maxRestingHeight = 640,
}: AdminFormModalProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [restingHeight, setRestingHeight] = useState(height);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardVisible) {
      setRestingHeight(height);
    }
  }, [height, keyboardVisible]);

  const handleRequestClose = useCallback(() => {
    if (keyboardVisible) {
      Keyboard.dismiss();
      return;
    }

    onClose();
  }, [keyboardVisible, onClose]);

  const runAction = useCallback((action: ModalAction) => {
    Keyboard.dismiss();
    action.onPress();
  }, []);

  const usableRestingHeight = Math.max(
    320,
    restingHeight - insets.top - insets.bottom - 32,
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          style={StyleSheet.absoluteFill}
          onPress={Keyboard.dismiss}
        />

        <View
          style={[
            styles.modal,
            {
              backgroundColor,
              borderColor,
              maxWidth,
              maxHeight: Math.min(usableRestingHeight, maxRestingHeight),
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
              {title}
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {children}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            {secondaryAction ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.secondaryButton,
                  { borderColor },
                  secondaryAction.disabled && styles.disabledButton,
                ]}
                onPress={() => runAction(secondaryAction)}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.loading ? (
                  <ActivityIndicator size="small" color={textColor} />
                ) : (
                  <Text style={[styles.secondaryButtonText, { color: textColor }]}>
                    {secondaryAction.label}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.primaryButton,
                { backgroundColor: primaryColor },
                primaryAction.disabled && styles.disabledButton,
              ]}
              onPress={() => runAction(primaryAction)}
              disabled={primaryAction.disabled}
            >
              {primaryAction.loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  modal: {
    width: '100%',
    minHeight: 300,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
    flexShrink: 1,
  },
  header: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: '#1E3A8A',
  },
  secondaryButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
