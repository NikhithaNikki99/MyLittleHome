import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import {
  blankEntry,
  buildTime,
  cleanTagName,
  displayTitle,
  escapeLike,
  formatTime12,
  isValidTime,
  normalizeEntryInput,
  splitTime,
  splitTitle,
} from '../src/features/diary/diaryLogic';
import {
  createEntry,
  deleteEntry,
  getEntry,
  getMonthMarks,
  listEntries,
  listTags,
  setFavorite,
  updateEntry,
} from '../src/features/diary/diaryService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

// In-memory stand-in for the on-device photo store.
function fakeFiles({ failImportAt = null } = {}) {
  const stored = new Set();
  let imports = 0;
  return {
    stored,
    async importPhoto(uri) {
      imports += 1;
      if (failImportAt !== null && imports === failImportAt) throw new Error('disk full');
      const target = `private://${uri.split('/').pop()}`;
      stored.add(target);
      return target;
    },
    async removePhoto(uri) {
      stored.delete(uri);
    },
  };
}

const base = (over = {}) => ({
  title: 'A good day',
  content: 'Walked by the lake.',
  entryDate: '2026-11-11',
  entryTime: '09:30',
  ...over,
});

describe('input validation', () => {
  test('needs a title or some content', () => {
    expect(() => normalizeEntryInput(base({ title: '  ', content: '   ' }))).toThrow(/title or a few words/);
    expect(normalizeEntryInput(base({ title: '', content: 'Just words' })).title).toBeNull();
    expect(normalizeEntryInput(base({ title: 'Just a title', content: '' })).content).toBe('');
  });

  test('time is 24-hour HH:MM with hour <= 23', () => {
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
    expect(() => normalizeEntryInput(base({ entryTime: '25:00' }))).toThrow(/time is not valid/);
  });

  test('date must be a real local date', () => {
    expect(() => normalizeEntryInput(base({ entryDate: '2026-02-30' }))).toThrow(/date is not valid/);
    expect(() => normalizeEntryInput(base({ entryDate: '11-11-2026' }))).toThrow(/date is not valid/);
  });

  test('mood is null or an integer 1-5', () => {
    expect(normalizeEntryInput(base({ mood: null })).mood).toBeNull();
    expect(normalizeEntryInput(base({ mood: 5 })).mood).toBe(5);
    for (const bad of [0, 6, 2.5, '3']) {
      expect(() => normalizeEntryInput(base({ mood: bad }))).toThrow(/mood/);
    }
  });

  test('allows at most six photos', () => {
    const photos = Array.from({ length: 7 }, (_, i) => ({ uri: `file:///p${i}.jpg` }));
    expect(() => normalizeEntryInput(base({ photos }))).toThrow(/up to 6 photos/);
    expect(normalizeEntryInput(base({ photos: photos.slice(0, 6) })).photos).toHaveLength(6);
  });

  test('tags are trimmed and de-duplicated ignoring case', () => {
    const n = normalizeEntryInput(base({ tagNames: ['  Life ', 'life', 'LIFE', 'Road   trip', ''] }));
    expect(n.tagNames).toEqual(['Life', 'Road trip']);
  });

  test('time picker round-trips 12-hour parts and 24-hour storage', () => {
    expect(splitTime('00:05')).toEqual({ hour12: 12, minute: 5, isPm: false });
    expect(splitTime('12:00')).toEqual({ hour12: 12, minute: 0, isPm: true });
    expect(splitTime('13:45')).toEqual({ hour12: 1, minute: 45, isPm: true });
    expect(splitTime('23:59')).toEqual({ hour12: 11, minute: 59, isPm: true });
    expect(buildTime('12', '5', false)).toBe('00:05');
    expect(buildTime('12', '00', true)).toBe('12:00');
    expect(buildTime('1', '45', true)).toBe('13:45');
    expect(buildTime('11', '59', true)).toBe('23:59');
    for (const time of ['00:00', '06:30', '12:15', '18:45', '23:59']) {
      const { hour12, minute, isPm } = splitTime(time);
      expect(buildTime(String(hour12), String(minute), isPm)).toBe(time);
    }
  });

  test('time picker rejects out-of-range or non-numeric input', () => {
    expect(buildTime('0', '30', false)).toBeNull();
    expect(buildTime('13', '30', false)).toBeNull();
    expect(buildTime('5', '60', false)).toBeNull();
    expect(buildTime('', '30', false)).toBeNull();
    expect(buildTime('5', '', false)).toBeNull();
    expect(buildTime('5.5', '30', false)).toBeNull();
    expect(buildTime('-1', '30', false)).toBeNull();
    expect(buildTime('five', '30', false)).toBeNull();
  });

  test('blank entry defaults to today and a valid time', () => {
    const b = blankEntry();
    expect(isValidTime(b.entryTime)).toBe(true);
    expect(b.mood).toBeNull();
    expect(b.photos).toEqual([]);
  });

  test('blank entry uses a given valid date and falls back to today otherwise', () => {
    const today = blankEntry().entryDate;
    expect(blankEntry('2026-03-05').entryDate).toBe('2026-03-05');
    expect(blankEntry('2030-12-31').entryDate).toBe('2030-12-31');
    expect(blankEntry('2026-02-30').entryDate).toBe(today);
    expect(blankEntry('not-a-date').entryDate).toBe(today);
    expect(blankEntry('').entryDate).toBe(today);
    expect(blankEntry(undefined).entryDate).toBe(today);
    expect(blankEntry(['2026-03-05']).entryDate).toBe(today);
  });

  test('heading/body split never hides text', () => {
    expect(splitTitle({ title: 'My day', content: ' Line one\nLine two ' })).toEqual({ title: 'My day', body: 'Line one\nLine two' });
    expect(splitTitle({ title: null, content: '\n\nFirst line\nSecond\nThird' })).toEqual({
      title: 'First line',
      body: 'Second\nThird',
    });
    expect(splitTitle({ title: '  ', content: 'Only line' })).toEqual({ title: 'Only line', body: '' });
    expect(splitTitle({ title: null, content: '   \n  ' })).toEqual({ title: 'Untitled', body: '' });
    const long = 'x'.repeat(80);
    const split = splitTitle({ title: null, content: `${long}\nmore` });
    expect(split.title).toBe(`${'x'.repeat(57)}...`);
    expect(split.body).toBe(`${long}\nmore`);
  });

  test('display helpers', () => {
    expect(formatTime12('00:05')).toBe('12:05 am');
    expect(formatTime12('13:45')).toBe('1:45 pm');
    expect(displayTitle({ title: ' Hi ', content: '' })).toBe('Hi');
    expect(displayTitle({ title: null, content: '\nFirst line\nsecond' })).toBe('First line');
    expect(displayTitle({ title: null, content: '' })).toBe('Untitled');
    expect(cleanTagName('  a   b ')).toBe('a b');
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

describe('create / read', () => {
  test('writes entry, photos and tags together', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const id = await createEntry(
      db,
      base({
        mood: 4,
        isFavorite: true,
        tagNames: ['Life', 'gratitude', 'Road trip'],
        photos: [
          { uri: 'file:///cache/a.jpg', width: 800, height: 600 },
          { uri: 'file:///cache/b.jpg' },
        ],
      }),
      files,
    );

    const e = await getEntry(db, id);
    expect(e).toMatchObject({ title: 'A good day', entryDate: '2026-11-11', entryTime: '09:30', mood: 4, isFavorite: true });
    expect(e.photos.map((p) => p.uri)).toEqual(['private://a.jpg', 'private://b.jpg']);
    expect(e.photos[0]).toMatchObject({ width: 800, height: 600 });
    expect(e.photos[1]).toMatchObject({ width: null, height: null });
    // 'gratitude' matched the seeded 'Gratitude' ignoring case; only 'Road trip' is new.
    expect(e.tags.map((t) => t.name)).toEqual(['Life', 'Gratitude', 'Road trip']);
    expect((await listTags(db)).map((t) => t.name)).toEqual(['Life', 'Work', 'Health', 'Gratitude', 'Road trip']);
  });

  test('missing entry reads as null', async () => {
    const db = await freshDb();
    expect(await getEntry(db, 'nope')).toBeNull();
  });
});

describe('transactions and file cleanup', () => {
  test('a failed database write rolls everything back and removes copied photos', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    // Poison the tag insert so it fails after the entry and photo rows were written.
    await db.execAsync(`
      CREATE TRIGGER boom BEFORE INSERT ON diary_tags WHEN NEW.name = 'Explode'
      BEGIN SELECT RAISE(ABORT, 'boom'); END;
    `);

    await expect(
      createEntry(db, base({ tagNames: ['Explode'], photos: [{ uri: 'file:///c/a.jpg' }] }), files),
    ).rejects.toThrow(/boom/);

    expect((await db.getAllAsync('SELECT * FROM diary_entries')).length).toBe(0);
    expect((await db.getAllAsync('SELECT * FROM diary_photos')).length).toBe(0);
    expect((await db.getAllAsync('SELECT * FROM entry_tags')).length).toBe(0);
    expect((await db.getAllAsync("SELECT * FROM diary_tags WHERE name = 'Explode'")).length).toBe(0);
    expect(files.stored.size).toBe(0);
  });

  test('a photo copy failing part-way leaves no rows and no stray files', async () => {
    const db = await freshDb();
    const files = fakeFiles({ failImportAt: 2 });
    await expect(
      createEntry(db, base({ photos: [{ uri: 'file:///c/a.jpg' }, { uri: 'file:///c/b.jpg' }] }), files),
    ).rejects.toThrow(/disk full/);
    expect((await db.getAllAsync('SELECT * FROM diary_entries')).length).toBe(0);
    expect(files.stored.size).toBe(0);
  });

  test('invalid input never touches the database or the file store', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    await expect(createEntry(db, base({ title: '', content: '', photos: [{ uri: 'file:///c/a.jpg' }] }), files)).rejects.toThrow(
      /title or a few words/,
    );
    expect(files.stored.size).toBe(0);
    expect((await db.getAllAsync('SELECT * FROM diary_entries')).length).toBe(0);
  });
});

describe('update', () => {
  test('edits fields, tags and photos; removed photo files are deleted after commit', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const id = await createEntry(
      db,
      base({ tagNames: ['Life'], photos: [{ uri: 'file:///c/a.jpg' }, { uri: 'file:///c/b.jpg' }] }),
      files,
    );
    const before = await getEntry(db, id);
    const [pa, pb] = before.photos;

    await updateEntry(
      db,
      id,
      base({
        title: 'Edited',
        mood: 2,
        tagNames: ['Work'],
        photos: [{ id: pb.id }, { uri: 'file:///c/c.jpg' }],
      }),
      files,
    );

    const after = await getEntry(db, id);
    expect(after).toMatchObject({ title: 'Edited', mood: 2 });
    expect(after.tags.map((t) => t.name)).toEqual(['Work']);
    expect(after.photos.map((p) => p.uri)).toEqual(['private://b.jpg', 'private://c.jpg']);
    expect(after.photos[0].id).toBe(pb.id);
    expect(files.stored.has(pa.uri)).toBe(false);
    expect(files.stored.has(pb.uri)).toBe(true);
    expect(files.stored.has('private://c.jpg')).toBe(true);
  });

  test('a failed update keeps the old photos and removes the newly copied ones', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const id = await createEntry(db, base({ tagNames: ['Life'], photos: [{ uri: 'file:///c/a.jpg' }] }), files);
    const original = await getEntry(db, id);
    await db.execAsync(`
      CREATE TRIGGER boom BEFORE INSERT ON diary_tags WHEN NEW.name = 'Explode'
      BEGIN SELECT RAISE(ABORT, 'boom'); END;
    `);

    await expect(
      updateEntry(db, id, base({ title: 'Nope', tagNames: ['Explode'], photos: [{ uri: 'file:///c/new.jpg' }] }), files),
    ).rejects.toThrow(/boom/);

    const after = await getEntry(db, id);
    expect(after.title).toBe('A good day');
    expect(after.tags.map((t) => t.name)).toEqual(['Life']);
    expect(after.photos.map((p) => p.uri)).toEqual(original.photos.map((p) => p.uri));
    expect(files.stored.has('private://a.jpg')).toBe(true);
    expect(files.stored.has('private://new.jpg')).toBe(false);
  });

  test('rejects photo ids that do not belong to the entry, and unknown entries', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const id = await createEntry(db, base(), files);
    await expect(updateEntry(db, id, base({ photos: [{ id: 'someone-elses' }] }), files)).rejects.toThrow(/photos could not be read/);
    await expect(updateEntry(db, 'missing', base(), files)).rejects.toThrow(/no longer exists/);
  });
});

