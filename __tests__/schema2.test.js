import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { setSetting, getSetting } from '../src/database/repositories/settingsRepository';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const NOW = '2026-11-11T08:00:00.000Z';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

test('upgrades from an installed schema v5 (the Milestone 2 build) keeping all data', async () => {
  const db = createTestDatabase();
  await runMigrations(db, migrations.slice(0, 5));
  await setSetting(db, 'theme_id', 'pinkDiary');
  await db.runAsync(
    "INSERT INTO transactions VALUES ('t', 'expense', 'Tea', 2000, 'cat-food', '2026-11-11', NULL, ?, ?)",
    [NOW, NOW],
  );

  const applied = await runMigrations(db, migrations);

  expect(applied).toEqual(migrations.slice(5).map((m) => m.version));
  expect(applied[0]).toBe(6);
  expect(await getSetting(db, 'theme_id')).toBe('pinkDiary');
  expect((await db.getAllAsync('SELECT * FROM transactions')).length).toBe(1);
  expect((await db.getFirstAsync('PRAGMA user_version')).user_version).toBe(migrations.length);
});

describe('diary', () => {
  const entry = (db, over = {}) =>
    db.runAsync(
      `INSERT INTO diary_entries (id, title, content, entry_date, entry_time, mood, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [over.id ?? 'e1', over.title ?? null, over.content ?? 'Hello', over.date ?? '2026-11-11', over.time ?? '09:30', over.mood ?? null, NOW, NOW],
    );

  test('seeds the four design tags', async () => {
    const db = await freshDb();
    const names = (await db.getAllAsync('SELECT name FROM diary_tags ORDER BY name')).map((r) => r.name);
    expect(names).toEqual(['Gratitude', 'Health', 'Life', 'Work']);
  });

  test('an entry needs a title or content, valid date/time, and mood 1-5', async () => {
    const db = await freshDb();
    await entry(db, { id: 'a', title: 'Only a title', content: '' });
    await entry(db, { id: 'b', title: null, content: 'Only content' });
    await expect(entry(db, { id: 'c', title: '  ', content: '   ' })).rejects.toThrow(/CHECK/i);
    await expect(entry(db, { id: 'd', date: '11-11-2026' })).rejects.toThrow(/CHECK/i);
    await expect(entry(db, { id: 'e', time: '25:00' })).rejects.toThrow(/CHECK/i);
    await expect(entry(db, { id: 'f', mood: 9 })).rejects.toThrow(/CHECK/i);
  });

  test('tag names are unique ignoring case, and deleting an entry removes photos and tag links but not tags', async () => {
    const db = await freshDb();
    await expect(
      db.runAsync("INSERT INTO diary_tags VALUES ('x', 'LIFE', ?)", [NOW]),
    ).rejects.toThrow(/UNIQUE/i);

    await entry(db);
    await db.runAsync("INSERT INTO diary_photos (id, entry_id, uri, created_at) VALUES ('p1', 'e1', 'file:///a.jpg', ?)", [NOW]);
    await db.runAsync("INSERT INTO entry_tags VALUES ('e1', 'tag-life')");
    await expect(db.runAsync("INSERT INTO entry_tags VALUES ('e1', 'tag-life')")).rejects.toThrow(/UNIQUE|PRIMARY/i);
    await expect(db.runAsync("INSERT INTO entry_tags VALUES ('e1', 'ghost')")).rejects.toThrow(/FOREIGN KEY/i);

    await db.runAsync("DELETE FROM diary_entries WHERE id = 'e1'");
    expect(await db.getAllAsync('SELECT * FROM diary_photos')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM entry_tags')).toEqual([]);
    expect((await db.getAllAsync('SELECT * FROM diary_tags')).length).toBe(4);
  });
});

describe('budgets', () => {
  const budget = (db, id, month, categoryId, limit) =>
    db.runAsync('INSERT INTO budgets VALUES (?, ?, ?, ?, ?, ?)', [id, month, categoryId, limit, NOW, NOW]);

  test('allows one overall budget per month and one per category per month', async () => {
    const db = await freshDb();
    await budget(db, 'b1', '2026-11', null, 1000000);
    await budget(db, 'b2', '2026-12', null, 1000000);
    await budget(db, 'b3', '2026-11', 'cat-food', 300000);
    await budget(db, 'b4', '2026-11', 'cat-travel', 100000);

    await expect(budget(db, 'b5', '2026-11', null, 5)).rejects.toThrow(/UNIQUE/i);
    await expect(budget(db, 'b6', '2026-11', 'cat-food', 5)).rejects.toThrow(/UNIQUE/i);
  });

  test('rejects zero limits, malformed months and unknown categories', async () => {
    const db = await freshDb();
    await expect(budget(db, 'x', '2026-11', null, 0)).rejects.toThrow(/CHECK/i);
    await expect(budget(db, 'x', '2026-1', null, 100)).rejects.toThrow(/CHECK/i);
    await expect(budget(db, 'x', '2026-11', 'nope', 100)).rejects.toThrow(/FOREIGN KEY/i);
  });
});

describe('savings', () => {
  test('saved amount is the sum of contributions; deleting a goal removes its contributions', async () => {
    const db = await freshDb();
    await db.runAsync("INSERT INTO savings_goals VALUES ('g', 'Trip', 5000000, '2027-03-01', 0, ?, ?)", [NOW, NOW]);
    await db.runAsync("INSERT INTO savings_contributions VALUES ('c1', 'g', 100000, '2026-11-01', NULL, ?)", [NOW]);
    await db.runAsync("INSERT INTO savings_contributions VALUES ('c2', 'g', 250050, '2026-11-08', 'bonus', ?)", [NOW]);

    const row = await db.getFirstAsync('SELECT SUM(amount_paise) AS saved FROM savings_contributions WHERE goal_id = ?', ['g']);
    expect(row.saved).toBe(350050);

    await expect(
      db.runAsync("INSERT INTO savings_contributions VALUES ('c3', 'g', -5, '2026-11-09', NULL, ?)", [NOW]),
    ).rejects.toThrow(/CHECK/i);
    await expect(
      db.runAsync("INSERT INTO savings_contributions VALUES ('c4', 'ghost', 5, '2026-11-09', NULL, ?)", [NOW]),
    ).rejects.toThrow(/FOREIGN KEY/i);

    await db.runAsync("DELETE FROM savings_goals WHERE id = 'g'");
    expect(await db.getAllAsync('SELECT * FROM savings_contributions')).toEqual([]);
  });
});

describe('sleep and goals', () => {
  test('sleep: one row per date, minutes within a day, quality 1-5', async () => {
    const db = await freshDb();
    const sleep = (id, date, minutes, quality = null) =>
      db.runAsync('INSERT INTO sleep_logs VALUES (?, ?, ?, ?, NULL, ?, ?)', [id, date, minutes, quality, NOW, NOW]);
    await sleep('a', '2026-11-11', 450, 4);
    await expect(sleep('b', '2026-11-11', 400)).rejects.toThrow(/UNIQUE/i);
    await expect(sleep('c', '2026-11-12', 0)).rejects.toThrow(/CHECK/i);
    await expect(sleep('d', '2026-11-12', 1441)).rejects.toThrow(/CHECK/i);
    await expect(sleep('e', '2026-11-12', 400, 6)).rejects.toThrow(/CHECK/i);
  });

  test('goals: milestones cascade with their goal; titles required', async () => {
    const db = await freshDb();
    await db.runAsync("INSERT INTO goals VALUES ('g', 'Run 5k', NULL, '2027-01-01', NULL, ?, ?)", [NOW, NOW]);
    await db.runAsync("INSERT INTO goal_milestones VALUES ('m1', 'g', 'Run 1k', 0, NULL, ?)", [NOW]);
    await expect(db.runAsync("INSERT INTO goals VALUES ('x', '  ', NULL, NULL, NULL, ?, ?)", [NOW, NOW])).rejects.toThrow(/CHECK/i);
    await expect(db.runAsync("INSERT INTO goal_milestones VALUES ('m2', 'ghost', 'x', 0, NULL, ?)", [NOW])).rejects.toThrow(/FOREIGN KEY/i);

    await db.runAsync("DELETE FROM goals WHERE id = 'g'");
    expect(await db.getAllAsync('SELECT * FROM goal_milestones')).toEqual([]);
  });
});
