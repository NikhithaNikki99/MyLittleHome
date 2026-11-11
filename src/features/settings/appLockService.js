// App lock: the only module that touches secure-store, biometrics and expo-crypto for the PIN.
// The PIN is stored only as a salted hash in secure-store (never in SQLite, logs or backups).
// This protects the app screen on a shared or unlocked phone; it does not encrypt the database.
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../../database/client';
import { getSetting, setSetting } from '../../database/repositories/settingsRepository';
import { ValidationError } from '../../utils/errors';
import { createPinRecord, remainingLockoutMs, verifyPin, formatWait } from './appLockLogic';
import { useAppLockStore } from './appLockStore';
import { SECURE_KEYS, SETTINGS_FEATURE_KEYS } from './settingKeys';

const digest = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const randomHex = async (bytes) =>
  Array.from(await Crypto.getRandomBytesAsync(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

const SECURE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// Called once at startup (after the database is ready). If the saved flag says "on" but the PIN
// record is missing (for example after clearing secure storage), the lock is turned off rather than
// leaving the user locked out of their own diary with no way in.
export async function initAppLock() {
  const db = await getDatabase();
  const flag = (await getSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_ENABLED)) === 'true';
  const biometrics = (await getSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_BIOMETRICS)) === 'true';
  let enabled = flag;
  if (flag) {
    const record = await SecureStore.getItemAsync(SECURE_KEYS.PIN_RECORD).catch(() => null);
    if (!record) {
      await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_ENABLED, 'false');
      await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_BIOMETRICS, 'false');
      enabled = false;
    }
  }
  useAppLockStore.getState().init({ enabled, biometrics: enabled && biometrics });
}

export async function getBiometricSupport() {
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return { available: hardware && enrolled, hasHardware: hardware, enrolled };
  } catch {
    return { available: false, hasHardware: false, enrolled: false };
  }
}

export async function enableAppLock(pin) {
  const record = await createPinRecord(pin, { digest, randomHex });
  await SecureStore.setItemAsync(SECURE_KEYS.PIN_RECORD, record, SECURE_OPTIONS);
  const db = await getDatabase();
  await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_ENABLED, 'true');
  useAppLockStore.getState().setEnabled(true);
}

export async function disableAppLock(pin) {
  await assertPin(pin);
  await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_RECORD);
  const db = await getDatabase();
  await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_ENABLED, 'false');
  await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_BIOMETRICS, 'false');
  const store = useAppLockStore.getState();
  store.setEnabled(false);
  store.setBiometrics(false);
}

export async function changePin(oldPin, newPin) {
  await assertPin(oldPin);
  const record = await createPinRecord(newPin, { digest, randomHex });
  await SecureStore.setItemAsync(SECURE_KEYS.PIN_RECORD, record, SECURE_OPTIONS);
}

export async function setBiometricsEnabled(enabled) {
  if (enabled) {
    const support = await getBiometricSupport();
    if (!support.available) {
      throw new ValidationError(
        support.hasHardware
          ? 'No fingerprint or face is set up on this phone yet. Add one in your phone settings first.'
          : "This phone doesn't support fingerprint or face unlock.",
      );
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to use biometrics',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });
    if (!result.success) throw new ValidationError('Biometric check was not completed, so it stays off.');
  }
  const db = await getDatabase();
  await setSetting(db, SETTINGS_FEATURE_KEYS.APP_LOCK_BIOMETRICS, enabled ? 'true' : 'false');
  useAppLockStore.getState().setBiometrics(enabled);
}

async function assertPin(pin) {
  const store = useAppLockStore.getState();
  const wait = remainingLockoutMs({ failedAttempts: store.failedAttempts, lastFailedAt: store.lastFailedAt, now: Date.now() });
  if (wait > 0) throw new ValidationError(`Too many tries. Please wait ${formatWait(wait)}.`);
  const record = await SecureStore.getItemAsync(SECURE_KEYS.PIN_RECORD);
  if (!(await verifyPin(pin, record, digest))) {
    store.recordFailure(Date.now());
    throw new ValidationError("That PIN isn't right.");
  }
  useAppLockStore.getState().unlock();
}

// Unlock screen entry points.
export async function unlockWithPin(pin) {
  await assertPin(pin);
}

export async function unlockWithBiometrics() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock My Little World',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  if (result.success) useAppLockStore.getState().unlock();
  return result.success;
}
