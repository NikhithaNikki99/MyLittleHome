import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { readAllTables, replaceAllTables } from '../src/database/repositories/backupRepository';
import { getMonthRecap } from '../src/features/memories/memoriesService';
import { MAX_REFLECTION_LENGTH, REFLECTION_FIELDS } from '../src/features/memories/reflectionOptions';
import { deleteReflection, getReflection, saveReflection } from '../src/features/memories/reflectionService';
import { buildBackupDocument, summarizeCounts, validateBackupText } from '../src/features/settings/backupFormat';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const TODAY = '2026-11-11';
const opts = { today: TODAY };

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const count = async (db) => (await db.getFirstAsync('SELECT COUNT(*) AS n FROM monthly_reflections')).n;

describe('migration 012', () => {
  // `well` defaults to 'Good' only when it is not passed at all, so an explicit null really inserts null.
  const insert = (db, over = {}) =>
    db.runAsync(
      `INSERT INTO monthly_reflections (id, month_key, went_well, was_hard, grateful_for, intention, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'n', 'n')`,
      [
        over.id ?? 'r1',
        over.month ?? '2026-10',
        'well' in over ? over.well : 'Good',
        over.hard ?? null,
        over.grateful ?? null,
        over.intention ?? null,
      ],
    );

  test('creates the table and enforces its rules', async () => {
    const db = await freshDb();
    await insert(db);
    await expect(insert(db, { id: 'r2' })).rejects.toThrow(); // one per month
    await expect(insert(db, { id: 'r3', month: '2026-13' })).rejects.toThrow();
    await expect(insert(db, { id: 'r4', month: '2026-00' })).rejects.toThrow();
    await expect(insert(db, { id: 'r5', month: '26-10' })).rejects.toThrow();
    await expect(insert(db, { id: 'r6', month: '2026-09', well: null })).rejects.toThrow(); // all empty
    await expect(insert(db, { id: 'r7', month: '2026-08', well: '   ' })).rejects.toThrow(); // whitespace only
    await expect(insert(db, { id: 'r8', month: '2026-07', well: 'x'.repeat(2001) })).rejects.toThrow();
    await insert(db, { id: 'r9', month: '2026-06', well: null, intention: 'Rest more' });
    expect(await count(db)).toBe(2);
  });

  test('an upgrade from schema 11 keeps existing data and adds an empty table', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations.slice(0, 11));
    await db.runAsync("INSERT INTO mood_logs (id, log_date, mood, created_at, updated_at) VALUES ('m', '2026-11-01', 4, 'n', 'n')");
    const applied = await runMigrations(db, migrations);
    expect(applied[0]).toBe(12);
    expect((await db.getAllAsync('SELECT * FROM mood_logs')).length).toBe(1);
    expect(await count(db)).toBe(0);
  });

  test('a reflection does not depend on any other table', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'A calm month' }, opts);
    await db.runAsync('DELETE FROM diary_entries');
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM habits');
    expect(await count(db)).toBe(1);
  });
});

