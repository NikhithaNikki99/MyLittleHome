// Native glue for exports and the complete backup: files, the share sheet and the file picker.
// Kept thin on purpose. Every rule (names, sizes, ordering, what is exported) lives in the tested pure modules;
// this file only moves bytes between disk and those modules. It uses the SDK 57 File / Directory API.
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { MAX_BACKUP_BYTES } from '../settings/backupFormat';

const READ_CHUNK = 256 * 1024;
const EXPORT_DIR = 'exports';
const STAGING_DIR = 'restore-staging';
const PHOTO_DIR = 'diary-photos';

function ensureDirectory(parent, name) {
  const dir = new Directory(parent, name);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function freshDirectory(parent, name) {
  const dir = new Directory(parent, name);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// ---- sharing ----
async function shareFile(file, mimeType, dialogTitle) {
  if (!(await Sharing.isAvailableAsync())) throw new ValidationError("Sharing isn't available on this device.");
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

// Text files (CSV) are written to the cache, shared, then removed.
export async function shareTextFile(text, fileName, mimeType, dialogTitle) {
  const dir = freshDirectory(Paths.cache, EXPORT_DIR);
  const file = new File(dir, fileName);
  file.create();
  file.write(text);
  try {
    await shareFile(file, mimeType, dialogTitle);
  } finally {
    removeQuietly(dir);
  }
}

export function removeQuietly(entry) {
  try {
    if (entry?.exists) entry.delete();
  } catch {
    // The system also clears the cache directory, so a leftover file is harmless.
  }
}

// ---- complete backup: writing ----
// Creates the archive file in the cache and returns it. The caller shares it and then removes `dir`.
export function openArchiveForWriting(fileName) {
  const dir = freshDirectory(Paths.cache, EXPORT_DIR);
  const file = new File(dir, fileName);
  file.create();
  const handle = file.open(FileMode.WriteOnly);
  return { dir, file, write: (chunk) => handle.writeBytes(chunk), close: () => handle.close() };
}

export function shareArchive(file) {
  return shareFile(file, 'application/zip', 'Save your My Little World backup');
}

// io pieces used by createArchive
export const archiveSourceIo = {
  fileExists: async (uri) => {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  },
  async *readFileChunks(uri) {
    const handle = new File(uri).open(FileMode.ReadOnly);
    try {
      while (handle.offset < handle.size) {
        yield handle.readBytes(Math.min(READ_CHUNK, handle.size - handle.offset));
      }
    } finally {
      handle.close();
    }
  },
};

// ---- complete backup: reading ----
export async function pickBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream', 'application/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name ?? '', size: asset.size ?? null };
}

// A JSON-only backup: read as text, with the size checked first. Same limit as before.
export async function readPickedText(picked) {
  assertSizeAllowed(picked.size, MAX_BACKUP_BYTES);
  const text = await new File(picked.uri).text();
  return { text, byteLength: picked.size ?? text.length, name: picked.name };
}

export function isArchiveName(name, bytesStart) {
  if (/\.mlwbackup$/i.test(name) || /\.zip$/i.test(name)) return true;
  // "PK" is how every zip starts, so a renamed file is still recognised by its content.
  return bytesStart?.[0] === 0x50 && bytesStart?.[1] === 0x4b;
}

export function peekBytes(uri, count = 4) {
  const handle = new File(uri).open(FileMode.ReadOnly);
  try {
    return handle.readBytes(Math.min(count, handle.size ?? count));
  } finally {
    handle.close();
  }
}

// io for inspectArchive/restoreArchive, bound to one picked file and one staging folder.
export function createRestoreIo(pickedUri) {
  let staging = freshDirectory(Paths.cache, STAGING_DIR);
  const photoDir = () => ensureDirectory(Paths.document, PHOTO_DIR);
  const stagedFile = (name) => new File(staging, name.replace('photos/', ''));
  // Stored under a new name, so a restored photo can never overwrite one that is still in use.
  const finalNames = new Map();
  const finalFileFor = (name) => {
    if (!finalNames.has(name)) finalNames.set(name, `${newId()}.${name.split('.').pop()}`);
    return new File(photoDir(), finalNames.get(name));
  };

  return {
    async *readArchiveChunks() {
      const handle = new File(pickedUri).open(FileMode.ReadOnly);
      try {
        while (handle.offset < handle.size) {
          yield handle.readBytes(Math.min(READ_CHUNK, handle.size - handle.offset));
        }
      } finally {
        handle.close();
      }
    },
    openStagedPhoto(name) {
      const file = stagedFile(name);
      file.create();
      const handle = file.open(FileMode.WriteOnly);
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          handle.close();
        }
      };
      return {
        write: (chunk) => handle.writeBytes(chunk),
        finish: close,
        abort: () => {
          close();
          removeQuietly(file);
        },
      };
    },
    async discardStaging() {
      removeQuietly(staging);
      staging = freshDirectory(Paths.cache, STAGING_DIR);
      removeQuietly(staging);
    },
    finalPhotoUri: (name) => finalFileFor(name).uri,
    async promoteStagedPhotos(names) {
      let failed = 0;
      for (const name of names) {
        try {
          stagedFile(name).move(finalFileFor(name));
        } catch {
          failed += 1;
        }
      }
      return failed;
    },
    async listStoredPhotoUris() {
      const dir = new Directory(Paths.document, PHOTO_DIR);
      if (!dir.exists) return [];
      return dir.list().filter((entry) => entry instanceof File).map((file) => file.uri);
    },
    async removePhoto(uri) {
      removeQuietly(new File(uri));
    },
  };
}

export function assertSizeAllowed(size, max) {
  if (typeof size === 'number' && size > max) throw new ValidationError('That file is too large to be a My Little World backup.');
}
