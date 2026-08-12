export type AppModalVariant = 'confirmation' | 'form' | 'long-content';

export type ModalLayoutInput = {
  width: number;
  restingHeight: number;
  topInset: number;
  bottomInset: number;
  fontScale: number;
  variant: AppModalVariant;
  requestedMaxWidth?: number;
  requestedMaxHeight?: number;
};

export type ModalLayout = {
  maxWidth: number;
  maxHeight: number;
  minHeight: number | undefined;
  stackActions: boolean;
};

const VARIANT_WIDTHS: Record<AppModalVariant, number> = {
  confirmation: 420,
  form: 480,
  'long-content': 680,
};

const VARIANT_HEIGHT_RATIOS: Record<AppModalVariant, number> = {
  confirmation: 0.58,
  form: 0.88,
  'long-content': 0.94,
};

export function getModalLayout(input: ModalLayoutInput): ModalLayout {
  const horizontalMargin = input.width < 380 ? 12 : 16;
  const verticalMargin = input.restingHeight < 620 ? 12 : 16;
  const availableWidth = Math.max(280, input.width - horizontalMargin * 2);
  const availableHeight = Math.max(
    280,
    input.restingHeight - input.topInset - input.bottomInset - verticalMargin * 2,
  );
  const variantHeight = availableHeight * VARIANT_HEIGHT_RATIOS[input.variant];
  const requestedHeight = input.requestedMaxHeight ?? variantHeight;
  const resolvedMaxHeight = Math.min(availableHeight, requestedHeight);

  return {
    maxWidth: Math.min(
      availableWidth,
      input.requestedMaxWidth ?? VARIANT_WIDTHS[input.variant],
    ),
    maxHeight: resolvedMaxHeight,
    minHeight: input.variant === 'confirmation'
      ? undefined
      : Math.min(input.variant === 'form' ? 360 : 400, resolvedMaxHeight),
    stackActions: input.width < 360 || input.fontScale > 1.35,
  };
}

export function getModalDismissAction(input: {
  busy: boolean;
  keyboardVisible: boolean;
  dismissAllowed: boolean;
}): 'dismiss-keyboard' | 'close' | 'ignore' {
  if (input.keyboardVisible) return 'dismiss-keyboard';
  if (input.busy || !input.dismissAllowed) return 'ignore';
  return 'close';
}

export function shouldResetModalList(input: {
  visible: boolean;
  previousTargetKey: string | null;
  nextTargetKey: string;
}): boolean {
  return input.visible && input.previousTargetKey !== input.nextTargetKey;
}
