import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  getSplashExitDelay,
  getSplashMarkSize,
  SPLASH_BACKGROUND_COLOR,
  SPLASH_TIMING,
} from '@/lib/ui/splash-screen';

const brandArtwork = require('../assets/splash-mark.png');

interface CustomSplashScreenProps {
  onReady?: () => void;
  visible: boolean;
}

export function CustomSplashScreen({ onReady, visible }: CustomSplashScreenProps) {
  const { height, width } = useWindowDimensions();
  const [rendered, setRendered] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const mountedAtRef = useRef(Date.now());
  const readyCalledRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const brandScale = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(8)).current;
  const accentScale = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const markSize = getSplashMarkSize(width, height);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!rendered) return;

    titleOpacity.setValue(0);
    titleTranslateY.setValue(reduceMotion ? 0 : 8);
    accentScale.setValue(0);
    statusOpacity.setValue(0);
    brandScale.setValue(1);

    const titleAnimation = Animated.parallel([
      Animated.timing(titleOpacity, {
        delay: reduceMotion ? 0 : SPLASH_TIMING.titleDelay,
        duration: reduceMotion ? 180 : SPLASH_TIMING.titleReveal,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        delay: reduceMotion ? 0 : SPLASH_TIMING.titleDelay,
        duration: reduceMotion ? 0 : SPLASH_TIMING.titleReveal,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(accentScale, {
        delay: reduceMotion ? 0 : SPLASH_TIMING.titleDelay + 120,
        duration: reduceMotion ? 180 : 360,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    const brandAnimation = reduceMotion
      ? null
      : Animated.sequence([
        Animated.timing(brandScale, {
          duration: SPLASH_TIMING.brandPulse / 2,
          easing: Easing.out(Easing.cubic),
          toValue: 1.035,
          useNativeDriver: true,
        }),
        Animated.timing(brandScale, {
          duration: SPLASH_TIMING.brandPulse / 2,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]);

    const statusAnimation = Animated.sequence([
      Animated.delay(SPLASH_TIMING.statusDelay),
      Animated.timing(statusOpacity, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);

    const animations = [titleAnimation, statusAnimation];
    if (brandAnimation) animations.push(brandAnimation);
    Animated.parallel(animations).start();

    return () => {
      titleAnimation.stop();
      brandAnimation?.stop();
      statusAnimation.stop();
    };
  }, [
    accentScale,
    brandScale,
    reduceMotion,
    rendered,
    statusOpacity,
    titleOpacity,
    titleTranslateY,
  ]);

  useEffect(() => {
    clearExitTimer();

    if (visible) {
      if (!rendered) {
        mountedAtRef.current = Date.now();
        overlayOpacity.setValue(1);
        setRendered(true);
      }
      return;
    }

    if (!rendered) return;
    const delay = getSplashExitDelay(
      mountedAtRef.current,
      Date.now(),
      reduceMotion,
    );
    exitTimerRef.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        duration: reduceMotion ? 120 : SPLASH_TIMING.exit,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }, delay);

    return clearExitTimer;
  }, [clearExitTimer, overlayOpacity, reduceMotion, rendered, visible]);

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;
    onReady?.();
  }, [onReady]);

  if (!rendered) return null;

  return (
    <Animated.View
      accessibilityLabel="Music Ministry is starting"
      accessibilityRole="progressbar"
      onLayout={handleLayout}
      style={[styles.container, { opacity: overlayOpacity }]}
    >
      <View style={styles.brandBlock}>
        <Animated.View
          style={[
            styles.markViewport,
            {
              height: markSize,
              transform: [{ scale: brandScale }],
              width: markSize,
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={brandArtwork}
            style={{
              height: markSize * 1.48,
              width: markSize * 1.48,
            }}
          />
        </Animated.View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          }}
        >
          <Text maxFontSizeMultiplier={1.15} style={styles.title}>
            Music Ministry
          </Text>
          <Animated.View
            style={[styles.accentLine, { transform: [{ scaleX: accentScale }] }]}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.status, { opacity: statusOpacity }]}>
        <ActivityIndicator
          size="small"
          color="#8CB9F5"
          style={styles.loader}
        />
        <Text maxFontSizeMultiplier={1.2} style={styles.statusText}>
          Preparing your schedule
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    zIndex: 2000,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    transform: [{ translateY: -12 }],
  },
  markViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#F7FAFF',
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  accentLine: {
    width: 58,
    height: 2,
    marginTop: 12,
    borderRadius: 1,
    backgroundColor: '#6FA8F4',
  },
  status: {
    position: 'absolute',
    bottom: 52,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  loader: {
    transform: [{ scale: 0.82 }],
  },
  statusText: {
    color: '#C8D9EF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
});
