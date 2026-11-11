// Settings owned by the settings feature. The shared SETTING_KEYS file is frozen, so extra keys live here.
// The PIN itself is never stored in SQLite: only the "enabled" flags below are.
export const SETTINGS_FEATURE_KEYS = {
  APP_LOCK_ENABLED: 'app_lock_enabled',
  APP_LOCK_BIOMETRICS: 'app_lock_biometrics',
  REMINDER_DIARY: 'reminder_diary',
  REMINDER_WATER: 'reminder_water',
  REMINDER_HABITS: 'reminder_habits',
};

// Secure-store entries (Android Keystore-backed). Never written to SQLite, logs or backups.
export const SECURE_KEYS = {
  PIN_RECORD: 'mlw_pin_record',
};
