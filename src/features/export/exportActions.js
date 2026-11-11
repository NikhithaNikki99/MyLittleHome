// Screen-facing actions for exports and the complete backup. Wires the tested logic to the native glue.
import Constants from 'expo-constants';
import { getDatabase } from '../../database/client';
import { toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { refreshAfterRestore } from '../settings/afterRestore';
import { createArchive, inspectArchive, restoreArchive } from './archiveBackupService';
import { archiveFileName } from './archiveFormat';
import { buildAllCsvFiles } from './csvDatasets';
import {
  archiveSourceIo,
  createRestoreIo,
  isArchiveName,
  openArchiveForWriting,
  peekBytes,
  pickBackupFile,
  removeQuietly,
  shareArchive,
  shareTextFile,
} from './exportFiles';
import { reportFileName } from './reportHtml';
import { buildMonthlyReport } from './reportService';

const appVersion = () => Constants.expoConfig?.version ?? 'unknown';

// ---- complete backup (database + photos) ----
export async function exportCompleteBackup() {
  const db = await getDatabase();
  const out = openArchiveForWriting(archiveFileName());
  try {
    const result = await createArchive(db, { ...archiveSourceIo, writeOut: out.write }, { appVersion: appVersion() });
    out.close();
    await shareArchive(out.file);
    return result;
  } finally {
    try {
      out.close();
    } catch {
      // Already closed.
    }
    removeQuietly(out.dir);
  }
}

// Picks a file and checks it. Returns null if cancelled. Nothing on the phone changes here.
// A JSON backup is routed to the existing JSON path by the caller (kind: 'json'); an archive is inspected here.
export async function pickAndInspectBackup() {
  const picked = await pickBackupFile();
  if (!picked) return null;
  const start = peekBytes(picked.uri);
  if (!isArchiveName(picked.name, start)) return { kind: 'json', picked };

  const db = await getDatabase();
  const io = createRestoreIo(picked.uri);
  const inspected = await inspectArchive(db, io, picked.size ?? undefined);
  return { kind: 'archive', picked, io, inspected };
}

export async function confirmArchiveRestore({ io, inspected }) {
  const db = await getDatabase();
  const result = await restoreArchive(db, io, inspected);
  await refreshAfterRestore();
  return result;
}

export async function cancelArchiveRestore({ io }) {
  await io.discardStaging();
}

// ---- CSV ----
export async function exportCsv() {
  const db = await getDatabase();
  const files = (await buildAllCsvFiles(db)).filter((f) => f.rowCount > 0);
  if (files.length === 0) throw new ValidationError('There is nothing to export yet.');
  return files;
}

export async function shareCsv(file) {
  await shareTextFile(file.text, file.fileName, 'text/csv', `Save ${file.label}`);
}

// ---- PDF ----
export async function exportMonthlyPdf(monthKey) {
  let Print;
  try {
    Print = await import('expo-print');
  } catch {
    Print = null;
  }
  if (!Print?.printToFileAsync) {
    throw new ValidationError('PDF reports need the latest version of the app. Please update it, then try again.');
  }
  const db = await getDatabase();
  const html = await buildMonthlyReport(db, monthKey, { today: toDateKey() });
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const { File, Directory, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.cache, 'exports');
  dir.create({ intermediates: true, idempotent: true });
  const named = new File(dir, reportFileName(monthKey));
  removeQuietly(named);
  new File(uri).move(named);
  try {
    const Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) throw new ValidationError("Sharing isn't available on this device.");
    await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', dialogTitle: 'Save your monthly report' });
  } finally {
    removeQuietly(named);
  }
}
