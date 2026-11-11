export default {
  version: 1,
  name: 'app_settings',
  sql: `
    CREATE TABLE app_settings (
      key        TEXT PRIMARY KEY NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
