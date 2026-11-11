import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { refreshDashboard } from '../features/dashboard/dashboardActions';
import { useDashboardStore } from '../store/dashboardStore';
import { toDateKey } from '../utils/dates';

// Loads on focus, and again when the app returns to the foreground on a new local day
// (so "today" rolls over after midnight without a restart).
export function useDashboard() {
  const data = useDashboardStore((s) => s.data);
  const status = useDashboardStore((s) => s.status);
  const error = useDashboardStore((s) => s.error);
  const loadedDay = useRef(null);

  useFocusEffect(
    useCallback(() => {
      refreshDashboard().then(() => {
        loadedDay.current = toDateKey();
      });
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && loadedDay.current && loadedDay.current !== toDateKey()) {
        refreshDashboard().then(() => {
          loadedDay.current = toDateKey();
        });
      }
    });
    return () => sub.remove();
  }, []);

  return { data, status, error, reload: refreshDashboard };
}
