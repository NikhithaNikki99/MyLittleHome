// Backup archive: a zip (.mlwbackup) holding backup.json (the validated JSON backup) and photos/<name>.
// Pure: no native modules, so the safety rules here are covered by Jest. Disk and zip streaming are in archiveIO.js.
//
// Photo names inside the archive are generated here (p0001.jpg ...), never copied from a path in the file, so a
// malicious archive cannot write outside the photo folder. On restore, entry names are checked against a strict
// pattern, and sizes are checked against hard limits before any bytes are accepted.

export const ARCHIVE_EXTENSION = 'mlwbackup';
export const ARCHIVE_JSON_NAME = 'backup.json';
export const PHOTO_PREFIX = 'photos/';

export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export const MAX_PHOTO_COUNT = 5000;
export const MAX_ARCHIVE_PHOTO_BYTES_TOTAL = 1.5 * 1024 * 1024 * 1024;
export const DEFAULT_LIMITS = {
  maxPhotoBytes: MAX_PHOTO_BYTES,
  maxPhotos: MAX_PHOTO_COUNT,
  maxTotalPhotoBytes: MAX_ARCHIVE_PHOTO_BYTES_TOTAL,
};

const PHOTO_ENTRY = /^photos\/p\d{4,6}\.(jpg|jpeg|png|webp|heic|heif|gif)$/;
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif']);

export function archiveFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `my-little-world-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${ARCHIVE_EXTENSION}`;
}

export function photoExtension(uri) {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(uri ?? '');
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return IMAGE_EXTENSIONS.has(ext) ? ext : 'jpg';
}

// Replaces each photo's stored file path with a name inside the archive. Photos whose file is missing on this
// phone are kept as records (uri unchanged) and listed as missing, so the backup still describes the entry.
// photoRows: [{ id, uri }]. existsByUri: Map(uri -> boolean). Returns the rows to write and the files to pack.
export function planPhotos(photoRows, existsByUri) {
  const files = [];
  const archiveNameByUri = new Map();
  const rows = photoRows.map((row) => {
    if (!existsByUri.get(row.uri)) return { ...row, uri: `missing:${row.id}`, archived: false };
    if (!archiveNameByUri.has(row.uri)) {
      const name = `${PHOTO_PREFIX}p${String(files.length + 1).padStart(4, '0')}.${photoExtension(row.uri)}`;
      archiveNameByUri.set(row.uri, name);
      files.push({ archiveName: name, sourceUri: row.uri });
    }
    return { ...row, uri: archiveNameByUri.get(row.uri), archived: true };
  });
  return { rows, files, missingCount: rows.filter((r) => !r.archived).length };
}

// Checks an archive entry before any of its bytes are read. Throws a plain message the UI can show.
export function checkEntry(name, declaredSize, state) {
  if (name === ARCHIVE_JSON_NAME) return 'json';
  if (!PHOTO_ENTRY.test(name)) throw new Error(`The backup contains an unexpected file (${safeLabel(name)}).`);
  if (state.names.has(name)) throw new Error('The backup lists the same photo twice.');
  if (typeof declaredSize === 'number' && declaredSize > state.limits.maxPhotoBytes) {
    throw new Error('The backup contains a photo that is larger than allowed.');
  }
  state.names.add(name);
  if (state.names.size > state.limits.maxPhotos) throw new Error('The backup contains more photos than expected.');
  return 'photo';
}

export function newEntryState(limits = {}) {
  return { names: new Set(), photoBytes: 0, limits: { ...DEFAULT_LIMITS, ...limits } };
}

// Counts bytes as they arrive. Declared sizes in a zip can lie, so the real count is what is enforced.
export function addPhotoBytes(state, count, perPhotoSoFar) {
  state.photoBytes += count;
  if (perPhotoSoFar > state.limits.maxPhotoBytes) throw new Error('The backup contains a photo that is larger than allowed.');
  if (state.photoBytes > state.limits.maxTotalPhotoBytes) throw new Error('The backup is larger than allowed.');
}

function safeLabel(name) {
  return String(name).replace(/[^\w./-]/g, '?').slice(0, 40);
}

// After the photo list has been read from the JSON, every photo record must point at a file that is in the
// archive, or be a recorded missing photo. Returns the set of archive names the JSON refers to.
export function referencedPhotoNames(photoRows) {
  const names = new Set();
  for (const row of photoRows) {
    if (typeof row.uri !== 'string') throw new Error('The backup has a photo without a file reference.');
    if (row.uri.startsWith(PHOTO_PREFIX)) {
      if (!PHOTO_ENTRY.test(row.uri)) throw new Error('The backup has a photo with an unsafe file reference.');
      names.add(row.uri);
    } else if (!row.uri.startsWith('missing:')) {
      throw new Error('The backup has a photo with an unexpected file reference.');
    }
  }
  return names;
}
