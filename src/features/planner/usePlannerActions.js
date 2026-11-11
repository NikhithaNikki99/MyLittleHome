import { useCallback, useState } from 'react';
import { getDatabase } from '../../database/client';
import { ValidationError } from '../../utils/errors';

export const GENERIC_ERROR = "Couldn't save that. Please try again.";

// Runs a write against SQLite, then calls `after` so the screen re-reads from the database.
// ValidationError messages are user-safe; anything else gets the generic message.
export function useWrite(after) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      setError(null);
      try {
        const db = await getDatabase();
        const result = await fn(db);
        await after?.();
        return { ok: true, result };
      } catch (e) {
        setError(e instanceof ValidationError ? e.message : GENERIC_ERROR);
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [after],
  );

  return { busy, error, setError, run };
}
