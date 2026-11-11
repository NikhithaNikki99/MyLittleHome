import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';
import {
  ARCHIVE_JSON_NAME,
  archiveFileName,
  checkEntry,
  newEntryState,
  photoExtension,
  planPhotos,
  referencedPhotoNames,
} from '../src/features/export/archiveFormat';
import { readArchive, writeArchive } from '../src/features/export/archiveZip';
import { buildCsv, csvCell, paiseToDecimal } from '../src/features/export/csv';

// ---- helpers ----
function bytes(n, fill = 1) {
  return new Uint8Array(n).fill(fill);
}

async function* chunked(data, size = 4096) {
  for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size);
}

async function make({ json = '{"ok":true}', photos = [] } = {}) {
  const parts = [];
  await writeArchive({
    jsonText: json,
    photos: photos.map((p) => ({ archiveName: p.name, readChunks: () => chunked(p.data, 5000) })),
    write: (c) => parts.push(Buffer.from(c)),
  });
  return new Uint8Array(Buffer.concat(parts));
}

// A raw zip built by hand, to produce archives the app itself would never write.
function rawZip(entries) {
  return new Promise((resolve, reject) => {
    const parts = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) return reject(err);
      parts.push(Buffer.from(chunk));
      if (final) resolve(new Uint8Array(Buffer.concat(parts)));
    });
    for (const e of entries) {
      const f = e.deflate ? new ZipDeflate(e.name) : new ZipPassThrough(e.name);
      zip.add(f);
      f.push(e.data, true);
    }
    zip.end();
  });
}

async function read(data, limits) {
  const saved = new Map();
  const aborted = [];
  const result = await readArchive({
    readChunks: () => chunked(data, 3000),
    openPhoto: (name) => {
      const parts = [];
      saved.set(name, parts);
      return { write: (c) => parts.push(Buffer.from(c)), finish: () => {}, abort: () => aborted.push(name) };
    },
    limits,
  });
  return { ...result, saved, aborted };
}

const fileBytes = (parts) => Buffer.concat(parts);

