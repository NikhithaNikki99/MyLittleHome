import { create } from 'zustand';

// In-memory only. `locked` starts true on a cold start when the lock is enabled; it is never persisted,
// so killing the app always brings the lock back.
export const useAppLockStore = create((set) => ({
  ready: false,
  enabled: false,
  biometrics: false,
  locked: false,
  failedAttempts: 0,
  lastFailedAt: null,
  init: ({ enabled, biometrics }) => set({ ready: true, enabled, biometrics, locked: enabled }),
  setEnabled: (enabled) => set({ enabled, locked: false, failedAttempts: 0, lastFailedAt: null }),
  setBiometrics: (biometrics) => set({ biometrics }),
  lock: () => set((s) => (s.enabled ? { locked: true } : {})),
  unlock: () => set({ locked: false, failedAttempts: 0, lastFailedAt: null }),
  recordFailure: (now) => set((s) => ({ failedAttempts: s.failedAttempts + 1, lastFailedAt: now })),
}));
