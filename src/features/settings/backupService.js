import { readAllTables, readSchemaVersion, replaceAllTables } from '../../database/repositories/backupRepository';
import { nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { buildBackupDocument, summarizeCounts, validateBackupText } from './backupFormat';

export function backupFileName(date = new Date()) {
  return `my-little-world-backup-${toDateKey(date)}.json`;
}

// Returns the backup as JSON text. Photo image files are not included, only their records.
export async function createBackupText(db, { appVersion }) {
  const [tables, schemaVersion] = await Promise.all([readAllTables(db), readSchemaVersion(db)]);
  const doc = buildBackupDocument({ tables, schemaVersion, appVersion, exportedAt: nowIso() });
  return JSON.stringify(doc);
}

// Validation only: lets the UI show counts and ask for confirmation before anything changes.
export async function inspectBackupText(db, text, byteLength) {
  const currentSchemaVersion = await readSchemaVersion(db);
  const { doc, counts } = validateBackupText(text, { currentSchemaVersion, byteLength });
  return { doc, counts, summary: summarizeCounts(counts), exportedAt: doc.exported_at ?? null };
}

// Replaces everything on this phone with the backup, atomically.
export async function restoreFromText(db, text, byteLength) {
  const { doc, counts } = await inspectBackupText(db, text, byteLength);
  try {
    await replaceAllTables(db, doc);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    // SQLite constraint or foreign-key failure: the file was well-formed but its data is not valid.
    throw new ValidationError("That backup's data didn't pass the checks, so nothing was changed.");
  }
  return counts;
}
