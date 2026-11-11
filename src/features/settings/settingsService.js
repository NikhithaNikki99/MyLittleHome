import { SETTING_KEYS } from '../../constants/settingKeys';
import { getDatabase } from '../../database/client';
import { getAllSettings, setSetting } from '../../database/repositories/settingsRepository';
import { MAX_PROFILE_NAME_LENGTH, useSettingsStore } from '../../store/settingsStore';
import { isValidThemeId } from '../../theme/palettes';
import { ValidationError } from '../../utils/errors';

export async function loadSettingsIntoStore() {
  const db = await getDatabase();
  const settings = await getAllSettings(db);
  useSettingsStore.getState().hydrate(settings);
}

export async function changeTheme(themeId) {
  if (!isValidThemeId(themeId)) {
    throw new Error(`Unknown theme: ${themeId}`);
  }
  const db = await getDatabase();
  await setSetting(db, SETTING_KEYS.THEME_ID, themeId);
  useSettingsStore.getState().setThemeId(themeId);
}

// An empty name is allowed and means "no name": the greeting simply omits it.
export function cleanProfileName(input) {
  const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new ValidationError(`Keep your name under ${MAX_PROFILE_NAME_LENGTH} characters.`);
  }
  return name;
}

export async function changeProfileName(input) {
  const name = cleanProfileName(input);
  const db = await getDatabase();
  await setSetting(db, SETTING_KEYS.PROFILE_NAME, name);
  useSettingsStore.getState().setProfileName(name);
}
