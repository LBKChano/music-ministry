import React from "react";
import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import { StyleProp, ViewStyle } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Comprehensive mapping from MaterialIcons / generic names → valid SF Symbol names.
// Applied before passing to SymbolView so callers can use either naming convention.
const MATERIAL_TO_SF: Record<string, string> = {
  // Navigation / common
  'home': 'house.fill',
  'house': 'house.fill',
  'church': 'building.columns.fill',
  'person': 'person.fill',
  'people': 'person.3.fill',
  'group': 'person.3.fill',
  'groups': 'person.3.fill',
  'settings': 'gearshape.fill',
  'tune': 'slider.horizontal.3',
  'dashboard': 'square.grid.3x3.fill',
  // Music
  'music-note': 'music.note',
  'music_note': 'music.note',
  'library-music': 'music.note.house.fill',
  'library_music': 'music.note.house.fill',
  'headset': 'headphones',
  'queue-music': 'music.note.list',
  'queue_music': 'music.note.list',
  'piano': 'pianokeys',
  'guitar': 'guitars',
  'music-note-list': 'music.note.list',
  'music_note_list': 'music.note.list',
  // Calendar / time
  'calendar-today': 'calendar',
  'calendar_today': 'calendar',
  'event': 'calendar',
  'event-available': 'calendar.badge.checkmark',
  'event_available': 'calendar.badge.checkmark',
  'schedule': 'clock.fill',
  'alarm': 'alarm.fill',
  'timer': 'timer',
  'access-time': 'clock',
  'access_time': 'clock',
  // Notifications
  'notifications': 'bell.fill',
  'notification': 'bell.fill',
  'bell': 'bell.fill',
  'notifications-active': 'bell.badge.fill',
  'notifications_active': 'bell.badge.fill',
  'notifications-off': 'bell.slash.fill',
  'notifications_off': 'bell.slash.fill',
  // Actions
  'add': 'plus',
  'close': 'xmark',
  'check': 'checkmark',
  'done': 'checkmark',
  'done-all': 'checkmark',
  'done_all': 'checkmark',
  'clear': 'xmark',
  'delete': 'trash',
  'remove': 'minus',
  'edit': 'pencil',
  'create': 'pencil',
  'save': 'checkmark.circle.fill',
  'save-alt': 'checkmark.circle.fill',
  'save_alt': 'checkmark.circle.fill',
  'refresh': 'arrow.clockwise',
  'sync': 'arrow.triangle.2.circlepath',
  'share': 'square.and.arrow.up',
  'send': 'paperplane.fill',
  'reply': 'arrowshape.turn.up.left.fill',
  'forward': 'arrowshape.turn.up.right.fill',
  // Navigation arrows
  'arrow-back': 'chevron.left',
  'arrow_back': 'chevron.left',
  'arrow-forward': 'chevron.right',
  'arrow_forward': 'chevron.right',
  'arrow-upward': 'chevron.up',
  'arrow_upward': 'chevron.up',
  'arrow-downward': 'chevron.down',
  'arrow_downward': 'chevron.down',
  'expand-less': 'chevron.up',
  'expand_less': 'chevron.up',
  'expand-more': 'chevron.down',
  'expand_more': 'chevron.down',
  'keyboard-arrow-up': 'chevron.up',
  'keyboard_arrow_up': 'chevron.up',
  'keyboard-arrow-down': 'chevron.down',
  'keyboard_arrow_down': 'chevron.down',
  'keyboard-arrow-left': 'chevron.left',
  'keyboard_arrow_left': 'chevron.left',
  'keyboard-arrow-right': 'chevron.right',
  'keyboard_arrow_right': 'chevron.right',
  // Menu / more
  'menu': 'line.3.horizontal',
  'more-vert': 'ellipsis',
  'more_vert': 'ellipsis',
  'more-horiz': 'ellipsis',
  'more_horiz': 'ellipsis',
  // Media
  'play-arrow': 'play.fill',
  'play_arrow': 'play.fill',
  'pause': 'pause.fill',
  'stop': 'stop.fill',
  'skip-next': 'forward.fill',
  'skip_next': 'forward.fill',
  'skip-previous': 'backward.fill',
  'skip_previous': 'backward.fill',
  'fast-forward': 'forward.end.fill',
  'fast_forward': 'forward.end.fill',
  'fast-rewind': 'backward.end.fill',
  'fast_rewind': 'backward.end.fill',
  'volume-up': 'speaker.wave.3.fill',
  'volume_up': 'speaker.wave.3.fill',
  'volume-off': 'speaker.slash.fill',
  'volume_off': 'speaker.slash.fill',
  'volume-mute': 'speaker.slash.fill',
  'volume_mute': 'speaker.slash.fill',
  'mic': 'mic.fill',
  'mic-off': 'mic.slash.fill',
  'mic_off': 'mic.slash.fill',
  // Media / files
  'camera': 'camera.fill',
  'image': 'photo',
  'photo': 'photo',
  'photo-library': 'photo.on.rectangle',
  'photo_library': 'photo.on.rectangle',
  'folder': 'folder.fill',
  'folder-open': 'folder.badge.plus',
  'folder_open': 'folder.badge.plus',
  'file': 'doc.fill',
  'attach-file': 'paperclip',
  'attach_file': 'paperclip',
  'link': 'link',
  // Security
  'lock': 'lock.fill',
  'lock-open': 'lock.open.fill',
  'lock_open': 'lock.open.fill',
  'unlock': 'lock.open.fill',
  'security': 'lock.shield.fill',
  'verified-user': 'person.badge.shield.checkmark.fill',
  'verified_user': 'person.badge.shield.checkmark.fill',
  // Visibility
  'visibility': 'eye',
  'visibility-off': 'eye.slash',
  'visibility_off': 'eye.slash',
  // Info / status
  'info': 'info.circle',
  'info-outline': 'info.circle',
  'info_outline': 'info.circle',
  'warning': 'exclamationmark.triangle',
  'error': 'xmark.circle',
  'error-outline': 'exclamationmark.circle',
  'error_outline': 'exclamationmark.circle',
  'help': 'questionmark.circle',
  'help-outline': 'questionmark.circle',
  'help_outline': 'questionmark.circle',
  'check-circle': 'checkmark.circle.fill',
  'check_circle': 'checkmark.circle.fill',
  'cancel': 'xmark.circle.fill',
  // Location / map
  'location-on': 'location.fill',
  'location_on': 'location.fill',
  'location-off': 'location.slash.fill',
  'location_off': 'location.slash.fill',
  'map': 'map.fill',
  'directions': 'arrow.triangle.turn.up.right.diamond.fill',
  'directions-car': 'car.fill',
  'directions_car': 'car.fill',
  // Communication
  'phone': 'phone.fill',
  'email': 'envelope.fill',
  'mail': 'envelope.fill',
  'chat': 'bubble.left.fill',
  'message': 'message.fill',
  'forum': 'bubble.left.and.bubble.right.fill',
  // People / auth
  'account-circle': 'person.circle.fill',
  'account_circle': 'person.circle.fill',
  'person-add': 'person.badge.plus',
  'person_add': 'person.badge.plus',
  'person-add-alt': 'person.badge.plus',
  'person_add_alt': 'person.badge.plus',
  'person-add-alt-1': 'person.badge.plus',
  'person_add_alt_1': 'person.badge.plus',
  'person-remove': 'person.badge.minus',
  'person_remove': 'person.badge.minus',
  'logout': 'rectangle.portrait.and.arrow.right',
  'login': 'person.badge.key.fill',
  // Finance
  'attach-money': 'dollarsign.circle.fill',
  'attach_money': 'dollarsign.circle.fill',
  'credit-card': 'creditcard.fill',
  'credit_card': 'creditcard.fill',
  'receipt': 'receipt.fill',
  'shopping-cart': 'cart.fill',
  'shopping_cart': 'cart.fill',
  'store': 'storefront.fill',
  'inventory': 'archivebox.fill',
  // Work / education
  'work': 'briefcase.fill',
  'school': 'graduationcap.fill',
  'account-balance': 'building.columns.fill',
  'account_balance': 'building.columns.fill',
  // Lists / sorting
  'filter-list': 'line.3.horizontal.decrease',
  'filter_list': 'line.3.horizontal.decrease',
  'sort': 'arrow.up.arrow.down',
  'list': 'list.bullet',
  'grid-view': 'square.grid.2x2.fill',
  'grid_view': 'square.grid.2x2.fill',
  // Charts
  'bar-chart': 'chart.bar.fill',
  'bar_chart': 'chart.bar.fill',
  'trending-up': 'chart.line.uptrend.xyaxis',
  'trending_up': 'chart.line.uptrend.xyaxis',
  'pie-chart': 'chart.pie.fill',
  'pie_chart': 'chart.pie.fill',
  // Cloud / network
  'cloud': 'cloud.fill',
  'cloud-upload': 'icloud.and.arrow.up.fill',
  'cloud_upload': 'icloud.and.arrow.up.fill',
  'cloud-download': 'icloud.and.arrow.down.fill',
  'cloud_download': 'icloud.and.arrow.down.fill',
  'wifi': 'wifi',
  'bluetooth': 'bluetooth',
  'download': 'arrow.down.circle',
  'upload': 'arrow.up.circle',
  // Misc
  'star': 'star.fill',
  'star-border': 'star',
  'star_border': 'star',
  'heart': 'heart.fill',
  'favorite': 'heart.fill',
  'favorite-border': 'heart',
  'favorite_border': 'heart',
  'search': 'magnifyingglass',
  'content-copy': 'doc.on.doc',
  'content_copy': 'doc.on.doc',
  'file-copy': 'doc.on.doc',
  'file_copy': 'doc.on.doc',
  'local-offer': 'ticket.fill',
  'local_offer': 'ticket.fill',
  'local-activity': 'ticket.fill',
  'local_activity': 'ticket.fill',
  'local-shipping': 'shippingbox.fill',
  'local_shipping': 'shippingbox.fill',
  'restaurant': 'fork.knife',
  'flight': 'airplane',
  'hotel': 'bed.double.fill',
  'nature': 'leaf.fill',
  'pets': 'pawprint.fill',
  'palette': 'paintpalette.fill',
  'brightness-high': 'sun.max.fill',
  'brightness_high': 'sun.max.fill',
  'dark-mode': 'moon.fill',
  'dark_mode': 'moon.fill',
  'battery-full': 'battery.100',
  'battery_full': 'battery.100',
  'sports': 'sportscourt.fill',
  'add-circle': 'plus.circle.fill',
  'add_circle': 'plus.circle.fill',
  'add-circle-outline': 'plus.circle',
  'add_circle_outline': 'plus.circle',
  'remove-circle': 'minus.circle.fill',
  'remove_circle': 'minus.circle.fill',
};