describe('delete', () => {
  test('cascades to photos and tag links, removes files, keeps shared tags', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const id = await createEntry(db, base({ tagNames: ['Life', 'Mine'], photos: [{ uri: 'file:///c/a.jpg' }] }), files);
    const other = await createEntry(db, base({ title: 'Other', tagNames: ['Life'] }), files);

    await deleteEntry(db, id, files);

    expect(await getEntry(db, id)).toBeNull();
    expect((await db.getAllAsync('SELECT * FROM diary_photos')).length).toBe(0);
    expect((await db.getAllAsync('SELECT * FROM entry_tags WHERE entry_id = ?', [id])).length).toBe(0);
    expect(files.stored.size).toBe(0);
    expect((await getEntry(db, other)).tags.map((t) => t.name)).toEqual(['Life']);
    expect((await listTags(db)).map((t) => t.name)).toContain('Mine');
  });
});

describe('list, filters and marks', () => {
  async function seed() {
    const db = await freshDb();
    const files = fakeFiles();
    await createEntry(db, base({ title: 'Morning walk', content: 'Sunny', entryDate: '2026-11-03', entryTime: '07:00' }), files);
    await createEntry(
      db,
      base({
        title: 'Sale 100% off',
        content: 'Bought a_b cable',
        entryDate: '2026-11-11',
        entryTime: '09:00',
        isFavorite: true,
        tagNames: ['Life'],
        photos: [{ uri: 'file:///c/a.jpg' }, { uri: 'file:///c/b.jpg' }],
      }),
      files,
    );
    await createEntry(db, base({ title: 'Evening', content: 'Tea and a book', entryDate: '2026-11-11', entryTime: '20:15' }), files);
    await createEntry(db, base({ title: 'October note', content: 'Older', entryDate: '2026-10-30', entryTime: '10:00' }), files);
    return db;
  }

  test('newest first by date then time', async () => {
    const db = await seed();
    const titles = (await listEntries(db)).map((e) => e.title);
    expect(titles).toEqual(['Evening', 'Sale 100% off', 'Morning walk', 'October note']);
  });

  test('summaries carry first photo, photo count and tags', async () => {
    const db = await seed();
    const sale = (await listEntries(db)).find((e) => e.title === 'Sale 100% off');
    expect(sale.thumbnailUri).toBe('private://a.jpg');
    expect(sale.photoCount).toBe(2);
    expect(sale.tags.map((t) => t.name)).toEqual(['Life']);
    expect(sale.isFavorite).toBe(true);
  });

  test('day filter', async () => {
    const db = await seed();
    expect((await listEntries(db, { date: '2026-11-11' })).map((e) => e.title)).toEqual(['Evening', 'Sale 100% off']);
    expect(await listEntries(db, { date: '2026-11-20' })).toEqual([]);
  });

  test('search matches title or content ignoring case', async () => {
    const db = await seed();
    expect((await listEntries(db, { query: 'MORNING' })).map((e) => e.title)).toEqual(['Morning walk']);
    expect((await listEntries(db, { query: 'tea and' })).map((e) => e.title)).toEqual(['Evening']);
    expect((await listEntries(db, { query: '   ' })).length).toBe(4);
  });

  test('% and _ in a search are literal, not wildcards', async () => {
    const db = await seed();
    expect((await listEntries(db, { query: '100%' })).map((e) => e.title)).toEqual(['Sale 100% off']);
    expect((await listEntries(db, { query: 'a_b' })).map((e) => e.title)).toEqual(['Sale 100% off']);
    expect(await listEntries(db, { query: 'a_c' })).toEqual([]);
    expect(await listEntries(db, { query: '%' })).toHaveLength(1);
    expect(await listEntries(db, { query: '_' })).toHaveLength(1);
    expect(await listEntries(db, { query: '\\' })).toEqual([]);
  });

  test('filters combine', async () => {
    const db = await seed();
    expect((await listEntries(db, { favoritesOnly: true })).map((e) => e.title)).toEqual(['Sale 100% off']);
    expect(await listEntries(db, { favoritesOnly: true, date: '2026-11-03' })).toEqual([]);
    expect((await listEntries(db, { date: '2026-11-11', query: 'book' })).map((e) => e.title)).toEqual(['Evening']);
  });

  test('month marks list distinct days with entries, month-bounded', async () => {
    const db = await seed();
    expect(await getMonthMarks(db, '2026-11')).toEqual(['2026-11-03', '2026-11-11']);
    expect(await getMonthMarks(db, '2026-10')).toEqual(['2026-10-30']);
    expect(await getMonthMarks(db, '2026-12')).toEqual([]);
  });

  test('december marks do not leak into january', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    await createEntry(db, base({ entryDate: '2026-12-31' }), files);
    await createEntry(db, base({ entryDate: '2027-01-01' }), files);
    expect(await getMonthMarks(db, '2026-12')).toEqual(['2026-12-31']);
    expect(await getMonthMarks(db, '2027-01')).toEqual(['2027-01-01']);
  });
});

