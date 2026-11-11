import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { esc, reportFileName } from '../src/features/export/reportHtml';
import { buildMonthlyReport } from '../src/features/export/reportService';
import { addTransaction } from '../src/features/expenses/expenseService';
import { saveReflection } from '../src/features/memories/reflectionService';
import { formatMonthKey } from '../src/utils/dates';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const TS = '2026-11-11T08:00:00.000Z';
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('escaping', () => {
  test('markup characters become text', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('"quoted" & \'single\'')).toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(42)).toBe('42');
  });

  test('ampersands are escaped first so entities are not double-decoded', () => {
    expect(esc('&lt;')).toBe('&amp;lt;');
  });
});

describe('the monthly report', () => {
  test('shows the month, totals, categories, mood and the reflection', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: 'Tea', amountPaise: 4550, categoryId: 'cat-food', txnDate: '2026-11-03' });
    await addTransaction(db, { title: 'Bus', amountPaise: 3000, categoryId: 'cat-travel', txnDate: '2026-11-04' });
    await addTransaction(db, { kind: 'income', title: 'Gift', amountPaise: 100000, categoryId: 'cat-other', txnDate: '2026-11-05' });
    await db.runAsync("INSERT INTO mood_logs (id, log_date, mood, created_at, updated_at) VALUES ('m', '2026-11-02', 4, ?, ?)", [TS, TS]);
    await db.runAsync("INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('e', 'A good day', 'x', '2026-11-02', '10:00', ?, ?)", [TS, TS]);
    await saveReflection(db, '2026-11', { wentWell: 'Slow mornings\nand tea', intention: 'Rest' }, { today: TODAY });

    const html = await buildMonthlyReport(db, '2026-11', { today: TODAY });
    expect(html).toContain(formatMonthKey('2026-11'));
    expect(html).toContain('₹75.50'); // 45.50 + 30
    expect(html).toContain('₹1,000');
    expect(html).toContain('Food');
    expect(html).toContain('Travel');
    expect(html).toContain('Good');
    expect(html).toContain('A good day');
    expect(html).toContain('Slow mornings<br>and tea');
    expect(html).toContain('An intention for next month');
    expect(html).toContain('Made on 2026-11-11');
  });

  test('a quiet month still produces a readable report', async () => {
    const db = await freshDb();
    const html = await buildMonthlyReport(db, '2026-09', { today: TODAY });
    expect(html).toContain(formatMonthKey('2026-09'));
    expect(html).toContain('No spending this month.');
    expect(html).toContain('No mood check-ins this month.');
    expect(html).not.toContain('Your reflection');
    expect(html).not.toContain('Diary entries</h2>');
  });

  test('user text with markup is shown as text and never becomes tags', async () => {
    const db = await freshDb();
    const evil = '<img src=x onerror=alert(1)>';
    await db.runAsync("INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('e', ?, 'x', '2026-11-02', '10:00', ?, ?)", [evil, TS, TS]);
    await db.runAsync("INSERT INTO expense_categories (id, name, icon, is_default, sort_order, created_at) VALUES ('c-evil', ?, 'x', 0, 99, ?)", ['<b>Cat</b>', TS]);
    await addTransaction(db, { title: 'Thing', amountPaise: 100, categoryId: 'c-evil', txnDate: '2026-11-02' });
    await saveReflection(db, '2026-11', { wentWell: '<script>steal()</script>', wasHard: '"><svg onload=1>' }, { today: TODAY });

    const html = await buildMonthlyReport(db, '2026-11', { today: TODAY });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<b>Cat');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
  });

  test('the page forbids scripts and network access', async () => {
    const db = await freshDb();
    const html = await buildMonthlyReport(db, '2026-11', { today: TODAY });
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html.toLowerCase()).not.toMatch(/<script|<link|<iframe|<object|<embed|src="http|href="http/);
  });

  test('the report never includes lock, PIN or settings data', async () => {
    const db = await freshDb();
    for (const [key, value] of [['app_lock_enabled', 'true'], ['profile_name', 'Asha'], ['theme_id', 'pinkDiary']]) {
      await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, TS]);
    }
    const html = (await buildMonthlyReport(db, '2026-11', { today: TODAY })).toLowerCase();
    for (const word of ['app_lock', 'biometric', 'asha', 'pinkdiary', 'secure']) expect(html).not.toContain(word);
    expect(html).not.toMatch(/\bpin\b/);
  });

  test('a very long list of entries is capped', async () => {
    const db = await freshDb();
    for (let i = 0; i < 230; i += 1) {
      await db.runAsync("INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES (?, ?, 'x', '2026-11-02', '10:00', ?, ?)", [`e${i}`, `T${i}`, TS, TS]);
    }
    const html = await buildMonthlyReport(db, '2026-11', { today: TODAY });
    expect((html.match(/<tr><td style="white-space:nowrap">/g) ?? []).length).toBe(200);
  });

  test('a bad month is refused', async () => {
    const db = await freshDb();
    await expect(buildMonthlyReport(db, '2026-13')).rejects.toThrow('month is not valid');
    await expect(buildMonthlyReport(db, 'nope')).rejects.toThrow('month is not valid');
  });

  test('file name', () => {
    expect(reportFileName('2026-11')).toBe('my-little-world-2026-11.pdf');
  });
});
