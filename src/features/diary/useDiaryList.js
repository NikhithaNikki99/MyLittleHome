import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { diaryActions } from './diaryActions';

export const LIST_LIMIT = 100;

// Loads the entry list and the calendar dots for a month. Reloads when the screen regains focus
// (so a just-saved entry shows up) and whenever a filter changes. Late responses are dropped.
export function useDiaryList({ monthKey, date, query, favoritesOnly }) {
  const [state, setState] = useState({ status: 'loading', entries: [], marks: new Set(), error: null });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const [entries, marks] = await Promise.all([
        diaryActions.list({ date, query, favoritesOnly, limit: LIST_LIMIT }),
        diaryActions.monthMarks(monthKey),
      ]);
      if (request !== latest.current) return;
      setState({ status: 'ready', entries, marks: new Set(marks), error: null });
    } catch (error) {
      if (request !== latest.current) return;
      setState((s) => ({ ...s, status: 'error', error }));
    }
  }, [monthKey, date, query, favoritesOnly]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { ...state, reload: load };
}
