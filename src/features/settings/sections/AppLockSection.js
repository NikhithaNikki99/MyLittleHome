import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { PIN_MIN_LENGTH } from '../appLockLogic';
import {
  changePin,
  disableAppLock,
  enableAppLock,
  getBiometricSupport,
  setBiometricsEnabled,
} from '../appLockService';
import { useAppLockStore } from '../appLockStore';
import { PinPad } from '../components/PinPad';

function ToggleRow({ label, detail, value, onToggle, disabled = false }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      onPress={onToggle}
      disabled={disabled}
      style={{
        minHeight: touchTarget + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{label}</AppText>
        {detail ? (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        ) : null}
      </View>
      <View
        accessible={false}
        style={{
          width: 52,
          height: 30,
          borderRadius: radii.pill,
          padding: 3,
          backgroundColor: value ? colors.primary : colors.border,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface }} />
      </View>
    </Pressable>
  );
}

// mode: 'create' (choose + confirm), 'change' (current, new, confirm), 'verify' (current only, for turning off).
const STEPS = {
  create: ['new', 'confirm'],
  change: ['current', 'new', 'confirm'],
  verify: ['current'],
};
const STEP_TEXT = {
  current: 'Enter your current PIN',
  new: `Choose a PIN (${PIN_MIN_LENGTH} to 6 digits)`,
  confirm: 'Enter the same PIN again',
};

function PinSheet({ mode, onClose, onDone }) {
  const { spacing } = useTheme();
  const steps = STEPS[mode];
  const [index, setIndex] = useState(0);
  const [pin, setPin] = useState('');
  const [entered, setEntered] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const step = steps[index];

  const next = async () => {
    setError(null);
    const values = { ...entered, [step]: pin };
    if (step === 'confirm' && values.confirm !== values.new) {
      setError("Those PINs don't match. Let's try again.");
      setEntered({});
      setIndex(steps.indexOf('new'));
      setPin('');
      return;
    }
    if (index < steps.length - 1) {
      setEntered(values);
      setIndex(index + 1);
      setPin('');
      return;
    }
    setBusy(true);
    try {
      await onDone(values);
      onClose();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Couldn't do that. Please try again.");
      setPin('');
      if (mode !== 'verify' && step !== 'current') {
        setEntered({});
        setIndex(steps.indexOf('new') === -1 ? 0 : steps.indexOf('new'));
      }
    } finally {
      setBusy(false);
    }
  };

  const last = index === steps.length - 1;
  return (
    <View style={{ gap: spacing.lg, alignItems: 'center' }}>
      <AppText variant="heading" accessibilityLiveRegion="polite">
        {STEP_TEXT[step]}
      </AppText>
      <PinPad value={pin} onChange={setPin} disabled={busy} />
      <FormError message={error} />
      <Button
        title={last ? 'Done' : 'Next'}
        onPress={next}
        disabled={pin.length < PIN_MIN_LENGTH || busy}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

export function AppLockSection() {
  const { spacing } = useTheme();
  const enabled = useAppLockStore((s) => s.enabled);
  const biometrics = useAppLockStore((s) => s.biometrics);
  const [sheet, setSheet] = useState(null);
  const [support, setSupport] = useState({ available: false, hasHardware: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    getBiometricSupport().then(setSupport);
  }, [enabled]);

  const close = useCallback(() => setSheet(null), []);

  const toggleBiometrics = async () => {
    setError(null);
    try {
      await setBiometricsEnabled(!biometrics);
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Couldn't change that. Please try again.");
    }
  };

  const biometricDetail = !support.hasHardware
    ? "This phone doesn't support fingerprint or face unlock"
    : !support.available
      ? 'Set up a fingerprint or face in your phone settings first'
      : 'Your PIN always works as a backup';

  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">
        App lock
      </AppText>
      <ToggleRow
        label="Lock with a PIN"
        detail={enabled ? 'On. Asked when you open the app' : 'Off'}
        value={enabled}
        onToggle={() => {
          setError(null);
          setSheet(enabled ? 'disable' : 'enable-info');
        }}
      />
      {enabled ? (
        <>
          <ToggleRow
            label="Fingerprint or face"
            detail={biometricDetail}
            value={biometrics}
            disabled={!biometrics && !support.available}
            onToggle={toggleBiometrics}
          />
          <Button title="Change PIN" variant="soft" onPress={() => setSheet('change')} />
        </>
      ) : null}
      <FormError message={error} />
      <AppText variant="caption" muted>
        The lock hides the app on this phone. It does not encrypt your data. The app asks for your PIN
        again after you have been away for more than 30 seconds.
      </AppText>

      <BottomSheet visible={sheet === 'enable-info'} title="Before you turn this on" onClose={close}>
        <View style={{ gap: spacing.md }}>
          <AppText>
            A forgotten PIN cannot be recovered. There is no reset, because nothing is stored anywhere
            else.
          </AppText>
          <AppText>
            If you get locked out, the only way back in is to clear the app's data in your phone
            settings, and that deletes your diary and everything else in the app.
          </AppText>
          <AppText muted>Tip: make a backup first (Settings, then Backup and restore).</AppText>
          <Button title="I understand, set a PIN" onPress={() => setSheet('enable')} />
          <Button title="Not now" variant="outline" onPress={close} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'enable'} title="Set your PIN" onClose={close}>
        {sheet === 'enable' ? (
          <PinSheet mode="create" onClose={close} onDone={({ new: pin }) => enableAppLock(pin)} />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'change'} title="Change PIN" onClose={close}>
        {sheet === 'change' ? (
          <PinSheet mode="change" onClose={close} onDone={({ current, new: pin }) => changePin(current, pin)} />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'disable'} title="Turn off app lock" onClose={close}>
        {sheet === 'disable' ? (
          <PinSheet mode="verify" onClose={close} onDone={({ current }) => disableAppLock(current)} />
        ) : null}
      </BottomSheet>
    </Card>
  );
}
