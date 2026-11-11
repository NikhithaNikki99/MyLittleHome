import { Fingerprint, Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { FormError } from '../../components/common/FormError';
import { useTheme } from '../../theme/ThemeProvider';
import { ValidationError } from '../../utils/errors';
import { remainingLockoutMs, formatWait } from './appLockLogic';
import { unlockWithBiometrics, unlockWithPin } from './appLockService';
import { useAppLockStore } from './appLockStore';
import { PinPad } from './components/PinPad';

// Shown instead of the app while locked. Nothing of the app is rendered behind it.
export function LockScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const biometrics = useAppLockStore((s) => s.biometrics);
  const failedAttempts = useAppLockStore((s) => s.failedAttempts);
  const lastFailedAt = useAppLockStore((s) => s.lastFailedAt);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const triedBiometrics = useRef(false);

  const waitMs = remainingLockoutMs({ failedAttempts, lastFailedAt, now });

  useEffect(() => {
    if (waitMs <= 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitMs]);

  const tryBiometrics = async () => {
    setError(null);
    try {
      await unlockWithBiometrics();
    } catch {
      setError('Biometric unlock did not work. Please use your PIN.');
    }
  };

  useEffect(() => {
    if (biometrics && !triedBiometrics.current) {
      triedBiometrics.current = true;
      tryBiometrics();
    }
  }, [biometrics]);

  const submit = async (digits) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await unlockWithPin(digits);
    } catch (e) {
      setNow(Date.now());
      setError(e instanceof ValidationError ? e.message : "Couldn't check your PIN. Please try again.");
    } finally {
      setPin('');
      busy.current = false;
    }
  };

  // The PIN may be 4 to 6 digits, so the user confirms with a button once at least 4 are entered.
  const canSubmit = pin.length >= 4 && waitMs <= 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: spacing.lg,
        gap: spacing.xl,
      }}
    >
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Lock color={colors.primary} size={36} />
        <AppText variant="title" accessibilityRole="header">
          My Little World
        </AppText>
        <AppText muted>Enter your PIN to open your diary</AppText>
      </View>

      <PinPad value={pin} onChange={setPin} disabled={waitMs > 0} />

      <View style={{ minHeight: 48, alignItems: 'center' }}>
        {waitMs > 0 ? (
          <AppText color={colors.danger} accessibilityLiveRegion="polite">
            Too many tries. Please wait {formatWait(waitMs)}.
          </AppText>
        ) : (
          <FormError message={error} />
        )}
      </View>

      <View style={{ gap: spacing.md, alignSelf: 'stretch', alignItems: 'center' }}>
        <Button title="Unlock" onPress={() => submit(pin)} disabled={!canSubmit} style={{ alignSelf: 'stretch' }} />
        {biometrics ? (
          <Button
            title="Use fingerprint or face"
            variant="outline"
            onPress={tryBiometrics}
            style={{ alignSelf: 'stretch' }}
            accessibilityLabel="Unlock with fingerprint or face"
          />
        ) : null}
      </View>
    </View>
  );
}
