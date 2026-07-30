import React, { useMemo } from 'react';
import {
  Text,
  type TextProps,
} from 'react-native';
import {
  createWordSafeHeaderLayout,
  normalizeHeaderDisplayText,
} from '@/lib/ui/header-typography';

interface WordSafeHeaderTextProps
  extends Omit<TextProps, 'children' | 'numberOfLines'> {
  text: string;
  availableWidth?: number;
  fontSize?: number;
  fontScale?: number;
  maxLines?: 1 | 2;
}

export function WordSafeHeaderText({
  text,
  availableWidth,
  fontSize,
  fontScale = 1,
  maxLines = 2,
  accessibilityLabel,
  ...textProps
}: WordSafeHeaderTextProps) {
  const layout = useMemo(() => (
    availableWidth && fontSize
      ? createWordSafeHeaderLayout({
        text,
        availableWidth,
        fontSize,
        fontScale,
      })
      : null
  ), [availableWidth, fontScale, fontSize, text]);
  const displayText = layout?.displayText ?? normalizeHeaderDisplayText(text);
  const renderedText = layout && !layout.singleTokenOverflow
    ? layout.lines.join('\n')
    : displayText;
  const containsOneToken = !displayText.includes(' ');
  const numberOfLines = (
    maxLines === 1
    || containsOneToken
    || layout?.singleTokenOverflow
  )
    ? 1
    : 2;

  return (
    <Text
      {...textProps}
      accessibilityLabel={accessibilityLabel ?? text}
      android_hyphenationFrequency="none"
      ellipsizeMode="tail"
      lineBreakStrategyIOS="none"
      numberOfLines={numberOfLines}
      textBreakStrategy="simple"
    >
      {renderedText}
    </Text>
  );
}
