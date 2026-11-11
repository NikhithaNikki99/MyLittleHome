import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { CSV_DATASETS, buildAllCsvFiles, buildCsvFile } from '../src/features/export/csvDatasets';
import { addTransaction } from '../src/features/expenses/expenseService';
import { createRecurring } from '../src/features/expenses/recurringService';
import { createHabit, advanceHabit } from '../src/features/habits/habitService';
import { saveReflection } from '../src/features/memories/reflectionService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const TS = '2026-11-11T08:00:00.000Z';
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const dataset = (key) => CSV_DATASETS.find((d) => d.key === key);
// Splits a CSV into rows of cells (handles quoted cells with commas/newlines) so assertions are about content.
function parse(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/^﻿/, '');
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += ch;
  }
  return rows;
}

describe('csv exports from the database', () => {
  test('every dataset produces a file, even when empty, with a header row', async () => {
    const db = await freshDb();
    const files = await buildAllCsvFiles(db);
    expect(files.map((f) => f.fileName)).toEqual([
      'expenses.csv', 'subscriptions.csv', 'diary.csv', 'habit-logs.csv', 'wellness.csv', 'todos.csv', 'monthly-reflections.csv',
    ]);
    for (const f of files) {
      expect(f.rowCount).toBe(0);
      expect(parse(f.text)).toHaveLength(1);
    }
  });

  test('expenses use plain decimal rupees and the category name', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: 'Chai, large', amountPaise: 4550, categoryId: 'cat-food', txnDate: '2026-11-10', notes: 'with "friends"' });
    await addTransaction(db, { kind: 'income', title: 'Gift', amountPaise: 100000, categoryId: 'cat-other', txnDate: '2026-11-09' });
    const rows = parse((await buildCsvFile(db, dataset('expenses'))).text);
    expect(rows[0]).toEqual(['Date', 'Type', 'Title', 'Amount (INR)', 'Category', 'Notes']);
    expect(rows[1]).toEqual(['2026-11-09', 'income', 'Gift', '1000.00', 'Other', '']);
    expect(rows[2]).toEqual(['2026-11-10', 'expense', 'Chai, large', '45.50', 'Food', 'with "friends"']);
  });

  test('user text that looks like a spreadsheet formula is neutralised in every dataset', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: '=HYPERLINK("http://evil","x")', amountPaise: 100, categoryId: 'cat-food', txnDate: TODAY });
    await db.runAsync("INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('e', '@SUM(1)', '+cmd|calc', '2026-11-10', '09:00', ?, ?)", [TS, TS]);
    await db.runAsync("INSERT INTO tasks (id, title, description, created_at, updated_at) VALUES ('t', '-2+3', '=1+1', ?, ?)", [TS, TS]);
    await saveReflection(db, '2026-10', { wentWell: '=bad()' }, { today: TODAY });

    for (const key of ['expenses', 'diary', 'tasks', 'reflections']) {
      const file = await buildCsvFile(db, dataset(key));
      const cells = parse(file.text).slice(1).flat().filter(Boolean);
      for (const cell of cells) expect(/^[=+\-@\t\r]/.test(cell)).toBe(false);
    }
  });

  test('diary rows carry mood label, tags and photo count; multi-line text stays in one cell', async () => {
    const db = await freshDb();
    await db.runAsync("INSERT INTO diary_entries (id, title, content, entry_date, entry_time, mood, is_favorite, created_at, updated_at) VALUES ('e', 'Day out', 'Line one\nLine two', '2026-11-10', '09:30', 4, 1, ?, ?)", [TS, TS]);
    await db.runAsync("INSERT INTO diary_photos (id, entry_id, uri, sort_order, created_at) VALUES ('p', 'e', 'file:///private/x.jpg', 0, ?)", [TS]);
    const tag = await db.getFirstAsync('SELECT id, name FROM diary_tags LIMIT 1');
    await db.runAsync('INSERT INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', ['e', tag.id]);
    const file = await buildCsvFile(db, dataset('diary'));
    const rows = parse(file.text);
    expect(rows[1]).toEqual(['2026-11-10', '09:30', 'Day out', 'Line one\nLine two', 'Good', 'yes', tag.name, '1']);
    expect(file.text).not.toContain('file:///private');
  });

  test('wellness merges mood, water totals per day, weight and sleep in date order', async () => {
    const db = await freshDb();
    await db.runAsync("INSERT INTO mood_logs (id, log_date, mood, created_at, updated_at) VALUES ('m', '2026-11-10', 5, ?, ?)", [TS, TS]);
    await db.runAsync("INSERT INTO water_logs (id, log_date, amount_ml, logged_at, created_at) VALUES ('w1', '2026-11-10', 250, ?, ?), ('w2', '2026-11-10', 500, ?, ?)", [TS, TS, TS, TS]);
    await db.runAsync("INSERT INTO weight_entries (id, entry_date, weight_kg, created_at, updated_at) VALUES ('g', '2026-11-09', 61.4, ?, ?)", [TS, TS]);
    await db.runAsync("INSERT INTO sleep_logs (id, log_date, minutes, created_at, updated_at) VALUES ('s', '2026-11-10', 450, ?, ?)", [TS, TS]);
    const rows = parse((await buildCsvFile(db, dataset('wellness'))).text).slice(1);
    expect(rows).toEqual([
      ['2026-11-09', 'weight_kg', '61.4', ''],
      ['2026-11-10', 'mood', '5 (Great)', ''],
      ['2026-11-10', 'sleep_minutes', '450', ''],
      ['2026-11-10', 'water_ml', '750', ''],
    ]);
  });

  test('habit check-ins, subscriptions and reflections export their readable fields', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Read', startDate: '2026-11-01' });
    const id = (await db.getFirstAsync("SELECT id FROM habits WHERE name = 'Read'")).id;
    await advanceHabit(db, id, '2026-11-10');
    await createRecurring(db, { title: 'Music', amountPaise: 11900, categoryId: 'cat-entertainment', frequency: 'monthly', startDate: '2026-12-01' }, { today: TODAY });
    await saveReflection(db, '2026-10', { wentWell: 'Calm', intention: 'Rest' }, { today: TODAY });

    expect(parse((await buildCsvFile(db, dataset('habits'))).text)[1]).toEqual(['2026-11-10', 'Read', '1', '1']);
    expect(parse((await buildCsvFile(db, dataset('subscriptions'))).text)[1]).toEqual(['Music', '119.00', 'Entertainment', 'monthly', '2026-12-01', '', 'active', '']);
    expect(parse((await buildCsvFile(db, dataset('reflections'))).text)[1]).toEqual(['2026-10', 'Calm', '', '', 'Rest']);
  });
});

