
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
import { useTheme } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href } from 'expo-router';
import { colors } from '@/styles/commonStyles';

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
  borderRadius = 35,
  bottomMargin,
}: FloatingTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const resolvedContainerWidth = Math.max(1, containerWidth ?? screenWidth / 2.5);
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();

  // ALL shared values must be declared unconditionally at the top — never inside
  // conditionals, loops, or after early returns. Reanimated crashes if hook order changes.
  const animatedValue = useSharedValue(0);
  const tabCountSV = useSharedValue(tabs?.length ?? 0);
  const containerWidthSV = useSharedValue(resolvedContainerWidth);

  // Memoize safeTabs so it has a stable reference for useMemo deps below
  const safeTabs = React.useMemo(() => tabs ?? [], [tabs]);
  const tabCount = safeTabs.length;

  const activeTabIndex = React.useMemo(() => {
    console.log('FloatingTabBar - Current pathname:', pathname);

    if (tabCount === 0) {
      console.warn('FloatingTabBar - No tabs provided');
      return 0;
    }

    let bestMatch = -1;
    let bestMatchScore = 0;

    safeTabs.forEach((tab, index) => {
      if (!tab || !tab.route) {
        console.warn('FloatingTabBar - Invalid tab at index', index, tab);
        return;
      }

      let score = 0;
      const routeStr = String(tab.route);

      if (pathname === routeStr) {
        score = 100;
      } else if (pathname.startsWith(routeStr)) {
        score = 80;
      } else if (tab.name && pathname.includes(tab.name)) {
        score = 60;
      } else if (routeStr.includes('/(tabs)/') && pathname.includes(routeStr.split('/(tabs)/')[1])) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    const result = bestMatch >= 0 ? bestMatch : 0;
    console.log('FloatingTabBar - Active tab index:', result);
    return result;
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
      animatedValue.value = withSpring(activeTabIndex, {
        damping: 20,
        stiffness: 120,
        mass: 1,
      });
    }
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = React.useCallback(
    (route: Href) => {
      console.log('FloatingTabBar - Navigating to:', route);
      router.push(route);
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
    borderWidth: 1.2,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        backgroundColor: theme.dark
          ? 'rgba(15, 23, 42, 0.8)'
          : 'rgba(255, 255, 255, 0.6)',
      },
      android: {
        backgroundColor: theme.dark
          ? 'rgba(15, 23, 42, 0.95)'
          : 'rgba(255, 255, 255, 0.6)',
      },
      web: {
        backgroundColor: theme.dark
          ? 'rgba(15, 23, 42, 0.95)'
          : 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(10px)',
      },
    }),
  };

  const indicatorBaseStyle = {
    ...styles.indicator,
    backgroundColor: theme.dark
      ? 'rgba(96, 165, 250, 0.15)'
      : 'rgba(30, 58, 138, 0.08)',
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
        <BlurView intensity={80} style={[blurContainerStyle, { borderRadius }]}>
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
                ? colors.primary
                : theme.dark
                ? '#98989D'
                : '#64748B';
              const labelColor = isActive ? colors.primary : theme.dark ? '#98989D' : '#64748B';
              const labelWeight = isActive ? ('600' as const) : ('500' as const);

              return (
                <React.Fragment key={tab.name}>
                  <TouchableOpacity
                    style={styles.tab}
                    onPress={() => handleTabPress(tab.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tabContent}>
                      <IconSymbol
                        android_material_icon_name={tab.icon}
                        ios_icon_name={tab.iosIcon ?? tab.icon}
                        size={24}
                        color={iconColor}
                      />
                      <Text
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
  },
  blurContainer: {
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 2,
    bottom: 4,
    borderRadius: 27,
    width: '49%',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    marginTop: 2,
  },
});
