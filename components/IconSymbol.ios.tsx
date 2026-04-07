import React from "react";
import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import { StyleProp, ViewStyle } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// SF Symbol names that are known to be valid across iOS 16+.
// Any name NOT in this set will fall back to MaterialIcons to prevent crashes.
const KNOWN_SF_SYMBOLS = new Set<string>([
  "person.fill", "person", "person.circle", "person.circle.fill",
  "person.2.fill", "person.badge.shield.checkmark",
  "rectangle.portrait.and.arrow.right",
  "calendar", "calendar.badge.plus", "calendar.badge.minus",
  "calendar.badge.exclamationmark",
  "checkmark.circle", "checkmark.circle.fill",
  "xmark.circle.fill",
  "trash", "trash.fill",
  "pencil", "pencil.circle",
  "plus", "plus.circle", "plus.circle.fill",
  "minus", "minus.circle",
  "chevron.up", "chevron.down", "chevron.left", "chevron.right",
  "arrow.right.square", "arrow.left",
  "building.2", "building.2.fill",
  "ticket", "ticket.fill",
  "doc.on.doc", "doc.on.doc.fill",
  "bell", "bell.fill", "bell.badge",
  "gear", "gearshape", "gearshape.fill",
  "house", "house.fill",
  "magnifyingglass",
  "star", "star.fill",
  "heart", "heart.fill",
  "envelope", "envelope.fill",
  "phone", "phone.fill",
  "lock", "lock.fill", "lock.open",
  "key", "key.fill",
  "info.circle", "info.circle.fill",
  "exclamationmark.circle", "exclamationmark.circle.fill",
  "exclamationmark.triangle", "exclamationmark.triangle.fill",
  "checkmark", "xmark",
  "square.and.arrow.up",
  "square.and.pencil",
  "list.bullet", "list.dash",
  "music.note", "music.note.list",
  "mic", "mic.fill",
  "speaker.wave.2", "speaker.wave.2.fill",
  "play", "play.fill", "pause", "pause.fill",
  "stop", "stop.fill",
  "forward", "backward",
  "shuffle", "repeat",
  "waveform",
  "map", "map.fill",
  "location", "location.fill",
  "photo", "photo.fill",
  "camera", "camera.fill",
  "video", "video.fill",
  "link",
  "paperclip",
  "flag", "flag.fill",
  "bookmark", "bookmark.fill",
  "tag", "tag.fill",
  "folder", "folder.fill",
  "tray", "tray.fill",
  "archivebox", "archivebox.fill",
  "clock", "clock.fill",
  "timer",
  "alarm", "alarm.fill",
  "chart.bar", "chart.bar.fill",
  "chart.pie", "chart.pie.fill",
  "creditcard", "creditcard.fill",
  "cart", "cart.fill",
  "bag", "bag.fill",
  "gift", "gift.fill",
  "crown", "crown.fill",
  "shield", "shield.fill",
  "eye", "eye.fill", "eye.slash", "eye.slash.fill",
  "hand.thumbsup", "hand.thumbsup.fill",
  "hand.thumbsdown", "hand.thumbsdown.fill",
  "bubble.left", "bubble.left.fill",
  "bubble.right", "bubble.right.fill",
  "ellipsis", "ellipsis.circle",
  "slider.horizontal.3",
  "line.3.horizontal",
  "square.grid.2x2", "square.grid.3x3",
  "rectangle.grid.2x2",
  "circle", "circle.fill",
  "square", "square.fill",
  "triangle", "triangle.fill",
]);

// Detect if a name looks like a MaterialIcons name (contains hyphens or underscores
// typical of Material naming) rather than an SF Symbol name (dot-separated).
function looksLikeMaterialIconName(name: string): boolean {
  return name.includes("-") || name.includes("_");
}

function isSafeSymbolName(name: string | undefined): name is string {
  if (!name) return false;
  if (looksLikeMaterialIconName(name)) return false;
  return KNOWN_SF_SYMBOLS.has(name);
}

export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight = "regular",
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: SymbolViewProps["name"] | string | undefined;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  // Fall back to MaterialIcons if no iOS icon name is provided, or if the name
  // is not a known-safe SF Symbol (e.g. a MaterialIcons name was passed by mistake).
  if (!isSafeSymbolName(ios_icon_name)) {
    return (
      <MaterialIcons
        onPress={onPress}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        color={color}
        size={size}
        name={android_material_icon_name}
        style={style as any}
      />
    );
  }

  return (
    <SafeSymbolView
      ios_icon_name={ios_icon_name}
      android_material_icon_name={android_material_icon_name}
      size={size}
      color={color}
      style={style}
      weight={weight}
      onPress={onPress}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

// Separate component so we can use an error boundary around SymbolView
class SafeSymbolView extends React.Component<{
  ios_icon_name: string;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight: SymbolWeight;
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
    console.warn("[IconSymbol.ios] SymbolView crashed for name:", this.props.ios_icon_name, error.message);
  }

  render() {
    const { ios_icon_name, android_material_icon_name, size, color, style, weight, onPress, onClick, onMouseOver, onMouseLeave, testID, accessibilityLabel } = this.props;

    if (this.state.hasError) {
      return (
        <MaterialIcons
          onPress={onPress}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          color={color}
          size={size}
          name={android_material_icon_name}
          style={style as any}
        />
      );
    }

    return (
      <SymbolView
        onPress={onPress}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
        name={ios_icon_name as SymbolViewProps["name"]}
        style={[{ width: size, height: size }, style]}
      />
    );
  }
}
