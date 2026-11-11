import {
  deleteGoalById,
  deleteMilestoneById,
  getGoalRow,
  getMilestoneRow,
  insertGoal,
  insertMilestone,
  listGoalsWithCounts,
  listMilestones,
  setGoalCompletedAt,
  setMilestoneCompletedAt,
  updateGoalFields,
} from '../../database/repositories/goalRepository';
import { isValidDateKey, nowIso } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { goalProgress } from './goalProgress';

export const MAX_TITLE_LENGTH = 120;

function cleanGoalInput({ title, description, targetDate }) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) throw new ValidationError('Give your goal a name.');
  if (cleanTitle.length > MAX_TITLE_LENGTH) throw new ValidationError(`Keep the name under ${MAX_TITLE_LENGTH} characters.`);
  const date = targetDate ?? null;
  if (date !== null && !isValidDateKey(date)) throw new ValidationError('That date is not valid.');
  return {
    title: cleanTitle,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    targetDate: date,
  };
}

function mapGoal(r) {
  const completed = r.completed_at !== null;
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    targetDate: r.target_date ?? null,
    completed,
    milestoneTotal: Number(r.milestone_total ?? 0),
    milestoneDone: Number(r.milestone_done ?? 0),
    progress: goalProgress({
      milestoneTotal: Number(r.milestone_total ?? 0),
      milestoneDone: Number(r.milestone_done ?? 0),
      completed,
    }),
  };
}

export async function addGoal(db, { title, description = null, targetDate = null }) {
  const clean = cleanGoalInput({ title, description, targetDate });
  const id = newId();
  await insertGoal(db, { id, ...clean, nowIso: nowIso() });
  return id;
}

export async function updateGoal(db, goalId, { title, description = null, targetDate = null }) {
  if (!(await getGoalRow(db, goalId))) throw new ValidationError('That goal no longer exists.');
  const clean = cleanGoalInput({ title, description, targetDate });
  await updateGoalFields(db, { id: goalId, ...clean, nowIso: nowIso() });
}

export async function deleteGoal(db, goalId) {
  await deleteGoalById(db, goalId);
}

// Marks a goal complete, or reopens it. Completing never touches the milestones.
export async function toggleGoalComplete(db, goalId) {
  const goal = await getGoalRow(db, goalId);
  if (!goal) throw new ValidationError('That goal no longer exists.');
  const now = nowIso();
  await setGoalCompletedAt(db, goalId, goal.completed_at ? null : now, now);
}

export async function getGoals(db) {
  return (await listGoalsWithCounts(db)).map(mapGoal);
}

// One goal with its milestones in order, for the detail sheet.
export async function getGoalDetail(db, goalId) {
  const goal = await getGoalRow(db, goalId);
  if (!goal) return null;
  const milestones = (await listMilestones(db, goalId)).map((m) => ({
    id: m.id,
    title: m.title,
    done: m.completed_at !== null,
  }));
  const done = milestones.filter((m) => m.done).length;
  const completed = goal.completed_at !== null;
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description ?? null,
    targetDate: goal.target_date ?? null,
    completed,
    milestones,
    progress: goalProgress({ milestoneTotal: milestones.length, milestoneDone: done, completed }),
  };
}

export async function addMilestone(db, goalId, title) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) throw new ValidationError('Add a milestone name.');
  if (cleanTitle.length > MAX_TITLE_LENGTH) throw new ValidationError(`Keep the name under ${MAX_TITLE_LENGTH} characters.`);
  if (!(await getGoalRow(db, goalId))) throw new ValidationError('That goal no longer exists.');
  await insertMilestone(db, { id: newId(), goalId, title: cleanTitle, nowIso: nowIso() });
}

export async function toggleMilestone(db, milestoneId) {
  const m = await getMilestoneRow(db, milestoneId);
  if (!m) throw new ValidationError('That milestone no longer exists.');
  await setMilestoneCompletedAt(db, milestoneId, m.completed_at ? null : nowIso());
}

export async function deleteMilestone(db, milestoneId) {
  await deleteMilestoneById(db, milestoneId);
}