describe('favourites', () => {
  test('toggles and rejects unknown entries', async () => {
    const db = await freshDb();
    const id = await createEntry(db, base(), fakeFiles());
    await setFavorite(db, id, true);
    expect((await getEntry(db, id)).isFavorite).toBe(true);
    await setFavorite(db, id, false);
    expect((await getEntry(db, id)).isFavorite).toBe(false);
    await expect(setFavorite(db, 'missing', true)).rejects.toThrow(/no longer exists/);
  });
});

describe('tags', () => {
  test('are shared across entries and unique ignoring case', async () => {
    const db = await freshDb();
    const files = fakeFiles();
    const a = await createEntry(db, base({ tagNames: ['Road trip'] }), files);
    const b = await createEntry(db, base({ title: 'B', tagNames: ['  road   TRIP ', 'LIFE'] }), files);
    const tags = await listTags(db);
    expect(tags.map((t) => t.name)).toEqual(['Life', 'Work', 'Health', 'Gratitude', 'Road trip']);
    const [ta] = (await getEntry(db, a)).tags;
    const [, tb] = (await getEntry(db, b)).tags;
    expect(ta.id).toBe(tb.id);
    expect((await getEntry(db, b)).tags.map((t) => t.id)).toContain('tag-life');
  });

  test('rejects over-long tag names before writing anything', async () => {
    const db = await freshDb();
    await expect(createEntry(db, base({ tagNames: ['x'.repeat(25)] }), fakeFiles())).rejects.toThrow(/up to 24/);
    expect((await db.getAllAsync('SELECT * FROM diary_entries')).length).toBe(0);
  });

  test('rejects more than ten tags', async () => {
    const db = await freshDb();
    const tagNames = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    await expect(createEntry(db, base({ tagNames }), fakeFiles())).rejects.toThrow(/up to 10 tags/);
  });

  test('database itself refuses a case-variant duplicate', async () => {
    const db = await freshDb();
    await expect(
      db.runAsync("INSERT INTO diary_tags (id, name, created_at) VALUES ('x', 'WORK', '2026-01-01T00:00:00.000Z')"),
    ).rejects.toThrow(/UNIQUE/i);
  });
});
