// Native glue for backup: write to cache, share sheet, pick a file. Kept thin and separate from
// backupService so the logic stays testable without native modules. Uses the SDK 57 File API.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MAX_BACKUP_BYTES } from './backupFormat';
import { ValidationError } from '../../utils/errors';

export async function shareBackupText(text, fileName) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ValidationError("Sharing isn't available on this device.");
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your My Little World backup',
  });
  return file;
}

// Returns null if the user cancelled, else { text, byteLength, name }.
export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (typeof asset.size === 'number' && asset.size > MAX_BACKUP_BYTES) {
    throw new ValidationError('That file is too large to be a My Little World backup.');
  }
  const file = new File(asset.uri);
  const text = await file.text();
  return { text, byteLength: asset.size ?? text.length, name: asset.name };
}

// The export copy in the cache directory is only needed while sharing; remove it afterwards.
export function removeCachedFile(file) {
  try {
    if (file?.exists) file.delete();
  } catch {
    // Cache cleanup is best effort; the system also clears the cache directory.
  }
}
