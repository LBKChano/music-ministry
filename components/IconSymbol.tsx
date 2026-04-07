// This file is a fallback for using MaterialIcons on Android and web.

import React from "react";
import { SymbolWeight } from "expo-symbols";
import {
  OpaqueColorValue,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Safe wrapper that catches render errors from invalid icon names.
class SafeMaterialIcon extends React.Component<{
  name: keyof typeof MaterialIcons.glyphMap;
  size: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[IconSymbol] MaterialIcons crashed for name:", this.props.name, error.message);
  }

  render() {
    if (this.state.hasError) {
      // Render a known-safe fallback icon so the UI doesn't go blank
      return (
        <MaterialIcons
          name="help-outline"
          size={this.props.size}
          color={this.props.color}
          style={this.props.style}
        />
      );
    }
    const { name, size, color, style, onPress, onClick, onMouseOver, onMouseLeave, testID, accessibilityLabel } = this.props;
    return (
      <MaterialIcons
        name={name}
        size={size}
        color={color}
        style={style}
        onPress={onPress}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
}

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and require manual mapping to MaterialIcons.
 */
export function IconSymbol({
  ios_icon_name = undefined,
  android_material_icon_name,
  size = 24,
  color,
  style,
  // Forward only the event handlers we inject from EditableElement_ (and a few common RN/web props).
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: string | undefined;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  return (
    <SafeMaterialIcon
      name={android_material_icon_name}
      size={size}
      color={color}
      style={style as StyleProp<TextStyle>}
      onPress={onPress}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
