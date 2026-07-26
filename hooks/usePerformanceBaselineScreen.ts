import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import {
  performanceBaseline,
  performanceBaselineEnabled,
  type PerformanceBaselineScreen,
} from '@/lib/performance/baseline';

type BaselineDetails = Record<string, boolean | number | string | null>;

function useEnabledPerformanceBaselineScreen(
  screen: PerformanceBaselineScreen,
  ready: boolean,
  details: BaselineDetails
) {
  const visitIdRef = useRef<number | null>(null);
  const detailsRef = useRef(details);
  detailsRef.current = details;

  useFocusEffect(
    useCallback(() => {
      visitIdRef.current = performanceBaseline.startVisit(screen);
      return () => {
        performanceBaseline.endVisit(visitIdRef.current);
        visitIdRef.current = null;
      };
    }, [screen])
  );

  useEffect(() => {
    performanceBaseline.recordRender(screen);
    if (ready) {
      performanceBaseline.markReady(screen, detailsRef.current);
    }
  });
}

function useDisabledPerformanceBaselineScreen(
  _screen: PerformanceBaselineScreen,
  _ready: boolean,
  _details: BaselineDetails
) {}

function useEnabledPerformanceBaselineLifecycle() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') {
        performanceBaseline.printReport();
      }
    });

    return () => subscription.remove();
  }, []);
}

function useDisabledPerformanceBaselineLifecycle() {}

export const usePerformanceBaselineScreen = performanceBaselineEnabled
  ? useEnabledPerformanceBaselineScreen
  : useDisabledPerformanceBaselineScreen;

export const usePerformanceBaselineLifecycle = performanceBaselineEnabled
  ? useEnabledPerformanceBaselineLifecycle
  : useDisabledPerformanceBaselineLifecycle;
