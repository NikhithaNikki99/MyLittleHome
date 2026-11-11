export async function insertGoal(db, g) {
  await db.runAsync(
    `INSERT INTO goals (id, title, description, target_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [g.id, g.title, g.description ?? null, g.targetDate ?? null, g.nowIso, g.nowIso],
  );
}

export async function getGoalRow(db, id) {
  return db.getFirstAsync(
    'SELECT id, title, description, target_date, completed_at, created_at FROM goals WHERE id = ?',
    [id],
  );
}

export async function updateGoalFields(db, g) {
  await db.runAsync('UPDATE goals SET title = ?, description = ?, target_date = ?, updated_at = ? WHERE id = ?', [
    g.title,
    g.description ?? null,
    g.targetDate ?? null,
    g.nowIso,
    g.id,
  ]);
}

export async function setGoalCompletedAt(db, id, completedAt, nowIso) {
  await db.runAsync('UPDATE goals SET completed_at = ?, updated_at = ? WHERE id = ?', [completedAt, nowIso, id]);
}

// Milestones are removed by ON DELETE CASCADE (foreign keys are enabled on the app connection).
export async function deleteGoalById(db, id) {
  await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
}

// Open goals first (nearest target date first, undated last), then completed ones, newest first.
export async function listGoalsWithCounts(db) {
  return db.getAllAsync(
    `SELECT g.id, g.title, g.description, g.target_date, g.completed_at, g.created_at,
            COUNT(m.id) AS milestone_total,
            COALESCE(SUM(CASE WHEN m.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS milestone_done
     FROM goals g
     LEFT JOIN goal_milestones m ON m.goal_id = g.id
     GROUP BY g.id
     ORDER BY (g.completed_at IS NOT NULL),
              CASE WHEN g.completed_at IS NULL THEN (g.target_date IS NULL) END,
              CASE WHEN g.completed_at IS NULL THEN g.target_date END,
              CASE WHEN g.completed_at IS NULL THEN g.created_at END,
              g.completed_at DESC`,
  );
}

export async function listMilestones(db, goalId) {
  return db.getAllAsync(
    `SELECT id, goal_id, title, sort_order, completed_at FROM goal_milestones
     WHERE goal_id = ?
     ORDER BY sort_order, created_at`,
    [goalId],
  );
}

export async function getMilestoneRow(db, id) {
  return db.getFirstAsync('SELECT id, goal_id, title, sort_order, completed_at FROM goal_milestones WHERE id = ?', [
    id,
  ]);
}

// The next sort_order is read and used inside one transaction so two quick adds cannot collide.
export async function insertMilestone(db, m) {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM goal_milestones WHERE goal_id = ?',
      [m.goalId],
    );
    await db.runAsync(
      `INSERT INTO goal_milestones (id, goal_id, title, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [m.id, m.goalId, m.title, row.next, m.nowIso],
    );
  });
}

export async function setMilestoneCompletedAt(db, id, completedAt) {
  await db.runAsync('UPDATE goal_milestones SET completed_at = ? WHERE id = ?', [completedAt, id]);
}

export async function deleteMilestoneById(db, id) {
  await db.runAsync('DELETE FROM goal_milestones WHERE id = ?', [id]);
}
