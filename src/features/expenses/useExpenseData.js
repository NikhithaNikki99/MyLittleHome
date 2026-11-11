import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { getDatabase } from '../../database/client';
import { ValidationError } from '../../utils/errors';

// Loads data from SQLite whenever the screen gains focus or `deps` change (for example the selected month).
// The previous data stays on screen while a reload runs, so switching month does not flash empty.
// `load` receives the database and returns the screen's data; `deps` must list what `load` closes over.
export function useExpenseQuery(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const sequence = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const db = await getDatabase();
      const data = await load(db);
      if (mine === sequence.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (mine === sequence.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      run();
      return () => {
        sequence.current += 1;
      };
    }, [run]),
  );

  return { ...state, reload: run };
}

// Runs a write against the database and turns failures into a user-safe message.
// ValidationError messages are written for users; anything else gets a generic line.
export function useAction() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (task) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const db = await getDatabase();
      await task(db);
      return true;
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Couldn't save that. Please try again.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
