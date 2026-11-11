import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { getSetting, setSetting } from '../src/database/repositories/settingsRepository';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const NOW = '2026-11-11T08:00:00.000Z';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('upgrade from an installed schema v1', () => {
  test('applies 002-005 on top of v1 without touching existing data', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations.slice(0, 1));
    await setSetting(db, 'theme_id', 'creamyTeddy');
    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(1);

    const applied = await runMigrations(db, migrations);

    expect(applied).toEqual(migrations.slice(1).map((m) => m.version));
    expect(await getSetting(db, 'theme_id')).toBe('creamyTeddy');
    expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(migrations.length);
  });

  test('seeds the nine default expense categories exactly once', async () => {
    const db = await freshDb();
    await runMigrations(db, migrations);
    const rows = await db.getAllAsync('SELECT name FROM expense_categories ORDER BY sort_order');
    expect(rows.map((r) => r.name)).toEqual([
      'Food', 'Travel', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Education', 'Personal Care', 'Other',
    ]);
  });
});

describe('constraints', () => {
  test('mood_logs allows one row per date and only moods 1-5', async () => {
    const db = await freshDb();
    const insert = (id, date, mood) =>
      db.runAsync('INSERT INTO mood_logs VALUES (?, ?, ?, NULL, ?, ?)', [id, date, mood, NOW, NOW]);
    await insert('a', '2026-11-11', 3);
    await expect(insert('b', '2026-11-11', 4)).rejects.toThrow(/UNIQUE/i);
    await expect(insert('c', '2026-11-12', 6)).rejects.toThrow(/CHECK/i);
    await expect(insert('d', '11/12/2026', 3)).rejects.toThrow(/CHECK/i);
  });

  test('water, weight and money reject impossible values', async () => {
    const db = await freshDb();
    await expect(
      db.runAsync('INSERT INTO water_logs VALUES (?, ?, ?, ?, ?)', ['w', '2026-11-11', 0, NOW, NOW]),
    ).rejects.toThrow(/CHECK/i);
    await expect(
      db.runAsync('INSERT INTO weight_entries VALUES (?, ?, ?, NULL, ?, ?)', ['x', '2026-11-11', 5, NOW, NOW]),
    ).rejects.toThrow(/CHECK/i);
    await expect(
      db.runAsync(
        "INSERT INTO transactions VALUES ('t', 'expense', 'Tea', 0, 'cat-food', '2026-11-11', NULL, ?, ?)",
        [NOW, NOW],
      ),
    ).rejects.toThrow(/CHECK/i);
  });

  test('a transaction must reference a real category, and categories in use cannot be deleted', async () => {
    const db = await freshDb();
    await expect(
      db.runAsync(
        "INSERT INTO transactions VALUES ('t', 'expense', 'Tea', 2000, 'nope', '2026-11-11', NULL, ?, ?)",
        [NOW, NOW],
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);

    await db.runAsync(
      "INSERT INTO transactions VALUES ('t', 'expense', 'Tea', 2000, 'cat-food', '2026-11-11', NULL, ?, ?)",
      [NOW, NOW],
    );
    await expect(db.runAsync("DELETE FROM expense_categories WHERE id = 'cat-food'")).rejects.toThrow(
      /FOREIGN KEY/i,
    );
  });

  test('deleting a habit cascades to its schedule and logs; one log per habit per day', async () => {
    const db = await freshDb();
    await db.runAsync(
      "INSERT INTO habits (id, name, start_date, created_at, updated_at) VALUES ('h', 'Walk', '2026-11-01', ?, ?)",
      [NOW, NOW],
    );
    await db.runAsync("INSERT INTO habit_schedule_days VALUES ('h', 1)");
    await db.runAsync("INSERT INTO habit_logs VALUES ('l1', 'h', '2026-11-11', 1, ?, ?)", [NOW, NOW]);
    await expect(
      db.runAsync("INSERT INTO habit_logs VALUES ('l2', 'h', '2026-11-11', 1, ?, ?)", [NOW, NOW]),
    ).rejects.toThrow(/UNIQUE/i);
    await expect(db.runAsync("INSERT INTO habit_schedule_days VALUES ('h', 9)")).rejects.toThrow(/CHECK/i);
    await expect(db.runAsync("INSERT INTO habit_schedule_days VALUES ('ghost', 1)")).rejects.toThrow(/FOREIGN KEY/i);

    await db.runAsync("DELETE FROM habits WHERE id = 'h'");
    expect(await db.getAllAsync('SELECT * FROM habit_schedule_days')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM habit_logs')).toEqual([]);
  });

  test('tasks require a title and a valid priority and due date', async () => {
    const db = await freshDb();
    const insert = (title, due, priority) =>
      db.runAsync(
        'INSERT INTO tasks (id, title, due_date, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [Math.random().toString(), title, due, priority, NOW, NOW],
      );
    await insert('Pay rent', '2026-11-15', 1);
    await insert('No due date', null, 2);
    await expect(insert('   ', null, 2)).rejects.toThrow(/CHECK/i);
    await expect(insert('Bad priority', null, 9)).rejects.toThrow(/CHECK/i);
    await expect(insert('Bad date', 'tomorrow', 2)).rejects.toThrow(/CHECK/i);
  });
});
