// Applies pending migrations in order. `db` is any object with the expo-sqlite async API
// (execAsync, getAllAsync, getFirstAsync, runAsync, withExclusiveTransactionAsync).

export function validateMigrations(migrations) {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migration versions must be contiguous from 1; found version ${m.version} at position ${i + 1}`,
      );
    }
    if (typeof m.sql !== 'string' || m.sql.trim() === '') {
      throw new Error(`Migration ${m.version} has no SQL`);
    }
  });
}

export async function runMigrations(db, migrations) {
  validateMigrations(migrations);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = await db.getAllAsync('SELECT version FROM schema_migrations ORDER BY version');
  const applied = new Set(rows.map((r) => r.version));
  const latestKnown = migrations.length;
  const latestApplied = rows.length ? rows[rows.length - 1].version : 0;

  // A database from a newer app build must not be silently downgraded or modified.
  if (latestApplied > latestKnown) {
    throw new Error(
      `Database schema version ${latestApplied} is newer than this app supports (${latestKnown}). Update the app.`,
    );
  }

  const appliedNow = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    // Each migration runs in its own transaction together with its bookkeeping row,
    // so a failure leaves the database exactly at the previous version.
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()],
      );
    });
    appliedNow.push(migration.version);
  }

  await db.execAsync(`PRAGMA user_version = ${latestKnown}`);
  return appliedNow;
}
