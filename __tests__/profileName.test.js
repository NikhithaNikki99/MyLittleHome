jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import { cleanProfileName } from '../src/features/settings/settingsService';
import { MAX_PROFILE_NAME_LENGTH, useSettingsStore } from '../src/store/settingsStore';

describe('profile name', () => {
  test('trims and collapses whitespace; empty is allowed', () => {
    expect(cleanProfileName('  Nikki  ')).toBe('Nikki');
    expect(cleanProfileName('Sai   Nikhitha')).toBe('Sai Nikhitha');
    expect(cleanProfileName('')).toBe('');
    expect(cleanProfileName('   ')).toBe('');
    expect(cleanProfileName(null)).toBe('');
  });

  test('rejects names that are too long', () => {
    expect(() => cleanProfileName('x'.repeat(MAX_PROFILE_NAME_LENGTH + 1))).toThrow(/under/);
    expect(cleanProfileName('x'.repeat(MAX_PROFILE_NAME_LENGTH))).toHaveLength(MAX_PROFILE_NAME_LENGTH);
  });

  test('the store hydrates the saved name and falls back to empty', () => {
    useSettingsStore.getState().hydrate({ profile_name: 'Nikki' });
    expect(useSettingsStore.getState().profileName).toBe('Nikki');
    useSettingsStore.getState().hydrate({});
    expect(useSettingsStore.getState().profileName).toBe('');
  });
});
