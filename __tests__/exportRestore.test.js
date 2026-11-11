import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { createArchive, inspectArchive, restoreArchive } from '../src/features/export/archiveBackupService';
import { writeArchive } from '../src/features/export/archiveZip';
import { createBackupText, restoreFromText } from '../src/features/settings/backupService';
import { addTransaction } from '../src/features/expenses/expenseService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const TS = '2026-11-11T08:00:00.000Z';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

async function* chunks(data, size = 2500) {
  for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
}

// An in-memory phone: a photo folder (uri -> bytes), a staging area, and an archive being written or read.
function fakePhone(photos = {}) {
  const phone = {
    photos: new Map(Object.entries(photos)),
    staging: new Map(),
    archiveParts: [],
    failPromote: false,
    discarded: 0,
    removed: [],
  };
  const io = {
    fileExists: async (uri) => phone.photos.has(uri),
    readFileChunks: (uri) => chunks(phone.photos.get(uri)),
    writeOut: (c) => phone.archiveParts.push(Buffer.from(c)),
    readArchiveChunks: () => chunks(new Uint8Array(Buffer.concat(phone.archiveParts))),
    openStagedPhoto: (name) => {
      const parts = [];
      phone.staging.set(name, parts);
      return {
        write: (c) => parts.push(Buffer.from(c)),
        finish: () => {},
        abort: () => phone.staging.delete(name),
      };
    },
    discardStaging: async () => {
      phone.discarded += 1;
      phone.staging.clear();
    },
    finalPhotoUri: (name) => `file:///restored/${name.replace('photos/', '')}`,
    promoteStagedPhotos: async (names) => {
      if (phone.failPromote) throw new Error('disk full');
      for (const name of names) phone.photos.set(`file:///restored/${name.replace('photos/', '')}`, new Uint8Array(Buffer.concat(phone.staging.get(name))));
      return 0;
    },
    listStoredPhotoUris: async () => [...phone.photos.keys()],
    removePhoto: async (uri) => {
      phone.removed.push(uri);
      phone.photos.delete(uri);
    },
  };
  return { phone, io };
}

async function seedEntryWithPhotos(db, photos) {
  await db.runAsync(
    `INSERT INTO diary_entries (id, title, content, entry_date, entry_time, created_at, updated_at) VALUES ('e1', 'Day out', 'Lovely', '2026-11-10', '10:00', ?, ?)`,
    [TS, TS],
  );
  let order = 0;
  for (const [id, uri] of photos) {
    await db.runAsync('INSERT INTO diary_photos (id, entry_id, uri, sort_order, created_at) VALUES (?, ?, ?, ?, ?)', [id, 'e1', uri, order++, TS]);
  }
}

const bytesOf = (n, seed) => new Uint8Array(n).map((_, i) => (i * seed) % 251);
const photoUris = async (db) => (await db.getAllAsync('SELECT uri FROM diary_photos ORDER BY id')).map((r) => r.uri);

describe('creating a complete backup', () => {
  test('packs the database and every photo, and no phone file paths appear in the data', async () => {
    const db = await freshDb();
    const a = bytesOf(40000, 3);
    const b = bytesOf(1234, 5);
    const { phone, io } = fakePhone({ 'file:///private/app/docs/one.jpg': a, 'file:///private/app/docs/two.png': b });
    await seedEntryWithPhotos(db, [['p1', 'file:///private/app/docs/one.jpg'], ['p2', 'file:///private/app/docs/two.png']]);
    await addTransaction(db, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: '2026-11-10' });

    const result = await createArchive(db, io, { appVersion: '1.0.0' });
    expect(result).toEqual({ photoCount: 2, missingPhotoCount: 0 });

    const inspected = await inspectArchive(db, io);
    expect(inspected.stagedPhotoNames.size).toBe(2);
    expect(inspected.summary).toContain('2 photos');
    expect(JSON.stringify(inspected.doc)).not.toContain('file:///private');
    expect(inspected.doc.tables.diary_photos.map((r) => r.uri)).toEqual(['photos/p0001.jpg', 'photos/p0002.png']);
    expect(Buffer.compare(Buffer.concat(phone.staging.get('photos/p0001.jpg')), Buffer.from(a))).toBe(0);
    expect(Buffer.compare(Buffer.concat(phone.staging.get('photos/p0002.png')), Buffer.from(b))).toBe(0);
  });

  test('a photo whose file is gone is recorded as missing instead of failing the backup', async () => {
    const db = await freshDb();
    const { io } = fakePhone({ 'file:///docs/here.jpg': bytesOf(100, 7) });
    await seedEntryWithPhotos(db, [['p1', 'file:///docs/here.jpg'], ['p2', 'file:///docs/gone.jpg']]);
    const result = await createArchive(db, io, { appVersion: '1.0.0' });
    expect(result).toEqual({ photoCount: 1, missingPhotoCount: 1 });
    const inspected = await inspectArchive(db, io);
    expect(inspected.doc.tables.diary_photos.map((r) => r.uri)).toEqual(['photos/p0001.jpg', 'missing:p2']);
  });

  test('two records sharing one file store it once', async () => {
    const db = await freshDb();
    const { io } = fakePhone({ 'file:///docs/shared.jpg': bytesOf(500, 3) });
    await seedEntryWithPhotos(db, [['p1', 'file:///docs/shared.jpg'], ['p2', 'file:///docs/shared.jpg']]);
    expect((await createArchive(db, io, { appVersion: '1.0.0' })).photoCount).toBe(1);
  });

  test('the backup never contains the app lock or reminder settings', async () => {
    const db = await freshDb();
    for (const [key, value] of [['app_lock_enabled', 'true'], ['app_lock_biometrics', 'true'], ['reminder_diary', '{"hour":9}'], ['profile_name', 'Asha']]) {
      await db.runAsync('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, value, TS]);
    }
    const { io } = fakePhone();
    await createArchive(db, io, { appVersion: '1.0.0' });
    const inspected = await inspectArchive(await freshDb(), io);
    const keys = inspected.doc.tables.app_settings.map((r) => r.key);
    expect(keys).toContain('profile_name');
    for (const secret of ['app_lock_enabled', 'app_lock_biometrics', 'reminder_diary']) expect(keys).not.toContain(secret);
    expect(JSON.stringify(inspected.doc).toLowerCase()).not.toMatch(/pin_record|mlw_pin|salt|hash/);
  });
});

