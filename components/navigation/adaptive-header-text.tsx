import React, { useCallback, useMemo } from 'react';
import {
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextStyle,
} from 'react-native';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import {
  createWordSafeHeaderLayout,
  selectAdaptiveHeaderTypography,
  type HeaderTypographyVariant,
} from '@/lib/ui/header-typography';

const headerLayoutDiagnosticsEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_HEADER_LAYOUT_DIAGNOSTICS === '1';

interface AdaptiveHeaderTextProps {
  text: string;
  variant: HeaderTypographyVariant;
  availableWidth: number;
  fontScale: number;
  color: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'header' | 'text';
  style?: TextStyle;
}

export function AdaptiveHeaderText({
  text,
  variant,
  availableWidth,
  fontScale,
  color,
  accessibilityLabel,
  accessibilityRole = 'text',
  style,
}: AdaptiveHeaderTextProps) {
  const typography = useMemo(
    () => selectAdaptiveHeaderTypography({
      text,
      variant,
      availableWidth,
      fontScale,
    }),
    [availableWidth, fontScale, text, variant],
  );
  const wordSafeLayout = useMemo(
    () => createWordSafeHeaderLayout({
      text,
      availableWidth,
      fontSize: typography.fontSize,
      fontScale: Math.min(
        Math.max(fontScale, 1),
        typography.maxFontSizeMultiplier,
      ),
    }),
    [
      availableWidth,
      fontScale,
      text,
      typography.fontSize,
      typography.maxFontSizeMultiplier,
    ],
  );

  const handleTextLayout = useCallback((
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    if (!headerLayoutDiagnosticsEnabled) return;

    console.log('[HeaderLayout]', {
      variant,
      availableWidth,
      selectedSize: typography.fontSize,
      fontScale,
      lineCount: event.nativeEvent.lines.length,
      expectedLines: wordSafeLayout.lines,
      truncated: wordSafeLayout.truncated,
    });
  }, [
    availableWidth,
    fontScale,
    typography.fontSize,
    variant,
    wordSafeLayout.lines,
    wordSafeLayout.truncated,
  ]);

  return (
    <WordSafeHeaderText
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityRole={accessibilityRole}
      availableWidth={availableWidth}
      fontScale={Math.min(
        Math.max(fontScale, 1),
        typography.maxFontSizeMultiplier,
      )}
      fontSize={typography.fontSize}
      maxLines={2}
      maxFontSizeMultiplier={typography.maxFontSizeMultiplier}
      onTextLayout={handleTextLayout}
      selectable
      style={[
        {
          color,
          fontSize: typography.fontSize,
          fontWeight: typography.fontWeight,
          letterSpacing: 0,
          lineHeight: typography.lineHeight,
          textAlign: 'left',
        },
        style,
      ]}
      text={text}
    />
  );
}
