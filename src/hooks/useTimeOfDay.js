import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilNextPeriod } from '../components/illustrations/timeOfDay';

// The current time, refreshed when the Home scene and greeting need to change: at the next boundary (05:00, 12:00,
// 17:00, 21:00) while the app is open, and again whenever the app comes back to the foreground, because a timer does
// not run while the phone has the app suspended.
export function useTimeOfDay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextPeriod(new Date()));
    };
    schedule();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return now;
}
