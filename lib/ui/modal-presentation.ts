export type AppModalVariant = 'confirmation' | 'form' | 'tall-form' | 'long-content';

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
  horizontalMargin: number;
  verticalMargin: number;
  stackActions: boolean;
};

const VARIANT_WIDTHS: Record<AppModalVariant, number> = {
  confirmation: 420,
  form: 480,
  'tall-form': 560,
  'long-content': 680,
};

const VARIANT_HEIGHT_RATIOS: Record<AppModalVariant, number> = {
  confirmation: 0.58,
  form: 0.94,
  'tall-form': 0.98,
  'long-content': 1,
};

const VARIANT_MIN_HEIGHTS: Record<AppModalVariant, number | undefined> = {
  confirmation: undefined,
  form: 360,
  'tall-form': 440,
  'long-content': 440,
};

const VARIANT_MIN_HEIGHT_RATIOS: Record<AppModalVariant, number | undefined> = {
  confirmation: undefined,
  form: undefined,
  'tall-form': 0.9,
  'long-content': 0.94,
};
const CONTENT_MODAL_MIN_HEIGHT_CEILING = 760;

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
  const fixedMinimum = VARIANT_MIN_HEIGHTS[input.variant];
  const proportionalMinimum = VARIANT_MIN_HEIGHT_RATIOS[input.variant] === undefined
    ? undefined
    : Math.min(
      availableHeight * (VARIANT_MIN_HEIGHT_RATIOS[input.variant] as number),
      CONTENT_MODAL_MIN_HEIGHT_CEILING,
    );
  const preferredMinimum = proportionalMinimum ?? fixedMinimum;

  return {
    maxWidth: Math.min(
      availableWidth,
      input.requestedMaxWidth ?? VARIANT_WIDTHS[input.variant],
    ),
    maxHeight: resolvedMaxHeight,
    minHeight: preferredMinimum === undefined
      ? undefined
      : Math.min(Math.max(fixedMinimum ?? 0, preferredMinimum), resolvedMaxHeight),
    horizontalMargin,
    verticalMargin,
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
  previousVisible?: boolean;
  previousTargetKey: string | null;
  nextTargetKey: string;
}): boolean {
  return input.visible && (
    input.previousVisible === false
    || input.previousTargetKey !== input.nextTargetKey
  );
}

export function shouldResetModalScroll(input: {
  visible: boolean;
  previousVisible: boolean;
  previousContentKey: string | null;
  nextContentKey: string;
}): boolean {
  return shouldResetModalList({
    visible: input.visible,
    previousVisible: input.previousVisible,
    previousTargetKey: input.previousContentKey,
    nextTargetKey: input.nextContentKey,
  });
}
