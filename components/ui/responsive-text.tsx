import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AccessibilityRole,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  createResponsiveCopyLayout,
  type ResponsiveCopyVariant,
} from '@/lib/ui/responsive-copy';

export function ResponsiveText({
  text,
  variant,
  accessibilityLabel,
  accessibilityRole = 'text',
  accessible = true,
  numberOfLines,
  selectable = false,
  style,
  textStyle,
  testID,
}: {
  text: string;
  variant: ResponsiveCopyVariant;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessible?: boolean;
  numberOfLines?: 1 | 2 | 3;
  selectable?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(0);
  const layout = useMemo(() => createResponsiveCopyLayout({
    text,
    variant,
    availableWidth: availableWidth || 10_000,
    fontScale,
    numberOfLines,
  }), [availableWidth, fontScale, numberOfLines, text, variant]);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setAvailableWidth(current => current === nextWidth ? current : nextWidth);
  }, []);
  const lines = layout.lines.length > 0 ? layout.lines : [''];

  return (
    <View
      accessibilityLabel={accessible ? accessibilityLabel ?? text : undefined}
      accessibilityRole={accessible ? accessibilityRole : undefined}
      accessible={accessible}
      onLayout={handleLayout}
      style={[styles.container, style]}
      testID={testID}
    >
      {selectable ? (
        <Text
          accessible={false}
          android_hyphenationFrequency="none"
          ellipsizeMode="tail"
          lineBreakStrategyIOS="none"
          maxFontSizeMultiplier={layout.maxFontSizeMultiplier}
          numberOfLines={layout.maxLines}
          selectable
          style={[
            textStyle,
            {
              fontSize: layout.fontSize,
              letterSpacing: 0,
              lineHeight: layout.lineHeight,
            },
          ]}
          textBreakStrategy="simple"
        >
          {layout.sourceText}
        </Text>
      ) : lines.map((line, index) => (
        <Text
          accessible={false}
          android_hyphenationFrequency="none"
          ellipsizeMode="tail"
          key={`${index}-${line}`}
          lineBreakStrategyIOS="none"
          maxFontSizeMultiplier={layout.maxFontSizeMultiplier}
          numberOfLines={1}
          style={[
            textStyle,
            {
              fontSize: layout.fontSize,
              letterSpacing: 0,
              lineHeight: layout.lineHeight,
            },
          ]}
          textBreakStrategy="simple"
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
});
