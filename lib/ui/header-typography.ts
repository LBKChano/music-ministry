export type HeaderTypographyVariant =
  | 'primaryTitle'
  | 'profileName'
  | 'secondaryChurchName'
  | 'focusedTitle';

export interface HeaderTypographyContract {
  preferredSize: number;
  minimumSize: number;
  lineHeightOffset: number;
  maxFontSizeMultiplier: number;
  fontWeight: '800' | '900';
}

export interface AdaptiveHeaderTypographyInput {
  text: string;
  variant: HeaderTypographyVariant;
  availableWidth: number;
  fontScale: number;
}

export interface AdaptiveHeaderTypographySelection
  extends HeaderTypographyContract {
  displayText: string;
  fontSize: number;
  lineHeight: number;
}

export interface WordSafeHeaderLayout {
  sourceText: string;
  displayText: string;
  lines: string[];
  singleTokenOverflow: boolean;
  truncated: boolean;
}

export const HEADER_ACTION_LANE_WIDTHS = {
  bell: 52,
  profile: 54,
  churchActions: 52,
} as const;

export const HEADER_TYPOGRAPHY: Record<
  HeaderTypographyVariant,
  HeaderTypographyContract
> = {
  primaryTitle: {
    preferredSize: 28,
    minimumSize: 22,
    lineHeightOffset: 6,
    maxFontSizeMultiplier: 1.35,
    fontWeight: '900',
  },
  profileName: {
    preferredSize: 32,
    minimumSize: 24,
    lineHeightOffset: 6,
    maxFontSizeMultiplier: 1.35,
    fontWeight: '900',
  },
  secondaryChurchName: {
    preferredSize: 18,
    minimumSize: 16,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.4,
    fontWeight: '800',
  },
  focusedTitle: {
    preferredSize: 19,
    minimumSize: 17,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.35,
    fontWeight: '800',
  },
};

export function normalizeHeaderDisplayText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function estimateHeaderTextWidth(
  text: string,
  fontSize: number,
): number {
  let units = 0;

  for (const character of text) {
    if (character === ' ') {
      units += 0.32;
    } else if (/[ilI1|.,'`:;]/.test(character)) {
      units += 0.3;
    } else if (/[MW@%&]/.test(character)) {
      units += 0.86;
    } else if (/[A-Z]/.test(character)) {
      units += 0.66;
    } else if (/[0-9]/.test(character)) {
      units += 0.56;
    } else {
      units += 0.54;
    }
  }

  return units * fontSize;
}

export function selectAdaptiveHeaderTypography({
  text,
  variant,
  availableWidth,
  fontScale,
}: AdaptiveHeaderTypographyInput): AdaptiveHeaderTypographySelection {
  const contract = HEADER_TYPOGRAPHY[variant];
  const displayText = normalizeHeaderDisplayText(text);
  const stableWidth = Math.max(1, Math.round(availableWidth));
  const effectiveFontScale = Math.min(
    Math.max(fontScale, 1),
    contract.maxFontSizeMultiplier,
  );
  const tokens = displayText ? displayText.split(' ') : [];
  const tokenCount = tokens.length;
  const lineCapacity = stableWidth * (tokenCount <= 1 ? 1 : 2) * 0.92;
  const tokenCapacity = stableWidth * 0.96;

  let fontSize = contract.minimumSize;
  for (
    let candidate = contract.preferredSize;
    candidate >= contract.minimumSize;
    candidate -= 2
  ) {
    const estimatedWidth = estimateHeaderTextWidth(
      displayText,
      candidate * effectiveFontScale,
    );
    const longestTokenWidth = tokens.reduce(
      (maximum, token) => Math.max(
        maximum,
        estimateHeaderTextWidth(token, candidate * effectiveFontScale),
      ),
      0,
    );
    if (
      estimatedWidth <= lineCapacity
      && longestTokenWidth <= tokenCapacity
    ) {
      fontSize = candidate;
      break;
    }
  }

  return {
    ...contract,
    displayText,
    fontSize,
    lineHeight: fontSize + contract.lineHeightOffset,
  };
}

export function createWordSafeHeaderLayout({
  text,
  availableWidth,
  fontSize,
  fontScale,
}: {
  text: string;
  availableWidth: number;
  fontSize: number;
  fontScale: number;
}): WordSafeHeaderLayout {
  const sourceText = text;
  const displayText = normalizeHeaderDisplayText(text);
  const words = displayText ? displayText.split(' ') : [];
  const stableWidth = Math.max(1, Math.round(availableWidth)) * 0.96;
  const scaledFontSize = fontSize * Math.max(fontScale, 1);

  if (words.length === 0) {
    return {
      sourceText,
      displayText,
      lines: [],
      singleTokenOverflow: false,
      truncated: false,
    };
  }

  const fullWidth = estimateHeaderTextWidth(displayText, scaledFontSize);
  if (words.length === 1) {
    const singleTokenOverflow = fullWidth > stableWidth;
    return {
      sourceText,
      displayText,
      lines: [displayText],
      singleTokenOverflow,
      truncated: singleTokenOverflow,
    };
  }

  if (fullWidth <= stableWidth) {
    return {
      sourceText,
      displayText,
      lines: [displayText],
      singleTokenOverflow: false,
      truncated: false,
    };
  }

  let bestLines = [words[0], words.slice(1).join(' ')];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestLineOverflow = false;

  for (let index = 1; index < words.length; index += 1) {
    const firstLine = words.slice(0, index).join(' ');
    const secondLine = words.slice(index).join(' ');
    const firstWidth = estimateHeaderTextWidth(firstLine, scaledFontSize);
    const secondWidth = estimateHeaderTextWidth(secondLine, scaledFontSize);
    const firstOverflow = Math.max(0, firstWidth - stableWidth);
    const secondOverflow = Math.max(0, secondWidth - stableWidth);
    const overflowPenalty = (firstOverflow * 1000) + (secondOverflow * 20);
    const balancePenalty = Math.abs(firstWidth - secondWidth);
    const score = overflowPenalty + balancePenalty;

    if (score < bestScore) {
      bestScore = score;
      bestLines = [firstLine, secondLine];
      bestLineOverflow = firstOverflow > 0 || secondOverflow > 0;
    }
  }

  const hasOverlongToken = words.some(
    word => estimateHeaderTextWidth(word, scaledFontSize) > stableWidth,
  );

  return {
    sourceText,
    displayText,
    lines: bestLines,
    singleTokenOverflow: false,
    truncated: bestLineOverflow || hasOverlongToken,
  };
}

export function calculateHeaderTitleLaneWidth({
  windowWidth,
  horizontalPadding = 40,
  gap = 12,
  trailingWidth = 0,
}: {
  windowWidth: number;
  horizontalPadding?: number;
  gap?: number;
  trailingWidth?: number;
}): number {
  const trailingSpace = trailingWidth > 0 ? trailingWidth + gap : 0;
  return Math.max(
    96,
    Math.floor(windowWidth - horizontalPadding - trailingSpace),
  );
}

export function calculateFocusedHeaderTitleLaneWidth({
  windowWidth,
  hasTrailingAction,
}: {
  windowWidth: number;
  hasTrailingAction: boolean;
}): number {
  const horizontalPadding = 24;
  const leadingControls = 88;
  const baseGaps = 20;
  const trailingSpace = hasTrailingAction ? 54 : 0;

  return Math.max(
    96,
    Math.floor(
      windowWidth
      - horizontalPadding
      - leadingControls
      - baseGaps
      - trailingSpace,
    ),
  );
}
