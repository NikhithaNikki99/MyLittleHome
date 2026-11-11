// One sleep record per local date (the date you woke up). Duration in minutes; quality 1-5 optional.
export default {
  version: 8,
  name: 'sleep',
  sql: `
    CREATE TABLE sleep_logs (
      id           TEXT PRIMARY KEY NOT NULL,
      log_date     TEXT NOT NULL UNIQUE CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      minutes      INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
      quality      INTEGER CHECK (quality IS NULL OR quality BETWEEN 1 AND 5),
      note         TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
  `,
};
