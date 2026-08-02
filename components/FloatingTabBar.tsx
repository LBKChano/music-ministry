import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { findActiveTabIndex } from '@/lib/ui/package16';

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
  borderRadius = 8,
  bottomMargin,
}: FloatingTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const initialTabCount = tabs?.length ?? 0;
  const defaultContainerWidth = initialTabCount >= 3
    ? Math.min(screenWidth - 24, 390)
    : Math.min(screenWidth - 32, 320);
  const resolvedContainerWidth = Math.max(1, containerWidth ?? defaultContainerWidth);
  const router = useRouter();
  const pathname = usePathname();

  // ALL shared values must be declared unconditionally at the top — never inside
  // conditionals, loops, or after early returns. Reanimated crashes if hook order changes.
  const animatedValue = useSharedValue(0);
  const tabCountSV = useSharedValue(tabs?.length ?? 0);
  const containerWidthSV = useSharedValue(resolvedContainerWidth);

  // Memoize safeTabs so it has a stable reference for useMemo deps below
  const safeTabs = React.useMemo(() => tabs ?? [], [tabs]);
  const tabCount = safeTabs.length;

  const activeTabIndex = React.useMemo(() => {
    if (tabCount === 0) {
      return 0;
    }
    return findActiveTabIndex(
      pathname,
      safeTabs.map(tab => ({ name: tab.name, route: String(tab.route) })),
    );
  }, [pathname, safeTabs, tabCount]);

  // Keep shared values in sync — always run, never conditional
  React.useEffect(() => {
    tabCountSV.value = tabCount;
  }, [tabCount, tabCountSV]);

  React.useEffect(() => {
    containerWidthSV.value = resolvedContainerWidth;
  }, [resolvedContainerWidth, containerWidthSV]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = reduceMotion
        ? activeTabIndex
        : withSpring(activeTabIndex, {
          damping: 20,
          stiffness: 120,
          mass: 1,
        });
    }
  }, [activeTabIndex, animatedValue, reduceMotion]);

  const handleTabPress = React.useCallback(
    (route: Href) => {
      router.navigate(route);
    },
    [router],
  );

  const tabWidthPercent = React.useMemo(() => {
    if (tabCount === 0) return 50;
    return (100 / tabCount) - 1;
  }, [tabCount]);

  // useAnimatedStyle — Reanimated v4 automatically treats this as a worklet.
  // Do NOT add the 'worklet' directive — v4 crashes if it is present.
  const indicatorStyle = useAnimatedStyle(() => {
    const tc = tabCountSV.value;
    const cw = containerWidthSV.value;
    if (tc <= 1 || cw <= 0) {
      return { transform: [{ translateX: 0 }] };
    }
    const tabWidth = (cw - 8) / tc;
    const clampedValue = Math.max(0, Math.min(animatedValue.value, tc - 1));
    return {
      transform: [{ translateX: clampedValue * tabWidth }],
    };
  });

  if (tabCount === 0) {
    console.error('FloatingTabBar - No valid tabs to render');
    return null;
  }

  const blurContainerStyle = {
    ...styles.blurContainer,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...Platform.select({
      ios: {
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
      },
      android: {
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
      },
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(10px)',
      },
    }),
  };

  const indicatorBaseStyle = {
    ...styles.indicator,
    backgroundColor: colors.primary,
    width: `${tabWidthPercent}%` as `${number}%`,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View
        style={[
          styles.container,
          {
            width: resolvedContainerWidth,
            marginBottom: bottomMargin ?? 20,
          },
        ]}
      >
        <BlurView intensity={55} style={[blurContainerStyle, { borderRadius }]}>
          <View style={styles.background} />
          <Animated.View style={[indicatorBaseStyle, indicatorStyle]} />
          <View style={styles.tabsContainer}>
            {safeTabs.map((tab, index) => {
              if (!tab) {
                console.warn('FloatingTabBar - Skipping invalid tab at index', index);
                return null;
              }

              const isActive = activeTabIndex === index;
              const iconColor = isActive
                ? '#FFFFFF'
                : '#334155';
              const labelColor = isActive ? '#FFFFFF' : '#334155';
              const labelWeight = isActive ? ('800' as const) : ('700' as const);

              return (
                <React.Fragment key={tab.name}>
                  <TouchableOpacity
                    style={styles.tab}
                    onPress={() => handleTabPress(tab.route)}
                    activeOpacity={0.7}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityHint={`Switches to the ${tab.label} tab`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={styles.tabContent}>
                      <IconSymbol
                        android_material_icon_name={tab.icon}
                        ios_icon_name={tab.iosIcon ?? tab.icon}
                        size={24}
                        color={iconColor}
                      />
                      <Text
                        maxFontSizeMultiplier={1.25}
                        numberOfLines={1}
                        style={[
                          styles.tabLabel,
                          { color: labelColor, fontWeight: labelWeight },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    marginHorizontal: 20,
    alignSelf: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  blurContainer: {
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  indicator: {
    position: 'absolute',
    top: 6,
    left: 4,
    bottom: 6,
    borderRadius: 6,
    width: '49%',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 68,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },
});
