export async function insertTask(db, t) {
  await db.runAsync(
    `INSERT INTO tasks (id, title, description, due_date, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.title, t.description ?? null, t.dueDate ?? null, t.priority, t.nowIso, t.nowIso],
  );
}

export async function getTaskById(db, id) {
  return db.getFirstAsync('SELECT id, title, due_date, priority, completed_at FROM tasks WHERE id = ?', [id]);
}

export async function getTaskDetail(db, id) {
  return db.getFirstAsync(
    'SELECT id, title, description, due_date, priority, completed_at FROM tasks WHERE id = ?',
    [id],
  );
}

export async function setTaskCompletedAt(db, id, completedAt, nowIso) {
  await db.runAsync('UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?', [completedAt, nowIso, id]);
}

export async function updateTaskFields(db, t) {
  await db.runAsync(
    'UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, updated_at = ? WHERE id = ?',
    [t.title, t.description ?? null, t.dueDate ?? null, t.priority, t.nowIso, t.id],
  );
}

export async function deleteTaskById(db, id) {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}

// Today's list: open tasks due today or earlier, plus tasks completed today (so ticking one
// off does not make it vanish). `dayStartIso`/`dayEndIso` bound "completed today" as instants.
export async function listTasksForToday(db, dateKey, dayStartIso, dayEndIso) {
  return db.getAllAsync(
    `SELECT id, title, due_date, priority, completed_at FROM tasks
     WHERE (completed_at IS NULL AND due_date IS NOT NULL AND due_date <= ?)
        OR (completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?)
     ORDER BY (completed_at IS NOT NULL), priority, due_date, created_at`,
    [dateKey, dayStartIso, dayEndIso],
  );
}

// Planner "Today" tab: open tasks due today or earlier, open undated ("someday") tasks, anything dated
// today (even if ticked off earlier), and tasks completed today.
export async function listPlannerToday(db, dateKey, dayStartIso, dayEndIso) {
  return db.getAllAsync(
    `SELECT id, title, description, due_date, priority, completed_at FROM tasks
     WHERE (completed_at IS NULL AND (due_date IS NULL OR due_date <= ?))
        OR due_date = ?
        OR (completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?)
     ORDER BY (completed_at IS NOT NULL), priority, due_date, created_at`,
    [dateKey, dateKey, dayStartIso, dayEndIso],
  );
}

export async function listTasksDueOn(db, dateKey) {
  return db.getAllAsync(
    `SELECT id, title, description, due_date, priority, completed_at FROM tasks
     WHERE due_date = ?
     ORDER BY (completed_at IS NOT NULL), priority, created_at`,
    [dateKey],
  );
}

// Per-day counts over the half-open range [start, endExclusive).
export async function countTasksByDueDate(db, start, endExclusive) {
  return db.getAllAsync(
    `SELECT due_date, COUNT(*) AS total,
            SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS open_count
     FROM tasks
     WHERE due_date >= ? AND due_date < ?
     GROUP BY due_date
     ORDER BY due_date`,
    [start, endExclusive],
  );
}
