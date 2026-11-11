import { create } from 'zustand';
import { SETTING_KEYS } from '../constants/settingKeys';
import { DEFAULT_THEME_ID, isValidThemeId } from '../theme/palettes';

export const MAX_PROFILE_NAME_LENGTH = 30;

// Cache of values persisted in SQLite (app_settings). SQLite is the source of truth;
// write through settingsService so the database and this store never diverge.
export const useSettingsStore = create((set) => ({
  themeId: DEFAULT_THEME_ID,
  profileName: '',
  hydrated: false,
  hydrate: (settings) =>
    set({
      themeId: isValidThemeId(settings[SETTING_KEYS.THEME_ID])
        ? settings[SETTING_KEYS.THEME_ID]
        : DEFAULT_THEME_ID,
      profileName: (settings[SETTING_KEYS.PROFILE_NAME] ?? '').slice(0, MAX_PROFILE_NAME_LENGTH),
      hydrated: true,
    }),
  setThemeId: (themeId) => set({ themeId }),
  setProfileName: (profileName) => set({ profileName }),
}));
