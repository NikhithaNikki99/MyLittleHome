import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { setSetting } from '../src/database/repositories/settingsRepository';
import { BACKUP_TABLES, buildBackupDocument } from '../src/features/settings/backupFormat';
import {
  backupFileName,
  createBackupText,
  inspectBackupText,
  restoreFromText,
} from '../src/features/settings/backupService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const NOW = '2026-11-11T08:00:00.000Z';
const LATEST = migrations.length;

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

async function seed(db) {
  await setSetting(db, 'profile_name', 'Nikki');
  await setSetting(db, 'app_lock_enabled', 'true');
  await db.runAsync('INSERT INTO mood_logs (id, log_date, mood, note, created_at, updated_at) VALUES (?,?,?,?,?,?)', [
    'm1', '2026-11-10', 4, null, NOW, NOW,
  ]);
  await db.runAsync(
    "INSERT INTO transactions (id, kind, title, amount_paise, category_id, txn_date, notes, created_at, updated_at) VALUES ('t1','expense','Chai',2500,'cat-food','2026-11-10',NULL,?,?)",
    [NOW, NOW],
  );
  await db.runAsync(
    "INSERT INTO diary_entries (id, title, content, entry_date, entry_time, mood, is_favorite, created_at, updated_at) VALUES ('e1','Good day','Wrote a lot','2026-11-10','21:30',4,1,?,?)",
    [NOW, NOW],
  );
  await db.runAsync(
    "INSERT INTO diary_photos (id, entry_id, uri, width, height, sort_order, created_at) VALUES ('p1','e1','file:///x/p1.jpg',100,200,0,?)",
    [NOW],
  );
  await db.runAsync("INSERT INTO entry_tags (entry_id, tag_id) VALUES ('e1','tag-life')");
  await db.runAsync(
    "INSERT INTO habits (id, name, icon, color, target_count, start_date, archived, created_at, updated_at) VALUES ('h1','Stretch','sprout','accentSage',1,'2026-11-01',0,?,?)",
    [NOW, NOW],
  );
  await db.runAsync("INSERT INTO habit_schedule_days (habit_id, weekday) VALUES ('h1', 3)");
  await db.runAsync("INSERT INTO habit_logs (id, habit_id, log_date, count, created_at, updated_at) VALUES ('hl1','h1','2026-11-10',1,?,?)", [NOW, NOW]);
  await db.runAsync("INSERT INTO savings_goals (id, name, target_paise, deadline, archived, created_at, updated_at) VALUES ('g1','Trip',500000,NULL,0,?,?)", [NOW, NOW]);
  await db.runAsync("INSERT INTO savings_contributions (id, goal_id, amount_paise, contrib_date, note, created_at) VALUES ('c1','g1',10000,'2026-11-09',NULL,?)", [NOW]);
}

async function snapshot(db) {
  const out = {};
  for (const t of BACKUP_TABLES) out[t.name] = await db.getAllAsync(`SELECT * FROM ${t.name} ORDER BY 1, 2`);
  return out;
}

describe('backup round trip', () => {
  test('export then restore into a fresh database reproduces the data', async () => {
    const source = await freshDb();
    await seed(source);
    const text = await createBackupText(source, { appVersion: '1.0.0' });

    const target = await freshDb();
    const counts = await restoreFromText(target, text);
    expect(counts.diary_entries).toBe(1);
    expect(counts.transactions).toBe(1);

    const before = await snapshot(source);
    const after = await snapshot(target);
    delete before.app_settings;
    delete after.app_settings;
    expect(after).toEqual(before);

    const settings = await target.getAllAsync("SELECT key, value FROM app_settings WHERE key = 'profile_name'");
    expect(settings).toEqual([{ key: 'profile_name', value: 'Nikki' }]);
  });

  test('the export carries the format marker and versions, and never the app lock flags', async () => {
    const db = await freshDb();
    await seed(db);
    const doc = JSON.parse(await createBackupText(db, { appVersion: '1.0.0' }));
    expect(doc.format).toBe('my-little-world-backup');
    expect(doc.schema_version).toBe(LATEST);
    expect(doc.app_version).toBe('1.0.0');
    expect(typeof doc.exported_at).toBe('string');
    expect(doc.tables.app_settings.map((r) => r.key)).toEqual(['profile_name']);
    expect(doc.tables).not.toHaveProperty('schema_migrations');
  });

  test('restore keeps this phone\'s own app lock flags', async () => {
    const source = await freshDb();
    await seed(source);
    const text = await createBackupText(source, { appVersion: '1.0.0' });

    const target = await freshDb();
    await setSetting(target, 'app_lock_enabled', 'true');
    await restoreFromText(target, text);
    const row = await target.getFirstAsync("SELECT value FROM app_settings WHERE key = 'app_lock_enabled'");
    expect(row.value).toBe('true');
  });

  test('restore replaces existing data rather than merging', async () => {
    const source = await freshDb();
    await seed(source);
    const text = await createBackupText(source, { appVersion: '1.0.0' });

    const target = await freshDb();
    await target.runAsync(
      "INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('old','Old','x','2026-01-01','08:00',?,?)",
      [NOW, NOW],
    );
    await restoreFromText(target, text);
    const ids = (await target.getAllAsync('SELECT id FROM diary_entries')).map((r) => r.id);
    expect(ids).toEqual(['e1']);
  });

  test('an empty database exports and restores cleanly', async () => {
    const source = await freshDb();
    const text = await createBackupText(source, { appVersion: '1.0.0' });
    const target = await freshDb();
    await seed(target);
    await restoreFromText(target, text);
    expect((await target.getAllAsync('SELECT id FROM diary_entries')).length).toBe(0);
    expect((await target.getAllAsync('SELECT id FROM expense_categories')).length).toBe(9);
  });

  test('file name carries the local date', () => {
    expect(backupFileName(new Date(2026, 10, 11))).toBe('my-little-world-backup-2026-11-11.json');
  });
});

