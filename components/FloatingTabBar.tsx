import React from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Href, usePathname, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { findActiveTabIndex } from '@/lib/ui/package16';
import {
  FLOATING_DOCK_HORIZONTAL_INSET,
  FLOATING_DOCK_MIN_TARGET,
  getFloatingDockLayout,
} from '@/lib/ui/floating-navigation';

export interface TabBarItem {
  name: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** SF Symbol name for iOS. Falls back to MaterialIcons if omitted or invalid. */
  iosIcon?: string;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
}

export default function FloatingTabBar({
  tabs,
  containerWidth,
  borderRadius,
  bottomMargin,
}: FloatingTabBarProps) {
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);
  const safeTabs = React.useMemo(() => tabs ?? [], [tabs]);
  const tabCount = safeTabs.length;
  const activeTabIndex = React.useMemo(() => {
    if (tabCount === 0) return 0;
    return findActiveTabIndex(
      pathname,
      safeTabs.map(tab => ({ name: tab.name, route: String(tab.route) })),
    );
  }, [pathname, safeTabs, tabCount]);
  const layout = React.useMemo(() => getFloatingDockLayout({
    requestedBottomGap: bottomMargin,
    requestedWidth: containerWidth,
    safeAreaBottom: insets.bottom,
    tabCount,
    viewportWidth,
  }), [bottomMargin, containerWidth, insets.bottom, tabCount, viewportWidth]);
  const resolvedBorderRadius = borderRadius ?? theme.radii.header - 2;

  // Shared values remain unconditional so permission-driven tab-count changes
  // cannot alter hook order.
  const animatedIndex = useSharedValue(activeTabIndex);
  const tabCountValue = useSharedValue(tabCount);
  const tabWidthValue = useSharedValue(layout.tabWidth);

  React.useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  React.useEffect(() => {
    tabCountValue.value = tabCount;
    tabWidthValue.value = layout.tabWidth;
  }, [layout.tabWidth, tabCount, tabCountValue, tabWidthValue]);

  React.useEffect(() => {
    animatedIndex.value = reduceMotion
      ? activeTabIndex
      : withSpring(activeTabIndex, {
        damping: 24,
        mass: 0.65,
        overshootClamping: true,
        stiffness: 220,
      });
  }, [activeTabIndex, animatedIndex, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => {
    const safeTabCount = Math.max(0, tabCountValue.value);
    const clampedIndex = safeTabCount > 0
      ? Math.max(0, Math.min(animatedIndex.value, safeTabCount - 1))
      : 0;
    return {
      transform: [{ translateX: clampedIndex * tabWidthValue.value }],
    };
  });

  const handleTabPress = React.useCallback((route: Href) => {
    router.navigate(route);
  }, [router]);

  if (tabCount === 0) {
    console.error('FloatingTabBar - No valid tabs to render');
    return null;
  }

  if (keyboardVisible) return null;

  const dockContents = (
    <>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.indicator,
          {
            backgroundColor: theme.colors.navigationSelected,
            borderColor: theme.colors.navigationBorder,
            borderRadius: Math.max(14, resolvedBorderRadius - 4),
            width: layout.tabWidth,
          },
          indicatorStyle,
        ]}
      >
        <View
          style={[
            styles.indicatorAccent,
            {
              backgroundColor: theme.colors.navigationAccent,
              boxShadow: `0 0 7px ${theme.colors.navigationAccent}`,
            },
          ]}
        />
      </Animated.View>

      <View style={styles.tabsContainer}>
        {safeTabs.map((tab, index) => {
          const isActive = activeTabIndex === index;
          const foreground = isActive
            ? theme.colors.navigationSelectedForeground
            : theme.colors.navigationInactive;

          return (
            <Pressable
              accessibilityHint={`Switches to the ${tab.label} tab`}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={2}
              key={tab.name}
              onPress={() => handleTabPress(tab.route)}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
            >
              <View style={styles.tabContent}>
                <IconSymbol
                  android_material_icon_name={tab.icon}
                  color={foreground}
                  ios_icon_name={tab.iosIcon ?? tab.icon}
                  size={22}
                />
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    {
                      color: foreground,
                      fontWeight: isActive ? '800' : '700',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const surfaceStyle = [
    styles.surface,
    {
      borderColor: theme.colors.navigationBorder,
      borderRadius: resolvedBorderRadius,
    },
  ];

  return (
    <View
      style={[
        styles.safeArea,
        { bottom: layout.bottomOffset },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            borderRadius: resolvedBorderRadius,
            boxShadow: theme.elevation.medium,
            height: layout.shellHeight,
            width: layout.shellWidth,
          },
        ]}
      >
        {process.env.EXPO_OS === 'ios' ? (
          <BlurView
            intensity={72}
            style={[
              surfaceStyle,
              { backgroundColor: theme.colors.navigationSurface },
            ]}
            tint={theme.mode === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'}
          >
            {dockContents}
          </BlurView>
        ) : (
          <View
            style={[
              surfaceStyle,
              { backgroundColor: theme.colors.navigationOpaqueSurface },
            ]}
          >
            {dockContents}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    alignItems: 'center',
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 1000,
  },
  container: {
    alignSelf: 'center',
  },
  surface: {
    borderCurve: 'continuous',
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  indicator: {
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    bottom: FLOATING_DOCK_HORIZONTAL_INSET,
    left: FLOATING_DOCK_HORIZONTAL_INSET,
    pointerEvents: 'none',
    position: 'absolute',
    top: FLOATING_DOCK_HORIZONTAL_INSET,
  },
  indicatorAccent: {
    alignSelf: 'center',
    borderRadius: 2,
    bottom: 3,
    height: 2,
    position: 'absolute',
    width: 28,
  },
  tabsContainer: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: FLOATING_DOCK_HORIZONTAL_INSET,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: FLOATING_DOCK_MIN_TARGET,
    paddingHorizontal: 4,
  },
  tabPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  tabContent: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 15,
    textAlign: 'center',
  },
});
