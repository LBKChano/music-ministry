import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  getLocalDateParts,
  millisecondsUntilNextLocalDay,
} from '@/lib/schedules/schedule-range';

export function useCurrentLocalDate() {
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    const timeout = setTimeout(refresh, millisecondsUntilNextLocalDay(now));
    return () => clearTimeout(timeout);
  }, [now, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return getLocalDateParts(now);
}
