// Pure app-lock rules. No native modules here so everything is unit-testable.
import { ValidationError } from '../../utils/errors';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const DEFAULT_GRACE_MS = 30 * 1000;
const PIN_PBKDF_ROUNDS = 5000;

export function validatePin(pin) {
  if (typeof pin !== 'string' || !new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin)) {
    throw new ValidationError(`Use ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits for your PIN.`);
  }
  return pin;
}

// Salted, iterated SHA-256. `digest(text)` returns a hex string; it is injected so tests
// do not need expo-crypto and the app passes the real implementation.
export async function hashPin(pin, saltHex, digest) {
  let value = `${saltHex}:${pin}`;
  for (let i = 0; i < PIN_PBKDF_ROUNDS; i += 1) {
    value = await digest(`${saltHex}:${value}`);
  }
  return value;
}

export async function createPinRecord(pin, { digest, randomHex }) {
  validatePin(pin);
  const salt = await randomHex(16);
  const hash = await hashPin(pin, salt, digest);
  return JSON.stringify({ v: 1, salt, hash });
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin, record, digest) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin) || typeof record !== 'string') return false;
  let parsed;
  try {
    parsed = JSON.parse(record);
  } catch {
    return false;
  }
  if (!parsed || parsed.v !== 1 || typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') return false;
  const candidate = await hashPin(pin, parsed.salt, digest);
  return constantTimeEqual(candidate, parsed.hash);
}

// Lock when the app was away longer than the grace period. `backgroundedAt` is a ms timestamp
// (null means the app has not been backgrounded since unlock).
export function shouldLockAfterBackground({ enabled, backgroundedAt, now, graceMs = DEFAULT_GRACE_MS }) {
  if (!enabled) return false;
  if (backgroundedAt == null) return false;
  return now - backgroundedAt >= graceMs;
}

// Free attempts, then a growing pause. Returns ms the user must wait before the next try.
const FREE_ATTEMPTS = 4;
const BACKOFF_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

export function backoffDelayMs(failedAttempts) {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  const step = Math.min(failedAttempts - FREE_ATTEMPTS, BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[step];
}

export function remainingLockoutMs({ failedAttempts, lastFailedAt, now }) {
  if (!lastFailedAt) return 0;
  return Math.max(0, lastFailedAt + backoffDelayMs(failedAttempts) - now);
}

export function formatWait(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
