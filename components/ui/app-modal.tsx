import React, { ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import {
  getModalDismissAction,
  getModalLayout,
  type AppModalVariant,
} from '@/lib/ui/modal-presentation';
import { colors } from '@/styles/commonStyles';

export type AppModalAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
};

type AppModalProps = {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: AppModalVariant;
  subtitle?: ReactNode;
  primaryAction?: AppModalAction;
  secondaryAction?: AppModalAction;
  footer?: ReactNode;
  bodyScroll?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  maxWidth?: number;
  maxHeight?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  primaryColor?: string;
  showCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
  busy?: boolean;
  returnFocusRef?: RefObject<View | null>;
  testID?: string;
};

export function AppModal({
  visible,
  title,
  children,
  onClose,
  variant = 'form',
  subtitle,
  primaryAction,
  secondaryAction,
  footer,
  bodyScroll = true,
  bodyStyle,
  contentContainerStyle,
  maxWidth,
  maxHeight,
  backgroundColor = colors.cardBackground,
  textColor = colors.text,
  borderColor = colors.border,
  primaryColor = colors.primary,
  showCloseButton = true,
  dismissOnBackdrop = true,
  busy = false,
  returnFocusRef,
  testID,
}: AppModalProps) {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotionPreference();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [restingHeight, setRestingHeight] = useState(dimensions.height);
  const closeButtonRef = useRef<View>(null);
  const actionBusy = Boolean(busy || primaryAction?.loading || secondaryAction?.loading);
  const layout = getModalLayout({
    width: dimensions.width,
    restingHeight,
    topInset: insets.top,
    bottomInset: insets.bottom,
    fontScale: dimensions.fontScale,
    variant,
    requestedMaxWidth: maxWidth,
    requestedMaxHeight: maxHeight,
  });

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
    if (!keyboardVisible) setRestingHeight(dimensions.height);
  }, [dimensions.height, keyboardVisible]);

  const requestDismiss = useCallback((dismissAllowed = true) => {
    const action = getModalDismissAction({
      busy: actionBusy,
      keyboardVisible,
      dismissAllowed,
    });
    if (action === 'dismiss-keyboard') Keyboard.dismiss();
    if (action === 'close') onClose();
  }, [actionBusy, keyboardVisible, onClose]);

  const runAction = useCallback((action: AppModalAction) => {
    Keyboard.dismiss();
    action.onPress();
  }, []);

  const restoreFocus = useCallback(() => {
    const node = returnFocusRef?.current
      ? findNodeHandle(returnFocusRef.current)
      : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [returnFocusRef]);

  const focusModal = useCallback(() => {
    if (!showCloseButton) return;
    const node = closeButtonRef.current
      ? findNodeHandle(closeButtonRef.current)
      : null;
    if (node) {
      setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 120);
    }
  }, [showCloseButton]);

  const actions = footer ?? ((primaryAction || secondaryAction) ? (
    <View
      style={[
        styles.footer,
        layout.stackActions && styles.stackedFooter,
        { borderTopColor: borderColor },
      ]}
    >
      {secondaryAction ? (
        <ModalActionButton
          action={secondaryAction}
          busy={actionBusy}
          borderColor={borderColor}
          primaryColor={primaryColor}
          textColor={textColor}
          secondary
          onPress={runAction}
        />
      ) : null}
      {primaryAction ? (
        <ModalActionButton
          action={primaryAction}
          busy={actionBusy}
          borderColor={borderColor}
          primaryColor={primaryColor}
          textColor={textColor}
          onPress={runAction}
        />
      ) : null}
    </View>
  ) : null);

  const body = bodyScroll ? (
    <ScrollView
      style={[styles.body, variant === 'long-content' && styles.longBody, bodyStyle]}
      contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, variant === 'long-content' && styles.longBody, bodyStyle]}>
      {children}
    </View>
  );

  return (
    <Modal
      animationType={reduceMotionEnabled ? 'none' : 'fade'}
      navigationBarTranslucent
      onDismiss={restoreFocus}
      onRequestClose={() => requestDismiss(true)}
      onShow={focusModal}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityLabel={`Dismiss ${title}`}
          accessible={false}
          onPress={() => requestDismiss(dismissOnBackdrop)}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityViewIsModal
          accessible={false}
          importantForAccessibility="yes"
          onAccessibilityEscape={() => requestDismiss(true)}
          onPress={event => event.stopPropagation()}
          style={[
            styles.modal,
            {
              backgroundColor,
              borderColor,
              maxHeight: layout.maxHeight,
              maxWidth: layout.maxWidth,
              minHeight: layout.minHeight,
            },
          ]}
          testID={testID}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            {showCloseButton ? <View style={styles.headerButton} /> : null}
            <View style={styles.headerCopy}>
              <ResponsiveText
                accessibilityRole="header"
                text={title}
                textStyle={[styles.title, { color: textColor }]}
                variant="stateTitle"
              />
              {subtitle ? (
                <View style={styles.subtitle}>
                  {typeof subtitle === 'string' ? (
                    <ResponsiveText
                      text={subtitle}
                      textStyle={[styles.subtitleText, { color: textColor }]}
                      variant="supportingCopy"
                    />
                  ) : subtitle}
                </View>
              ) : null}
            </View>
            {showCloseButton ? (
              <Pressable
                accessibilityHint={`Closes the ${title} dialog`}
                accessibilityLabel={`Close ${title}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: actionBusy }}
                disabled={actionBusy}
                hitSlop={8}
                onPress={() => requestDismiss(true)}
                ref={closeButtonRef}
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}
              >
                <IconSymbol
                  android_material_icon_name="close"
                  color={textColor}
                  ios_icon_name="xmark"
                  size={22}
                />
              </Pressable>
            ) : null}
          </View>
          {body}
          {actions}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalActionButton({
  action,
  busy,
  borderColor,
  primaryColor,
  textColor,
  secondary = false,
  onPress,
}: {
  action: AppModalAction;
  busy: boolean;
  borderColor: string;
  primaryColor: string;
  textColor: string;
  secondary?: boolean;
  onPress: (action: AppModalAction) => void;
}) {
  const disabled = Boolean(action.disabled || busy);
  const actionColor = action.destructive ? colors.error : primaryColor;
  return (
    <Pressable
      accessibilityHint={action.accessibilityHint}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      accessibilityState={{ busy: action.loading, disabled }}
      disabled={disabled}
      onPress={() => onPress(action)}
      style={({ pressed }) => [
        styles.actionButton,
        secondary
          ? { backgroundColor: colors.backgroundAlt, borderColor, borderWidth: 1 }
          : { backgroundColor: actionColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {action.loading ? (
        <ActivityIndicator color={secondary ? textColor : '#FFFFFF'} size="small" />
      ) : (
        <ResponsiveText
          accessible={false}
          style={styles.actionLabelLane}
          text={action.label}
          textStyle={[
            styles.actionText,
            { color: secondary ? textColor : '#FFFFFF' },
          ]}
          variant="actionLabel"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    flex: 1,
    justifyContent: 'center',
    padding: 12,
  },
  modal: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: { alignItems: 'center', flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '800', lineHeight: 25, textAlign: 'center' },
  subtitle: { alignItems: 'center', paddingTop: 3 },
  subtitleText: { opacity: 0.76, textAlign: 'center' },
  body: { flexShrink: 1, minHeight: 0 },
  longBody: { flex: 1 },
  bodyContent: { paddingHorizontal: 18, paddingVertical: 16 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  stackedFooter: { flexDirection: 'column-reverse' },
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 16, fontWeight: '800', lineHeight: 21, textAlign: 'center' },
  actionLabelLane: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});
