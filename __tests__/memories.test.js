import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import {
  averageWaterMl,
  describeWeightChange,
  getMonthRecap,
  getTimeline,
  groupByMonth,
} from '../src/features/memories/memoriesService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const NOW = '2026-11-11T08:00:00.000Z';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

async function entry(db, id, date, { title = null, content = 'text', time = '09:00', mood = null, fav = 0 } = {}) {
  await db.runAsync(
    `INSERT INTO diary_entries (id, title, content, entry_date, entry_time, mood, is_favorite, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, title, content, date, time, mood, fav, NOW, NOW],
  );
}

async function photo(db, id, entryId, order = 0) {
  await db.runAsync(
    'INSERT INTO diary_photos (id, entry_id, uri, sort_order, created_at) VALUES (?,?,?,?,?)',
    [id, entryId, `file:///photos/${id}.jpg`, order, NOW],
  );
}

describe('timeline', () => {
  test('an empty database gives an empty timeline', async () => {
    const db = await freshDb();
    expect(await getTimeline(db, '2026-11-11')).toEqual({ groups: [], onThisDay: [], total: 0 });
  });

  test('groups entries by month, newest first, with ordered photos', async () => {
    const db = await freshDb();
    await entry(db, 'a', '2026-11-10', { title: 'Nov late', time: '20:00' });
    await entry(db, 'b', '2026-11-02', { content: 'Nov early' });
    await entry(db, 'c', '2026-10-30', { content: 'Oct' });
    await photo(db, 'p2', 'a', 1);
    await photo(db, 'p1', 'a', 0);

    const t = await getTimeline(db, '2026-11-11');
    expect(t.total).toBe(3);
    expect(t.groups.map((g) => [g.monthKey, g.entries.map((e) => e.id)])).toEqual([
      ['2026-11', ['a', 'b']],
      ['2026-10', ['c']],
    ]);
    expect(t.groups[0].entries[0].photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(t.groups[0].entries[0].title).toBe('Nov late');
    expect(t.groups[0].entries[1].title).toBeNull();
  });

  test('long content is shortened to a one-line preview', async () => {
    const db = await freshDb();
    await entry(db, 'a', '2026-11-10', { content: `${'word '.repeat(80)}` });
    const [e] = (await getTimeline(db, '2026-11-11')).groups[0].entries;
    expect(e.preview.length).toBeLessThanOrEqual(121);
    expect(e.preview.endsWith('…')).toBe(true);
  });

  test('"on this day" shows only earlier years on the same month and day', async () => {
    const db = await freshDb();
    await entry(db, 'last-year', '2025-11-11', { content: 'a year ago' });
    await entry(db, 'two-years', '2024-11-11', { content: 'two years ago' });
    await entry(db, 'today', '2026-11-11', { content: 'today' });
    await entry(db, 'other-day', '2025-11-12', { content: 'not this day' });
    await entry(db, 'future', '2027-11-11', { content: 'later year' });

    const t = await getTimeline(db, '2026-11-11');
    expect(t.onThisDay.map((e) => e.id)).toEqual(['last-year', 'two-years']);
  });

  test('groupByMonth keeps order and handles empty input', () => {
    expect(groupByMonth([])).toEqual([]);
    const groups = groupByMonth([{ date: '2026-02-03' }, { date: '2026-02-01' }, { date: '2026-01-31' }]);
    expect(groups.map((g) => [g.monthKey, g.entries.length])).toEqual([
      ['2026-02', 2],
      ['2026-01', 1],
    ]);
  });
});

describe('month recap', () => {
  test('an empty month is flagged empty with zeros', async () => {
    const db = await freshDb();
    const r = await getMonthRecap(db, '2026-11');
    expect(r.isEmpty).toBe(true);
    expect(r).toMatchObject({
      entryCount: 0, moodTotal: 0, spentPaise: 0, habitCompletions: 0, avgWaterMl: 0, weightNote: null, moment: null,
    });
  });

  test('aggregates the month and ignores neighbouring months', async () => {
    const db = await freshDb();
    // Inside November 2026.
    await entry(db, 'e1', '2026-11-01', { title: 'First' });
    await entry(db, 'e2', '2026-11-30', { title: 'Last' });
    // Outside: boundaries on either side.
    await entry(db, 'out1', '2026-10-31');
    await entry(db, 'out2', '2026-12-01');

    for (const [id, date, mood] of [['m1', '2026-11-02', 4], ['m2', '2026-11-03', 4], ['m3', '2026-11-04', 2], ['mo', '2026-10-31', 5]]) {
      await db.runAsync('INSERT INTO mood_logs (id, log_date, mood, created_at, updated_at) VALUES (?,?,?,?,?)', [id, date, mood, NOW, NOW]);
    }

    for (const [id, kind, amount, date] of [
      ['t1', 'expense', 12000, '2026-11-05'],
      ['t2', 'expense', 3050, '2026-11-30'],
      ['t3', 'income', 99900, '2026-11-06'],
      ['t4', 'expense', 7777, '2026-12-01'],
    ]) {
      await db.runAsync(
        `INSERT INTO transactions (id, kind, title, amount_paise, category_id, txn_date, created_at, updated_at)
         VALUES (?,?,'x',?, 'cat-food', ?, ?, ?)`,
        [id, kind, amount, date, NOW, NOW],
      );
    }

    await db.runAsync("INSERT INTO habits (id, name, target_count, start_date, created_at, updated_at) VALUES ('h1','Read',2,'2026-11-01',?,?)", [NOW, NOW]);
    // Reached target (2/2), below target (1/2), reached target but next month.
    for (const [id, date, count] of [['l1', '2026-11-05', 2], ['l2', '2026-11-06', 1], ['l3', '2026-12-02', 2]]) {
      await db.runAsync('INSERT INTO habit_logs (id, habit_id, log_date, count, created_at, updated_at) VALUES (?,?,?,?,?,?)', [id, 'h1', date, count, NOW, NOW]);
    }

    for (const [id, date, ml] of [['w1', '2026-11-05', 500], ['w2', '2026-11-05', 1500], ['w3', '2026-11-06', 1000], ['wo', '2026-12-01', 4000]]) {
      await db.runAsync('INSERT INTO water_logs (id, log_date, amount_ml, logged_at, created_at) VALUES (?,?,?,?,?)', [id, date, ml, NOW, NOW]);
    }

    for (const [id, date, kg] of [['k1', '2026-11-02', 62.4], ['k2', '2026-11-28', 61.2], ['ko', '2026-10-30', 70]]) {
      await db.runAsync('INSERT INTO weight_entries (id, entry_date, weight_kg, created_at, updated_at) VALUES (?,?,?,?,?)', [id, date, kg, NOW, NOW]);
    }

    const r = await getMonthRecap(db, '2026-11');
    expect(r.isEmpty).toBe(false);
    expect(r.entryCount).toBe(2);
    expect(r.moodCounts).toEqual({ 1: 0, 2: 1, 3: 0, 4: 2, 5: 0 });
    expect(r.moodTotal).toBe(3);
    expect(r.spentPaise).toBe(15050);
    expect(r.spendCount).toBe(2);
    expect(r.habitCompletions).toBe(1);
    expect(r.avgWaterMl).toBe(1500);
    expect(r.waterDays).toBe(2);
    expect(r.weightNote).toBe('Weight down 1.2 kg across the month');
  });

  test('December rolls over into January correctly', async () => {
    const db = await freshDb();
    await entry(db, 'dec', '2026-12-31');
    await entry(db, 'jan', '2027-01-01');
    expect((await getMonthRecap(db, '2026-12')).entryCount).toBe(1);
    expect((await getMonthRecap(db, '2027-01')).entryCount).toBe(1);
  });

  test('the moment prefers a favourite, otherwise the newest entry, and carries its photos', async () => {
    const db = await freshDb();
    await entry(db, 'old-fav', '2026-11-03', { title: 'Favourite', fav: 1 });
    await entry(db, 'newest', '2026-11-20', { title: 'Newest' });
    await photo(db, 'pf', 'old-fav');
    expect((await getMonthRecap(db, '2026-11')).moment).toMatchObject({
      id: 'old-fav',
      favorite: true,
      photos: [{ id: 'pf', uri: 'file:///photos/pf.jpg' }],
    });

    const db2 = await freshDb();
    await entry(db2, 'a', '2026-11-03');
    await entry(db2, 'b', '2026-11-20');
    expect((await getMonthRecap(db2, '2026-11')).moment.id).toBe('b');
  });
});

describe('recap wording helpers', () => {
  test('weight change is described neutrally', () => {
    const a = { entry_date: '2026-11-02', weight_kg: 60 };
    expect(describeWeightChange(a, { entry_date: '2026-11-20', weight_kg: 61.5 })).toBe('Weight up 1.5 kg across the month');
    expect(describeWeightChange(a, { entry_date: '2026-11-20', weight_kg: 60 })).toBe('Weight stayed about the same');
    expect(describeWeightChange(a, a)).toBeNull();
    expect(describeWeightChange(null, null)).toBeNull();
  });

  test('average water ignores days with no logs', () => {
    expect(averageWaterMl(3000, 2)).toBe(1500);
    expect(averageWaterMl(0, 0)).toBe(0);
  });
});