describe('restoring a complete backup', () => {
  async function backedUp() {
    const source = await freshDb();
    const a = bytesOf(30000, 3);
    const sourcePhone = fakePhone({ 'file:///old/one.jpg': a });
    await seedEntryWithPhotos(source, [['p1', 'file:///old/one.jpg']]);
    await addTransaction(source, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: '2026-11-10' });
    await createArchive(source, sourcePhone.io, { appVersion: '1.0.0' });
    return { archive: sourcePhone.phone.archiveParts, photo: a };
  }

  test('puts the data and the photos back, pointing at their new locations', async () => {
    const { archive, photo } = await backedUp();
    const target = await freshDb();
    const { phone, io } = fakePhone();
    phone.archiveParts = archive;

    const inspected = await inspectArchive(target, io);
    const result = await restoreArchive(target, io, inspected);

    expect(result.failedPhotoMoves).toBe(0);
    expect(await photoUris(target)).toEqual(['file:///restored/p0001.jpg']);
    expect(Buffer.compare(Buffer.from(phone.photos.get('file:///restored/p0001.jpg')), Buffer.from(photo))).toBe(0);
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Tea']);
    expect(phone.staging.size).toBe(0);
  });

  test('inspecting alone changes nothing on the phone', async () => {
    const { archive } = await backedUp();
    const target = await freshDb();
    await addTransaction(target, { title: 'Mine', amountPaise: 100, categoryId: 'cat-food', txnDate: '2026-11-01' });
    const { phone, io } = fakePhone({ 'file:///mine/keep.jpg': bytesOf(10, 1) });
    phone.archiveParts = archive;

    await inspectArchive(target, io);
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Mine']);
    expect([...phone.photos.keys()]).toEqual(['file:///mine/keep.jpg']);
  });

  test("photos that are no longer part of the data are removed, and the current ones are kept", async () => {
    const { archive } = await backedUp();
    const target = await freshDb();
    const { phone, io } = fakePhone({ 'file:///mine/old.jpg': bytesOf(10, 1) });
    phone.archiveParts = archive;
    await restoreArchive(target, io, await inspectArchive(target, io));
    expect(phone.removed).toEqual(['file:///mine/old.jpg']);
    expect([...phone.photos.keys()]).toEqual(['file:///restored/p0001.jpg']);
  });

  test('a database failure leaves the phone exactly as it was: data, old photos and staging', async () => {
    const { archive } = await backedUp();
    const target = await freshDb();
    await addTransaction(target, { title: 'Mine', amountPaise: 100, categoryId: 'cat-food', txnDate: '2026-11-01' });
    const { phone, io } = fakePhone({ 'file:///mine/keep.jpg': bytesOf(10, 1) });
    phone.archiveParts = archive;

    const inspected = await inspectArchive(target, io);
    inspected.doc.tables.transactions[0].amount_paise = -5; // fails the database CHECK
    await expect(restoreArchive(target, io, inspected)).rejects.toThrow("didn't pass the checks");

    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Mine']);
    expect([...phone.photos.keys()]).toEqual(['file:///mine/keep.jpg']);
    expect(phone.removed).toEqual([]);
    expect(phone.staging.size).toBe(0);
  });

  test('if moving photos fails after the data is replaced, the data stands and nothing else is deleted wrongly', async () => {
    const { archive } = await backedUp();
    const target = await freshDb();
    const { phone, io } = fakePhone({ 'file:///mine/old.jpg': bytesOf(10, 1) });
    phone.archiveParts = archive;
    phone.failPromote = true;

    const result = await restoreArchive(target, io, await inspectArchive(target, io));
    expect(result.failedPhotoMoves).toBe(1);
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Tea']);
    expect(await photoUris(target)).toEqual(['file:///restored/p0001.jpg']);
    expect(phone.removed).toEqual(['file:///mine/old.jpg']);
  });
});

