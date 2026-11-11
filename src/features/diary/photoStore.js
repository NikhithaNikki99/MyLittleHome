import { Directory, File, Paths } from 'expo-file-system';
import { newId } from '../../utils/id';

// Diary photos live in the app's private documents folder (not the gallery, not the cache),
// so they stay on this device and are not removed by the system when storage runs low.
const PHOTO_DIR_NAME = 'diary-photos';

function extensionOf(uri) {
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(uri ?? '');
  return match ? match[1].toLowerCase() : 'jpg';
}

function photoDirectory() {
  const dir = new Directory(Paths.document, PHOTO_DIR_NAME);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// Copies a picked image into the private folder and returns the stored file URI.
async function importPhoto(sourceUri) {
  const target = new File(photoDirectory(), `${newId()}.${extensionOf(sourceUri)}`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

async function removePhoto(uri) {
  const file = new File(uri);
  if (file.exists) file.delete();
}

export const photoFiles = { importPhoto, removePhoto };