// Detect if a name looks like a MaterialIcons name (contains hyphens or underscores
// typical of Material naming) rather than an SF Symbol name (dot-separated).
function looksLikeMaterialIconName(name: string): boolean {
  return name.includes('-') || name.includes('_');
}

export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight = 'regular',
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: SymbolViewProps['name'] | string | undefined;
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
  // Apply Material→SF mapping first so callers can pass either naming convention.
  const rawName = ios_icon_name as string | undefined;
  const mappedName = rawName ? (MATERIAL_TO_SF[rawName] ?? rawName) : rawName;

  // If no iOS name provided, or the name still looks like a Material icon name
  // (hyphens/underscores), fall back to MaterialIcons immediately.
  if (!mappedName || looksLikeMaterialIconName(mappedName)) {
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

  // Pass to SafeSymbolView — it has a class-based error boundary that catches any
  // SymbolView crash (invalid name, missing asset, etc.) and falls back to MaterialIcons.
  return (
    <SafeSymbolView
      ios_icon_name={mappedName}
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
class SafeSymbolView extends React.Component<
  {
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
  },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      '[IconSymbol.ios] SymbolView crashed for name:',
      this.props.ios_icon_name,
      error.message,
    );
  }

  render() {
    const {
      ios_icon_name,
      android_material_icon_name,
      size,
      color,
      style,
      weight,
      onPress,
      onClick,
      onMouseOver,
      onMouseLeave,
      testID,
      accessibilityLabel,
    } = this.props;

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
        name={ios_icon_name as SymbolViewProps['name']}
        style={[{ width: size, height: size }, style]}
      />
    );
  }
}
