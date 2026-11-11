// SQL for backup/restore. Table and column names come only from the allowlist in backupFormat.js
// (never from user input); all values are bound as parameters.
import { BACKUP_TABLES, EXCLUDED_SETTING_KEYS, columnNames } from '../../features/settings/backupFormat';

export async function readSchemaVersion(db) {
  const row = await db.getFirstAsync('SELECT MAX(version) AS v FROM schema_migrations');
  return row?.v ?? 0;
}

export async function readAllTables(db) {
  const tables = {};
  for (const t of BACKUP_TABLES) {
    const cols = columnNames(t.name).join(', ');
    tables[t.name] = await db.getAllAsync(`SELECT ${cols} FROM ${t.name}`);
  }
  return tables;
}

// Replaces user data with the (already validated) document in ONE transaction. Children are
// deleted before parents and inserted after them. Any failure rolls everything back, leaving the
// database exactly as it was. Tables absent from the document are left untouched.
export async function replaceAllTables(db, doc) {
  // A backup made before a table existed does not contain it. Restoring such a backup must not leave that table's
  // current rows behind, so it is cleared whenever the table named here is being replaced: subscriptions point at
  // transactions, and reflections describe months of diary and tracking data that is about to be replaced.
  const IMPLIED_BY = {
    recurring_expenses: 'transactions',
    recurring_expense_occurrences: 'transactions',
    monthly_reflections: 'diary_entries',
  };
  const isReplaced = (name) =>
    doc.tables[name] !== undefined || (IMPLIED_BY[name] !== undefined && doc.tables[IMPLIED_BY[name]] !== undefined);

  await db.withTransactionAsync(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (!isReplaced(t.name)) continue;
      if (t.name === 'app_settings') {
        const keep = [...EXCLUDED_SETTING_KEYS];
        await db.runAsync(
          `DELETE FROM app_settings WHERE key NOT IN (${keep.map(() => '?').join(', ')})`,
          keep,
        );
      } else {
        await db.runAsync(`DELETE FROM ${t.name}`);
      }
    }

    for (const t of BACKUP_TABLES) {
      const rows = doc.tables[t.name];
      if (!rows || rows.length === 0) continue;
      const cols = columnNames(t.name);
      const sql = `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
      for (const row of rows) {
        await db.runAsync(sql, cols.map((c) => row[c] ?? null));
      }
    }

    // Foreign keys may be unenforced on some connections; check explicitly before committing.
    const violations = await db.getAllAsync('PRAGMA foreign_key_check');
    if (violations.length > 0) {
      throw new Error('Backup data refers to entries that are not in the file.');
    }
  });
}