describe('backup rejection', () => {
  async function inspect(text) {
    const db = await freshDb();
    return inspectBackupText(db, text);
  }
  async function goodDoc() {
    const db = await freshDb();
    await seed(db);
    return JSON.parse(await createBackupText(db, { appVersion: '1.0.0' }));
  }

  test.each([
    ['empty file', ''],
    ['not JSON', 'hello'],
    ['JSON array', '[]'],
    ['wrong format marker', JSON.stringify({ format: 'something-else' })],
  ])('rejects %s', async (_name, text) => {
    await expect(inspect(text)).rejects.toThrow(/backup|empty/i);
  });

  test('rejects a backup from a newer schema', async () => {
    const doc = await goodDoc();
    doc.schema_version = LATEST + 1;
    await expect(inspect(JSON.stringify(doc))).rejects.toThrow(/newer version/);
  });

  test('rejects unknown tables and unknown columns (allowlist)', async () => {
    const doc = await goodDoc();
    await expect(inspect(JSON.stringify({ ...doc, tables: { ...doc.tables, sqlite_master: [] } }))).rejects.toThrow(
      /recognise/,
    );

    const withExtra = await goodDoc();
    withExtra.tables.tasks = [
      { id: 'x', title: 'a', description: null, due_date: null, priority: 2, completed_at: null, created_at: NOW, updated_at: NOW, evil: 1 },
    ];
    await expect(inspect(JSON.stringify(withExtra))).rejects.toThrow(/unexpected field/);
  });

  test('rejects wrong value types and missing required values', async () => {
    const doc = await goodDoc();
    doc.tables.transactions[0].amount_paise = '2500';
    await expect(inspect(JSON.stringify(doc))).rejects.toThrow(/unexpected value/);

    const missing = await goodDoc();
    delete missing.tables.transactions[0].title;
    await expect(inspect(JSON.stringify(missing))).rejects.toThrow(/missing value/);

    const fractional = await goodDoc();
    fractional.tables.transactions[0].amount_paise = 25.5;
    await expect(inspect(JSON.stringify(fractional))).rejects.toThrow(/unexpected value/);
  });

  test('rejects oversize files', async () => {
    const db = await freshDb();
    await expect(inspectBackupText(db, '{}', 26 * 1024 * 1024)).rejects.toThrow(/too large/);
  });

  test('inspect does not change the database', async () => {
    const db = await freshDb();
    await seed(db);
    const before = await snapshot(db);
    const text = await createBackupText(db, { appVersion: '1.0.0' });
    await inspectBackupText(db, text);
    expect(await snapshot(db)).toEqual(before);
  });
});

describe('restore atomicity', () => {
  test('a constraint failure mid-restore rolls everything back', async () => {
    const source = await freshDb();
    await seed(source);
    const doc = JSON.parse(await createBackupText(source, { appVersion: '1.0.0' }));
    // Passes type checks but violates the table CHECK (mood 1-5) on the last-inserted diary data.
    doc.tables.mood_logs[0].mood = 9;
    doc.tables.goals = [
      { id: 'goal1', title: 'Fine', description: null, target_date: null, completed_at: null, created_at: NOW, updated_at: NOW },
    ];

    const target = await freshDb();
    await target.runAsync(
      "INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('keep','Keep me','x','2026-01-01','08:00',?,?)",
      [NOW, NOW],
    );
    await setSetting(target, 'profile_name', 'Original');
    const before = await snapshot(target);

    await expect(restoreFromText(target, JSON.stringify(doc))).rejects.toThrow(/nothing was changed/);
    expect(await snapshot(target)).toEqual(before);
  });

  test('a dangling reference is caught and rolled back', async () => {
    const source = await freshDb();
    await seed(source);
    const doc = JSON.parse(await createBackupText(source, { appVersion: '1.0.0' }));
    doc.tables.diary_photos[0].entry_id = 'does-not-exist';

    const target = await freshDb();
    await seed(target);
    const before = await snapshot(target);
    await expect(restoreFromText(target, JSON.stringify(doc))).rejects.toThrow(/nothing was changed/);
    expect(await snapshot(target)).toEqual(before);
  });
});

describe('buildBackupDocument', () => {
  test('exports only allowlisted columns', () => {
    const doc = buildBackupDocument({
      tables: { tasks: [{ id: 'a', title: 't', secret: 'nope', priority: 2 }] },
      schemaVersion: 9,
      appVersion: '1.0.0',
      exportedAt: NOW,
    });
    expect(Object.keys(doc.tables.tasks[0])).not.toContain('secret');
    expect(doc.tables.tasks[0].description).toBeNull();
  });
});
