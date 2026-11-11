import { useCallback, useState } from 'react';
import { ValidationError } from '../../../utils/errors';

// Shared submit handling for entry sheets: busy flag + friendly error text.
// ValidationError messages are user-safe; anything else gets a generic message.
export function useSheetSubmit(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(
    async (task) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await task();
        onDone();
      } catch (e) {
        setError(e instanceof ValidationError ? e.message : "Couldn't save that. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onDone],
  );

  return { busy, error, setError, run };
}
