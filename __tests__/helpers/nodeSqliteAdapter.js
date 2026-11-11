// Wraps node:sqlite to mimic the subset of the expo-sqlite async API used by the app,
// so migrations and queries are tested against a real SQLite engine.
const { DatabaseSync } = require('node:sqlite');

function toParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function createTestDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');

  const api = {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, ...args) {
      const r = raw.prepare(sql).run(...toParams(args));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getAllAsync(sql, ...args) {
      return raw.prepare(sql).all(...toParams(args));
    },
    async getFirstAsync(sql, ...args) {
      return raw.prepare(sql).get(...toParams(args)) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    async withExclusiveTransactionAsync(task) {
      raw.exec('BEGIN EXCLUSIVE');
      try {
        await task(api);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    async closeAsync() {
      raw.close();
    },
  };
  return api;
}

module.exports = { createTestDatabase };
