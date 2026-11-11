// What each CSV file contains. Columns are listed explicitly (an allowlist) so a column added to a table later is
// never exported by accident. Nothing here reads app settings, so no lock, PIN or reminder data can appear.
import { buildCsv, paiseToDecimal } from './csv';

const MOOD_LABELS = { 1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };

export const CSV_DATASETS = [
  {
    key: 'expenses',
    fileName: 'expenses.csv',
    label: 'Expenses and income',
    sql: `SELECT t.txn_date, t.kind, t.title, t.amount_paise, c.name AS category, t.notes
          FROM transactions t JOIN expense_categories c ON c.id = t.category_id
          ORDER BY t.txn_date, t.created_at`,
    columns: [
      { header: 'Date', value: (r) => r.txn_date },
      { header: 'Type', value: (r) => r.kind },
      { header: 'Title', value: (r) => r.title },
      { header: 'Amount (INR)', value: (r) => paiseToDecimal(r.amount_paise) },
      { header: 'Category', value: (r) => r.category },
      { header: 'Notes', value: (r) => r.notes },
    ],
  },
  {
    key: 'subscriptions',
    fileName: 'subscriptions.csv',
    label: 'Subscriptions',
    sql: `SELECT r.title, r.amount_paise, c.name AS category, r.frequency, r.start_date, r.end_date, r.is_active, r.notes
          FROM recurring_expenses r JOIN expense_categories c ON c.id = r.category_id
          ORDER BY r.title COLLATE NOCASE`,
    columns: [
      { header: 'Name', value: (r) => r.title },
      { header: 'Amount (INR)', value: (r) => paiseToDecimal(r.amount_paise) },
      { header: 'Category', value: (r) => r.category },
      { header: 'Repeats', value: (r) => r.frequency },
      { header: 'Starts', value: (r) => r.start_date },
      { header: 'Ends', value: (r) => r.end_date },
      { header: 'Status', value: (r) => (r.is_active === 1 ? 'active' : 'paused') },
      { header: 'Notes', value: (r) => r.notes },
    ],
  },
  {
    key: 'diary',
    fileName: 'diary.csv',
    label: 'Diary entries',
    sql: `SELECT e.entry_date, e.entry_time, e.title, e.content, e.mood, e.is_favorite,
                (SELECT GROUP_CONCAT(g.name, '; ') FROM entry_tags et JOIN diary_tags g ON g.id = et.tag_id
                 WHERE et.entry_id = e.id) AS tags,
                (SELECT COUNT(*) FROM diary_photos p WHERE p.entry_id = e.id) AS photo_count
          FROM diary_entries e ORDER BY e.entry_date, e.entry_time`,
    columns: [
      { header: 'Date', value: (r) => r.entry_date },
      { header: 'Time', value: (r) => r.entry_time },
      { header: 'Title', value: (r) => r.title },
      { header: 'Entry', value: (r) => r.content },
      { header: 'Mood', value: (r) => (r.mood ? MOOD_LABELS[r.mood] ?? r.mood : '') },
      { header: 'Favourite', value: (r) => (r.is_favorite === 1 ? 'yes' : '') },
      { header: 'Tags', value: (r) => r.tags },
      { header: 'Photos', value: (r) => r.photo_count },
    ],
  },
  {
    key: 'habits',
    fileName: 'habit-logs.csv',
    label: 'Habit check-ins',
    sql: `SELECT l.log_date, h.name, l.count, h.target_count
          FROM habit_logs l JOIN habits h ON h.id = l.habit_id ORDER BY l.log_date, h.name`,
    columns: [
      { header: 'Date', value: (r) => r.log_date },
      { header: 'Habit', value: (r) => r.name },
      { header: 'Done', value: (r) => r.count },
      { header: 'Target per day', value: (r) => r.target_count },
    ],
  },
  {
    key: 'wellness',
    fileName: 'wellness.csv',
    label: 'Mood, water, weight and sleep',
    sql: `SELECT d AS day, kind, value, detail FROM (
            SELECT log_date AS d, 'mood' AS kind, mood AS value, note AS detail FROM mood_logs
            UNION ALL SELECT log_date, 'water_ml', SUM(amount_ml), NULL FROM water_logs GROUP BY log_date
            UNION ALL SELECT entry_date, 'weight_kg', weight_kg, note FROM weight_entries
            UNION ALL SELECT log_date, 'sleep_minutes', minutes, note FROM sleep_logs
          ) ORDER BY day, kind`,
    columns: [
      { header: 'Date', value: (r) => r.day },
      { header: 'Measure', value: (r) => r.kind },
      { header: 'Value', value: (r) => (r.kind === 'mood' ? `${r.value} (${MOOD_LABELS[r.value] ?? ''})`.trim() : r.value) },
      { header: 'Note', value: (r) => r.detail },
    ],
  },
  {
    key: 'tasks',
    fileName: 'todos.csv',
    label: 'To-dos',
    sql: 'SELECT title, description, due_date, priority, completed_at FROM tasks ORDER BY COALESCE(due_date, \'9999\'), created_at',
    columns: [
      { header: 'Title', value: (r) => r.title },
      { header: 'Details', value: (r) => r.description },
      { header: 'Due', value: (r) => r.due_date },
      { header: 'Priority', value: (r) => r.priority },
      { header: 'Done on', value: (r) => (r.completed_at ? r.completed_at.slice(0, 10) : '') },
    ],
  },
  {
    key: 'reflections',
    fileName: 'monthly-reflections.csv',
    label: 'Monthly reflections',
    sql: 'SELECT month_key, went_well, was_hard, grateful_for, intention FROM monthly_reflections ORDER BY month_key',
    columns: [
      { header: 'Month', value: (r) => r.month_key },
      { header: 'What went well', value: (r) => r.went_well },
      { header: 'What was hard', value: (r) => r.was_hard },
      { header: 'Grateful for', value: (r) => r.grateful_for },
      { header: 'Intention', value: (r) => r.intention },
    ],
  },
];

export async function buildCsvFile(db, dataset) {
  const rows = await db.getAllAsync(dataset.sql);
  return { fileName: dataset.fileName, label: dataset.label, rowCount: rows.length, text: buildCsv(dataset.columns, rows) };
}

// Every dataset, including empty ones, so the set of files is predictable.
export async function buildAllCsvFiles(db) {
  const files = [];
  for (const dataset of CSV_DATASETS) files.push(await buildCsvFile(db, dataset));
  return files;
}
