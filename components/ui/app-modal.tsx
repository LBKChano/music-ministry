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
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import {
  getModalDismissAction,
  getModalLayout,
  shouldResetModalScroll,
  type AppModalVariant,
} from '@/lib/ui/modal-presentation';

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
  headerIcon?: ReactNode;
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
  scrollResetKey?: string;
  testID?: string;
};

export function AppModal({
  visible,
  title,
  children,
  onClose,
  variant = 'form',
  subtitle,
  headerIcon,
  primaryAction,
  secondaryAction,
  footer,
  bodyScroll = true,
  bodyStyle,
  contentContainerStyle,
  maxWidth,
  maxHeight,
  backgroundColor,
  textColor,
  borderColor,
  primaryColor,
  showCloseButton = true,
  dismissOnBackdrop = true,
  busy = false,
  returnFocusRef,
  scrollResetKey,
  testID,
}: AppModalProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotionPreference();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [restingHeight, setRestingHeight] = useState(dimensions.height);
  const closeButtonRef = useRef<View>(null);
  const bodyScrollRef = useRef<ScrollView>(null);
  const previousVisibleRef = useRef(false);
  const previousContentKeyRef = useRef<string | null>(null);
  const actionBusy = Boolean(busy || primaryAction?.loading || secondaryAction?.loading);
  const resolvedBackgroundColor = backgroundColor ?? theme.modal.surface;
  const resolvedTextColor = textColor ?? theme.colors.textPrimary;
  const resolvedBorderColor = borderColor ?? theme.modal.border;
  const resolvedPrimaryColor = primaryColor ?? theme.button.primarySurface;
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

  useEffect(() => {
    const contentKey = scrollResetKey ?? title;
    const shouldReset = bodyScroll && shouldResetModalScroll({
      visible,
      previousVisible: previousVisibleRef.current,
      previousContentKey: previousContentKeyRef.current,
      nextContentKey: contentKey,
    });
    previousVisibleRef.current = visible;
    previousContentKeyRef.current = contentKey;

    if (!shouldReset) return;
    const frame = requestAnimationFrame(() => {
      bodyScrollRef.current?.scrollTo({ animated: false, y: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [bodyScroll, scrollResetKey, title, visible]);

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
        {
          backgroundColor: theme.modal.footerSurface,
          borderTopColor: resolvedBorderColor,
        },
      ]}
    >
      {secondaryAction ? (
        <ModalActionButton
          action={secondaryAction}
          busy={actionBusy}
          borderColor={resolvedBorderColor}
          primaryColor={resolvedPrimaryColor}
          textColor={resolvedTextColor}
          secondary
          onPress={runAction}
        />
      ) : null}
      {primaryAction ? (
        <ModalActionButton
          action={primaryAction}
          busy={actionBusy}
          borderColor={resolvedBorderColor}
          primaryColor={resolvedPrimaryColor}
          textColor={resolvedTextColor}
          onPress={runAction}
        />
      ) : null}
    </View>
  ) : null);

  const body = bodyScroll ? (
    <ScrollView
      ref={bodyScrollRef}
      style={[
        styles.body,
        variant !== 'confirmation' && styles.flexBody,
        bodyStyle,
      ]}
      contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
      bounces
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[
      styles.body,
      variant !== 'confirmation' && styles.flexBody,
      bodyStyle,
    ]}>
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
        style={[
          styles.overlay,
          {
            backgroundColor: theme.modal.backdrop,
            paddingBottom: insets.bottom + layout.verticalMargin,
            paddingHorizontal: layout.horizontalMargin,
            paddingTop: insets.top + layout.verticalMargin,
          },
        ]}
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
              backgroundColor: resolvedBackgroundColor,
              borderColor: resolvedBorderColor,
              borderRadius: theme.radii.modal,
              maxHeight: layout.maxHeight,
              maxWidth: layout.maxWidth,
              minHeight: keyboardVisible ? undefined : layout.minHeight,
            },
          ]}
          testID={testID}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: theme.modalHeader.surface,
                borderBottomColor: resolvedBorderColor,
              },
            ]}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.headerIcon,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.modalHeader.accent,
                },
              ]}
            >
              {headerIcon ?? (
                <IconSymbol
                  android_material_icon_name={variant === 'confirmation' ? 'help-outline' : variant === 'long-content' ? 'view-list' : 'edit'}
                  color={theme.modalHeader.accent}
                  ios_icon_name={variant === 'confirmation' ? 'questionmark.circle.fill' : variant === 'long-content' ? 'list.bullet.rectangle.fill' : 'square.and.pencil'}
                  size={22}
                />
              )}
            </View>
            <View style={styles.headerCopy}>
              <ResponsiveText
                accessibilityRole="header"
                text={title}
                textStyle={[styles.title, { color: theme.modalHeader.foreground }]}
                variant="stateTitle"
              />
              {subtitle ? (
                <View style={styles.subtitle}>
                  {typeof subtitle === 'string' ? (
                    <ResponsiveText
                      text={subtitle}
                      textStyle={[styles.subtitleText, { color: theme.modalHeader.mutedForeground }]}
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
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borderStrong,
                  },
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}
              >
                <IconSymbol
                  android_material_icon_name="close"
                  color={theme.modalHeader.foreground}
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
  const theme = useAppTheme();
  const disabled = Boolean(action.disabled || busy);
  const actionColor = action.destructive
    ? theme.button.destructiveSurface
    : primaryColor;
  const primaryForeground = action.destructive
    ? theme.button.destructiveForeground
    : theme.button.primaryForeground;
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
          ? {
            backgroundColor: theme.button.secondarySurface,
            borderColor: theme.button.secondaryBorder || borderColor,
            borderWidth: 1,
          }
          : { backgroundColor: actionColor },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {action.loading ? (
        <ActivityIndicator
          color={secondary ? theme.button.secondaryForeground : primaryForeground}
          size="small"
        />
      ) : (
        <ResponsiveText
          accessible={false}
          style={styles.actionLabelLane}
          text={action.label}
          textStyle={[
            styles.actionText,
            {
              color: secondary
                ? theme.button.secondaryForeground || textColor
                : primaryForeground,
            },
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
    flex: 1,
    justifyContent: 'center',
  },
  modal: {
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexShrink: 0,
  },
  headerIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: { alignItems: 'flex-start', flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23, textAlign: 'left' },
  subtitle: { alignItems: 'flex-start', paddingTop: 3 },
  subtitleText: { textAlign: 'left' },
  body: { flexShrink: 1, minHeight: 0 },
  flexBody: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 16 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexShrink: 0,
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
