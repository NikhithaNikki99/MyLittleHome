import {
  deleteGoalRow,
  getGoalById,
  getGoalWithTotal,
  insertContribution,
  insertGoal,
  listContributions,
  listGoalsWithTotals,
  setGoalArchived,
  updateGoalRow,
} from '../../database/repositories/savingsRepository';
import { isValidDateKey, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { goalProgress } from './expenseMath';

const MAX_NAME_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const MAX_AMOUNT_PAISE = 100000000000;

function cleanGoal({ name, targetPaise, deadline }) {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) throw new ValidationError('Give your goal a name.');
  if (cleanName.length > MAX_NAME_LENGTH) throw new ValidationError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  if (!Number.isInteger(targetPaise) || targetPaise <= 0) throw new ValidationError('Enter a target above zero.');
  if (targetPaise > MAX_AMOUNT_PAISE) throw new ValidationError('That amount is too large.');
  const cleanDeadline = deadline ? deadline : null;
  if (cleanDeadline !== null && !isValidDateKey(cleanDeadline)) throw new ValidationError('That date is not valid.');
  return { name: cleanName, targetPaise, deadline: cleanDeadline };
}

function shape(row) {
  const progress = goalProgress(row.saved_paise, row.target_paise);
  return {
    id: row.id,
    name: row.name,
    targetPaise: row.target_paise,
    deadline: row.deadline,
    archived: row.archived === 1,
    savedPaise: row.saved_paise,
    contributionCount: row.contribution_count,
    ...progress,
  };
}

export async function createGoal(db, input) {
  await insertGoal(db, { id: newId(), ...cleanGoal(input), nowIso: nowIso() });
}

export async function updateGoal(db, id, input) {
  const changes = await updateGoalRow(db, { id, ...cleanGoal(input), nowIso: nowIso() });
  if (changes === 0) throw new ValidationError('That goal no longer exists.');
}

export async function addContribution(db, goalId, { amountPaise, contribDate = toDateKey(), note = null }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ValidationError('Enter an amount above zero.');
  if (amountPaise > MAX_AMOUNT_PAISE) throw new ValidationError('That amount is too large.');
  if (!isValidDateKey(contribDate)) throw new ValidationError('That date is not valid.');
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  if (cleanNote.length > MAX_NOTE_LENGTH) throw new ValidationError(`Keep notes under ${MAX_NOTE_LENGTH} characters.`);
  const goal = await getGoalById(db, goalId);
  if (!goal) throw new ValidationError('That goal no longer exists.');
  if (goal.archived) throw new ValidationError('Restore this goal before adding to it.');
  await insertContribution(db, {
    id: newId(),
    goalId,
    amountPaise,
    contribDate,
    note: cleanNote || null,
    nowIso: nowIso(),
  });
}

export async function archiveGoal(db, id, archived = true) {
  const changes = await setGoalArchived(db, id, archived, nowIso());
  if (changes === 0) throw new ValidationError('That goal no longer exists.');
}

export async function deleteGoal(db, id) {
  const changes = await deleteGoalRow(db, id);
  if (changes === 0) throw new ValidationError('That goal no longer exists.');
}

export async function getGoals(db) {
  const [active, archived] = await Promise.all([
    listGoalsWithTotals(db, { archived: false }),
    listGoalsWithTotals(db, { archived: true }),
  ]);
  return { active: active.map(shape), archived: archived.map(shape) };
}

export async function getGoalDetail(db, id) {
  const row = await getGoalWithTotal(db, id);
  if (!row) return null;
  return { ...shape(row), contributions: await listContributions(db, id) };
}
