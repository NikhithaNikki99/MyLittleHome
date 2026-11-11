// Savings goals. The saved amount is never stored: it is always SUM(contributions), so it cannot drift.

export async function insertGoal(db, g) {
  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_paise, deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [g.id, g.name, g.targetPaise, g.deadline ?? null, g.nowIso, g.nowIso],
  );
}

export async function getGoalById(db, id) {
  return db.getFirstAsync('SELECT id, name, target_paise, deadline, archived FROM savings_goals WHERE id = ?', [id]);
}

export async function updateGoalRow(db, g) {
  const result = await db.runAsync(
    'UPDATE savings_goals SET name = ?, target_paise = ?, deadline = ?, updated_at = ? WHERE id = ?',
    [g.name, g.targetPaise, g.deadline ?? null, g.nowIso, g.id],
  );
  return result.changes;
}

export async function setGoalArchived(db, id, archived, nowIso) {
  const result = await db.runAsync('UPDATE savings_goals SET archived = ?, updated_at = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowIso,
    id,
  ]);
  return result.changes;
}

// Contributions cascade away with the goal (foreign key ON DELETE CASCADE).
export async function deleteGoalRow(db, id) {
  const result = await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
  return result.changes;
}

export async function insertContribution(db, c) {
  await db.runAsync(
    `INSERT INTO savings_contributions (id, goal_id, amount_paise, contrib_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [c.id, c.goalId, c.amountPaise, c.contribDate, c.note ?? null, c.nowIso],
  );
}

// Goals with their saved total and contribution count. `archived` selects the active or the archived list.
export async function listGoalsWithTotals(db, { archived }) {
  return db.getAllAsync(
    `SELECT g.id, g.name, g.target_paise, g.deadline, g.archived, g.created_at,
            COALESCE(SUM(c.amount_paise), 0) AS saved_paise, COUNT(c.id) AS contribution_count
     FROM savings_goals g LEFT JOIN savings_contributions c ON c.goal_id = g.id
     WHERE g.archived = ?
     GROUP BY g.id
     ORDER BY g.created_at, g.name`,
    [archived ? 1 : 0],
  );
}

export async function getGoalWithTotal(db, id) {
  return db.getFirstAsync(
    `SELECT g.id, g.name, g.target_paise, g.deadline, g.archived,
            COALESCE(SUM(c.amount_paise), 0) AS saved_paise, COUNT(c.id) AS contribution_count
     FROM savings_goals g LEFT JOIN savings_contributions c ON c.goal_id = g.id
     WHERE g.id = ?
     GROUP BY g.id`,
    [id],
  );
}

export async function listContributions(db, goalId, limit = 20) {
  return db.getAllAsync(
    `SELECT id, amount_paise, contrib_date, note FROM savings_contributions
     WHERE goal_id = ? ORDER BY contrib_date DESC, created_at DESC LIMIT ?`,
    [goalId, limit],
  );
}
