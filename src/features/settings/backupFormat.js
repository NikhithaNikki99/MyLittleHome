// Backup file format: allowlisted tables and columns, strict validation. Pure (no native modules).
// Tables are listed parents-first; restore deletes in reverse order and inserts in this order.
// Deliberately excluded: schema_migrations (managed by the app) and the app lock (it lives in
// secure-store, and app_settings rows for it are filtered out below).
import { ValidationError } from '../../utils/errors';

export const BACKUP_FORMAT = 'my-little-world-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export const MAX_ROWS_PER_TABLE = 200000;

const T = 'text';
const I = 'int';
const R = 'real';

// type: text | int | real. `nullable` columns accept null. Order of columns is the order exported.
export const BACKUP_TABLES = [
  { name: 'app_settings', columns: { key: [T], value: [T], updated_at: [T] } },
  {
    name: 'mood_logs',
    columns: { id: [T], log_date: [T], mood: [I], note: [T, true], created_at: [T], updated_at: [T] },
  },
  {
    name: 'water_logs',
    columns: { id: [T], log_date: [T], amount_ml: [I], logged_at: [T], created_at: [T] },
  },
  {
    name: 'weight_entries',
    columns: { id: [T], entry_date: [T], weight_kg: [R], note: [T, true], created_at: [T], updated_at: [T] },
  },
  {
    name: 'expense_categories',
    columns: { id: [T], name: [T], icon: [T], is_default: [I], archived: [I], sort_order: [I], created_at: [T] },
  },
  {
    name: 'transactions',
    columns: {
      id: [T], kind: [T], title: [T], amount_paise: [I], category_id: [T], txn_date: [T],
      notes: [T, true], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'recurring_expenses',
    columns: {
      id: [T], title: [T], amount_paise: [I], category_id: [T], frequency: [T], start_date: [T],
      end_date: [T, true], is_active: [I], notes: [T, true], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'recurring_expense_occurrences',
    columns: {
      id: [T], recurring_id: [T], due_date: [T], status: [T], transaction_id: [T, true], created_at: [T],
    },
  },
  {
    name: 'habits',
    columns: {
      id: [T], name: [T], icon: [T], color: [T], target_count: [I], start_date: [T],
      archived: [I], created_at: [T], updated_at: [T],
    },
  },
  { name: 'habit_schedule_days', columns: { habit_id: [T], weekday: [I] } },
  {
    name: 'habit_logs',
    columns: { id: [T], habit_id: [T], log_date: [T], count: [I], created_at: [T], updated_at: [T] },
  },
  {
    name: 'tasks',
    columns: {
      id: [T], title: [T], description: [T, true], due_date: [T, true], priority: [I],
      completed_at: [T, true], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'diary_entries',
    columns: {
      id: [T], title: [T, true], content: [T], entry_date: [T], entry_time: [T], mood: [I, true],
      is_favorite: [I], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'diary_photos',
    columns: {
      id: [T], entry_id: [T], uri: [T], width: [I, true], height: [I, true], sort_order: [I], created_at: [T],
    },
  },
  { name: 'diary_tags', columns: { id: [T], name: [T], created_at: [T] } },
  { name: 'entry_tags', columns: { entry_id: [T], tag_id: [T] } },
  {
    name: 'budgets',
    columns: {
      id: [T], month: [T], category_id: [T, true], limit_paise: [I], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'savings_goals',
    columns: {
      id: [T], name: [T], target_paise: [I], deadline: [T, true], archived: [I], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'savings_contributions',
    columns: { id: [T], goal_id: [T], amount_paise: [I], contrib_date: [T], note: [T, true], created_at: [T] },
  },
  {
    name: 'sleep_logs',
    columns: {
      id: [T], log_date: [T], minutes: [I], quality: [I, true], note: [T, true], created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'goals',
    columns: {
      id: [T], title: [T], description: [T, true], target_date: [T, true], completed_at: [T, true],
      created_at: [T], updated_at: [T],
    },
  },
  {
    name: 'goal_milestones',
    columns: {
      id: [T], goal_id: [T], title: [T], sort_order: [I], completed_at: [T, true], created_at: [T],
    },
  },
];

const TABLE_BY_NAME = Object.fromEntries(BACKUP_TABLES.map((t) => [t.name, t]));

// Per-phone settings never travel in a backup: the app-lock flags describe this phone's lock, and a
// restored "reminder on" would have no matching notification schedule or permission.
export const EXCLUDED_SETTING_KEYS = new Set([
  'app_lock_enabled',
  'app_lock_biometrics',
  'reminder_diary',
  'reminder_water',
  'reminder_habits',
]);

export function columnNames(table) {
  return Object.keys(TABLE_BY_NAME[table].columns);
}

export function buildBackupDocument({ tables, schemaVersion, appVersion, exportedAt }) {
  const out = {};
  for (const t of BACKUP_TABLES) {
    let rows = tables[t.name] ?? [];
    if (t.name === 'app_settings') rows = rows.filter((r) => !EXCLUDED_SETTING_KEYS.has(r.key));
    const cols = Object.keys(t.columns);
    out[t.name] = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    schema_version: schemaVersion,
    app_version: appVersion,
    exported_at: exportedAt,
    tables: out,
  };
}

function fail(message) {
  throw new ValidationError(message);
}

function checkValue(table, column, value, [type, nullable]) {
  if (value === null || value === undefined) {
    if (!nullable) fail(`This backup has a missing value in ${table}.${column}.`);
    return;
  }
  if (type === 'text' && typeof value !== 'string') fail(`This backup has an unexpected value in ${table}.${column}.`);
  if (type === 'int' && !Number.isSafeInteger(value)) fail(`This backup has an unexpected value in ${table}.${column}.`);
  if (type === 'real' && (typeof value !== 'number' || !Number.isFinite(value))) {
    fail(`This backup has an unexpected value in ${table}.${column}.`);
  }
}

// Throws ValidationError with a user-safe message. Returns { doc, counts } on success.
// The database's own CHECK/FOREIGN KEY constraints are the final gate during restore; this
// catches the obviously wrong files early with clear messages.
export function validateBackupText(text, { currentSchemaVersion, byteLength }) {
  if (typeof text !== 'string' || text.length === 0) fail("That file is empty, so it can't be a backup.");
  if ((byteLength ?? text.length) > MAX_BACKUP_BYTES) fail('That file is too large to be a My Little World backup.');

  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    fail("That file isn't a My Little World backup (it couldn't be read).");
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.format !== BACKUP_FORMAT) {
    fail("That file isn't a My Little World backup.");
  }
  if (doc.format_version !== BACKUP_FORMAT_VERSION) {
    fail('This backup was made by a different version of the backup format and cannot be restored here.');
  }
  if (!Number.isInteger(doc.schema_version) || doc.schema_version < 1) {
    fail('This backup is missing its version information.');
  }
  if (doc.schema_version > currentSchemaVersion) {
    fail('This backup was made by a newer version of the app. Please update the app, then try again.');
  }
  if (!doc.tables || typeof doc.tables !== 'object' || Array.isArray(doc.tables)) {
    fail("That backup doesn't contain any data.");
  }

  for (const name of Object.keys(doc.tables)) {
    if (!TABLE_BY_NAME[name]) fail(`This backup contains data this app doesn't recognise (${name}).`);
  }

  const counts = {};
  for (const t of BACKUP_TABLES) {
    const rows = doc.tables[t.name] ?? [];
    if (!Array.isArray(rows)) fail(`This backup has an unexpected layout for ${t.name}.`);
    if (rows.length > MAX_ROWS_PER_TABLE) fail('This backup has more data than expected.');
    const allowed = Object.keys(t.columns);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`This backup has an unexpected row in ${t.name}.`);
      for (const key of Object.keys(row)) {
        if (!allowed.includes(key)) fail(`This backup has an unexpected field (${t.name}.${key}).`);
      }
      for (const col of allowed) checkValue(t.name, col, row[col], t.columns[col]);
    }
    counts[t.name] = rows.length;
  }
  return { doc, counts };
}

// Friendly summary lines for the confirmation sheet.
export function summarizeCounts(counts) {
  const parts = [
    ['diary entries', counts.diary_entries],
    ['expenses and income', counts.transactions],
    ['subscriptions', counts.recurring_expenses],
    ['habits', counts.habits],
    ['to-dos', counts.tasks],
    ['goals', counts.goals],
    ['water logs', counts.water_logs],
    ['weight entries', counts.weight_entries],
    ['mood check-ins', counts.mood_logs],
    ['sleep logs', counts.sleep_logs],
  ];
  return parts.filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}`);
}