describe('csv', () => {
  test('plain cells are untouched; commas, quotes and line breaks are quoted', () => {
    expect(csvCell('Lunch')).toBe('Lunch');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  test('null, undefined and numbers', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(12.5)).toBe('12.5');
  });

  test('cells that could run as spreadsheet formulas get a leading apostrophe', () => {
    for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx', '=HYPERLINK("http://x","y")']) {
      const out = csvCell(evil);
      expect(out.replace(/^"/, '').startsWith("'")).toBe(true);
    }
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  test('numbers are not mistaken for formulas, but negative text is', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('Trip - Goa')).toBe('Trip - Goa');
  });

  test('buildCsv writes a BOM, a header row, CRLF and a trailing newline', () => {
    const text = buildCsv(
      [{ header: 'Name', value: (r) => r.n }, { header: 'Amount', value: (r) => r.a }],
      [{ n: 'Tea, large', a: '20.00' }, { n: '=bad', a: '5.00' }],
    );
    expect(text.startsWith('﻿')).toBe(true);
    expect(text.slice(1)).toBe('Name,Amount\r\n"Tea, large",20.00\r\n\'=bad,5.00\r\n');
  });

  test('an empty dataset still has its header', () => {
    expect(buildCsv([{ header: 'A', value: () => 1 }], [])).toBe('﻿A\r\n');
  });

  test('paise become exact decimal rupees', () => {
    expect([0, 5, 99, 100, 12345, 1500000, -250].map(paiseToDecimal)).toEqual(['0.00', '0.05', '0.99', '1.00', '123.45', '15000.00', '-2.50']);
  });
});

describe('archive format helpers', () => {
  test('file name and extensions', () => {
    expect(archiveFileName(new Date(2026, 10, 5))).toBe('my-little-world-backup-2026-11-05.mlwbackup');
    expect(photoExtension('file:///a/b/photo.JPG')).toBe('jpg');
    expect(photoExtension('file:///a/b/photo.png?x=1')).toBe('png');
    expect(photoExtension('file:///a/b/noext')).toBe('jpg');
    expect(photoExtension('file:///a/b/evil.exe')).toBe('jpg');
    expect(photoExtension('file:///a/b/evil.php.jpg')).toBe('jpg');
  });

  test('planPhotos gives generated names, reuses a file shared by two records, and marks missing files', () => {
    const rows = [
      { id: 'a', uri: 'file:///x/one.jpg' },
      { id: 'b', uri: 'file:///x/two.png' },
      { id: 'c', uri: 'file:///x/one.jpg' },
      { id: 'd', uri: 'file:///x/gone.jpg' },
    ];
    const exists = new Map([['file:///x/one.jpg', true], ['file:///x/two.png', true], ['file:///x/gone.jpg', false]]);
    const plan = planPhotos(rows, exists);
    expect(plan.files).toEqual([
      { archiveName: 'photos/p0001.jpg', sourceUri: 'file:///x/one.jpg' },
      { archiveName: 'photos/p0002.png', sourceUri: 'file:///x/two.png' },
    ]);
    expect(plan.rows.map((r) => r.uri)).toEqual(['photos/p0001.jpg', 'photos/p0002.png', 'photos/p0001.jpg', 'missing:d']);
    expect(plan.missingCount).toBe(1);
    expect(JSON.stringify(plan.rows)).not.toContain('file:///');
  });

  test('checkEntry accepts only backup.json and strictly named photos', () => {
    const state = newEntryState();
    expect(checkEntry(ARCHIVE_JSON_NAME, 10, state)).toBe('json');
    expect(checkEntry('photos/p0001.jpg', 10, state)).toBe('photo');
    for (const bad of [
      '../evil.jpg', 'photos/../../evil.jpg', '/etc/passwd', 'photos/p0001.jpg/../x', 'photos/p1.jpg', 'photos/p0002.sh',
      'photos/p0002.jpg.exe', 'photos/sub/p0003.jpg', 'photos\\p0004.jpg', 'notes.txt', 'backup.json.bak', 'Photos/p0005.jpg', '',
    ]) {
      expect(() => checkEntry(bad, 1, state)).toThrow('unexpected file');
    }
  });

  test('checkEntry rejects duplicates, oversize and too many photos', () => {
    const state = newEntryState({ maxPhotoBytes: 100, maxPhotos: 2 });
    checkEntry('photos/p0001.jpg', 50, state);
    expect(() => checkEntry('photos/p0001.jpg', 50, state)).toThrow('twice');
    expect(() => checkEntry('photos/p0002.jpg', 101, state)).toThrow('larger than allowed');
    checkEntry('photos/p0002.jpg', 10, state);
    expect(() => checkEntry('photos/p0003.jpg', 10, state)).toThrow('more photos');
  });

  test('referencedPhotoNames lists archive photos and allows recorded missing ones', () => {
    const names = referencedPhotoNames([{ uri: 'photos/p0001.jpg' }, { uri: 'missing:x' }, { uri: 'photos/p0001.jpg' }]);
    expect([...names]).toEqual(['photos/p0001.jpg']);
    expect(() => referencedPhotoNames([{ uri: 'file:///data/user/0/x.jpg' }])).toThrow('unexpected file reference');
    expect(() => referencedPhotoNames([{ uri: 'photos/../../x.jpg' }])).toThrow('unsafe');
    expect(() => referencedPhotoNames([{ uri: '/etc/passwd' }])).toThrow('unexpected file reference');
    expect(() => referencedPhotoNames([{ uri: null }])).toThrow('without a file reference');
  });
});

describe('writing and reading an archive', () => {
  test('round-trips the JSON and every photo byte-for-byte', async () => {
    const big = new Uint8Array(300000).map((_, i) => (i * 7) % 251);
    const small = bytes(10, 9);
    const archive = await make({
      json: JSON.stringify({ hello: 'wörld ₹ 🙂' }),
      photos: [{ name: 'photos/p0001.jpg', data: big }, { name: 'photos/p0002.png', data: small }],
    });
    const out = await read(archive);
    expect(JSON.parse(out.jsonText)).toEqual({ hello: 'wörld ₹ 🙂' });
    expect([...out.photoNames].sort()).toEqual(['photos/p0001.jpg', 'photos/p0002.png']);
    expect(Buffer.compare(fileBytes(out.saved.get('photos/p0001.jpg')), Buffer.from(big))).toBe(0);
    expect(Buffer.compare(fileBytes(out.saved.get('photos/p0002.png')), Buffer.from(small))).toBe(0);
  });

  test('an archive with no photos is fine', async () => {
    const out = await read(await make());
    expect(out.jsonText).toBe('{"ok":true}');
    expect(out.photoNames.size).toBe(0);
  });

  test('an empty photo file survives', async () => {
    const out = await read(await make({ photos: [{ name: 'photos/p0001.jpg', data: new Uint8Array(0) }] }));
    expect(fileBytes(out.saved.get('photos/p0001.jpg')).length).toBe(0);
  });

  test('writeArchive reports how many photos it wrote', async () => {
    const parts = [];
    const n = await writeArchive({
      jsonText: '{}',
      photos: [1, 2, 3].map((i) => ({ archiveName: `photos/p000${i}.jpg`, readChunks: () => chunked(bytes(10, i)) })),
      write: (c) => parts.push(c),
    });
    expect(n).toBe(3);
  });
});

describe('reading a hostile or damaged archive', () => {
  const json = strToU8('{"ok":true}');
  const photo = bytes(2000, 5);

  test('path traversal names are refused', async () => {
    for (const name of ['../evil.jpg', 'photos/../../evil.jpg', '/abs/evil.jpg', 'evil.sh']) {
      const zip = await rawZip([{ name: ARCHIVE_JSON_NAME, data: json, deflate: true }, { name, data: photo }]);
      await expect(read(zip)).rejects.toThrow('unexpected file');
    }
  });

  test('a photo bigger than the limit is refused, and nothing it wrote is kept', async () => {
    const zip = await rawZip([{ name: ARCHIVE_JSON_NAME, data: json, deflate: true }, { name: 'photos/p0001.jpg', data: bytes(5000) }]);
    await expect(read(zip, { maxPhotoBytes: 1000 })).rejects.toThrow('larger than allowed');
  });

  test('the total size across photos is limited', async () => {
    const zip = await rawZip([
      { name: ARCHIVE_JSON_NAME, data: json, deflate: true },
      { name: 'photos/p0001.jpg', data: bytes(600) },
      { name: 'photos/p0002.jpg', data: bytes(600) },
    ]);
    await expect(read(zip, { maxTotalPhotoBytes: 1000, maxPhotoBytes: 1000 })).rejects.toThrow('larger than allowed');
  });

  test('too many photos are refused', async () => {
    const zip = await rawZip([
      { name: ARCHIVE_JSON_NAME, data: json, deflate: true },
      ...[1, 2, 3].map((i) => ({ name: `photos/p000${i}.jpg`, data: bytes(10) })),
    ]);
    await expect(read(zip, { maxPhotos: 2 })).rejects.toThrow('more photos');
  });

  test('a duplicate photo name is refused', async () => {
    const zip = await rawZip([
      { name: ARCHIVE_JSON_NAME, data: json, deflate: true },
      { name: 'photos/p0001.jpg', data: bytes(10) },
      { name: 'photos/p0001.jpg', data: bytes(10) },
    ]);
    await expect(read(zip)).rejects.toThrow('twice');
  });

  test('a zip without backup.json is not a backup', async () => {
    const zip = await rawZip([{ name: 'photos/p0001.jpg', data: photo }]);
    await expect(read(zip)).rejects.toThrow("isn't a My Little World backup");
  });

  test('a truncated archive is reported as damaged, not half-restored', async () => {
    const full = await make({ photos: [{ name: 'photos/p0001.jpg', data: bytes(80000, 3) }] });
    for (const keep of [0.3, 0.6, 0.9]) {
      await expect(read(full.subarray(0, Math.floor(full.length * keep)))).rejects.toThrow();
    }
  });

  test('random bytes and an empty file are refused with a readable message', async () => {
    await expect(read(new Uint8Array(0))).rejects.toThrow('empty');
    const noise = new Uint8Array(5000).map((_, i) => (i * 31 + 7) % 256);
    await expect(read(noise)).rejects.toThrow();
    await expect(read(strToU8('{"just":"json"}'))).rejects.toThrow();
  });

  test('on failure every photo sink that was opened is aborted', async () => {
    const zip = await rawZip([
      { name: ARCHIVE_JSON_NAME, data: json, deflate: true },
      { name: 'photos/p0001.jpg', data: bytes(800) },
      { name: 'photos/p0002.jpg', data: bytes(5000) },
    ]);
    const saved = new Map();
    const aborted = [];
    await expect(
      readArchive({
        readChunks: () => chunked(zip, 700),
        openPhoto: (name) => {
          saved.set(name, []);
          return { write: (c) => saved.get(name).push(c), finish: () => {}, abort: () => aborted.push(name) };
        },
        limits: { maxPhotoBytes: 1000 },
      }),
    ).rejects.toThrow('larger than allowed');
    expect(aborted.length).toBeGreaterThan(0);
  });

  test('a failing photo sink stops the read with its error', async () => {
    const zip = await make({ photos: [{ name: 'photos/p0001.jpg', data: bytes(9000) }] });
    await expect(
      readArchive({
        readChunks: () => chunked(zip, 2000),
        openPhoto: () => ({
          write: () => {
            throw new Error('Not enough storage');
          },
          finish: () => {},
        }),
      }),
    ).rejects.toThrow('Not enough storage');
  });
});
