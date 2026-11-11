// Complete backup (database + photo files) as one .mlwbackup zip, and the restore that reads it back.
// All disk access goes through `io`, so the whole flow (including failures at each step) runs in Jest.
//
// Restore order. Nothing on the phone changes until every earlier step has succeeded:
//   1. read the archive: names, sizes and counts checked as bytes arrive; photos go to a staging area
//   2. validate backup.json with the same rules as a JSON backup
//   3. check that every photo record points at a staged photo (or is a recorded missing one)
//   4. replace the database in ONE transaction, with photo records rewritten to their final locations
//   5. move the staged photos into the photo folder and delete the files that are no longer referenced
// A failure in steps 1 to 4 leaves data and photos exactly as they were. Step 5 only moves files that step 4
// already points at; if a move fails, that photo shows the usual placeholder, and the rest of the restore stands.
import { readAllTables, readSchemaVersion, replaceAllTables } from '../../database/repositories/backupRepository';
import { nowIso } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { buildBackupDocument, summarizeCounts, validateBackupText } from '../settings/backupFormat';
import { planPhotos, referencedPhotoNames } from './archiveFormat';
import { readArchive, writeArchive } from './archiveZip';

function readableArchiveError(error) {
  if (error instanceof ValidationError) return error;
  return new ValidationError(error?.message?.length < 160 ? error.message : 'That backup file could not be read.');
}

// io: { fileExists(uri), readFileChunks(uri), writeOut(chunk) }
export async function createArchive(db, io, { appVersion }) {
  const [tables, schemaVersion] = await Promise.all([readAllTables(db), readSchemaVersion(db)]);

  const existsByUri = new Map();
  for (const row of tables.diary_photos) {
    if (!existsByUri.has(row.uri)) existsByUri.set(row.uri, await io.fileExists(row.uri));
  }
  const plan = planPhotos(tables.diary_photos, existsByUri);
  const doc = buildBackupDocument({
    tables: { ...tables, diary_photos: plan.rows.map(({ archived, ...row }) => row) },
    schemaVersion,
    appVersion,
    exportedAt: nowIso(),
  });

  const photoCount = await writeArchive({
    jsonText: JSON.stringify(doc),
    photos: plan.files.map((f) => ({ archiveName: f.archiveName, readChunks: () => io.readFileChunks(f.sourceUri) })),
    write: io.writeOut,
  });
  return { photoCount, missingPhotoCount: plan.missingCount };
}

// Reads and checks an archive without touching the phone's data. Photos are left in staging.
// io: { readArchiveChunks(), openStagedPhoto(name) -> sink, discardStaging() }
export async function inspectArchive(db, io, byteLength) {
  let result;
  try {
    result = await readArchive({ readChunks: io.readArchiveChunks, openPhoto: io.openStagedPhoto });
  } catch (error) {
    await io.discardStaging();
    throw readableArchiveError(error);
  }

  try {
    const currentSchemaVersion = await readSchemaVersion(db);
    const { doc, counts } = validateBackupText(result.jsonText, { currentSchemaVersion, byteLength });
    const wanted = referencedPhotoNames(doc.tables.diary_photos ?? []);
    for (const name of wanted) {
      if (!result.photoNames.has(name)) throw new ValidationError('The backup file is incomplete: a photo is missing from it.');
    }
    return {
      doc,
      counts,
      summary: [...summarizeCounts(counts), ...(result.photoNames.size ? [`${result.photoNames.size} photos`] : [])],
      exportedAt: doc.exported_at ?? null,
      stagedPhotoNames: result.photoNames,
    };
  } catch (error) {
    await io.discardStaging();
    throw readableArchiveError(error);
  }
}

// io (in addition to the above): { finalPhotoUri(name) -> uri, promoteStagedPhotos(names), listStoredPhotoUris(),
//   removePhoto(uri), discardStaging() }
export async function restoreArchive(db, io, inspected) {
  const { doc, counts } = inspected;
  const oldUris = await io.listStoredPhotoUris();

  const rewritten = {
    ...doc,
    tables: {
      ...doc.tables,
      diary_photos: (doc.tables.diary_photos ?? []).map((row) =>
        row.uri.startsWith('photos/') ? { ...row, uri: io.finalPhotoUri(row.uri) } : row,
      ),
    },
  };

  try {
    await replaceAllTables(db, rewritten);
  } catch (error) {
    await io.discardStaging();
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("That backup's data didn't pass the checks, so nothing was changed.");
  }

  // The database now describes the restored state. From here on a problem only affects individual photo files.
  let failedMoves = 0;
  try {
    failedMoves = (await io.promoteStagedPhotos([...inspected.stagedPhotoNames])) ?? 0;
  } catch {
    failedMoves = inspected.stagedPhotoNames.size;
  }
  const kept = new Set(rewritten.tables.diary_photos.map((r) => r.uri));
  for (const uri of oldUris) {
    if (kept.has(uri)) continue;
    try {
      await io.removePhoto(uri);
    } catch {
      // A leftover old photo wastes space but harms nothing.
    }
  }
  await io.discardStaging();
  return { counts, failedPhotoMoves: failedMoves };
}