describe('saving a reflection', () => {
  test('saves the four prompts and reads them back', async () => {
    const db = await freshDb();
    await saveReflection(
      db,
      '2026-10',
      { wentWell: 'Long walks', wasHard: 'Tiredness', gratefulFor: 'Family', intention: 'Sleep earlier' },
      opts,
    );
    expect(await getReflection(db, '2026-10')).toMatchObject({
      monthKey: '2026-10',
      wentWell: 'Long walks',
      wasHard: 'Tiredness',
      gratefulFor: 'Family',
      intention: 'Sleep earlier',
    });
  });

  test('trims text and stores empty boxes as nothing', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: '  Good days  ', wasHard: '   ', gratefulFor: '', intention: undefined }, opts);
    expect(await getReflection(db, '2026-10')).toMatchObject({ wentWell: 'Good days', wasHard: null, gratefulFor: null, intention: null });
  });

  test('one word in any single box is enough', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { intention: 'Rest' }, opts);
    expect((await getReflection(db, '2026-10')).intention).toBe('Rest');
  });

  test('writing again replaces the text and keeps the original id and created date', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'First draft', wasHard: 'Something' }, opts);
    const before = await db.getFirstAsync('SELECT id, created_at FROM monthly_reflections');
    await saveReflection(db, '2026-10', { wentWell: 'Second thoughts' }, opts);
    const after = await db.getFirstAsync('SELECT id, created_at, went_well, was_hard FROM monthly_reflections');
    expect(await count(db)).toBe(1);
    expect(after).toMatchObject({ id: before.id, created_at: before.created_at, went_well: 'Second thoughts', was_hard: null });
  });

  test('each month has its own reflection', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-09', { wentWell: 'September' }, opts);
    await saveReflection(db, '2026-10', { wentWell: 'October' }, opts);
    expect((await getReflection(db, '2026-09')).wentWell).toBe('September');
    expect((await getReflection(db, '2026-10')).wentWell).toBe('October');
  });

  test('the current month can be reflected on, a future month cannot', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-11', { wentWell: 'So far so good' }, opts);
    await expect(saveReflection(db, '2026-12', { wentWell: 'Early' }, opts)).rejects.toThrow('once it has begun');
    expect(await getReflection(db, '2026-12')).toBeNull();
  });

  test('rejects bad input with readable messages and writes nothing', async () => {
    const db = await freshDb();
    await expect(saveReflection(db, '2026-10', {}, opts)).rejects.toThrow('at least one box');
    await expect(saveReflection(db, '2026-10', { wentWell: '   ' }, opts)).rejects.toThrow('at least one box');
    await expect(saveReflection(db, '2026-10', undefined, opts)).rejects.toThrow('at least one box');
    await expect(saveReflection(db, '2026-10', { wentWell: 42 }, opts)).rejects.toThrow('not valid');
    await expect(saveReflection(db, '2026-10', { wasHard: 'x'.repeat(MAX_REFLECTION_LENGTH + 1) }, opts)).rejects.toThrow('What was hard');
    await expect(saveReflection(db, '2026-1', { wentWell: 'x' }, opts)).rejects.toThrow('month is not valid');
    await expect(saveReflection(db, '2026-13', { wentWell: 'x' }, opts)).rejects.toThrow('month is not valid');
    await expect(saveReflection(db, null, { wentWell: 'x' }, opts)).rejects.toThrow('month is not valid');
    expect(await count(db)).toBe(0);
  });

  test('text exactly at the limit is accepted', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'a'.repeat(MAX_REFLECTION_LENGTH) }, opts);
    expect((await getReflection(db, '2026-10')).wentWell).toHaveLength(MAX_REFLECTION_LENGTH);
  });

  test('a failed edit leaves the saved reflection as it was', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'Keep this' }, opts);
    await expect(saveReflection(db, '2026-10', { wentWell: '', wasHard: '' }, opts)).rejects.toThrow();
    expect((await getReflection(db, '2026-10')).wentWell).toBe('Keep this');
  });

  test('prompts are open and gentle', () => {
    expect(REFLECTION_FIELDS.map((f) => f.key)).toEqual(['wentWell', 'wasHard', 'gratefulFor', 'intention']);
    const text = REFLECTION_FIELDS.map((f) => `${f.label} ${f.placeholder}`).join(' ').toLowerCase();
    for (const word of ['fail', 'should', 'must', 'wasted', 'lazy', 'bad']) expect(text).not.toContain(word);
  });
});

describe('deleting a reflection', () => {
  test('removes it, and a second delete says there is nothing to delete', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'x' }, opts);
    await deleteReflection(db, '2026-10');
    expect(await getReflection(db, '2026-10')).toBeNull();
    await expect(deleteReflection(db, '2026-10')).rejects.toThrow('no reflection');
  });

  test('deleting one month leaves the others', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-09', { wentWell: 'a' }, opts);
    await saveReflection(db, '2026-10', { wentWell: 'b' }, opts);
    await deleteReflection(db, '2026-09');
    expect(await getReflection(db, '2026-10')).not.toBeNull();
  });
});

