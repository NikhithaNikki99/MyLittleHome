export async function getAllSettings(db) {
  const rows = await db.getAllAsync('SELECT key, value FROM app_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getSetting(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(db, key, value) {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, String(value), new Date().toISOString()],
  );
}
