import { migrations } from '../src/database/migrations';
import { runMigrations, validateMigrations } from '../src/database/migrationRunner';
import { getAllSettings, getSetting, setSetting } from '../src/database/repositories/settingsRepository';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

describe('migration runner', () => {
  test('shipped migrations are contiguous and non-empty', () => {
    expect(() => validateMigrations(migrations)).not.toThrow();
  });

  test('applies all migrations to a fresh database and records them', async () => {
    const db = createTestDatabase();
    const applied = await runMigrations(db, migrations);

    expect(applied).toEqual(migrations.map((m) => m.version));
    const rows = await db.getAllAsync('SELECT version, name FROM schema_migrations ORDER BY version');
    expect(rows).toEqual(migrations.map((m) => ({ version: m.version, name: m.name })));
    const uv = await db.getFirstAsync('PRAGMA user_version');
    expect(uv.user_version).toBe(migrations.length);
  });

  test('is idempotent: a second run applies nothing and keeps data', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations);
    await setSetting(db, 'theme_id', 'matchaJournal');

    const appliedAgain = await runMigrations(db, migrations);

    expect(appliedAgain).toEqual([]);
    expect(await getSetting(db, 'theme_id')).toBe('matchaJournal');
  });

  test('a failing migration rolls back completely and leaves earlier data intact', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations);
    await setSetting(db, 'theme_id', 'pinkDiary');

    const broken = {
      version: migrations.length + 1,
      name: 'broken',
      sql: 'CREATE TABLE half_done (id TEXT); THIS IS NOT SQL;',
    };

    await expect(runMigrations(db, [...migrations, broken])).rejects.toThrow();

    const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE name = 'half_done'");
    expect(tables).toEqual([]);
    const versions = await db.getAllAsync('SELECT version FROM schema_migrations');
    expect(versions.map((v) => v.version)).toEqual(migrations.map((m) => m.version));
    expect(await getSetting(db, 'theme_id')).toBe('pinkDiary');
  });

  test('refuses to run against a database from a newer app version', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations);
    await db.runAsync(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [migrations.length + 5, 'future', new Date().toISOString()],
    );

    await expect(runMigrations(db, migrations)).rejects.toThrow(/newer than this app supports/);
  });

  test('rejects non-contiguous migration versions', () => {
    expect(() =>
      validateMigrations([
        { version: 1, name: 'a', sql: 'SELECT 1' },
        { version: 3, name: 'c', sql: 'SELECT 1' },
      ]),
    ).toThrow(/contiguous/);
  });
});

describe('settings repository', () => {
  test('upserts and reads settings with parameterized queries', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations);

    await setSetting(db, 'theme_id', 'pinkDiary');
    await setSetting(db, 'theme_id', 'creamyTeddy');
    // A value that would break naive string-built SQL must round-trip untouched.
    await setSetting(db, 'note', "Robert'); DROP TABLE app_settings;--");

    expect(await getAllSettings(db)).toEqual({
      theme_id: 'creamyTeddy',
      note: "Robert'); DROP TABLE app_settings;--",
    });
    expect(await getSetting(db, 'missing')).toBeNull();
  });
});

describe('foreign keys', () => {
  test('are enforced on the test connection (mirrors PRAGMA foreign_keys = ON in client.js)', async () => {
    const db = createTestDatabase();
    await db.execAsync(`
      CREATE TABLE parent (id TEXT PRIMARY KEY);
      CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parent(id) ON DELETE CASCADE);
    `);

    await expect(db.runAsync('INSERT INTO child VALUES (?, ?)', ['c1', 'nope'])).rejects.toThrow(
      /FOREIGN KEY/i,
    );

    await db.runAsync('INSERT INTO parent VALUES (?)', ['p1']);
    await db.runAsync('INSERT INTO child VALUES (?, ?)', ['c1', 'p1']);
    await db.runAsync('DELETE FROM parent WHERE id = ?', ['p1']);
    expect(await db.getAllAsync('SELECT * FROM child')).toEqual([]);
  });
});