describe('in the monthly recap', () => {
  test('the recap carries the reflection for that month only', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'October words' }, opts);
    const october = await getMonthRecap(db, '2026-10');
    const september = await getMonthRecap(db, '2026-09');
    expect(october.reflection).toMatchObject({ wentWell: 'October words' });
    expect(september.reflection).toBeNull();
  });

  test('a reflection does not change what counts as a quiet month', async () => {
    const db = await freshDb();
    await saveReflection(db, '2026-10', { wentWell: 'Quiet but fine' }, opts);
    const recap = await getMonthRecap(db, '2026-10');
    expect(recap.isEmpty).toBe(true);
    expect(recap.reflection.wentWell).toBe('Quiet but fine');
  });
});

describe('backup and restore', () => {
  const NOW = '2026-11-11T10:00:00.000Z';
  const roundTrip = async (source) => {
    const tables = await readAllTables(source);
    const doc = buildBackupDocument({ tables, schemaVersion: migrations.length, appVersion: '1.0.0', exportedAt: NOW });
    return validateBackupText(JSON.stringify(doc), { currentSchemaVersion: migrations.length });
  };

  test('reflections survive a backup and restore', async () => {
    const source = await freshDb();
    await saveReflection(source, '2026-09', { wentWell: 'a', intention: 'b' }, opts);
    await saveReflection(source, '2026-10', { wasHard: 'c' }, opts);
    const { doc, counts } = await roundTrip(source);
    expect(counts.monthly_reflections).toBe(2);
    expect(summarizeCounts(counts)).toContain('2 monthly reflections');

    const target = await freshDb();
    await replaceAllTables(target, doc);
    expect(await getReflection(target, '2026-09')).toMatchObject({ wentWell: 'a', intention: 'b' });
    expect(await getReflection(target, '2026-10')).toMatchObject({ wasHard: 'c', wentWell: null });
  });

  test('restoring replaces reflections already on the phone', async () => {
    const source = await freshDb();
    await saveReflection(source, '2026-10', { wentWell: 'From the backup' }, opts);
    const { doc } = await roundTrip(source);

    const target = await freshDb();
    await saveReflection(target, '2026-10', { wentWell: 'Local words' }, opts);
    await saveReflection(target, '2026-08', { wentWell: 'Only here' }, opts);
    await replaceAllTables(target, doc);
    expect((await getReflection(target, '2026-10')).wentWell).toBe('From the backup');
    expect(await getReflection(target, '2026-08')).toBeNull();
  });

  test('a backup made before reflections existed clears stale reflections when it replaces the diary', async () => {
    const source = await freshDb();
    const { doc } = await roundTrip(source);
    delete doc.tables.monthly_reflections;
    const older = validateBackupText(JSON.stringify(doc), { currentSchemaVersion: migrations.length }).doc;

    const target = await freshDb();
    await saveReflection(target, '2026-10', { wentWell: 'Local words' }, opts);
    await replaceAllTables(target, older);
    expect(await count(target)).toBe(0);
  });

  test('a corrupt reflection in a backup is rejected and nothing changes', async () => {
    const source = await freshDb();
    await saveReflection(source, '2026-10', { wentWell: 'x' }, opts);
    const { doc } = await roundTrip(source);
    doc.tables.monthly_reflections[0].went_well = null;

    const target = await freshDb();
    await saveReflection(target, '2026-09', { wentWell: 'Keep me' }, opts);
    await expect(replaceAllTables(target, doc)).rejects.toThrow();
    expect((await getReflection(target, '2026-09')).wentWell).toBe('Keep me');
    expect(await count(target)).toBe(1);
  });
});
