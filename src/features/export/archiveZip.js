// Streaming zip writer and reader on top of fflate (pure JavaScript, no native code).
// Both sides work through small callbacks, so disk access lives in archiveIO.js and this file runs unchanged in Jest.
// Photos are never held whole in memory: they pass through in chunks.
import { Unzip, UnzipInflate, UnzipPassThrough, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from 'fflate';
import { ARCHIVE_JSON_NAME, addPhotoBytes, checkEntry, newEntryState } from './archiveFormat';

const CHUNK = 256 * 1024;
const MAX_JSON_BYTES = 25 * 1024 * 1024;

// jsonText: the backup JSON. photos: [{ archiveName, readChunks: async function*() yielding Uint8Array }].
// write(chunk): receives zip bytes in order. Returns the number of photos written.
export async function writeArchive({ jsonText, photos, write }) {
  let failure = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else write(chunk);
  });

  const json = new ZipDeflate(ARCHIVE_JSON_NAME, { level: 6 });
  zip.add(json);
  json.push(strToU8(jsonText), true);

  let written = 0;
  for (const photo of photos) {
    if (failure) break;
    // Photos are already compressed (JPEG/PNG/WebP), so they are stored as they are.
    const entry = new ZipPassThrough(photo.archiveName);
    zip.add(entry);
    let pending = null;
    for await (const chunk of photo.readChunks()) {
      if (pending) entry.push(pending, false);
      pending = chunk;
    }
    entry.push(pending ?? new Uint8Array(0), true);
    written += 1;
  }
  if (failure) throw failure;
  zip.end();
  if (failure) throw failure;
  return written;
}

// Reads an archive and hands photos to `savePhoto`. Nothing is trusted until it has been checked:
// names against the strict pattern, sizes as bytes actually arrive, counts and totals against the limits.
// readChunks: async function*() yielding the archive bytes in order.
// savePhoto(name): returns { write(chunk), finish() } for one photo; abort(error) is called if reading fails.
// Resolves to { jsonText, photoNames: Set }.
export async function readArchive({ readChunks, openPhoto, limits }) {
  const state = newEntryState(limits);
  let jsonText = null;
  let failure = null;
  const jsonParts = [];
  let jsonBytes = 0;
  const open = [];
  const done = new Set();

  const fail = (error) => {
    if (!failure) failure = error instanceof Error ? error : new Error(String(error));
  };

  const unzip = new Unzip((file) => {
    if (failure) return;
    let kind;
    try {
      kind = checkEntry(file.name, file.originalSize, state);
    } catch (error) {
      fail(error);
      return;
    }

    if (kind === 'json') {
      file.ondata = (error, data, final) => {
        if (failure) return;
        if (error) return fail(error);
        jsonBytes += data.length;
        if (jsonBytes > MAX_JSON_BYTES) return fail(new Error('The backup data is larger than allowed.'));
        jsonParts.push(data);
        if (final) jsonText = strFromU8(concat(jsonParts, jsonBytes));
      };
    } else {
      let sink;
      try {
        sink = openPhoto(file.name);
      } catch (error) {
        fail(error);
        return;
      }
      open.push(sink);
      let size = 0;
      file.ondata = (error, data, final) => {
        if (failure) return;
        if (error) return fail(error);
        try {
          size += data.length;
          addPhotoBytes(state, data.length, size);
          sink.write(data);
          if (final) {
            sink.finish();
            done.add(file.name);
          }
        } catch (e) {
          fail(e);
        }
      };
    }
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  let sawAny = false;
  try {
    for await (const chunk of readChunks()) {
      sawAny = true;
      for (let i = 0; i < chunk.length && !failure; i += CHUNK) unzip.push(chunk.subarray(i, i + CHUNK), false);
      if (failure) break;
    }
    if (!failure) unzip.push(new Uint8Array(0), true);
  } catch (error) {
    fail(error);
  }

  if (!failure && !sawAny) fail(new Error("That file is empty, so it can't be a backup."));
  if (!failure && jsonText === null) fail(new Error("That file isn't a My Little World backup."));
  if (!failure) {
    for (const name of state.names) {
      if (!done.has(name)) {
        fail(new Error('The backup file is incomplete or damaged.'));
        break;
      }
    }
  }

  if (failure) {
    for (const sink of open) {
      try {
        sink.abort?.();
      } catch {
        // Cleanup is best effort; the caller also removes the staging folder.
      }
    }
    throw failure;
  }
  return { jsonText, photoNames: state.names };
}

function concat(parts, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
