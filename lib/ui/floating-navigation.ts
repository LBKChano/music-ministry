export const FLOATING_DOCK_HEIGHT = 64;
export const FLOATING_DOCK_MAX_WIDTH = 390;
export const FLOATING_DOCK_HORIZONTAL_INSET = 4;
export const FLOATING_DOCK_BOTTOM_GAP = 12;
export const FLOATING_DOCK_CONTENT_GAP = 16;
export const FLOATING_DOCK_MIN_TARGET = 44;

export interface FloatingDockLayout {
  shellWidth: number;
  shellHeight: number;
  trackWidth: number;
  tabWidth: number;
  bottomOffset: number;
  contentClearance: number;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getFloatingDockLayout({
  viewportWidth,
  tabCount,
  safeAreaBottom,
  requestedWidth,
  requestedBottomGap,
}: {
  viewportWidth: number;
  tabCount: number;
  safeAreaBottom: number;
  requestedWidth?: number;
  requestedBottomGap?: number;
}): FloatingDockLayout {
  const safeWidth = Math.max(1, finiteOr(viewportWidth, 1));
  const horizontalMargin = safeWidth <= 360 ? 12 : 16;
  const availableWidth = Math.max(1, safeWidth - horizontalMargin * 2);
  const preferredWidth = finiteOr(requestedWidth, availableWidth);
  const shellWidth = Math.max(
    1,
    Math.min(preferredWidth, availableWidth, FLOATING_DOCK_MAX_WIDTH),
  );
  const safeTabCount = Math.max(0, Math.floor(finiteOr(tabCount, 0)));
  const trackWidth = Math.max(0, shellWidth - FLOATING_DOCK_HORIZONTAL_INSET * 2);
  const tabWidth = safeTabCount > 0 ? trackWidth / safeTabCount : 0;
  const bottomGap = Math.max(
    0,
    finiteOr(requestedBottomGap, FLOATING_DOCK_BOTTOM_GAP),
  );
  const bottomOffset = Math.max(0, finiteOr(safeAreaBottom, 0)) + bottomGap;

  return {
    shellWidth,
    shellHeight: FLOATING_DOCK_HEIGHT,
    trackWidth,
    tabWidth,
    bottomOffset,
    contentClearance: bottomOffset
      + FLOATING_DOCK_HEIGHT
      + FLOATING_DOCK_CONTENT_GAP,
  };
}

export function clampFloatingDockIndex(index: number, tabCount: number): number {
  const safeTabCount = Math.max(0, Math.floor(finiteOr(tabCount, 0)));
  if (safeTabCount === 0) return 0;
  return Math.max(0, Math.min(finiteOr(index, 0), safeTabCount - 1));
}

export function getFloatingDockCapsuleOffset({
  index,
  tabCount,
  tabWidth,
}: {
  index: number;
  tabCount: number;
  tabWidth: number;
}): number {
  return clampFloatingDockIndex(index, tabCount) * Math.max(0, tabWidth);
}
