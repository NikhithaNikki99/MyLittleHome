import nodeCrypto from 'node:crypto';
import {
  DEFAULT_GRACE_MS,
  backoffDelayMs,
  createPinRecord,
  formatWait,
  hashPin,
  remainingLockoutMs,
  shouldLockAfterBackground,
  validatePin,
  verifyPin,
} from '../src/features/settings/appLockLogic';

const digest = async (text) => nodeCrypto.createHash('sha256').update(text).digest('hex');
const randomHex = async (bytes) => nodeCrypto.randomBytes(bytes).toString('hex');
const deps = { digest, randomHex };

describe('validatePin', () => {
  test.each(['1234', '12345', '123456', '0000'])('accepts %s', (pin) => {
    expect(validatePin(pin)).toBe(pin);
  });

  test.each(['', '123', '1234567', 'abcd', '12 34', '12.4', null, undefined, 1234])('rejects %p', (pin) => {
    expect(() => validatePin(pin)).toThrow(/4 to 6 digits/);
  });
});

describe('PIN records', () => {
  test('a correct PIN verifies and a wrong one does not', async () => {
    const record = await createPinRecord('2468', deps);
    expect(await verifyPin('2468', record, digest)).toBe(true);
    expect(await verifyPin('2469', record, digest)).toBe(false);
    expect(await verifyPin('246', record, digest)).toBe(false);
  });

  test('the record never contains the PIN, and each record has its own salt', async () => {
    const a = await createPinRecord('135790', deps);
    const b = await createPinRecord('135790', deps);
    expect(a).not.toContain('135790');
    expect(JSON.parse(a).salt).not.toBe(JSON.parse(b).salt);
    expect(JSON.parse(a).hash).not.toBe(JSON.parse(b).hash);
  });

  test('same PIN and salt hash identically; different salt changes the hash', async () => {
    expect(await hashPin('1234', 'aa', digest)).toBe(await hashPin('1234', 'aa', digest));
    expect(await hashPin('1234', 'aa', digest)).not.toBe(await hashPin('1234', 'bb', digest));
  });

  test('malformed or missing records fail closed', async () => {
    expect(await verifyPin('1234', null, digest)).toBe(false);
    expect(await verifyPin('1234', 'not json', digest)).toBe(false);
    expect(await verifyPin('1234', JSON.stringify({ v: 2, salt: 'a', hash: 'b' }), digest)).toBe(false);
    expect(await verifyPin('1234', JSON.stringify({ v: 1 }), digest)).toBe(false);
  });

  test('creating a record rejects an invalid PIN', async () => {
    await expect(createPinRecord('12', deps)).rejects.toThrow(/4 to 6 digits/);
  });
});

describe('grace period', () => {
  const base = { enabled: true, now: 1_000_000 };

  test('does not lock when the lock is off', () => {
    expect(shouldLockAfterBackground({ ...base, enabled: false, backgroundedAt: 0 })).toBe(false);
  });

  test('does not lock when the app was never backgrounded', () => {
    expect(shouldLockAfterBackground({ ...base, backgroundedAt: null })).toBe(false);
  });

  test('stays unlocked inside the default 30 s grace and locks at the boundary', () => {
    expect(DEFAULT_GRACE_MS).toBe(30000);
    expect(shouldLockAfterBackground({ ...base, backgroundedAt: base.now - 29_999 })).toBe(false);
    expect(shouldLockAfterBackground({ ...base, backgroundedAt: base.now - 30_000 })).toBe(true);
    expect(shouldLockAfterBackground({ ...base, backgroundedAt: base.now - 10 * 60_000 })).toBe(true);
  });

  test('honours a custom grace period', () => {
    expect(shouldLockAfterBackground({ ...base, backgroundedAt: base.now - 5000, graceMs: 0 })).toBe(true);
  });
});

describe('wrong-attempt backoff', () => {
  test('first attempts are free, then the wait grows and is capped', () => {
    expect([0, 1, 2, 3].map(backoffDelayMs)).toEqual([0, 0, 0, 0]);
    expect(backoffDelayMs(4)).toBe(30_000);
    expect(backoffDelayMs(5)).toBe(60_000);
    expect(backoffDelayMs(6)).toBe(300_000);
    expect(backoffDelayMs(7)).toBe(900_000);
    expect(backoffDelayMs(50)).toBe(900_000);
  });

  test('remaining lockout counts down from the last failure', () => {
    const lastFailedAt = 1_000_000;
    expect(remainingLockoutMs({ failedAttempts: 4, lastFailedAt, now: lastFailedAt + 10_000 })).toBe(20_000);
    expect(remainingLockoutMs({ failedAttempts: 4, lastFailedAt, now: lastFailedAt + 30_000 })).toBe(0);
    expect(remainingLockoutMs({ failedAttempts: 2, lastFailedAt, now: lastFailedAt })).toBe(0);
    expect(remainingLockoutMs({ failedAttempts: 9, lastFailedAt: null, now: 5 })).toBe(0);
  });

  test('formats waits in plain words', () => {
    expect(formatWait(1000)).toBe('1 second');
    expect(formatWait(20_500)).toBe('21 seconds');
    expect(formatWait(60_000)).toBe('1 minute');
    expect(formatWait(300_000)).toBe('5 minutes');
  });
});
