import { useCallback, useRef, useState } from 'react';
import { ValidationError } from '../../utils/errors';

export const GENERIC_SAVE_ERROR = "Couldn't save that. Please try again.";

export function messageFor(error) {
  return error instanceof ValidationError ? error.message : GENERIC_SAVE_ERROR;
}

// Busy flag + friendly error text for sheets. ValidationError messages are user-safe; anything
// else gets a generic message. `onDone` runs after a successful task.
export function useSubmit(onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (task) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        await task();
        onDone();
      } catch (e) {
        setError(messageFor(e));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [onDone],
  );

  return { busy, error, setError, run };
}
