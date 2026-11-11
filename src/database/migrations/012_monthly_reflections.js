// Monthly personal reflection: one row per calendar month ('YYYY-MM') holding the user's own words.
// Four optional prompts, at least one of which must have text. There is no score or rating on purpose.
// The row stands alone (no foreign keys), so deleting diary entries, habits or expenses never touches it.
export default {
  version: 12,
  name: 'monthly_reflections',
  sql: `
    CREATE TABLE monthly_reflections (
      id          TEXT PRIMARY KEY NOT NULL,
      month_key   TEXT NOT NULL UNIQUE
                    CHECK (month_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND substr(month_key, 6, 2) BETWEEN '01' AND '12'),
      went_well   TEXT CHECK (went_well IS NULL OR length(went_well) <= 2000),
      was_hard    TEXT CHECK (was_hard IS NULL OR length(was_hard) <= 2000),
      grateful_for TEXT CHECK (grateful_for IS NULL OR length(grateful_for) <= 2000),
      intention   TEXT CHECK (intention IS NULL OR length(intention) <= 2000),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      CHECK (
        length(trim(COALESCE(went_well, '') || COALESCE(was_hard, '') || COALESCE(grateful_for, '') || COALESCE(intention, ''))) > 0
      )
    );
  `,
};