describe('restoring a damaged or hostile archive', () => {
  async function archiveWith(mutate) {
    const source = await freshDb();
    const { phone, io } = fakePhone({ 'file:///old/one.jpg': bytesOf(5000, 3) });
    await seedEntryWithPhotos(source, [['p1', 'file:///old/one.jpg']]);
    await createArchive(source, io, { appVersion: '1.0.0' });
    return mutate(new Uint8Array(Buffer.concat(phone.archiveParts)));
  }

  async function attempt(bytes) {
    const target = await freshDb();
    await addTransaction(target, { title: 'Mine', amountPaise: 100, categoryId: 'cat-food', txnDate: '2026-11-01' });
    const { phone, io } = fakePhone({ 'file:///mine/keep.jpg': bytesOf(10, 1) });
    phone.archiveParts = [Buffer.from(bytes)];
    let error = null;
    try {
      await inspectArchive(target, io);
    } catch (e) {
      error = e;
    }
    return { error, target, phone };
  }

  test('a truncated archive is refused and nothing changes', async () => {
    const bytes = await archiveWith((b) => b.subarray(0, Math.floor(b.length / 2)));
    const { error, target, phone } = await attempt(bytes);
    expect(error).toBeTruthy();
    expect(error.name).toBe('ValidationError');
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Mine']);
    expect([...phone.photos.keys()]).toEqual(['file:///mine/keep.jpg']);
    expect(phone.staging.size).toBe(0);
  });

  test('random bytes are refused with a readable message', async () => {
    const { error } = await attempt(new Uint8Array(3000).map((_, i) => (i * 13) % 256));
    expect(error.name).toBe('ValidationError');
    expect(error.message.length).toBeLessThan(200);
  });

  test('an archive from a newer app version is refused before anything is staged for restore', async () => {
    const source = await freshDb();
    const { phone, io } = fakePhone();
    await createArchive(source, io, { appVersion: '1.0.0' });
    // Re-create with a schema number above this app's: patch backup.json by rebuilding the archive.
    const inspectedOk = await inspectArchive(source, io);
    const newer = { ...inspectedOk.doc, schema_version: migrations.length + 5 };
    const parts = [];
    await writeArchive({ jsonText: JSON.stringify(newer), photos: [], write: (c) => parts.push(Buffer.from(c)) });
    phone.archiveParts = parts;
    await expect(inspectArchive(source, io)).rejects.toThrow('newer version');
  });

  test('a photo record that points outside the archive is refused', async () => {
    const source = await freshDb();
    const { phone, io } = fakePhone();
    await createArchive(source, io, { appVersion: '1.0.0' });
    const doc = (await inspectArchive(source, io)).doc;
    doc.tables.diary_entries = [{ id: 'e', title: 't', content: 'c', entry_date: '2026-11-01', entry_time: '10:00', mood: null, is_favorite: 0, created_at: TS, updated_at: TS }];
    doc.tables.diary_photos = [{ id: 'x', entry_id: 'e', uri: 'file:///data/user/0/com.other.app/secret.jpg', width: null, height: null, sort_order: 0, created_at: TS }];
    const parts = [];
    await writeArchive({ jsonText: JSON.stringify(doc), photos: [], write: (c) => parts.push(Buffer.from(c)) });
    phone.archiveParts = parts;
    await expect(inspectArchive(source, io)).rejects.toThrow('unexpected file reference');
  });

  test('a photo record whose file is not in the archive is refused as incomplete', async () => {
    const source = await freshDb();
    const { phone, io } = fakePhone();
    await createArchive(source, io, { appVersion: '1.0.0' });
    const doc = (await inspectArchive(source, io)).doc;
    doc.tables.diary_entries = [{ id: 'e', title: 't', content: 'c', entry_date: '2026-11-01', entry_time: '10:00', mood: null, is_favorite: 0, created_at: TS, updated_at: TS }];
    doc.tables.diary_photos = [{ id: 'x', entry_id: 'e', uri: 'photos/p0007.jpg', width: null, height: null, sort_order: 0, created_at: TS }];
    const parts = [];
    await writeArchive({ jsonText: JSON.stringify(doc), photos: [], write: (c) => parts.push(Buffer.from(c)) });
    phone.archiveParts = parts;
    await expect(inspectArchive(source, io)).rejects.toThrow('photo is missing');
  });
});

describe('the older JSON-only backup still works', () => {
  test('a JSON backup made by the previous code restores into the new code', async () => {
    const source = await freshDb();
    await addTransaction(source, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: '2026-11-10' });
    const text = await createBackupText(source, { appVersion: '1.0.0' });
    const target = await freshDb();
    await restoreFromText(target, text);
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Tea']);
  });
});
