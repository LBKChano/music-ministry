import {
  estimateHeaderTextWidth,
  normalizeHeaderDisplayText,
} from './header-typography.ts';

export type ResponsiveCopyVariant =
  | 'serviceType'
  | 'memberName'
  | 'roleName'
  | 'songTitle'
  | 'notificationTitle'
  | 'monthLabel'
  | 'requestCopy'
  | 'actionLabel'
  | 'compactLabel'
  | 'stateTitle'
  | 'supportingCopy';

export interface ResponsiveCopyContract {
  preferredSize: number;
  minimumSize: number;
  lineHeightOffset: number;
  maxFontSizeMultiplier: number;
  maxLines: 1 | 2 | 3;
}

export interface ResponsiveCopyLayout extends ResponsiveCopyContract {
  sourceText: string;
  displayText: string;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  truncated: boolean;
}

export const RESPONSIVE_COPY_CONTRACTS: Record<
  ResponsiveCopyVariant,
  ResponsiveCopyContract
> = {
  serviceType: {
    preferredSize: 18,
    minimumSize: 15,
    lineHeightOffset: 4,
    maxFontSizeMultiplier: 1.35,
    maxLines: 2,
  },
  memberName: {
    preferredSize: 16,
    minimumSize: 14,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.45,
    maxLines: 2,
  },
  roleName: {
    preferredSize: 15,
    minimumSize: 13,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.4,
    maxLines: 2,
  },
  songTitle: {
    preferredSize: 14,
    minimumSize: 13,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.4,
    maxLines: 2,
  },
  notificationTitle: {
    preferredSize: 15,
    minimumSize: 13,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.45,
    maxLines: 2,
  },
  monthLabel: {
    preferredSize: 17,
    minimumSize: 15,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.4,
    maxLines: 2,
  },
  requestCopy: {
    preferredSize: 14,
    minimumSize: 13,
    lineHeightOffset: 6,
    maxFontSizeMultiplier: 1.45,
    maxLines: 3,
  },
  actionLabel: {
    preferredSize: 16,
    minimumSize: 13,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.35,
    maxLines: 2,
  },
  compactLabel: {
    preferredSize: 13,
    minimumSize: 11,
    lineHeightOffset: 5,
    maxFontSizeMultiplier: 1.35,
    maxLines: 2,
  },
  stateTitle: {
    preferredSize: 20,
    minimumSize: 17,
    lineHeightOffset: 6,
    maxFontSizeMultiplier: 1.5,
    maxLines: 2,
  },
  supportingCopy: {
    preferredSize: 15,
    minimumSize: 13,
    lineHeightOffset: 7,
    maxFontSizeMultiplier: 1.55,
    maxLines: 3,
  },
};

function packCompleteWords(
  words: string[],
  availableWidth: number,
  scaledFontSize: number,
): string[] {
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (
      currentLine
      && estimateHeaderTextWidth(candidate, scaledFontSize) > availableWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = candidate;
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export function createResponsiveCopyLayout({
  text,
  variant,
  availableWidth,
  fontScale,
  numberOfLines,
}: {
  text: string;
  variant: ResponsiveCopyVariant;
  availableWidth: number;
  fontScale: number;
  numberOfLines?: 1 | 2 | 3;
}): ResponsiveCopyLayout {
  const baseContract = RESPONSIVE_COPY_CONTRACTS[variant];
  const contract = {
    ...baseContract,
    maxLines: numberOfLines ?? baseContract.maxLines,
  };
  const sourceText = text;
  const displayText = normalizeHeaderDisplayText(text);
  const words = displayText ? displayText.split(' ') : [];
  const stableWidth = Math.max(1, Math.round(availableWidth)) * 0.96;
  const effectiveFontScale = Math.min(
    Math.max(fontScale, 1),
    contract.maxFontSizeMultiplier,
  );
  let fontSize = contract.minimumSize;

  for (
    let candidate = contract.preferredSize;
    candidate >= contract.minimumSize;
    candidate -= 1
  ) {
    const scaledFontSize = candidate * effectiveFontScale;
    const packedLines = packCompleteWords(words, stableWidth, scaledFontSize);
    const everyTokenFits = words.every(
      word => estimateHeaderTextWidth(word, scaledFontSize) <= stableWidth,
    );
    if (everyTokenFits && packedLines.length <= contract.maxLines) {
      fontSize = candidate;
      break;
    }
  }

  if (words.length === 0) {
    return {
      ...contract,
      sourceText,
      displayText,
      fontSize,
      lineHeight: fontSize + contract.lineHeightOffset,
      lines: [],
      truncated: false,
    };
  }

  const scaledFontSize = fontSize * effectiveFontScale;
  const packedLines = packCompleteWords(words, stableWidth, scaledFontSize);
  const containsOverlongToken = words.some(
    word => estimateHeaderTextWidth(word, scaledFontSize) > stableWidth,
  );
  const truncated = containsOverlongToken
    || packedLines.length > contract.maxLines;
  const lines = packedLines.length <= contract.maxLines
    ? packedLines
    : [
      ...packedLines.slice(0, contract.maxLines - 1),
      packedLines.slice(contract.maxLines - 1).join(' '),
    ];

  return {
    ...contract,
    sourceText,
    displayText,
    fontSize,
    lineHeight: fontSize + contract.lineHeightOffset,
    lines,
    truncated,
  };
}
