import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { shouldLockAfterBackground } from './appLockLogic';
import { initAppLock } from './appLockService';
import { useAppLockStore } from './appLockStore';
import { LockScreen } from './LockScreen';
import { resyncReminders } from './reminderActions';

// Sits inside DatabaseGate. Locks on cold start and when the app returns after the grace period.
// While locked or still deciding, children are not rendered at all.
export function AppLockGate({ children }) {
  const { colors } = useTheme();
  const ready = useAppLockStore((s) => s.ready);
  const locked = useAppLockStore((s) => s.locked);
  const backgroundedAt = useRef(null);

  useEffect(() => {
    initAppLock().catch(() => {
      // If the lock state cannot be read, fail closed only when we know the lock is on; here we do not,
      // so open the app rather than trap the user. The lock settings screen will surface the problem.
      useAppLockStore.getState().init({ enabled: false, biometrics: false });
    });
    resyncReminders();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const { enabled, lock } = useAppLockStore.getState();
      if (next === 'background' || next === 'inactive') {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
        return;
      }
      if (next === 'active') {
        const away = shouldLockAfterBackground({
          enabled,
          backgroundedAt: backgroundedAt.current,
          now: Date.now(),
        });
        backgroundedAt.current = null;
        if (away) lock();
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (locked) return <LockScreen />;
  return children;
}