describe('what the exports must never contain', () => {
  test('no export includes app lock, PIN, reminder or settings data', async () => {
    const db = await freshDb();
    for (const [key, value] of [
      ['app_lock_enabled', 'true'], ['app_lock_biometrics', 'true'], ['reminder_diary', '{"hour":9}'],
      ['profile_name', 'Asha'], ['theme_id', 'pinkDiary'],
    ]) {
      await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, TS]);
    }
    await addTransaction(db, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: TODAY });
    const everything = (await buildAllCsvFiles(db)).map((f) => f.text).join('\n').toLowerCase();
    for (const forbidden of ['app_lock', 'pin', 'biometric', 'reminder', 'secure', 'asha', 'pinkdiary', 'theme_id']) {
      // "pin" must not appear as a word or key; the data above contains none of them.
      if (forbidden === 'pin') expect(everything).not.toMatch(/\bpin\b|pin_record/);
      else expect(everything).not.toContain(forbidden);
    }
  });

  test('no dataset reads from app_settings or any lock table', () => {
    for (const d of CSV_DATASETS) {
      expect(d.sql.toLowerCase()).not.toContain('app_settings');
      expect(d.sql.toLowerCase()).not.toMatch(/pin|lock|secure/);
    }
  });

  test('exports use internal ids nowhere: no uuid-looking value is written', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: TODAY });
    await createHabit(db, { name: 'Read', startDate: '2026-11-01' });
    const text = (await buildAllCsvFiles(db)).map((f) => f.text).join('\n');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
