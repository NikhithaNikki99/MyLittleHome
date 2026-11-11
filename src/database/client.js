import * as SQLite from 'expo-sqlite';
import { migrations } from './migrations';
import { runMigrations } from './migrationRunner';

export const DATABASE_NAME = 'my-little-world.db';

let dbPromise = null;

async function open() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  // Connection settings: foreign keys are off by default in SQLite and must be enabled per connection.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await runMigrations(db, migrations);
  return db;
}

// Single shared connection. A failed open is not cached, so a retry can succeed.
export function getDatabase() {
  if (!dbPromise) {
    dbPromise = open().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}
