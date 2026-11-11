import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { toDateKey } from '../../utils/dates';

// Loads on screen focus, and again when the app returns to the foreground on a new local day,
// so "today" rolls over after midnight. `load(todayKey)` must be a stable function.
// Out-of-order responses are dropped so a slow earlier load can't overwrite a newer one.
export function useLoadOnFocus(load) {
  const [state, setState] = useState({ data: null, status: 'loading', error: null });
  const loadedDay = useRef(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    const day = toDateKey();
    try {
      const data = await load(day);
      if (ticket !== latest.current) return;
      loadedDay.current = day;
      setState({ data, status: 'ready', error: null });
    } catch (error) {
      if (ticket !== latest.current) return;
      setState((s) => ({ ...s, status: 'error', error }));
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && loadedDay.current && loadedDay.current !== toDateKey()) reload();
    });
    return () => sub.remove();
  }, [reload]);

  return { ...state, reload };
}
